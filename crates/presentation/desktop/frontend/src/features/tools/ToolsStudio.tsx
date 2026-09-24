import { useEffect, useMemo, useState } from 'react'
import { runtime } from '../../services/runtime'
import Icon from '../../components/Icon'

type ToolTab = 'All' | 'Enabled' | 'Risk'

const toolCatalog = [
  { name: 'filesystem', description: 'Read and write workspace files', risk: 'High', category: 'Workspace', enabled: true },
  { name: 'terminal', description: 'Execute shell commands in the selected environment', risk: 'Critical', category: 'Execution', enabled: true },
  { name: 'git', description: 'Inspect repository state and create changes', risk: 'High', category: 'Source control', enabled: true },
  { name: 'browser', description: 'Navigate pages, inspect DOM and interact with forms', risk: 'High', category: 'Automation', enabled: true },
  { name: 'search', description: 'Search web or indexed repository sources', risk: 'Medium', category: 'Research', enabled: false },
  { name: 'http', description: 'Perform outbound HTTP requests', risk: 'High', category: 'Network', enabled: false },
  { name: 'python', description: 'Run data and scripting workloads in a sandbox', risk: 'High', category: 'Execution', enabled: false },
  { name: 'vision', description: 'Analyze visual inputs', risk: 'Medium', category: 'Multimodal', enabled: false },
  { name: 'web_search', description: 'Search the web for current sources and evidence.', risk: 'Medium', category: 'Web', enabled: false },
  { name: 'web_extract', description: 'Extract readable content from a web page.', risk: 'Medium', category: 'Web', enabled: false },
  { name: 'browser_navigate', description: 'Navigate a browser session and preserve session state.', risk: 'High', category: 'Browser', enabled: false },
  { name: 'browser_click', description: 'Click interactive browser elements by reference.', risk: 'High', category: 'Browser', enabled: false },
  { name: 'browser_type', description: 'Fill browser form fields and submit input.', risk: 'High', category: 'Browser', enabled: false },
  { name: 'browser_screenshot', description: 'Capture the current browser state for visual verification.', risk: 'Medium', category: 'Browser', enabled: false },
  { name: 'browser_console', description: 'Inspect browser console output and JavaScript errors.', risk: 'Medium', category: 'Browser', enabled: false },
  { name: 'browser_network', description: 'Inspect network traffic for debugging workflows.', risk: 'High', category: 'Browser', enabled: false },
  { name: 'process_manage', description: 'Manage background terminal processes and output.', risk: 'High', category: 'Execution', enabled: false },
  { name: 'read_file', description: 'Read workspace files with bounded output.', risk: 'Medium', category: 'Files', enabled: true },
  { name: 'patch', description: 'Apply targeted file patches within policy scope.', risk: 'High', category: 'Files', enabled: true },
  { name: 'memory', description: 'Read and curate persistent agent memory.', risk: 'Medium', category: 'Memory', enabled: false },
  { name: 'session_search', description: 'Search previous sessions and messages.', risk: 'Medium', category: 'Memory', enabled: false },
  { name: 'todo_list', description: 'Create and inspect structured task plans.', risk: 'Low', category: 'Planning', enabled: true },
  { name: 'clarify', description: 'Request missing information before high-impact actions.', risk: 'Low', category: 'Planning', enabled: true },
  { name: 'delegate_task', description: 'Spawn an isolated specialist subagent for a subtask.', risk: 'High', category: 'Delegation', enabled: false },
  { name: 'execute_code', description: 'Run bounded programmatic tool pipelines in an execution environment.', risk: 'Critical', category: 'Execution', enabled: false },
  { name: 'cronjob_manage', description: 'Create, pause, resume and inspect scheduled jobs.', risk: 'High', category: 'Automation', enabled: false },
  { name: 'skills_list', description: 'List installed and available procedural skills.', risk: 'Low', category: 'Skills', enabled: true },
  { name: 'skill_view', description: 'Load a skill and its references progressively.', risk: 'Medium', category: 'Skills', enabled: false },
  { name: 'skill_manage', description: 'Create, update or remove skill packages.', risk: 'High', category: 'Skills', enabled: false },
  { name: 'text_to_speech', description: 'Generate spoken output for voice workflows.', risk: 'Medium', category: 'Media', enabled: false },
  { name: 'image_generate', description: 'Generate image assets from prompts or references.', risk: 'Medium', category: 'Media', enabled: false },
  { name: 'vision_analyze', description: 'Analyze images, screenshots and visual artifacts.', risk: 'Medium', category: 'Multimodal', enabled: false },
  { name: 'video_generate', description: 'Generate video assets for agent workflows.', risk: 'Medium', category: 'Media', enabled: false },
  { name: 'video_analyze', description: 'Inspect video content for multimodal workflows.', risk: 'Medium', category: 'Media', enabled: false },
  { name: 'computer_use', description: 'Drive a controlled desktop or application session.', risk: 'Critical', category: 'Computer', enabled: false },
  { name: 'x_search', description: 'Search public social posts and threads when enabled.', risk: 'Medium', category: 'Social', enabled: false },
  { name: 'homeassistant', description: 'Use Home Assistant integration tools under explicit policy.', risk: 'Critical', category: 'Integrations', enabled: false },
  { name: 'messaging', description: 'Send messages through configured gateway channels.', risk: 'Critical', category: 'Messaging', enabled: false },
  { name: 'spotify', description: 'Control supported Spotify workflows through an integration.', risk: 'High', category: 'Integrations', enabled: false },
  { name: 'discord', description: 'Interact with supported Discord integrations.', risk: 'High', category: 'Messaging', enabled: false },
  { name: 'kanban', description: 'Operate structured task-board workflows.', risk: 'Medium', category: 'Work management', enabled: false },
  { name: 'desktop_preview', description: 'Preview desktop application state for agent verification.', risk: 'Medium', category: 'Desktop GUI', enabled: false },
  { name: 'browser_back', description: 'Navigate back in browser history.', risk: 'Medium', category: 'Browser', enabled: false },
  { name: 'browser_press', description: 'Press a keyboard key in the browser session.', risk: 'Medium', category: 'Browser', enabled: false },
  { name: 'browser_scroll', description: 'Scroll a browser page in a controlled direction.', risk: 'Medium', category: 'Browser', enabled: false },
  { name: 'browser_snapshot', description: 'Read the browser accessibility tree and interactive refs.', risk: 'Medium', category: 'Browser', enabled: false },
  { name: 'browser_vision', description: 'Inspect the current browser page visually from a screenshot.', risk: 'Medium', category: 'Browser', enabled: false },
  { name: 'browser_get_images', description: 'Inventory images on the current browser page.', risk: 'Low', category: 'Browser', enabled: false },
  { name: 'browser_cdp', description: 'Issue a raw Chrome DevTools Protocol command when CDP is available.', risk: 'Critical', category: 'Browser', enabled: false },
  { name: 'browser_dialog', description: 'Accept or dismiss a browser dialog.', risk: 'High', category: 'Browser', enabled: false },
  { name: 'manage_connections', description: 'Connect, reconnect and install managed or MCP integrations.', risk: 'High', category: 'Integrations', enabled: false },
  { name: 'search_files', description: 'Search repository contents or locate files by name.', risk: 'Medium', category: 'Files', enabled: false },
  { name: 'write_file', description: 'Replace a file after explicit review and write authorization.', risk: 'High', category: 'Files', enabled: false },
  { name: 'ha_call_service', description: 'Call an approved Home Assistant service.', risk: 'Critical', category: 'Home Assistant', enabled: false },
  { name: 'ha_get_state', description: 'Read state and attributes for a Home Assistant entity.', risk: 'Medium', category: 'Home Assistant', enabled: false },
  { name: 'ha_list_entities', description: 'List Home Assistant entities by domain or area.', risk: 'Medium', category: 'Home Assistant', enabled: false },
  { name: 'ha_list_services', description: 'Inspect available Home Assistant services and schemas.', risk: 'Medium', category: 'Home Assistant', enabled: false },
  { name: 'kanban_show', description: 'Show the current worker task and dependencies.', risk: 'Low', category: 'Kanban', enabled: false },
  { name: 'kanban_list', description: 'List board tasks with filters.', risk: 'Medium', category: 'Kanban', enabled: false },
  { name: 'kanban_complete', description: 'Complete a task with structured handoff data.', risk: 'High', category: 'Kanban', enabled: false },
  { name: 'kanban_block', description: 'Block a task pending human input.', risk: 'High', category: 'Kanban', enabled: false },
  { name: 'kanban_request_review', description: 'Route an implementation task to review.', risk: 'High', category: 'Kanban', enabled: false },
  { name: 'kanban_request_changes', description: 'Route a review back to the implementer for changes.', risk: 'High', category: 'Kanban', enabled: false },
  { name: 'kanban_heartbeat', description: 'Report progress during long-running task execution.', risk: 'Low', category: 'Kanban', enabled: false },
  { name: 'kanban_comment', description: 'Add a progress comment without changing task state.', risk: 'Low', category: 'Kanban', enabled: false },
  { name: 'kanban_create', description: 'Fan out child tasks from an orchestrator task.', risk: 'High', category: 'Kanban', enabled: false },
  { name: 'kanban_link', description: 'Link tasks with parent-child dependency edges.', risk: 'Medium', category: 'Kanban', enabled: false },
  { name: 'kanban_unblock', description: 'Move a blocked task back into the runnable board state.', risk: 'High', category: 'Kanban', enabled: false },
  { name: 'kanban_attach', description: 'Attach a local file to a task.', risk: 'Medium', category: 'Kanban', enabled: false },
  { name: 'kanban_attach_url', description: 'Attach a file from a URL to a task.', risk: 'High', category: 'Kanban', enabled: false },
  { name: 'kanban_attachments', description: 'List task attachments and metadata.', risk: 'Low', category: 'Kanban', enabled: false },
  { name: 'desktop_project', description: 'Create, list and switch named desktop projects.', risk: 'Medium', category: 'Projects', enabled: false },
  { name: 'manage_catalog', description: 'Discover and install reviewed plugins and skill packages.', risk: 'High', category: 'Marketplace', enabled: false },
  { name: 'memory_read', description: 'Read persistent memory scoped to the current agent context.', risk: 'Medium', category: 'Memory', enabled: false },
  { name: 'session_search', description: 'Search or browse historical session messages.', risk: 'Medium', category: 'Memory', enabled: false },
  { name: 'read_terminal', description: 'Read the embedded desktop terminal pane.', risk: 'Low', category: 'Desktop GUI', enabled: false },
  { name: 'close_terminal', description: 'Close a terminal presentation tab without killing the process.', risk: 'Medium', category: 'Desktop GUI', enabled: false },
  { name: 'drive_preview', description: 'Interact with the in-app preview browser using stable refs.', risk: 'High', category: 'Desktop GUI', enabled: false },
  { name: 'annotate_preview', description: 'Annotate preview elements with durable visual marks.', risk: 'Low', category: 'Desktop GUI', enabled: false },
  { name: 'read_window_below', description: 'Inspect metadata of the OS window below the agent desktop.', risk: 'Medium', category: 'Desktop GUI', enabled: false },
  { name: 'focus_pane', description: 'Reveal and focus a desktop pane.', risk: 'Low', category: 'Desktop GUI', enabled: false },
  { name: 'react_to_message', description: 'React to a message when reactions are enabled.', risk: 'Low', category: 'Desktop GUI', enabled: false },
  { name: 'gui_tour', description: 'Guide the user through UI elements with stable tour targets.', risk: 'Low', category: 'Desktop GUI', enabled: false },
  { name: 'show_tip', description: 'Show a focused contextual tip on a UI element.', risk: 'Low', category: 'Desktop GUI', enabled: false },
  { name: 'apply_layout', description: 'Apply a saved workspace layout preset.', risk: 'Medium', category: 'Desktop GUI', enabled: false },
  { name: 'read_terminal', description: 'Read the terminal pane in the desktop workspace.', risk: 'Low', category: 'Desktop GUI', enabled: false },
  { name: 'discord', description: 'Read and participate in supported Discord workflows.', risk: 'High', category: 'Discord', enabled: false },
  { name: 'discord_admin', description: 'Manage Discord channels, roles and moderation actions.', risk: 'Critical', category: 'Discord', enabled: false },
  { name: 'spotify_playback', description: 'Control playback and inspect recently played tracks.', risk: 'High', category: 'Spotify', enabled: false },
  { name: 'spotify_devices', description: 'List or transfer Spotify Connect playback devices.', risk: 'Medium', category: 'Spotify', enabled: false },
  { name: 'spotify_queue', description: 'Inspect or modify the Spotify queue.', risk: 'Medium', category: 'Spotify', enabled: false },
  { name: 'spotify_search', description: 'Search Spotify tracks, artists, albums and playlists.', risk: 'Low', category: 'Spotify', enabled: false },
  { name: 'spotify_playlists', description: 'Create and modify Spotify playlists.', risk: 'High', category: 'Spotify', enabled: false },
  { name: 'spotify_albums', description: 'Read Spotify album metadata or tracks.', risk: 'Low', category: 'Spotify', enabled: false },
  { name: 'spotify_library', description: 'Read or modify saved Spotify tracks and albums.', risk: 'High', category: 'Spotify', enabled: false },
  { name: 'feishu_doc_read', description: 'Read Feishu/Lark document content.', risk: 'Medium', category: 'Feishu', enabled: false },
  { name: 'feishu_drive_add_comment', description: 'Add a Feishu document or file comment.', risk: 'High', category: 'Feishu', enabled: false },
  { name: 'feishu_drive_list_comments', description: 'List Feishu document comments.', risk: 'Low', category: 'Feishu', enabled: false },
  { name: 'feishu_drive_list_comment_replies', description: 'List replies in a Feishu comment thread.', risk: 'Low', category: 'Feishu', enabled: false },
  { name: 'feishu_drive_reply_comment', description: 'Reply to a Feishu document comment thread.', risk: 'High', category: 'Feishu', enabled: false },
  { name: 'yb_query_group_info', description: 'Inspect Yuanbao group information.', risk: 'Low', category: 'Yuanbao', enabled: false },
  { name: 'yb_query_group_members', description: 'Inspect members in a Yuanbao group.', risk: 'Medium', category: 'Yuanbao', enabled: false },
  { name: 'yb_send_dm', description: 'Send a Yuanbao direct message.', risk: 'Critical', category: 'Yuanbao', enabled: false },
  { name: 'yb_search_sticker', description: 'Search the Yuanbao sticker catalog.', risk: 'Low', category: 'Yuanbao', enabled: false },
  { name: 'yb_send_sticker', description: 'Send a Yuanbao sticker.', risk: 'High', category: 'Yuanbao', enabled: false },
  { name: 'video_generate', description: 'Generate or animate video assets through the configured backend.', risk: 'Medium', category: 'Video', enabled: false },
  { name: 'xai_video_edit', description: 'Edit a video through the configured xAI video backend.', risk: 'High', category: 'Video', enabled: false },
  { name: 'xai_video_extend', description: 'Extend a video through the configured xAI video backend.', risk: 'High', category: 'Video', enabled: false },
  { name: 'x_search', description: 'Search public X posts, profiles and threads.', risk: 'Medium', category: 'Social', enabled: false },
]

