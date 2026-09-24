import type { ReactNode } from 'react'
import Icon, { type IconName } from '../../components/Icon'
import type { SettingsState } from './SettingsStudio'

type UpdateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void

const auxiliaryProviders = ['auto', 'openrouter', 'nous', 'codex', 'copilot', 'anthropic', 'main', 'zai', 'kimi-coding', 'minimax', 'custom']

function ParitySection({ title, icon = 'sliders', children }: { title: string; icon?: IconName; children: ReactNode }) {
  return (
    <section className="settings-section-card">
      <div className="settings-section-card__heading">
        <div><span>{title}</span><small>Hermes-compatible configuration shape</small></div>
        <Icon name={icon} size={14} />
      </div>
      {children}
    </section>
  )
}

function ParitySelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="settings-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>
}

function ParityText({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return <label className="settings-field"><span>{label}</span><input className="settings-input" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>
}

function ParityNumber({ label, value, suffix, min, max, onChange }: { label: string; value: number; suffix: string; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="settings-field"><span>{label}</span><div className="settings-number"><input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value))))} /><small>{suffix}</small></div></label>
}

function ParityToggle({ label, detail, enabled, onChange }: { label: string; detail: string; enabled: boolean; onChange: () => void }) {
  return <div className="settings-control-row"><div><strong>{label}</strong><span>{detail}</span></div><button className={enabled ? 'switch switch--on' : 'switch'} role="switch" aria-checked={enabled} onClick={onChange} type="button"><span /></button></div>
}

