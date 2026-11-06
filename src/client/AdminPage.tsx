/** Read-only health summary for the bundled Redteam plugin. */
import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { Button, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { IconRefresh } from './iconCompat.js'
import { type AdminStatus, type Translate } from './contracts.js'
import { errorMessage, type AdminFace } from './controller.js'
import type { ConversationViewSettingsScope } from './conversationViewSettings.js'

export function createAdminPage(face: AdminFace, t: Translate, _visibilityScope: ConversationViewSettingsScope): () => ReactElement {
  return function AdminPage(): ReactElement {
    const [status, setStatus] = useState<AdminStatus | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [applying, setApplying] = useState(false)
    const [applied, setApplied] = useState<string | null>(null)
    const refresh = useCallback(async () => {
      try { setStatus(await face.status(true)); setError(null) }
      catch (cause) { setStatus(null); setError(errorMessage(cause)) }
    }, [face])
    // A version upgrade replaces files in place; the host only swaps them when
    // a recomposition runs, and it watches the ordered bundle list for that.
    // The manager moves its own entry, which is a no-op for composition and a
    // real trigger for the watcher — the update lands without a restart.
    const applyUpdate = useCallback(async () => {
      setApplying(true)
      try { setApplied((await face.recompose()).detail); setError(null) }
      catch (cause) { setApplied(null); setError(errorMessage(cause)) }
      finally { setApplying(false) }
    }, [face])
    useEffect(() => {
      let alive = true
      let timer: number | undefined
      const tick = async () => {
        try { const next = await face.status(); if (alive) { setStatus(next); setError(null) } }
        catch (cause) { if (alive) { setStatus(null); setError(errorMessage(cause)) } }
        if (alive) timer = window.setTimeout(() => void tick(), 60_000)
      }
      void tick()
      return () => { alive = false; if (timer !== undefined) window.clearTimeout(timer) }
    }, [face])
    const health = status?.health
    const integrity = health?.bundleIntegrity ?? 'unknown'
    const runtime = health?.runtimeHealth ?? 'unknown'
    const overall = integrity === 'incomplete' || runtime === 'unhealthy' ? 'error'
      : integrity === 'complete' && runtime === 'healthy' ? 'healthy' : 'unknown'
    const dot = (state: 'good' | 'bad' | 'unknown') => state === 'good' ? 'done' : state === 'bad' ? 'error' : 'warning'
    return <div className="dsh-rtm">
      <div className="dsh-rtm-head">
        <div><h2 className="dsh-rtm-title">{t('title')}</h2><p className="dsh-rtm-sub">{t('healthSubtitle')}</p></div>
        <div className="dsh-rtm-head-actions">
          <Button size="sm" variant="outline" disabled={applying} onClick={() => void applyUpdate()}>
            {applying ? t('recomposeRunning') : t('recompose')}
          </Button>
          <Button size="sm" variant="outline" icon={<IconRefresh size={14} />} onClick={() => void refresh()}>{t('refresh')}</Button>
        </div>
      </div>
      {applied !== null && <div className="dsh-rtm-note" role="status">{t('recomposeDone')}: {applied}</div>}
      <p className="dsh-rtm-restart-hint">{t('recomposeHint')}</p>
      {error !== null && <div className="dsh-rtm-error" role="alert"><span>{t('requestFailed')}: {error}</span></div>}
      {status === null && error === null ? <div className="dsh-rtm-loading">{t('loading')}</div> : <>
        <section className={`dsh-rtm-overall dsh-rtm-overall--${overall}`} aria-live="polite">
          <StateDot state={dot(overall === 'healthy' ? 'good' : overall === 'error' ? 'bad' : 'unknown')} size={8} />
          <span>{t('overallLabel')}</span><strong>{t(overall === 'healthy' ? 'healthOverallReady' : overall === 'error' ? 'healthOverallError' : 'healthUnknown')}</strong>
        </section>
        <section className="dsh-rtm-card">
          <div className="dsh-rtm-section-head"><h3 className="dsh-rtm-section-title">{t('healthChecks')}</h3></div>
          <div className="dsh-rtm-attention-list">
            <HealthRow label={t('healthHostVersion')} value={health?.hostVersion || t('healthUnknown')} />
            <HealthRow label={t('healthBundle')} value={t(integrity === 'complete' ? 'healthBundleComplete' : integrity === 'incomplete' ? 'healthBundleIncomplete' : 'healthUnknown')}
              state={dot(integrity === 'complete' ? 'good' : integrity === 'incomplete' ? 'bad' : 'unknown')} />
            <HealthRow label={t('healthRuntime')} value={t(runtime === 'healthy' ? 'healthRuntimeReady' : runtime === 'unhealthy' ? 'healthRuntimeError' : 'healthUnknown')}
              state={dot(runtime === 'healthy' ? 'good' : runtime === 'unhealthy' ? 'bad' : 'unknown')} />
          </div>
        </section>
        <p className="dsh-rtm-restart-hint">{t('healthLimit')}</p>
        {health?.details?.length ? <section className="dsh-rtm-card"><div className="dsh-rtm-section-head"><h3 className="dsh-rtm-section-title">{t('healthDetails')}</h3></div>
          <div className="dsh-rtm-attention-list">{health.details.map((detail, index) => <div className="dsh-rtm-attention-row" key={index}>{detail}</div>)}</div></section> : null}
      </>}
    </div>
  }
}

function HealthRow({ label, value, state }: { label: string; value: string; state?: 'done' | 'error' | 'warning' }) {
  return <div className="dsh-rtm-attention-row">{state && <StateDot state={state} size={7} />}
    <div className="dsh-rtm-attention-main"><strong>{label}</strong></div><span>{value}</span></div>
}
