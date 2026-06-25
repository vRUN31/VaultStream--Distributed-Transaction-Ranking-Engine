import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="bg-surface border border-error/20 p-6 md:p-8 rounded-2xl max-w-2xl w-full shadow-2xl">
            <div className="flex items-center gap-3 text-error mb-4">
              <AlertCircle className="w-8 h-8" />
              <h2 className="text-2xl font-headline-md">Application Error</h2>
            </div>
            <p className="text-on-surface-variant mb-6">
              A critical error occurred while rendering the interface.
            </p>
            <div className="bg-black/10 dark:bg-white/5 p-4 rounded-lg overflow-auto max-h-[400px]">
              <pre className="text-error font-code-md text-sm whitespace-pre-wrap">
                {this.state.error?.toString()}
              </pre>
              <pre className="text-on-surface-variant font-code-md text-xs mt-4 whitespace-pre-wrap">
                {this.state.errorInfo?.componentStack}
              </pre>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-6 py-2 bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 transition-opacity"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
