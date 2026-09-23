import { useState } from 'react'
import Icon from './Icon'

interface ChatEnhancementDockProps {
  onInsert: (text: string) => void
  onAction: (message: string) => void
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
  ['/run-everything', 'Configure automatic execution preview'],
]

export default function ChatEnhancementDock({ onInsert, onAction }: ChatEnhancementDockProps) {
  const [open, setOpen] = useState<'context' | 'commands' | 'more' | null>(null)

  function insert(value: string) {
    onInsert(value + ' ')
    setOpen(null)
  }

  return (
    <div className="chat-enhancement-dock">
      <div className="chat-enhancement-dock__group">
        <button type="button" className={`composer-enhance-button ${open === 'context' ? 'composer-enhance-button--active' : ''}`} onClick={() => setOpen(open === 'context' ? null : 'context')}>
          <Icon name="archive" size={13} /> Context
        </button>
        <button type="button" className={`composer-enhance-button ${open === 'commands' ? 'composer-enhance-button--active' : ''}`} onClick={() => setOpen(open === 'commands' ? null : 'commands')}>
          <Icon name="command" size={13} /> Commands
        </button>
        <button type="button" className="composer-enhance-button" onClick={() => onAction('Background-agent task staged in preview')}>
          <Icon name="cloud" size={13} /> Background
        </button>
        <button type="button" className="composer-enhance-button" onClick={() => onAction('Checkpoint created in preview')}>
          <Icon name="git" size={13} /> Checkpoint
        </button>
        <button type="button" className="composer-enhance-button" onClick={() => onAction('Conversation branch created in preview')}>
          <Icon name="branch" size={13} /> Branch
        </button>
        <button type="button" className={`composer-enhance-button ${open === 'more' ? 'composer-enhance-button--active' : ''}`} onClick={() => setOpen(open === 'more' ? null : 'more')}>
          <Icon name="more" size={13} /> More
        </button>
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
