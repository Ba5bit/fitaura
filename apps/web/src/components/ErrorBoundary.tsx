import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * App-level error boundary. Without it, any render error blanks the whole app
 * (white screen). Catches render/lifecycle errors and shows a branded recovery
 * screen instead. Effects/event-handler errors are not caught by React error
 * boundaries — those are handled locally (e.g. export try/catch).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '32px',
          textAlign: 'center',
          color: 'var(--ink)',
          fontFamily: '"Hanken Grotesk", system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: 440 }}>
          <div
            style={{
              fontFamily: '"Anton", sans-serif',
              fontSize: 'clamp(30px,6vw,44px)',
              textTransform: 'uppercase',
              color: '#fff',
              lineHeight: 1,
            }}
          >
            Something broke
          </div>
          <p style={{ color: 'var(--ink-dim)', fontSize: 15, lineHeight: 1.55, margin: '16px 0 0' }}>
            The app hit an unexpected error. Your saved scans and credits are safe on your device. A reload usually
            fixes it.
          </p>
          <button
            onClick={() => window.location.assign('/')}
            style={{
              marginTop: 24,
              fontFamily: '"Hanken Grotesk"',
              fontWeight: 700,
              fontSize: 14.5,
              padding: '13px 22px',
              borderRadius: 12,
              cursor: 'pointer',
              color: 'var(--accent)',
              border: '1px solid color-mix(in oklab, var(--accent) 65%, transparent)',
              background: 'color-mix(in oklab, var(--accent) 16%, transparent)',
            }}
          >
            Reload FitAura
          </button>
        </div>
      </div>
    );
  }
}
