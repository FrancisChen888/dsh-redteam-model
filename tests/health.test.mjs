import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { inspectHealth } from '../lib/index.js'

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'redteam-health-'))
  const put = (file, text) => { const f = path.join(root, file); mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, text) }
  // Host-plane plugins declare `dsh.bundle`; the plane is read from the
  // manifest, so a fixture without it would not be required at boot.
  put('plugins/dsh-hunter/package.json', '{"name":"dsh-hunter","version":"1.0.0","dsh":{"bundle":{"patch":"./cordis.patch.yml"}}}')
  put('modes/redteam/preset.yml', 'name: redteam\n')
  put('important.dat', 'retained')
  put('lib/package-integrity.json', JSON.stringify({ files: { 'important.dat': createHash('sha256').update('retained').digest('hex') } }))
  const host = path.join(root, 'host')
  for (const pkg of ['cordis', 'dsh-settings', 'dsh-tools', 'dsh']) {
    const dir = path.join(host, 'node_modules', '@deepseek-ai', pkg)
    mkdirSync(dir, { recursive: true }); writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: pkg === 'dsh' ? '0.2.2-rc.1' : '1' }))
  }
  const prev = process.env.DSH_RUNTIME_DIR; process.env.DSH_RUNTIME_DIR = host
  const ctx = {
    loader: { entries: () => [{ id: 'include:bundled-dsh-hunter:dsh-hunter', fiber: { state: 2 } }] },
    agentPresets: { async acquireScope() { return { key: {}, async [Symbol.asyncDispose]() {} } } },
    subagents: { list() { return ['codex-redteam', 'claude-code'] } },
    skills: { async list() { return [{ name: 'router-playbook' }] }, async get() { return { description: 'Router', content: 'Workflow' } } },
    systemPrompt: { async assemble() { return { sections: [{ name: 'persona', text: 'Model: {{model}}' }], contexts: [], tools: [], variables: { model: undefined, provider: undefined } } } },
  }
  return { root, ctx, cleanup() { if (prev === undefined) delete process.env.DSH_RUNTIME_DIR; else process.env.DSH_RUNTIME_DIR = prev; rmSync(root, { recursive: true, force: true }) } }
}

test('health verifies bundle, host version and live component/preset state', async () => {
  const f = fixture()
  try { const h = await inspectHealth(f.ctx, f.root); assert.equal(h.hostVersion, '0.2.2-rc.1'); assert.equal(h.bundleIntegrity, 'complete'); assert.equal(h.runtimeHealth, 'healthy') } finally { f.cleanup() }
})
test('missing files are reported incomplete', async () => {
  const f = fixture()
  try { rmSync(path.join(f.root, 'important.dat')); assert.equal((await inspectHealth(f.ctx, f.root)).bundleIntegrity, 'incomplete') } finally { f.cleanup() }
})
test('a forced refresh rechecks cached files', async () => {
  const f = fixture()
  try {
    assert.equal((await inspectHealth(f.ctx, f.root)).bundleIntegrity, 'complete')
    rmSync(path.join(f.root, 'important.dat'))
    assert.equal((await inspectHealth(f.ctx, f.root, true)).bundleIntegrity, 'incomplete')
  } finally { f.cleanup() }
})
test('missing host component is unhealthy', async () => {
  const f = fixture()
  try { f.ctx.loader.entries = () => []; assert.equal((await inspectHealth(f.ctx, f.root)).runtimeHealth, 'unhealthy') } finally { f.cleanup() }
})
test('a missing redteam subagent provider is unhealthy', async () => {
  const f = fixture()
  f.ctx.subagents.list = () => ['codex', 'claude-code']
  try {
    const h = await inspectHealth(f.ctx, f.root)
    assert.equal(h.runtimeHealth, 'unhealthy')
    assert.match(h.details.join(' '), /codex-redteam/)
  } finally { f.cleanup() }
})
test('missing loader state remains unknown', async () => {
  const f = fixture()
  try { assert.equal((await inspectHealth({}, f.root)).runtimeHealth, 'unknown') } finally { f.cleanup() }
})
test('a missing workflow skill makes the runtime unhealthy', async () => {
  const f = fixture()
  f.ctx.skills.list = async () => []
  try {
    const h = await inspectHealth(f.ctx, f.root)
    assert.equal(h.runtimeHealth, 'unhealthy')
    assert.match(h.details.join(' '), /router-playbook/)
  } finally { f.cleanup() }
})
test('an unreadable workflow skill makes the runtime unhealthy', async () => {
  const f = fixture()
  f.ctx.skills.get = async () => undefined
  try { assert.equal((await inspectHealth(f.ctx, f.root)).runtimeHealth, 'unhealthy') } finally { f.cleanup() }
})
test('unregistered prompt variables are reported as unhealthy', async () => {
  const f = fixture()
  f.ctx.systemPrompt.assemble = async () => ({ sections: [{ name: 'persona', text: '{{cwd}}' }], contexts: [], tools: [], variables: { model: undefined, provider: undefined } })
  try {
    const h = await inspectHealth(f.ctx, f.root)
    assert.equal(h.runtimeHealth, 'unhealthy')
    assert.match(h.details.join(' '), /unknown prompt variable/)
  } finally { f.cleanup() }
})
test('failure to inspect a skill provider remains unknown', async () => {
  const f = fixture()
  f.ctx.skills.list = async () => { throw new Error('provider unavailable') }
  try { assert.equal((await inspectHealth(f.ctx, f.root)).runtimeHealth, 'unknown') } finally { f.cleanup() }
})
