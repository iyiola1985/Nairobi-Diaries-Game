import { useState } from 'react';
import { FOCUSES, NEIGHBOURHOODS } from '../game/character/catalog';
import type { LifestyleFocus, Neighbourhood } from '../game/character/types';
import { StudioStage } from './Studio';
import { useGame } from '../store/useGame';

export function Lifestyle() {
  const current = useGame((state) => state.character.lifestyle);
  const setLifestyle = useGame((state) => state.setLifestyle);
  const [neighbourhood, setNeighbourhood] = useState<Neighbourhood>(current.neighbourhood);
  const [focus, setFocus] = useState<LifestyleFocus>(current.focus);

  return (
    <main className="studio-shell">
      <StudioStage frame="body" />
      <aside className="panel">
        <p className="eyebrow">Before the street</p>
        <h1>Where does the day start?</h1>
        <p className="hint">The CBD, Hurlingham, and Kilimani streets are walkable. The other neighbourhoods are saved for later districts.</p>
        <div className="section">
          <h2>Home base</h2>
          <div className="choices">
            {NEIGHBOURHOODS.map((item) => (
              <button key={item.id} type="button" className={item.id === neighbourhood ? 'choice on' : 'choice'} onClick={() => setNeighbourhood(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="section">
          <h2>Today</h2>
          <div className="choices">
            {FOCUSES.map((item) => (
              <button key={item.id} type="button" className={item.id === focus ? 'choice on' : 'choice'} onClick={() => setFocus(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <button className="btn primary" type="button" onClick={() => setLifestyle(neighbourhood, focus)}>
          Enter Nairobi
        </button>
      </aside>
    </main>
  );
}
