import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import * as React from 'react'
import * as JsxRuntime from 'react/jsx-runtime'
import TestRenderer, { act } from 'react-test-renderer'

const DEFAULT_VISIBILITY = {
  showCampaignMemory: true,
  showAttackAtlas: true,
  showRedteamResults: true,
  showHunter: true,
  showWebshellManager: true,
}

const STATUS = {
  summary: {
    modesTotal: 0,
    modesReady: 0,
    pluginsTotal: 1,
    pluginsInstalled: 1,
    updatesAvailable: 0,
    busy: false,
  },
  modes: [],
  plugins: [{
    name: 'dsh-attack-atlas',
    title: 'Attack Atlas',
    description: 'Attack Atlas test fixture',
    installState: 'installed',
    installedVersion: '1.1.1',
    mountPlane: 'host',
  }],
  operations: [],
}

function stripProps(props, names) {
  const next = { ...props }
  for (const name of names) delete next[name]
  return next
}

const primitives = {
  Button({ children, icon, ...props }) {
    return React.createElement('button', stripProps(props, ['size', 'variant']), icon, children)
  },
  DisclosureRow({ children, ...props }) {
    return React.createElement('div', stripProps(props, ['open', 'onOpenChange']), children)
  },
  Modal({ open, title, description, children, footer }) {
    if (!open) return null
    return React.createElement('section', { role: 'dialog', 'aria-label': title },
      React.createElement('h2', null, title),
      React.createElement('p', null, description),
      children,
      footer,
    )
  },
  StateDot() {
    return React.createElement('span')
  },
  IconAgentPresetOutline16() {
    return React.createElement('span')
  },
  IconCordisPluginOutline14() {
    return React.createElement('span')
  },
  IconRefreshOutline16() {
    return React.createElement('span')
  },
}

function loadClientBundle() {
  let definition
  const browserWindow = {
    __ModuleLoader__: {
      load(value) {
        definition = value
      },
    },
    setTimeout,
    clearTimeout,
  }
  vm.runInNewContext(readFileSync('lib/client.js', 'utf8'), { window: browserWindow })
  assert.equal(definition.id, '@dsh-external/dsh-redteam-model')
  return definition.factory(name => {
    if (name === 'react') return React
    if (name === 'react/jsx-runtime') return JsxRuntime
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return primitives
    throw new Error(`unexpected browser import: ${name}`)
  })
}

async function renderManager(initialSnapshot, status = STATUS) {
  const client = loadClientBundle()
  let snapshot = initialSnapshot
  let pageComponent
  let dictionary = {}
  const listeners = new Set()
  const setCalls = []
  const rpcCalls = []
  const statusCalls = []
  const startCalls = []

  const ctx = {
    effect(factory, label) {
      if (label?.endsWith(': locale')) factory()
    },
    connection: {
      rpc: {
        async call(_channel, endpoint, payload) {
          rpcCalls.push(endpoint)
          if (endpoint === 'operation/start') {
            startCalls.push(payload)
            return { ok: true, value: { id: 'op-0001' } }
          }
          assert.equal(endpoint, 'status')
          statusCalls.push(payload)
          return { ok: true, value: status }
        },
      },
    },
    settingsScope: {
      bind(spec) {
        assert.equal(spec.namespace, 'redteam-manager-ui')
        return {
          getSnapshot: () => snapshot,
          subscribe(listener) {
            listeners.add(listener)
            return () => listeners.delete(listener)
          },
          async set(field, value) {
            setCalls.push({ field, value })
          },
        }
      },
    },
    locale: {
      register(_namespace, dictionaries) {
        dictionary = dictionaries.en
        return () => undefined
      },
      bind() {
        return key => dictionary[key] ?? key
      },
    },
    slots: {
      inject(name, register) {
        assert.equal(name, 'settings.section')
        register()
      },
      register(options, component) {
        assert.equal(options.id, 'redteam-manager')
        pageComponent = component
        return () => undefined
      },
    },
  }

  client.apply(ctx)
  assert.equal(typeof pageComponent, 'function')

  let renderer
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(pageComponent))
    await Promise.resolve()
    await Promise.resolve()
  })

  const openPlugins = () => {
    const button = renderer.root.findAllByType('button').find(node => node.children.includes('Plugins'))
    assert.ok(button, 'Plugins page button must render')
    act(() => button.props.onClick())
  }

  const openModes = () => {
    const button = renderer.root.findAllByType('button').find(node => node.children.includes('Modes'))
    assert.ok(button, 'Modes page button must render')
    act(() => button.props.onClick())
  }

  return {
    renderer,
    rpcCalls,
    statusCalls,
    setCalls,
    startCalls,
    openPlugins,
    openModes,
    setSnapshot(next) {
      snapshot = next
      for (const listener of listeners) listener()
    },
    async cleanup() {
      await act(async () => renderer.unmount())
    },
  }
}

