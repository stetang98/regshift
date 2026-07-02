import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AppShell } from './components/shell/AppShell';
import { AuditView } from './components/audit/AuditView';
import { ErrorPanel } from './components/ui/ErrorPanel';
import { ImpactView } from './components/impact/ImpactView';
import { ObligationsView } from './components/obligations/ObligationsView';
import { OverviewView } from './components/overview/OverviewView';
import { ProposalView } from './components/proposals/ProposalView';
import { ReviewView } from './components/review/ReviewView';
import { RunDataProvider, useRunData } from './hooks/useRunData';
import { useHashRoute } from './hooks/useHashRoute';

export default function App() {
  return (
    <RenderErrorBoundary>
      <RunDataProvider>
        <Routed />
      </RunDataProvider>
    </RenderErrorBoundary>
  );
}

function Routed() {
  const { route } = useHashRoute();
  const { state, retry } = useRunData();
  const section = route.segments[0] ?? '';
  const run = state.status === 'ready' ? state.bundle.run : null;

  let content: ReactNode;
  if (state.status === 'loading') {
    content = <div className="loading-panel">loading run artifacts from runs/demo/ …</div>;
  } else if (state.status === 'error') {
    content = <ErrorPanel failures={state.failures} onRetry={retry} />;
  } else {
    const bundle = state.bundle;
    switch (section) {
      case '':
        content = <OverviewView bundle={bundle} />;
        break;
      case 'obligations':
        content = <ObligationsView bundle={bundle} params={route.params} />;
        break;
      case 'impact':
        content = <ImpactView bundle={bundle} params={route.params} />;
        break;
      case 'proposals':
        content = <ProposalView bundle={bundle} proposalId={route.segments[1] ?? ''} />;
        break;
      case 'review':
        content = <ReviewView bundle={bundle} params={route.params} />;
        break;
      case 'audit':
        content = <AuditView bundle={bundle} />;
        break;
      default:
        content = <NotFound path={route.path} />;
    }
  }

  return (
    <AppShell run={run} activeSection={section}>
      {content}
    </AppShell>
  );
}

function NotFound({ path }: { path: string }) {
  return (
    <section className="panel panel-pad" role="alert">
      <h1>Route not found</h1>
      <p className="measure">
        No view is registered at <code>{path}</code>. Use the navigation above, or start at the{' '}
        <a href="#/">overview</a>.
      </p>
    </section>
  );
}

interface BoundaryState {
  error: Error | null;
}

class RenderErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('regshift: render error', error, info.componentStack);
  }

  render() {
    if (this.state.error !== null) {
      return (
        <main className="app-main">
          <section className="error-panel" role="alert">
            <h1>Something failed while rendering</h1>
            <p>
              <code>{this.state.error.message}</code>
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