const schemas = [
  ['filesystem.read', 'path: string', 'Workspace file content'],
  ['terminal.exec', 'command: string', 'Command result + exit code'],
  ['git.diff', 'scope?: string', 'Repository change set'],
  ['browser.navigate', 'url: string', 'Navigation state'],
  ['search.query', 'query: string', 'Search results'],
]

export default function ToolsStudio({ onAction }: { onAction: (message: string) => void }) {
  const [tab, setTab] = useState<ToolTab>('All')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(toolCatalog[0].name)
  const [liveTools, setLiveTools] = useState(toolCatalog)

  useEffect(() => {
    let cancelled = false
    void runtime.tools.list().then((remoteTools) => {
      if (cancelled || remoteTools.length === 0) return
      const mapped = remoteTools.map((tool, index) => ({
        name: typeof tool.name === 'string' ? tool.name : typeof tool.tool_id === 'string' ? tool.tool_id : `tool-${index + 1}`,
        description: typeof tool.description === 'string' ? tool.description : 'Runtime tool',
        risk: typeof tool.risk === 'string' ? tool.risk : 'Review',
        category: typeof tool.category === 'string' ? tool.category : 'Runtime',
        enabled: tool.enabled !== false,
      }))
      setLiveTools(mapped)
      setEnabled(new Set(mapped.filter((item) => item.enabled).map((item) => item.name)))
      setSelected((current) => mapped.some((item) => item.name === current) ? current : mapped[0].name)
    }).catch(() => {
      // Keep local tool catalog while runtime is unavailable.
    }).finally(() => { if (!cancelled) setRuntimeSyncing(false) })
    return () => { cancelled = true }
  }, [])
  const [enabled, setEnabled] = useState(() => new Set(toolCatalog.filter((tool) => tool.enabled).map((tool) => tool.name)))
  const [runtimeSyncing, setRuntimeSyncing] = useState(true)

  const visible = useMemo(() => liveTools.filter((tool) => {
    if (tab === 'Enabled' && !enabled.has(tool.name)) return false
    if (tab === 'Risk' && tool.risk === 'Medium') return false
    return !query || (tool.name + ' ' + tool.description + ' ' + tool.category).toLowerCase().includes(query.toLowerCase())
  }), [enabled, liveTools, query, tab])

  const current = liveTools.find((tool) => tool.name === selected) ?? liveTools[0]

  function toggle(name: string) {
    setEnabled((state) => {
      const next = new Set(state)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
    onAction(name + ' tool toggled in preview')
  }

  return (
    <div className="tools-studio">
      <aside className="tools-studio__sidebar">
        <div className="tools-search"><Icon name="search" size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools…" aria-label="Search tools" /></div>
        <div className="tools-tabs" role="tablist" aria-label={`Tool registry filters · ${runtimeSyncing ? 'syncing' : 'runtime'}`} aria-orientation="horizontal">
          {(['All', 'Enabled', 'Risk'] as ToolTab[]).map((item, index, tabs) => <button key={item} id={'tools-tab-' + item.toLowerCase()} type="button" role="tab" tabIndex={tab === item ? 0 : -1} aria-selected={tab === item} aria-controls="tools-list-panel" className={tab === item ? 'tools-tab tools-tab--active' : 'tools-tab'} onClick={() => setTab(item)} onKeyDown={(event) => {
            const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
            if (nextIndex >= 0) { event.preventDefault(); const next = tabs[nextIndex]; setTab(next); window.requestAnimationFrame(() => document.getElementById('tools-tab-' + next.toLowerCase())?.focus()) }
          }}>{item}</button>)}
        </div>
        <div id="tools-list-panel" className="tools-list" role="tabpanel" aria-labelledby={'tools-tab-' + tab.toLowerCase()} tabIndex={0}>
          {visible.map((tool) => <button type="button" key={tool.name} className={current.name === tool.name ? 'tool-list-row tool-list-row--active' : 'tool-list-row'} onClick={() => setSelected(tool.name)}><span className="tool-list-icon"><Icon name={tool.name === 'terminal' ? 'terminal' : tool.name === 'git' ? 'git' : tool.name === 'browser' ? 'globe' : 'tool'} size={13} /></span><span><strong>{tool.name}</strong><small>{tool.category}</small></span><span className={'risk-pill risk-pill--' + tool.risk.toLowerCase()}>{tool.risk}</span></button>)}
        </div>
      </aside>
      <section className="tools-studio__detail">
        <div className="tools-detail-head"><div><span className="eyebrow">{current.category}</span><h2>{current.name}</h2><p>{current.description}</p></div><button className={enabled.has(current.name) ? 'switch switch--on' : 'switch'} type="button" role="switch" aria-checked={enabled.has(current.name)} onClick={() => toggle(current.name)}><span /></button></div>
        <div className="tools-detail-grid"><div><span>Risk</span><strong>{current.risk}</strong></div><div><span>Category</span><strong>{current.category}</strong></div><div><span>State</span><strong>{enabled.has(current.name) ? 'Enabled' : 'Disabled'}</strong></div><div><span>Approval</span><strong>{current.risk === 'Critical' ? 'Required' : 'Policy based'}</strong></div></div>
        <div className="tool-schema"><div className="surface-block__heading"><span>Schema preview</span><span className="mono-text">typed</span></div>{schemas.filter(([name]) => name.startsWith(current.name + '.')).map(([name, args, result]) => <div key={name}><strong>{name}</strong><span>{args}</span><small>{result}</small></div>)}{schemas.filter(([name]) => name.startsWith(current.name + '.')).length === 0 && <div className="review-empty">Schema details appear when the runtime registers this tool.</div>}</div>
        <div className="tool-policy-grid"><div><span>Workspace access</span><strong>Scoped</strong></div><div><span>Network access</span><strong>{current.category === 'Network' ? 'Confirm' : 'None'}</strong></div><div><span>Mutation</span><strong>{current.risk === 'Critical' ? 'Blocked by default' : 'Policy based'}</strong></div><div><span>Audit</span><strong>Recorded</strong></div></div>
        <div className="platform-actions"><button className="studio-button" type="button" onClick={() => onAction(current.name + ' test run opened in preview')}><Icon name="play" size={13} /> Test tool</button><button className="studio-button" type="button" onClick={() => onAction(current.name + ' schema copied')}><Icon name="copy" size={13} /> Copy schema</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction(current.name + ' policy editor opened in preview')}><Icon name="shield" size={13} /> Edit policy</button></div>
      </section>
    </div>
  )
}