test('health dashboard reports DSH version and separates integrity from runtime', async () => {
  const manager = await renderManager({ status: 'unavailable', value: undefined, writable: false, mode: 'memory' }, {
    ...STATUS, health: { hostVersion: '0.2.2-rc.1', bundleIntegrity: 'complete', runtimeHealth: 'healthy', details: [] },
  })
  try {
    const text = JSON.stringify(manager.renderer.toJSON())
    assert.match(text, /0\.2\.2-rc\.1/)
    assert.match(text, /Checks passed/)
    assert.match(text, /Bundle integrity/)
    assert.match(text, /Runtime components/)
    assert.match(text, /Model, credentials, external tools and API calls are not tested/)
    const buttons = manager.renderer.root.findAllByType('button').flatMap(node => node.children.filter(child => typeof child === 'string'))
    assert.ok(!buttons.some(label => /install|uninstall|update|repair/i.test(label)))
  } finally { await manager.cleanup() }
})

test('manual refresh forces a fresh integrity check', async () => {
  const manager = await renderManager({ status: 'unavailable', value: undefined, writable: false, mode: 'memory' })
  try {
    assert.equal(manager.statusCalls.at(-1).force, false)
    const refresh = manager.renderer.root.findAllByType('button').find(node => node.children.includes('Refresh'))
    assert.ok(refresh)
    await act(async () => { refresh.props.onClick(); await Promise.resolve(); await Promise.resolve() })
    assert.equal(manager.statusCalls.at(-1).force, true)
  } finally { await manager.cleanup() }
})

test('unknown runtime does not produce a positive overall result', async () => {
  const manager = await renderManager({ status: 'unavailable', value: undefined, writable: false, mode: 'memory' }, {
    ...STATUS, health: { hostVersion: null, bundleIntegrity: 'complete', runtimeHealth: 'unknown', details: ['No runtime status'] },
  })
  try {
    const text = JSON.stringify(manager.renderer.toJSON())
    assert.match(text, /Unknown/)
    assert.match(text, /No runtime status/)
    assert.doesNotMatch(text, /Checks passed/)
  } finally { await manager.cleanup() }
})

test('incomplete bundle or unhealthy runtime reports attention', async () => {
  for (const health of [
    { hostVersion: '0.2.2-rc.1', bundleIntegrity: 'incomplete', runtimeHealth: 'healthy', details: [] },
    { hostVersion: '0.2.2-rc.1', bundleIntegrity: 'complete', runtimeHealth: 'unhealthy', details: [] },
  ]) {
    const manager = await renderManager({ status: 'unavailable', value: undefined, writable: false, mode: 'memory' }, { ...STATUS, health })
    try {
      const text = JSON.stringify(manager.renderer.toJSON())
      assert.match(text, /Attention required/)
      assert.doesNotMatch(text, /Checks passed/)
    } finally { await manager.cleanup() }
  }
})

test('older hosts with no health payload remain unknown', async () => {
  const manager = await renderManager({ status: 'unavailable', value: undefined, writable: false, mode: 'memory' })
  try {
    const text = JSON.stringify(manager.renderer.toJSON())
    assert.match(text, /Unknown/)
    assert.doesNotMatch(text, /Checks passed/)
  } finally { await manager.cleanup() }
})
