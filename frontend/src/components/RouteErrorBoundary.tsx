import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../lib/observability';

interface Props {
  children: ReactNode;
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
    console.error('Route error:', error, info);
    reportError(error, { componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-dark-950 p-6">
          <div className="card max-w-md text-center space-y-4">
            <h1 className="text-xl font-semibold text-dark-50">Noe gikk galt</h1>
            <p className="text-sm text-dark-400">
              En uventet feil oppstod. Last siden på nytt, eller logg inn på nytt hvis problemet vedvarer.
            </p>
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => window.location.reload()}
            >
              Last siden på nytt
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
