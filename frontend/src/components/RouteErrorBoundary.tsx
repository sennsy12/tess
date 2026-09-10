import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../lib/observability';

interface Props {
  children: ReactNode;
  /** Reset the boundary when this key changes (e.g. location.pathname). */
  resetKey?: string;
}

interface State {
  hasError: boolean;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // console preserved for local debugging; telemetry carries the payload.
    console.error('Route error:', error, info);
    reportError(error, { componentStack: info.componentStack });
  }

  componentDidUpdate(prevProps: Props) {
    // One route crash must not kill the whole shell forever — reset on
    // navigation so the next page gets a clean boundary.
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-dark-950 p-6">
          <div className="card max-w-md text-center space-y-4">
            <h1 className="text-xl font-semibold text-dark-50">Noe gikk galt</h1>
            <p className="text-sm text-dark-400">
              En uventet feil oppstod. Prøv igjen, eller last siden på nytt hvis problemet vedvarer.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => this.setState({ hasError: false })}
              >
                Prøv igjen
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => window.location.reload()}
              >
                Last siden på nytt
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
