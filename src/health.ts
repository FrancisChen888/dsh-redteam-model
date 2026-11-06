import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderPrompt, type PromptAssembly } from '@deepseek-ai/dsh-system-prompt'
import { hostRuntimeScope, locateRoot, scanModes, scanPlugins } from './manager.ts'

export type HealthState = 'healthy' | 'unhealthy' | 'unknown'
export interface BundleHealth {
  hostVersion: string | null
  bundleIntegrity: 'complete' | 'incomplete' | 'unknown'
  runtimeHealth: HealthState
  details: string[]
}

/** Reports only evidence we can actually observe; this does not test model credentials. */
let cachedIntegrity: { root: string; expires: number; value: BundleHealth['bundleIntegrity']; detail: string } | undefined

const EXPECTED_PLAYBOOKS: Record<string, string> = {
  redteam: 'router-playbook',
  pentest: 'pentest-playbook',
  'code-audit': 'audit-playbook',
  'binary-analysis': 're-playbook',
  'attack-defense': 'ad-playbook',
  'av-evasion': 'av-playbook',
  'incident-response': 'ir-playbook',
  'cloud-security': 'cloud-playbook',
  'ctf-solver': 'ctf-playbook',
  'asset-mapping': 'asset-mapping-playbook',
}

export async function inspectHealth(ctx: unknown, root = locateRoot(), forceIntegrity = false): Promise<BundleHealth> {
  const details: string[] = []
  let hostVersion: string | null = null
  const host = hostRuntimeScope()
  if (host) try { hostVersion = JSON.parse(readFileSync(path.join(host, 'dsh/package.json'), 'utf8')).version ?? null } catch { /* unknown host */ }
  let bundleIntegrity: BundleHealth['bundleIntegrity'] = 'unknown'
  if (!forceIntegrity && cachedIntegrity?.root === root && cachedIntegrity.expires > Date.now()) {
    bundleIntegrity = cachedIntegrity.value
    details.push(cachedIntegrity.detail)
  } else try {
    const manifest = JSON.parse(readFileSync(path.join(root, 'lib/package-integrity.json'), 'utf8')) as { files: Record<string, string> }
    const entries = Object.entries(manifest.files)
    if (entries.length === 0) throw new Error('empty manifest')
    const bad: string[] = []
    for (const [relative, expected] of entries) {
      if (path.isAbsolute(relative) || relative.split('/').includes('..')) throw new Error('invalid manifest path')
      try {
        const actual = createHash('sha256').update(readFileSync(path.join(root, relative))).digest('hex')
        if (actual !== expected) bad.push(relative)
      } catch { bad.push(relative) }
    }
    bundleIntegrity = bad.length ? 'incomplete' : 'complete'
    const detail = bad.length ? `文件缺失或校验不一致：${bad.slice(0, 8).join(', ')}（共 ${bad.length} 项）` : `已核对 ${entries.length} 个安装包文件。`
    details.push(detail)
    cachedIntegrity = { root, expires: Date.now() + 30000, value: bundleIntegrity, detail }
  } catch { details.push('缺少有效的完整性清单，无法确认文件完整。') }
  let runtimeHealth: HealthState = 'unknown'
  try {
    const loader = (ctx as { loader?: { entries(): Iterable<{ id?: unknown; options?: { name?: string }; fiber?: { state?: number }; disabled?: boolean }> } }).loader
    if (loader) {
      const entries = [...loader.entries()]
      const required = scanPlugins(root).filter(x => x.mountPlane === 'host')
      const failed = required.filter(plugin => !entries.some(entry => (String(entry.id).includes(`bundled-${plugin.name}:`) || entry.options?.name === `@dsh-external/${plugin.name}`) && !entry.disabled && entry.fiber?.state === 2))
      if (failed.length) { runtimeHealth = 'unhealthy'; details.push(`宿主组件未运行：${failed.map(x => x.name).join(', ')}`) }
      else {
        const services = ctx as {
          agentPresets?: { acquireScope(id: string): Promise<AsyncDisposable & { key: unknown }> }
          subagents?: { list(): readonly string[] }
          skills?: {
            list(options: { scope: unknown }): Promise<readonly { name: string }[]>
            get(name: string, options: { scope: unknown }): Promise<{ description?: string; content?: string } | undefined>
          }
          systemPrompt?: { assemble(options: { scope: unknown }): Promise<PromptAssembly> }
        }
        const { agentPresets: presets, subagents, skills, systemPrompt } = services
        const modes = scanModes(root)
        if (!required.length || !modes.length || !presets || typeof presets.acquireScope !== 'function' || !subagents || !skills || !systemPrompt) {
          details.push(`全部 ${required.length} 个宿主子组件已启动；预设、子智能体、技能或提示词状态不可读取。`)
        } else {
          const failures: string[] = []
          const unknown: string[] = []
          const providers = subagents.list()
          for (const provider of ['codex-redteam', 'claude-code']) {
            if (!providers.includes(provider)) failures.push(`缺少子智能体提供方 ${provider}`)
          }
          for (const mode of modes) {
            try {
              const lease = await presets.acquireScope(mode.id)
              try {
                const assembly = await systemPrompt.assemble({ scope: lease.key })
                // No model request is sent; supply only the two route values
                // normally provided by an agent during prompt rendering.
                if (!Object.hasOwn(assembly.variables, 'model') || !Object.hasOwn(assembly.variables, 'provider')) {
                  throw new Error('宿主未注册 model 或 provider 提示词变量')
                }
                assembly.variables.model ??= 'health-check-model'
                assembly.variables.provider ??= 'health-check-provider'
                renderPrompt(assembly)
                const expected = EXPECTED_PLAYBOOKS[mode.id]
                if (expected === undefined) {
                  unknown.push(`${mode.id}（未知的预设）`)
                } else {
                  try {
                    const catalog = await skills.list({ scope: lease.key })
                    if (!catalog.some(skill => skill.name === expected)) failures.push(`${mode.id}（缺少 ${expected}）`)
                    else {
                      const skill = await skills.get(expected, { scope: lease.key })
                      if (!skill || !skill.description?.trim() || !skill.content?.trim()) failures.push(`${mode.id}（无法加载 ${expected}）`)
                    }
                  } catch {
                    // Discovery may include providers outside this bundle.
                    unknown.push(`${mode.id}（技能目录读取失败）`)
                  }
                }
              } finally {
                await lease[Symbol.asyncDispose]()
              }
            } catch (error) {
              failures.push(`${mode.id}（${error instanceof Error ? error.message : String(error)}）`)
            }
          }
          if (failures.length) { runtimeHealth = 'unhealthy'; details.push(`预设检查失败：${failures.join(', ')}`) }
          else if (unknown.length) details.push(`无法确认：${unknown.join(', ')}`)
          else { runtimeHealth = 'healthy'; details.push(`全部 ${required.length} 个宿主组件已启动，${modes.length} 个预设的挂载、提示词和工作流技能已检查；未验证客户端与外部模型、工具凭据。`) }
        }
      }
    } else details.push('宿主运行状态不可读取。')
  } catch { details.push('无法读取宿主运行状态。') }
  return { hostVersion, bundleIntegrity, runtimeHealth, details }
}
