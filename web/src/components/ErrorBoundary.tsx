import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2>Terjadi Kesalahan</h2>
          <p style={{ color: '#666', margin: '16px 0' }}>{this.state.error?.message || 'Silakan muat ulang halaman.'}</p>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }} style={{ padding: '12px 24px', background: '#0061ff', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>
            Muat Ulang
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
