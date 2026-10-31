import { Component, useEffect, useState, type ReactNode } from 'react';
import { Account } from './ui/Account';
import { Creator } from './ui/Creator';
import { Lifestyle } from './ui/Lifestyle';
import { NavBar } from './ui/NavBar';
import { Welcome } from './ui/Welcome';
import { World } from './ui/World';
import { useGame, type Phase } from './store/useGame';

export function App() {
  const phase = useGame((state) => state.phase);
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <main className="boot">
        <div>
          <p className="eyebrow">NairobiDiaries</p>
          <h1>Setting the street</h1>
        </div>
      </main>
    );
  }
  return (
    <ErrorBoundary>
      <div className="app-frame">
        <NavBar />
        <div className="app-stage">
          <Screen phase={phase} />
        </div>
      </div>
    </ErrorBoundary>
  );
}

function Screen({ phase }: { phase: Phase }) {
  switch (phase) {
    case 'welcome':
      return <Welcome />;
    case 'account':
      return <Account />;
    case 'create':
      return <Creator />;
    case 'lifestyle':
      return <Lifestyle />;
    case 'world':
      return <World />;
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

function useHydrated(): boolean {
  const [ready, setReady] = useState(() => useGame.persist.hasHydrated());
  useEffect(() => {
    if (useGame.persist.hasHydrated()) setReady(true);
    return useGame.persist.onFinishHydration(() => setReady(true));
  }, []);
  return ready;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  render() {
    if (this.state.message) {
      return (
        <main className="boot-error">
          <div>
            <p className="eyebrow">NairobiDiaries</p>
            <h1>The view didn’t start</h1>
            <p className="lede">{this.state.message}</p>
            <p className="fine">Use a current desktop browser with WebGL enabled, then reload.</p>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
