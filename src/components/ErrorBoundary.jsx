import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Generic Error Boundary — catches render crashes so the page shows a
 * helpful error message instead of a blank white screen. Wrap any
 * component that might crash (e.g. a settings tab) in <ErrorBoundary>.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
    this.setState({ componentStack: info?.componentStack || null });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, componentStack: null });
  };

  render() {
    if (this.state.hasError) {
      const stack = this.state.componentStack || this.state.error?.stack || '';
      return (
        <div className="flex flex-col items-center justify-center text-center px-6 py-16 min-h-[60vh]">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-amber-500" />
          </div>
          <p className="text-base font-semibold text-slate-800 mb-1">Something went wrong loading this section</p>
          <p className="text-sm text-slate-500 max-w-md mb-1">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          {stack && (
            <details className="mt-3 max-w-2xl w-full text-left">
              <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">Show error details</summary>
              <pre className="mt-2 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                {stack}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleRetry}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}