import { Component, type ErrorInfo, type ReactNode } from 'react'
import Icon from './Icon'

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unknown interface error',
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('AgentiCOS UI error boundary', error, info.componentStack)
  }

  reset = () => {
    this.setState({ hasError: false, message: '' })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="app-error-boundary" role="alert">
        <div className="app-error-boundary__mark"><Icon name="shield" size={22} /></div>
        <span className="eyebrow">Interface recovery</span>
        <h1>AgentiCOS could not render this workspace.</h1>
        <p>The frontend isolated a rendering failure so the desktop shell can recover without exposing runtime internals.</p>
        <div className="app-error-boundary__detail">
          <span>Error</span>
          <strong>{this.state.message || 'Unknown interface error'}</strong>
        </div>
        <div className="app-error-boundary__actions">
          <button className="studio-button studio-button--active" type="button" onClick={this.reset}>Retry surface</button>
          <button className="studio-button" type="button" onClick={() => window.location.reload()}>Reload application</button>
        </div>
      </main>
    )
  }
}
