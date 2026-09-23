import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'

interface ThemeTokens {
  background: string
  surface: string
  elevated: string
  border: string
  text: string
  muted: string
  accent: string
  selection: string
  focus: string
}

const presets: Record<string, ThemeTokens> = {
  Monochrome: { background: '#0a0a0a', surface: '#101010', elevated: '#171717', border: '#262626', text: '#f2f2f2', muted: '#686868', accent: '#ffffff', selection: '#272727', focus: '#555555' },
  Graphite: { background: '#0d0e10', surface: '#15171a', elevated: '#1c1f23', border: '#2b2f34', text: '#eef0f2', muted: '#777c83', accent: '#d9dde1', selection: '#2a2f35', focus: '#646c74' },
  Paper: { background: '#171717', surface: '#1d1d1d', elevated: '#242424', border: '#363636', text: '#f5f5f5', muted: '#929292', accent: '#e7e7e7', selection: '#343434', focus: '#777777' },
  'High contrast': { background: '#000000', surface: '#050505', elevated: '#111111', border: '#555555', text: '#ffffff', muted: '#bdbdbd', accent: '#ffffff', selection: '#333333', focus: '#ffffff' },
  'Dark OLED': { background: '#000000', surface: '#030303', elevated: '#080808', border: '#1b1b1b', text: '#f7f7f7', muted: '#606060', accent: '#ffffff', selection: '#141414', focus: '#444444' },
}

const tokenLabels: Array<[keyof ThemeTokens, string]> = [
  ['background', 'Background'],
  ['surface', 'Surface'],
  ['elevated', 'Elevated surface'],
  ['border', 'Border'],
  ['text', 'Text'],
  ['muted', 'Muted text'],
  ['accent', 'Accent'],
  ['selection', 'Selection'],
  ['focus', 'Focus ring'],
]

export default function ThemeStudio() {
  const [name, setName] = useState('Monochrome')
  const [tokens, setTokens] = useState<ThemeTokens>(presets.Monochrome)
  const [radius, setRadius] = useState(8)
  const [preview, setPreview] = useState(true)

  const tokenCount = useMemo(() => Object.keys(tokens).length, [tokens])

  function choosePreset(nextName: string) {
    setName(nextName)
    setTokens({ ...presets[nextName] })
  }

  function update(key: keyof ThemeTokens, value: string) {
    setTokens((current) => ({ ...current, [key]: value }))
    setName('Custom')
  }

  return (
    <div className="theme-studio">
      <div className="theme-studio__toolbar">
        <div className="theme-studio__presets">{Object.keys(presets).map((preset) => <button type="button" key={preset} className={name === preset ? 'customize-filter customize-filter--active' : 'customize-filter'} onClick={() => choosePreset(preset)}>{preset}</button>)}</div>
        <label className="theme-toggle"><input type="checkbox" checked={preview} onChange={(event) => setPreview(event.target.checked)} /> Live preview</label>
      </div>
      <div className="theme-studio__body">
        <div className="theme-studio__tokens">
          {tokenLabels.map(([key, label]) => <label className="theme-token" key={key}><span>{label}</span><span><input type="color" value={tokens[key]} onChange={(event) => update(key, event.target.value)} /><input value={tokens[key]} onChange={(event) => update(key, event.target.value)} /></span></label>)}
          <label className="theme-token"><span>Radius</span><span className="theme-range"><input type="range" min={0} max={18} value={radius} onChange={(event) => setRadius(Number(event.target.value))} /><output>{radius}px</output></span></label>
        </div>
        <div className="theme-studio__preview" style={preview ? { background: tokens.background, color: tokens.text, borderRadius: radius } : undefined}>
          <div className="theme-preview__bar" style={preview ? { borderColor: tokens.border, background: tokens.surface } : undefined}><span>AgentiCOS</span><span className="mono-text">Theme preview · {tokenCount} tokens</span></div>
          <div className="theme-preview__canvas" style={preview ? { background: tokens.surface } : undefined}>
            <div className="theme-preview__card" style={preview ? { background: tokens.elevated, borderColor: tokens.border } : undefined}><span style={preview ? { color: tokens.muted } : undefined}>Assistant</span><strong>Configuration ready</strong><div className="theme-preview__button" style={preview ? { background: tokens.accent, color: tokens.background, borderRadius: radius } : undefined}><Icon name="check" size={12} /> Save</div></div>
            <div className="theme-preview__selection" style={preview ? { background: tokens.selection, borderColor: tokens.focus } : undefined}>Selected workspace surface</div>
          </div>
        </div>
      </div>
    </div>
  )
}