export default function HermesParityControls({ settings, update }: { settings: SettingsState; update: UpdateSetting }) {
  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <div>
          <span className="eyebrow">Compatibility layer</span>
          <h2>Hermes Parity</h2>
          <p>Advanced controls missing from the general settings taxonomy: auxiliary task routing, context engines, credential pools, voice runtime, gateway behavior, quick commands and transport limits.</p>
        </div>
        <span className="settings-page__mark"><Icon name="layers" size={17} /></span>
      </header>

      <div className="advanced-grid">
        <div><span>Config precedence</span><strong>CLI → profile/config → environment → defaults</strong></div>
        <div><span>Secret boundary</span><strong>Runtime-owned</strong></div>
        <div><span>Auxiliary slots</span><strong>Independent provider/model/base URL</strong></div>
        <div><span>Execution</span><strong>Presentation preview only</strong></div>
      </div>

      <ParitySection title="Context engine & credential pools" icon="database">
        <ParitySelect label="Context engine" value={settings.contextEngine} onChange={(v) => update('contextEngine', v)} options={['compressor', 'lcm', 'custom-plugin']} />
        <ParitySelect label="Memory provider" value={settings.memoryProvider} onChange={(v) => update('memoryProvider', v)} options={['builtin', 'local', 'plugin', 'custom']} />
        <ParitySelect label="Credential pool strategy" value={settings.credentialPoolStrategy} onChange={(v) => update('credentialPoolStrategy', v)} options={['fill_first', 'round_robin', 'least_used', 'random']} />
        <ParitySelect label="Auxiliary reasoning effort" value={settings.auxiliaryReasoningEffort} onChange={(v) => update('auxiliaryReasoningEffort', v)} options={['provider-default', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh']} />
        <div className="settings-info-banner"><span><Icon name="info" size={15} /></span><div><strong>Runtime precedence remains authoritative</strong><small>This page models the configuration contract only. Secret values, provider credentials, pool rotation and context-engine activation must be enforced by the Rust runtime.</small></div></div>
      </ParitySection>

      <ParitySection title="Fallback model contract" icon="network">
        <ParitySelect label="Fallback provider" value={settings.fallbackModelProvider} onChange={(v) => update('fallbackModelProvider', v)} options={auxiliaryProviders} />
        <ParityText label="Fallback model" value={settings.fallbackModel} placeholder="provider default" onChange={(v) => update('fallbackModel', v)} />
        <ParityText label="Fallback base URL" value={settings.fallbackModelBaseUrl} placeholder="https://host/v1" onChange={(v) => update('fallbackModelBaseUrl', v)} />
      </ParitySection>

      <ParitySection title="Auxiliary task: Web Extract" icon="search">
        <ParitySelect label="Provider" value={settings.auxWebExtractProvider} onChange={(v) => update('auxWebExtractProvider', v)} options={auxiliaryProviders} />
        <ParityText label="Model" value={settings.auxWebExtractModel} placeholder="Auto web-extract model" onChange={(v) => update('auxWebExtractModel', v)} />
        <ParityText label="Base URL" value={settings.auxWebExtractBaseUrl} placeholder="Optional OpenAI-compatible endpoint" onChange={(v) => update('auxWebExtractBaseUrl', v)} />
        <ParityNumber label="Timeout" value={settings.auxWebExtractTimeout} suffix="seconds" min={1} max={3600} onChange={(v) => update('auxWebExtractTimeout', v)} />
      </ParitySection>

      <ParitySection title="Auxiliary task: Approval" icon="shield">
        <ParitySelect label="Provider" value={settings.auxApprovalProvider} onChange={(v) => update('auxApprovalProvider', v)} options={auxiliaryProviders} />
        <ParityText label="Model" value={settings.auxApprovalModel} placeholder="Auto approval model" onChange={(v) => update('auxApprovalModel', v)} />
        <ParityText label="Base URL" value={settings.auxApprovalBaseUrl} placeholder="Optional OpenAI-compatible endpoint" onChange={(v) => update('auxApprovalBaseUrl', v)} />
        <ParityNumber label="Timeout" value={settings.auxApprovalTimeout} suffix="seconds" min={1} max={600} onChange={(v) => update('auxApprovalTimeout', v)} />
      </ParitySection>

      <ParitySection title="Auxiliary task: Session Search" icon="search">
        <ParitySelect label="Provider" value={settings.auxSessionSearchProvider} onChange={(v) => update('auxSessionSearchProvider', v)} options={auxiliaryProviders} />
        <ParityText label="Model" value={settings.auxSessionSearchModel} placeholder="Auto session-search model" onChange={(v) => update('auxSessionSearchModel', v)} />
        <ParityText label="Base URL" value={settings.auxSessionSearchBaseUrl} placeholder="Optional OpenAI-compatible endpoint" onChange={(v) => update('auxSessionSearchBaseUrl', v)} />
        <ParityNumber label="Timeout" value={settings.auxSessionSearchTimeout} suffix="seconds" min={1} max={600} onChange={(v) => update('auxSessionSearchTimeout', v)} />
      </ParitySection>

      <ParitySection title="Auxiliary task: Skills Hub" icon="spark">
        <ParitySelect label="Provider" value={settings.auxSkillsHubProvider} onChange={(v) => update('auxSkillsHubProvider', v)} options={auxiliaryProviders} />
        <ParityText label="Model" value={settings.auxSkillsHubModel} placeholder="Auto skills-hub model" onChange={(v) => update('auxSkillsHubModel', v)} />
        <ParityText label="Base URL" value={settings.auxSkillsHubBaseUrl} placeholder="Optional OpenAI-compatible endpoint" onChange={(v) => update('auxSkillsHubBaseUrl', v)} />
        <ParityNumber label="Timeout" value={settings.auxSkillsHubTimeout} suffix="seconds" min={1} max={600} onChange={(v) => update('auxSkillsHubTimeout', v)} />
      </ParitySection>

      <ParitySection title="Auxiliary task: MCP Dispatch" icon="network">
        <ParitySelect label="Provider" value={settings.auxMcpProvider} onChange={(v) => update('auxMcpProvider', v)} options={auxiliaryProviders} />
        <ParityText label="Model" value={settings.auxMcpModel} placeholder="Auto MCP dispatch model" onChange={(v) => update('auxMcpModel', v)} />
        <ParityText label="Base URL" value={settings.auxMcpBaseUrl} placeholder="Optional OpenAI-compatible endpoint" onChange={(v) => update('auxMcpBaseUrl', v)} />
        <ParityNumber label="Timeout" value={settings.auxMcpTimeout} suffix="seconds" min={1} max={600} onChange={(v) => update('auxMcpTimeout', v)} />
      </ParitySection>

      <ParitySection title="Auxiliary task: Memory Flush" icon="archive">
        <ParitySelect label="Provider" value={settings.auxFlushProvider} onChange={(v) => update('auxFlushProvider', v)} options={auxiliaryProviders} />
        <ParityText label="Model" value={settings.auxFlushModel} placeholder="Auto memory-flush model" onChange={(v) => update('auxFlushModel', v)} />
        <ParityText label="Base URL" value={settings.auxFlushBaseUrl} placeholder="Optional OpenAI-compatible endpoint" onChange={(v) => update('auxFlushBaseUrl', v)} />
        <ParityNumber label="Timeout" value={settings.auxFlushTimeout} suffix="seconds" min={1} max={600} onChange={(v) => update('auxFlushTimeout', v)} />
        <ParityNumber label="Vision download timeout" value={settings.visionDownloadTimeout} suffix="seconds" min={1} max={600} onChange={(v) => update('visionDownloadTimeout', v)} />
      </ParitySection>

      <ParitySection title="Docker sandbox contract" icon="terminal">
        <label className="settings-field">
          <span>Docker volume mounts</span>
          <textarea
            className="raw-config-editor"
            value={settings.dockerVolumes.join('\n')}
            onChange={(event) => update('dockerVolumes', event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))}
            spellCheck={false}
            placeholder="/host/path:/container/path[:ro]"
            rows={5}
          />
        </label>
        <ParityToggle label="Run as host user" detail="Preserve host UID/GID ownership for files created in bind mounts." enabled={settings.dockerRunAsHostUser} onChange={() => update('dockerRunAsHostUser', !settings.dockerRunAsHostUser)} />
        <ParityText label="Docker extra arguments" value={settings.dockerExtraArgs} placeholder="Additional runtime flags; backend validates allowed arguments." onChange={(v) => update('dockerExtraArgs', v)} />
        <ParityToggle label="Persist container across processes" detail="Request reusable Docker sandbox lifecycle where the runtime supports it." enabled={settings.dockerPersistAcrossProcesses} onChange={() => update('dockerPersistAcrossProcesses', !settings.dockerPersistAcrossProcesses)} />
        <ParityToggle label="Orphan reaper" detail="Enable cleanup of abandoned Docker sandbox processes." enabled={settings.dockerOrphanReaper} onChange={() => update('dockerOrphanReaper', !settings.dockerOrphanReaper)} />
        <div className="settings-info-banner"><span><Icon name="shield" size={15} /></span><div><strong>Mounts are security-sensitive</strong><small>Mount permissions, path validation and Docker flags must be enforced by the runtime. This editor is a contract preview only.</small></div></div>
      </ParitySection>

      <ParitySection title="Voice runtime" icon="mic">
        <ParitySelect label="TTS provider" value={settings.ttsProvider} onChange={(v) => update('ttsProvider', v)} options={['edge', 'elevenlabs', 'openai', 'neutts']} />
        <ParityText label="TTS voice ID" value={settings.ttsVoiceId} placeholder="Provider-specific voice id" onChange={(v) => update('ttsVoiceId', v)} />
        <ParityText label="TTS model ID" value={settings.ttsModelId} placeholder="Provider-specific model id" onChange={(v) => update('ttsModelId', v)} />
        <ParityText label="TTS base URL" value={settings.ttsBaseUrl} placeholder="Optional OpenAI-compatible TTS endpoint" onChange={(v) => update('ttsBaseUrl', v)} />
        <ParityText label="Neutts reference audio" value={settings.ttsRefAudio} placeholder="/path/to/reference.wav" onChange={(v) => update('ttsRefAudio', v)} />
        <ParityText label="Neutts reference text" value={settings.ttsRefText} placeholder="Reference transcript" onChange={(v) => update('ttsRefText', v)} />
        <ParitySelect label="Neutts device" value={settings.ttsDevice} onChange={(v) => update('ttsDevice', v)} options={['cpu', 'cuda', 'mps', 'auto']} />
        <ParityText label="Voice record key" value={settings.voiceRecordKey} onChange={(v) => update('voiceRecordKey', v)} />
        <ParityNumber label="Maximum recording" value={settings.voiceMaxRecordingSeconds} suffix="seconds" min={1} max={3600} onChange={(v) => update('voiceMaxRecordingSeconds', v)} />
        <ParityNumber label="Silence threshold" value={settings.voiceSilenceThreshold} suffix="RMS" min={0} max={10000} onChange={(v) => update('voiceSilenceThreshold', v)} />
        <ParityNumber label="Silence duration" value={settings.voiceSilenceDuration} suffix="seconds" min={0.1} max={60} onChange={(v) => update('voiceSilenceDuration', v)} />
        <ParityToggle label="Automatic TTS in voice mode" detail="Speak replies automatically when voice mode is enabled." enabled={settings.voiceAutoTts} onChange={() => update('voiceAutoTts', !settings.voiceAutoTts)} />
      </ParitySection>

      <ParitySection title="Display, skins & progress overrides" icon="spark">
        <ParitySelect label="CLI skin" value={settings.cliSkin} onChange={(v) => update('cliSkin', v)} options={['default', 'minimal', 'terminal', 'custom']} />
        <ParityText label="Personality cosmetic preset" value={settings.personalityPreset} placeholder="default" onChange={(v) => update('personalityPreset', v)} />
        <ParityText label="Per-platform tool progress overrides" value={settings.toolProgressOverrides} placeholder='{"signal":"off","telegram":"verbose"}' onChange={(v) => update('toolProgressOverrides', v)} />
        <ParityToggle label="Show interim assistant messages" detail="Allow gateway-specific mid-turn assistant updates." enabled={settings.interimAssistantMessages} onChange={() => update('interimAssistantMessages', !settings.interimAssistantMessages)} />
      </ParitySection>

      <ParitySection title="Web search, extraction & crawl" icon="globe">
        <ParitySelect label="Search backend" value={settings.webBackend} onChange={(v) => update('webBackend', v)} options={['auto', 'firecrawl', 'parallel', 'tavily', 'exa', 'searxng', 'perplexity']} />
        <ParitySelect label="Extract backend" value={settings.webExtractBackend} onChange={(v) => update('webExtractBackend', v)} options={['auto', 'firecrawl', 'parallel', 'tavily', 'exa', 'searxng', 'perplexity']} />
        <ParitySelect label="Crawl backend" value={settings.webCrawlBackend} onChange={(v) => update('webCrawlBackend', v)} options={['auto', 'firecrawl', 'tavily', 'disabled']} />
        <ParitySelect label="Parallel search mode" value={settings.parallelSearchMode} onChange={(v) => update('parallelSearchMode', v)} options={['agentic', 'fast', 'one-shot']} />
        <ParityText label="Self-hosted Firecrawl URL" value={settings.firecrawlApiUrl} placeholder="http://localhost:3002" onChange={(v) => update('firecrawlApiUrl', v)} />
      </ParitySection>

      <ParitySection title="Streaming timeouts & gateway transport" icon="activity">
        <ParityNumber label="Stream read timeout" value={settings.streamReadTimeout} suffix="seconds" min={1} max={7200} onChange={(v) => update('streamReadTimeout', v)} />
        <ParityNumber label="Stale stream timeout" value={settings.streamStaleTimeout} suffix="seconds" min={0} max={7200} onChange={(v) => update('streamStaleTimeout', v)} />
        <ParityNumber label="Non-streaming API timeout" value={settings.apiTimeout} suffix="seconds" min={1} max={7200} onChange={(v) => update('apiTimeout', v)} />
        <ParityNumber label="Gateway buffer threshold" value={settings.gatewayBufferThreshold} suffix="chars" min={1} max={10000} onChange={(v) => update('gatewayBufferThreshold', v)} />
        <ParityText label="Gateway streaming cursor" value={settings.gatewayCursor} onChange={(v) => update('gatewayCursor', v)} />
        <ParityToggle label="Per-user group sessions" detail="Keep shared rooms isolated per participant when the platform supports user IDs." enabled={settings.groupSessionsPerUser} onChange={() => update('groupSessionsPerUser', !settings.groupSessionsPerUser)} />
        <ParitySelect label="Unauthorized DM behavior" value={settings.unauthorizedDmBehavior} onChange={(v) => update('unauthorizedDmBehavior', v)} options={['pair', 'ignore']} />
        <ParityText label="Per-platform DM overrides" value={settings.unauthorizedDmOverrides} placeholder='{"whatsapp":"ignore"}' onChange={(v) => update('unauthorizedDmOverrides', v)} />
      </ParitySection>

      <ParitySection title="Quick commands" icon="command">
        <label className="settings-field">
          <span>Shell commands (name = command)</span>
          <textarea className="raw-config-editor" value={settings.quickCommands} onChange={(event) => update('quickCommands', event.target.value)} spellCheck={false} placeholder={'status = systemctl status agenticos\ndisk = df -h /\ngpu = nvidia-smi'} rows={7} />
        </label>
        <div className="settings-info-banner"><span><Icon name="shield" size={15} /></span><div><strong>Zero-LLM command path</strong><small>These entries model the quick-command contract. Actual shell execution, timeout enforcement and authorization remain backend-controlled and must never be inferred from the frontend preview.</small></div></div>
      </ParitySection>

      <ParitySection title="Compatibility coverage" icon="check">
        <div className="advanced-grid">
          <div><span>Context engine selector</span><strong>Covered</strong></div>
          <div><span>Credential rotation</span><strong>Covered</strong></div>
          <div><span>Auxiliary task routing</span><strong>Covered</strong></div>
          <div><span>Voice mode controls</span><strong>Covered</strong></div>
          <div><span>Web crawl + search mode</span><strong>Covered</strong></div>
          <div><span>Gateway transport limits</span><strong>Covered</strong></div>
          <div><span>Quick commands</span><strong>Preview contract</strong></div>
          <div><span>Secrets</span><strong>Runtime-owned</strong></div>
        </div>
      </ParitySection>
    </div>
  )
}
