import type { ConversationSummary } from '../types/runtime'
import Icon from './Icon'

interface WorkspaceSidebarProps {
  conversations: ConversationSummary[]
  activeConversation: string
  onSelectConversation: (id: string) => void
  onCreateConversation: () => void
  onOpenSearch: () => void
  runtimeConnected: boolean
}

export default function WorkspaceSidebar({
  conversations,
  activeConversation,
  onSelectConversation,
  onCreateConversation,
  onOpenSearch,
  runtimeConnected,
}: WorkspaceSidebarProps) {
  return (
    <aside className="workspace-sidebar">
      <div className="workspace-sidebar__header">
        <div>
          <div className="eyebrow">Workspace</div>
          <div className="workspace-title">Local Agent</div>
        </div>
        <button className="icon-button" aria-label="New conversation" title="New conversation" onClick={onCreateConversation} type="button">
          <Icon name="plus" size={17} />
        </button>
      </div>

      <div className="workspace-switcher">
        <div className="workspace-avatar">A</div>
        <div className="workspace-switcher__copy">
          <strong>AgentiCOS</strong>
          <span>Personal workspace</span>
        </div>
        <Icon name="chevron-right" size={15} />
      </div>

      <button className="search-field" onClick={onOpenSearch} type="button">
        <Icon name="search" size={15} />
        <span>Search workspace</span>
        <kbd>⌘K</kbd>
      </button>

      <div className="sidebar-section">
        <div className="sidebar-section__title">
          <span>Conversations</span>
          <span className="count-pill">{conversations.length}</span>
        </div>

        <div className="conversation-list">
          {conversations.length === 0 ? (
            <div className="sidebar-empty">No saved conversations yet.</div>
          ) : (
            conversations.map((conversation) => (
              <button
                className={`conversation-row ${activeConversation === conversation.id ? 'conversation-row--active' : ''}`}
                key={conversation.id}
                onClick={() => onSelectConversation(conversation.id)}
                type="button"
              >
                <div className="conversation-row__icon">
                  <Icon name={conversation.pinned ? 'archive' : 'message'} size={15} />
                </div>
                <div className="conversation-row__copy">
                  <strong>{conversation.title}</strong>
                  <span>{conversation.preview}</span>
                </div>
                <time>{new Date(conversation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="mini-status">
          <span className={`status-dot ${runtimeConnected ? 'status-dot--live' : 'status-dot--offline'}`} />
          <span>{runtimeConnected ? 'Runtime online' : 'Runtime offline'}</span>
        </div>
        <button className="sidebar-footer__action" title="Command palette" aria-label="Command palette" type="button" onClick={onOpenSearch}>
          <Icon name="command" size={15} />
        </button>
      </div>
    </aside>
  )
}
