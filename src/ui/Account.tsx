import { useState } from 'react';
import { identityReady, validateIdentity } from '../game/character/metrics';
import { StudioStage } from './Studio';
import { useGame } from '../store/useGame';

export function Account() {
  const character = useGame((state) => state.character);
  const commitCharacter = useGame((state) => state.commitCharacter);
  const setPhase = useGame((state) => state.setPhase);
  const [displayName, setDisplayName] = useState(character.displayName);
  const [username, setUsername] = useState(character.username);
  const [errors, setErrors] = useState<{ displayName?: string; username?: string }>({});

  const submit = () => {
    const nextErrors = validateIdentity(displayName, username);
    setErrors(nextErrors);
    if (!identityReady(displayName, username)) return;
    commitCharacter({ ...character, displayName: displayName.trim(), username });
    setPhase('create');
  };

  return (
    <main className="studio-shell">
      <StudioStage frame="body" />
      <aside className="panel">
        <p className="eyebrow">This browser</p>
        <h1>Who’s walking?</h1>
        <p className="hint">A local profile. No account server is connected, and nothing here is shared with other players.</p>
        <div className="section">
          <label className="field">
            Display name
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={24} autoComplete="nickname" />
            {errors.displayName ? <span className="error">{errors.displayName}</span> : null}
          </label>
          <label className="field">
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              maxLength={16}
              autoComplete="off"
              spellCheck={false}
            />
            {errors.username ? <span className="error">{errors.username}</span> : null}
          </label>
        </div>
        <div className="actions">
          <button className="btn primary" type="button" onClick={submit}>
            Continue to the studio
          </button>
          <button className="btn" type="button" onClick={() => setPhase('welcome')}>
            Back
          </button>
        </div>
      </aside>
    </main>
  );
}
