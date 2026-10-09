// Time log (10 Oct 2026): created 1:34 AM by Claude Code · last changed 1:34 AM
// Keeps one broken part from blanking the whole page. The orb's 3D view can fail when the GPU runs out of memory
// (Ollama, the speech model and Sign mode all share a 4 GB GPU); without this, React would unmount everything.
import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; fallback: (error: Error, retry: () => void) => ReactNode; retryAfterMs?: number }

export class ErrorBoundary extends Component<Props, { error: Error | null; attempt: number }> {
  state = { error: null as Error | null, attempt: 0 };
  private timer = 0;
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) {
    console.warn('Autonoma recovered from an error:', error);
    if (this.props.retryAfterMs) this.timer = window.setTimeout(this.retry, this.props.retryAfterMs);
  }
  componentWillUnmount() { clearTimeout(this.timer); }
  retry = () => this.setState(({ attempt }) => ({ error: null, attempt: attempt + 1 }));
  render() {
    if (this.state.error) return this.props.fallback(this.state.error, this.retry);
    // A new key remounts the children from scratch on retry.
    return <div key={this.state.attempt} style={{ display: 'contents' }}>{this.props.children}</div>;
  }
}
