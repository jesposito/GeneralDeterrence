import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryState { failed: boolean }

export const sanitizeErrorMessage = (message: string) => message
  .replace(/https?:\/\/\S+/g, '[url]')
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
  .slice(0, 500);

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application error:', error, info.componentStack);
    const message = sanitizeErrorMessage(error.message || 'Unknown application error');
    void fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, screen: window.location.pathname.slice(0, 40) }),
      keepalive: true,
    }).catch(() => { /* recovery UI must work offline */ });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app-min-vh bg-gray-950 text-white flex items-center justify-center p-5">
        <section role="alert" aria-labelledby="error-title" className="w-full max-w-lg border-4 border-pink-500 bg-gray-900 rounded-lg p-6 text-center shadow-2xl shadow-pink-500/30">
          <h1 id="error-title" className="text-3xl font-display font-bold text-pink-400 text-glow-pink">Patrol interrupted</h1>
          <p className="mt-3 text-gray-300 font-sans">The game hit an unexpected error. Your completed results remain stored.</p>
          <div className="mt-6 grid sm:grid-cols-2 gap-3">
            <button type="button" onClick={() => window.location.assign(window.location.pathname)} className="bg-cyan-700 hover:bg-cyan-600 border-2 border-cyan-400 rounded-lg px-4 py-3 font-display font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300">Return to title</button>
            <button type="button" onClick={() => window.location.reload()} className="bg-pink-600 hover:bg-pink-500 border-2 border-pink-400 rounded-lg px-4 py-3 font-display font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300">Reload</button>
          </div>
        </section>
      </main>
    );
  }
}

export default ErrorBoundary;
