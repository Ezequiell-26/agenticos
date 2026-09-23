import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'
import Icon from './Icon'

interface Props { children: ReactNode }
interface State { hasError: boolean; retryKey: number }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, retryKey: 0 }

  static getDerivedStateFromError(_error: unknown): State {
    return {
      hasError: true,
      retryKey: 0,
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('AgentiCOS UI error boundary', error, info.componentStack)
  }

  reset = () => {
    this.setState((current) => ({ hasError: false, retryKey: current.retryKey + 1 }))
  }

  render() {
    if (!this.state.hasError) return <Fragment key={this.state.retryKey}>{this.props.children}</Fragment>

    return (
      <main className="app-error-boundary" role="alert" aria-live="assertive">
        <div className="app-error-boundary__mark"><Icon name="shield" size={22} /></div>
        <span className="eyebrow">Interface recovery</span>
        <h1>AgentiCOS could not render this workspace.</h1>
        <p>The frontend isolated a rendering failure so the desktop shell can recover without exposing runtime internals.</p>
        <div className="app-error-boundary__detail">
          <span>Recovery reference</span>
          <strong>UI-RECOVERY</strong>
          <small>The technical exception was captured in the developer console and is intentionally not exposed in the product surface.</small>
        </div>
        <div className="app-error-boundary__actions">
          <button className="studio-button studio-button--active" type="button" onClick={this.reset}>Retry surface</button>
          <button className="studio-button" type="button" onClick={() => window.location.reload()}>Reload application</button>
        </div>
      </main>
    )
  }
}
