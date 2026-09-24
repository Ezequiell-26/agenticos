import { useState } from 'react'
import Icon from './Icon'
import { useExclusiveOverlay } from '../hooks/useExclusiveOverlay'

interface ChatEnhancementDockProps {
  onInsert: (text: string) => void
  onAction: (message: string) => void
  compact?: boolean
}

const contexts = [
  ['@files', 'Workspace files'],
  ['@diff', 'Current git diff'],
  ['@memory', 'Pinned memory'],
  ['@rules', 'Project rules'],
  ['@terminal', 'Recent terminal output'],
  ['@url', 'URL or web page'],
]

const commands = [
  ['/plan', 'Create an implementation plan'],
  ['/review', 'Review the current changes'],
  ['/research', 'Research with sources'],
  ['/fix', 'Diagnose and fix a problem'],
  ['/test', 'Build a verification plan'],
  ['/summarize', 'Summarize the current run'],
  ['/ask', 'Switch to read-only exploration'],
  ['/debug', 'Start evidence-first debugging'],
  ['/goal', 'Set a long-lived objective'],
  ['/fork', 'Fork this conversation'],
  ['/resume', 'Resume a recent session'],
  ['/compact', 'Compact the current context'],
  ['/rename', 'Rename the current session'],
  ['/rollback', 'Restore a selected checkpoint'],
  ['/memory', 'Inspect or capture persistent memory'],
  ['/session-search', 'Search previous sessions'],
  ['/cron', 'Manage scheduled agent tasks'],
  ['/delegate', 'Delegate work to a specialist subagent'],
  ['/skills', 'Browse procedural skills'],
  ['/tools', 'Inspect toolsets and execution policies'],
  ['/mcp', 'Inspect connected MCP servers'],
  ['/browser', 'Open browser control'],
  ['/voice', 'Start voice workflow'],
  ['/gateway', 'Inspect messaging gateway'],
  ['/run-everything', 'Configure automatic execution preview'],
]

export default function ChatEnhancementDock({ onInsert, onAction, compact = false }: ChatEnhancementDockProps) {
  const [open, setOpen] = useState<'context' | 'commands' | 'more' | null>(null)
  useExclusiveOverlay('chat-enhancements', open !== null, () => setOpen(null))

  function insert(value: string) {
    onInsert(value + ' ')
    setOpen(null)
  }

  const buttons: Array<{ id: 'context' | 'commands' | 'more' | null; label: string; icon: Parameters<typeof Icon>[0]['name']; title: string; onClick: () => void }> = [
    { id: 'context', label: 'Context', icon: 'archive', title: 'Context sources', onClick: () => setOpen(open === 'context' ? null : 'context') },
    { id: 'commands', label: 'Commands', icon: 'command', title: 'Slash commands', onClick: () => setOpen(open === 'commands' ? null : 'commands') },
    { id: null, label: 'Background', icon: 'cloud', title: 'Background agent task', onClick: () => onAction('Background-agent task staged in preview') },
    { id: null, label: 'Checkpoint', icon: 'git', title: 'Create checkpoint', onClick: () => onAction('Checkpoint created in preview') },
    { id: null, label: 'Branch', icon: 'branch', title: 'Branch conversation', onClick: () => onAction('Conversation branch created in preview') },
    { id: 'more', label: 'More', icon: 'more', title: 'More composer actions', onClick: () => setOpen(open === 'more' ? null : 'more') },
  ]

  return (
    <div className="chat-enhancement-dock">
      <div className={'chat-enhancement-dock__group' + (compact ? ' chat-enhancement-dock__group--compact' : '')}>
        {buttons.map((button) => (
          <button
            key={button.label}
            type="button"
            title={button.title}
            aria-label={compact ? button.title : undefined}
            className={`composer-enhance-button ${open === button.id && button.id ? 'composer-enhance-button--active' : ''}`}
            onClick={button.onClick}
          >
            <Icon name={button.icon} size={13} />{!compact && button.label}
          </button>
        ))}
      </div>

      {open && (
        <div className="chat-enhancement-popover">
          {open === 'context' && contexts.map(([value, detail]) => (
            <button type="button" key={value} onClick={() => insert(value)}><strong>{value}</strong><span>{detail}</span></button>
          ))}
          {open === 'commands' && commands.map(([value, detail]) => (
            <button type="button" key={value} onClick={() => insert(value)}><strong>{value}</strong><span>{detail}</span></button>
          ))}
          {open === 'more' && (
            <>
              <button type="button" onClick={() => onAction('Response format set to Markdown') }><strong>Markdown</strong><span>Prefer a structured text response</span></button>
              <button type="button" onClick={() => onAction('Structured output mode enabled in preview')}><strong>Structured output</strong><span>Request JSON-like response structure</span></button>
              <button type="button" onClick={() => onAction('Citations enabled in preview')}><strong>Citations</strong><span>Show source references when available</span></button>
              <button type="button" onClick={() => onAction('Voice input staged in preview')}><strong>Voice input</strong><span>Use microphone transcription when connected</span></button>
              <button type="button" onClick={() => onAction('Session fork created in preview')}><strong>Fork session</strong><span>Create a separate conversation branch</span></button>
              <button type="button" onClick={() => onAction('Context compacted in preview')}><strong>Compact context</strong><span>Reduce active context before continuing</span></button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
