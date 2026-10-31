import { queuePlaces } from './nav';
import { useGame, type Phase } from '../store/useGame';

const LINKS: { id: Phase | 'places'; label: string }[] = [
  { id: 'welcome', label: 'Home' },
  { id: 'world', label: 'City' },
  { id: 'create', label: 'Wardrobe' },
  { id: 'lifestyle', label: 'Life' },
  { id: 'places', label: 'Places' },
];

export function NavBar() {
  const phase = useGame((state) => state.phase);
  const confirmed = useGame((state) => state.character.confirmed);
  const setPhase = useGame((state) => state.setPhase);
  const beginCreation = useGame((state) => state.beginCreation);
  const openWardrobe = useGame((state) => state.openWardrobe);

  const go = (id: Phase | 'places') => {
    if (id === 'welcome') {
      setPhase('welcome');
      return;
    }
    if (!confirmed) {
      const creating = phase === 'account' || phase === 'create';
      if (!creating) beginCreation();
      return;
    }
    if (id === 'places') {
      if (phase === 'world') window.dispatchEvent(new Event('nd-open-places'));
      else {
        queuePlaces();
        setPhase('world');
      }
      return;
    }
    if (id === 'create') {
      openWardrobe();
      return;
    }
    if (id === 'world' && phase === 'world') {
      window.dispatchEvent(new Event('nd-show-city'));
      return;
    }
    setPhase(id);
  };

  return (
    <nav className="app-nav" aria-label="NairobiDiaries">
      <button className="app-nav-brand" type="button" onClick={() => go('welcome')}>
        NairobiDiaries
      </button>
      <div className="app-nav-links">
        {LINKS.map((link) => {
          const current = link.id === 'places' ? false : phase === link.id;
          return (
            <button
              key={link.id}
              type="button"
              aria-current={current ? 'page' : undefined}
              title={!confirmed && (phase === 'account' || phase === 'create') ? 'Finish your character before opening this' : undefined}
              onClick={() => go(link.id)}
            >
              {link.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
