import Icon from './Icon'

const files = [
  { label: 'crates', depth: 0, icon: 'folder', kind: 'folder' },
  { label: 'presentation', depth: 1, icon: 'folder', kind: 'folder' },
  { label: 'desktop', depth: 2, icon: 'folder', kind: 'folder' },
  { label: 'frontend', depth: 3, icon: 'folder', kind: 'folder' },
  { label: 'App.tsx', depth: 4, icon: 'code', kind: 'file' },
  { label: 'ChatSurface.tsx', depth: 4, icon: 'code', kind: 'file' },
  { label: 'runtime.ts', depth: 4, icon: 'code', kind: 'file' },
  { label: 'index.css', depth: 4, icon: 'code', kind: 'file' },
  { label: 'Cargo.toml', depth: 0, icon: 'code', kind: 'file' },
] as const

export default function FileExplorer() {
  return (
    <section className="overview-surface">
      <div className="overview-heading">
        <div>
          <span className="eyebrow">Project</span>
          <h1>Workspace explorer</h1>
          <p>Repository context prepared for the editor, diff and safe-change slices.</p>
        </div>
        <button className="soft-button" type="button"><Icon name="search" size={14} /> Search files</button>
      </div>

      <div className="explorer-shell">
        <div className="explorer-header"><span>agenticos</span><span className="mono-text">main</span></div>
        <div className="explorer-tree">
          {files.map((file) => (
            <button className={`tree-row tree-row--${file.kind}`} style={{ paddingLeft: `${12 + file.depth * 18}px` }} key={`${file.depth}-${file.label}`} type="button">
              <Icon name={file.icon} size={15} />
              <span>{file.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
