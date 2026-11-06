/**
 * Native, isolated smoke test for an already-built bundle.
 *
 * Run with the target Desktop's Electron Node runtime, for example:
 * ELECTRON_RUN_AS_NODE=1 '/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness' \
 *   --expose-internals tests/desktop-bundle-integration.mjs \
 *   '/Applications/DeepSeek Harness.app/Contents/Resources/app/dsh'
 *
 * The test copies only distributable files into a temporary profile. It does
 * not load or change the caller's DSH configuration, sessions or presets.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { syncBuiltinESMExports } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const runtime = process.argv[2]
if (!runtime || !path.isAbsolute(runtime)) throw new Error('Pass the absolute target DSH runtime directory')

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(fs.readFileSync(path.join(source, 'lib/package-integrity.json'), 'utf8'))
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-bundle-test-'))
const dshHome = path.join(temp, 'dsh-home')
const profileDirectory = path.join(dshHome, 'profiles', 'compat')
const model = path.join(profileDirectory, 'node_modules', '@dsh-external', 'dsh-redteam-model')
for (const name of [...Object.keys(manifest.files), 'lib/package-integrity.json']) {
  assert(!path.isAbsolute(name) && !name.split('/').includes('..'), `invalid package path: ${name}`)
  const target = path.join(model, name)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(path.join(source, name), target)
}
assert(!fs.existsSync(path.join(model, 'plugins/node_modules')), 'test must start without child bridges')

process.env.DSH_HOME = dshHome
process.env.DSH_TELEMETRY_DISABLED = '1'
os.homedir = () => path.join(temp, 'os-home')
syncBuiltinESMExports()
process.chdir(temp)
process.argv.push(profileDirectory)

const dependency = '@dsh-external/dsh-redteam-model'
const standalone = process.env.DSH_TEST_STANDALONE ?? 'none'
assert(['none', 'all', 'mixed'].includes(standalone), 'DSH_TEST_STANDALONE must be none, all, or mixed')
const dependencies = { [dependency]: `link:${model}` }
const bundles = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', dependency]
const hosts = fs.readdirSync(path.join(model, 'plugins')).filter(name =>
  fs.existsSync(path.join(model, 'plugins', name, 'package.json')),
).sort()
for (const [index, name] of hosts.entries()) {
  if (standalone === 'none' || (standalone === 'mixed' && index % 2 !== 0)) continue
  const childName = `@dsh-external/${name}`
  const sourceDir = path.join(model, 'plugins', name)
  const destination = path.join(profileDirectory, 'node_modules', childName)
  fs.symlinkSync(sourceDir, destination, 'dir')
  dependencies[childName] = `link:${sourceDir}`
  bundles.push(childName)
}
const initialProfile = {
  name: 'redteam-bundle-smoke-test', private: true,
  dependencies,
  dsh: { profile: { bundles } },
}
fs.writeFileSync(path.join(profileDirectory, 'package.json'), JSON.stringify(initialProfile, null, 2))

const anchor = path.join(runtime, 'node_modules/@deepseek-ai/dsh/package.json')
const boot = await import(pathToFileURL(path.join(runtime, 'node_modules/@deepseek-ai/dsh-app-boot/lib/index.js')))
const { runProfile } = await import(pathToFileURL(path.join(runtime, 'node_modules/@deepseek-ai/dsh/lib/profile-boot.js')))
const profile = boot.loadProfileDirectory('dsh', profileDirectory, anchor)
let app
try {
  app = await runProfile({
    environment: boot.loadLayeredEnv('dsh'), profile: 'compat',
    resolvedProfile: { profile, installAnchor: anchor }, patchFiles: [],
    args: ['--no-open', '--host', '127.0.0.1', '--port', '0'],
  })
  const { inspectHealth } = await import(pathToFileURL(path.join(model, 'lib/index.js')))
  const services = { loader: app.ctx.loader, agentPresets: app.ctx.agentPresets, subagents: app.ctx.subagents, skills: app.ctx.skills, systemPrompt: app.ctx.systemPrompt }
  const health = await inspectHealth(services, model, true)
  assert.equal(health.hostVersion, JSON.parse(fs.readFileSync(anchor)).version)
  assert.equal(health.bundleIntegrity, 'complete', health.details.join('; '))
  assert.equal(health.runtimeHealth, 'healthy', health.details.join('; '))
  const loadedProfile = JSON.parse(fs.readFileSync(path.join(profileDirectory, 'package.json')))
  assert.deepEqual(loadedProfile.dependencies, initialProfile.dependencies, 'startup must not rewrite profile dependencies')
  assert.deepEqual(loadedProfile.dsh.profile.bundles, initialProfile.dsh.profile.bundles, 'startup must preserve existing bundle choices')
  assert(app.ctx.subagents.list().includes('codex-redteam'))

  const port = app.ctx.webServer.server.address().port
  for (const name of ['dsh-attack-atlas', 'dsh-campaign-memory', 'dsh-hunter', 'dsh-redteam-results', 'dsh-session-pulse', 'dsh-webshell-mgr']) {
    const url = `http://127.0.0.1:${port}/${name}/csrf`
    assert.equal((await fetch(url)).status, 200, name)
    assert.equal((await fetch(url, { headers: { origin: 'https://other.invalid' } })).status, 403, name)
  }

  // Exercise the real authenticated route and its captured service context.
  const base = `http://127.0.0.1:${port}/`
  const login = await fetch(app.ctx.connection.authenticatedUrl(base), { redirect: 'manual' })
  const cookie = login.headers.get('set-cookie')?.split(';')[0]
  assert(cookie, 'temporary test login must return a cookie')
  const status = async (force = false) => {
    const response = await fetch(`${base}api/dsh-redteam-model/status`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie, origin: base.slice(0, -1) },
      body: JSON.stringify({ type: 'client-request', rpcId: 'bundle-test', method: 'status', payload: { force } }),
    })
    assert.equal(response.status, 200)
    const envelope = await response.json()
    assert.equal(envelope.result?.ok, true)
    return envelope.result.value.health
  }
  assert.equal((await status()).runtimeHealth, 'healthy')
  fs.appendFileSync(path.join(model, 'modes/redteam/skills/router-playbook/SKILL.md'), '\n')
  assert.equal((await status(true)).bundleIntegrity, 'incomplete', 'manual refresh must not reuse a stale integrity result')

  console.log(`Bundle smoke test passed on DSH ${health.hostVersion} (${standalone} standalone components): host components, 10 presets, prompts, workflow skills and authenticated health endpoint`)
} finally {
  if (app) await app.ctx.fiber.dispose()
  fs.rmSync(temp, { recursive: true, force: true })
}
