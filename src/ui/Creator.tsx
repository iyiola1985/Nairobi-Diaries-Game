import { useEffect, useState } from 'react';
import {
  BAGS,
  BLUSH_COLORS,
  BODY_STARTS,
  BOTTOMS,
  BROW_COLORS,
  CLOTH_COLORS,
  DRESSES,
  EYE_COLORS,
  EYESHADOW_COLORS,
  FACIAL_HAIR,
  FOCUSES,
  HAIR_COLORS,
  HAIR_STYLES,
  HEADWEAR,
  LIP_COLORS,
  NAILS,
  PRESENTATIONS,
  SHOES,
  SKIN_TONES,
  TOPS,
  labelOf,
} from '../game/character/catalog';
import { identityReady, naturalLip, validateIdentity } from '../game/character/metrics';
import { cycleBody, nextIndex, randomizeCategory, resetCategory } from '../game/character/mutate';
import { STYLE_PRESETS, applyPreset } from '../game/character/presets';
import { CHARACTER_PIPELINE, MISSING_CHARACTER_ASSETS } from '../game/character/pipeline';
import type { CharacterConfig, CreatorTab } from '../game/character/types';
import { DressingRoom } from './DressingRoom';
import { StudioStage, nudgeStudio, type StudioFrame } from './Studio';
import { useGame } from '../store/useGame';

const TABS: { id: CreatorTab; label: string }[] = [
  { id: 'appearance', label: 'You' },
  { id: 'clothing', label: 'Dress' },
  { id: 'face', label: 'Mirror' },
  { id: 'hair', label: 'Hair' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'accessories', label: 'Bags and hats' },
  { id: 'body', label: 'Body' },
  { id: 'final', label: 'Final look' },
];

export function Creator() {
  const character = useGame((state) => state.character);
  const commitCharacter = useGame((state) => state.commitCharacter);
  const undo = useGame((state) => state.undo);
  const redo = useGame((state) => state.redo);
  const confirmCharacter = useGame((state) => state.confirmCharacter);
  const saveLook = useGame((state) => state.saveLook);
  const loadLook = useGame((state) => state.loadLook);
  const savedLooks = useGame((state) => state.savedLooks);
  const creatorReturn = useGame((state) => state.creatorReturn);
  const setPhase = useGame((state) => state.setPhase);
  const [tab, setTab] = useState<CreatorTab>(creatorReturn === 'world' ? 'clothing' : 'appearance');
  const [frame, setFrame] = useState<StudioFrame>('body');
  const [pose, setPose] = useState<'stand' | 'walk'>('stand');
  const [lookName, setLookName] = useState('First look');
  const [errors, setErrors] = useState<{ displayName?: string; username?: string }>({});

  useEffect(() => {
    if (tab === 'face' || tab === 'hair') setFrame('face');
    else if (tab === 'shoes') setFrame('shoes');
    else setFrame('body');
  }, [tab]);

  const patch = (next: CharacterConfig) => commitCharacter(next);
  const ready = identityReady(character.displayName, character.username);

  const confirm = () => {
    const nextErrors = validateIdentity(character.displayName, character.username);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setTab('appearance');
      return;
    }
    confirmCharacter();
  };

  return (
    <main className="studio-shell">
      <div className="stage-wrap">
        <StudioStage frame={frame} pose={pose} />
        <div className="stage-tools">
          {(['body', 'face', 'shoes'] as const).map((item) => (
            <button key={item} className={frame === item ? 'btn small primary' : 'btn small'} type="button" onClick={() => setFrame(item)}>
              {item === 'body' ? 'Full body' : item === 'face' ? 'Face' : 'Shoes'}
            </button>
          ))}
          <button className={pose === 'stand' ? 'btn small primary' : 'btn small'} type="button" onClick={() => setPose('stand')}>Stand</button>
          <button className={pose === 'walk' ? 'btn small primary' : 'btn small'} type="button" onClick={() => setPose('walk')}>Walk</button>
          <button className="btn small" type="button" onClick={() => nudgeStudio({ yaw: 0.5, zoom: 1 })}>Turn left</button>
          <button className="btn small" type="button" onClick={() => nudgeStudio({ yaw: -0.5, zoom: 1 })}>Turn right</button>
          <button className="btn small" type="button" onClick={() => nudgeStudio({ yaw: 0, zoom: 0.82 })}>Zoom in</button>
          <button className="btn small" type="button" onClick={() => nudgeStudio({ yaw: 0, zoom: 1.18 })}>Zoom out</button>
        </div>
      </div>
      <aside className="panel">
        <p className="eyebrow">Avatar studio</p>
        <h1>{character.displayName || 'New character'}</h1>
        <div className="toolbar">
          <button className="btn small" type="button" onClick={undo}>Undo</button>
          <button className="btn small" type="button" onClick={redo}>Redo</button>
          <button className="btn small" type="button" onClick={() => patch(randomizeCategory(character, tab))}>Randomise chapter</button>
          <button className="btn small" type="button" onClick={() => patch(resetCategory(character, tab))}>Reset tab</button>
        </div>
        <div className="tabs" role="tablist">
          {TABS.map((item) => (
            <button key={item.id} className={tab === item.id ? 'tab on' : 'tab'} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <TabPanel tab={tab} character={character} patch={patch} errors={errors} lookName={lookName} setLookName={setLookName} onDress={() => setTab('clothing')} />
        <div className="actions">
          <button className="btn primary" type="button" onClick={confirm} disabled={!ready && tab !== 'appearance'}>
            {creatorReturn === 'world' ? 'Save and return' : 'Confirm character'}
          </button>
          <button className="btn" type="button" onClick={() => saveLook(lookName)}>Save look</button>
          {creatorReturn === 'world' ? (
            <button className="btn" type="button" onClick={() => setPhase('world')}>Back to the city</button>
          ) : null}
        </div>
        {savedLooks.length > 0 ? (
          <div className="section">
            <h2>Saved looks</h2>
            <div className="choices">
              {savedLooks.map((look) => (
                <button key={look.id} className="choice" type="button" onClick={() => loadLook(look.id)}>
                  {look.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <p className="fine">
          Drag to turn the figure, or use Turn and Zoom. Stand holds the arms at rest. Walk plays Strut Walking, and Jogging plays when you run in the city. Clothes, hair, shoes, and extras are worn on the supplied character here and in the city. The face stays that model. Source: {CHARACTER_PIPELINE.source}. Missing: {MISSING_CHARACTER_ASSETS[0]}.
        </p>
      </aside>
    </main>
  );
}

function TabPanel({
  tab,
  character,
  patch,
  errors,
  lookName,
  setLookName,
  onDress,
}: {
  tab: CreatorTab;
  character: CharacterConfig;
  patch: (next: CharacterConfig) => void;
  errors: { displayName?: string; username?: string };
  lookName: string;
  setLookName: (value: string) => void;
  onDress: () => void;
}) {
  switch (tab) {
    case 'appearance':
      return (
        <div className="section">
          <label className="field">
            Display name
            <input value={character.displayName} onChange={(event) => patch({ ...character, displayName: event.target.value })} />
            {errors.displayName ? <span className="error">{errors.displayName}</span> : null}
          </label>
          <label className="field">
            Username
            <input
              value={character.username}
              spellCheck={false}
              onChange={(event) => patch({ ...character, username: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
            />
            {errors.username ? <span className="error">{errors.username}</span> : null}
          </label>
          <h2>Presentation</h2>
          <Cycle
            label={labelOf(PRESENTATIONS, character.presentation)}
            onPrev={() => patch({ ...character, presentation: step(PRESENTATIONS, character.presentation, -1) })}
            onNext={() => patch({ ...character, presentation: step(PRESENTATIONS, character.presentation, 1) })}
          />
          <div className="choices">
            {PRESENTATIONS.map((item) => (
              <button key={item.id} className={item.id === character.presentation ? 'choice on' : 'choice'} type="button" onClick={() => patch({ ...character, presentation: item.id })}>
                {item.label}
              </button>
            ))}
          </div>
          <h2>Skin</h2>
          <Swatches colors={SKIN_TONES} value={character.skin} onPick={(hex) => patch({ ...character, skin: hex })} />
          <h2>Clothes</h2>
          <button className="btn" type="button" onClick={onDress}>Dress this character</button>
          <p className="hint">You can change the outfit before you enter the city, and again from Wardrobe after the game has started.</p>
          <h2>Starting looks</h2>
          <div className="choices">
            {STYLE_PRESETS.map((preset) => (
              <button key={preset.id} className="choice" type="button" onClick={() => patch(applyPreset(character, preset.id))}>
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      );
    case 'face':
      return (
        <div className="section">
          <h2>Eyes</h2>
          <Swatches colors={EYE_COLORS} value={character.face.eyeColor} onPick={(hex) => patch({ ...character, face: { ...character.face, eyeColor: hex } })} />
          <Slider label="Eye size" value={character.face.eyeSize} onChange={(value) => useGame.getState().previewCharacter({ ...character, face: { ...character.face, eyeSize: value } })} />
          <Slider label="Eye spacing" value={character.face.eyeSpacing} onChange={(value) => useGame.getState().previewCharacter({ ...character, face: { ...character.face, eyeSpacing: value } })} />
          <Slider label="Brows" value={character.face.brow} onChange={(value) => useGame.getState().previewCharacter({ ...character, face: { ...character.face, brow: value } })} />
          <Slider label="Face width" value={character.face.shape} onChange={(value) => useGame.getState().previewCharacter({ ...character, face: { ...character.face, shape: value } })} />
          <Slider label="Jaw" value={character.face.jaw} onChange={(value) => useGame.getState().previewCharacter({ ...character, face: { ...character.face, jaw: value } })} />
          <Slider label="Cheeks" value={character.face.cheeks} onChange={(value) => useGame.getState().previewCharacter({ ...character, face: { ...character.face, cheeks: value } })} />
          <Slider label="Forehead" value={character.face.forehead} onChange={(value) => useGame.getState().previewCharacter({ ...character, face: { ...character.face, forehead: value } })} />
          <Slider label="Chin" value={character.face.chin} onChange={(value) => useGame.getState().previewCharacter({ ...character, face: { ...character.face, chin: value } })} />
          <Slider label="Nose width" value={character.face.noseWidth} onChange={(value) => useGame.getState().previewCharacter({ ...character, face: { ...character.face, noseWidth: value } })} />
          <Slider label="Nose length" value={character.face.noseLength} onChange={(value) => useGame.getState().previewCharacter({ ...character, face: { ...character.face, noseLength: value } })} />
          <Slider label="Lips" value={character.face.lipFullness} onChange={(value) => useGame.getState().previewCharacter({ ...character, face: { ...character.face, lipFullness: value } })} />
          <h2>Brows</h2>
          <Swatches colors={BROW_COLORS} value={character.makeup.browColor} onPick={(browColor) => patch({ ...character, makeup: { ...character.makeup, browColor } })} />
          <h2>Eyeshadow</h2>
          <NullableSwatches
            colors={EYESHADOW_COLORS}
            value={character.makeup.eyeshadow}
            onPick={(eyeshadow) => patch({ ...character, makeup: { ...character.makeup, eyeshadow } })}
          />
          <h2>Lashes and liner</h2>
          <Slider label="Lashes" value={character.makeup.lashes} onChange={(value) => useGame.getState().previewCharacter({ ...character, makeup: { ...character.makeup, lashes: value } })} />
          <Slider label="Eyeliner" value={character.makeup.eyeliner} onChange={(value) => useGame.getState().previewCharacter({ ...character, makeup: { ...character.makeup, eyeliner: value } })} />
          <h2>Blush</h2>
          <NullableSwatches
            colors={BLUSH_COLORS}
            value={character.makeup.blush}
            onPick={(blush) => patch({ ...character, makeup: { ...character.makeup, blush } })}
          />
          <h2>Lips</h2>
          <div className="swatches">
            {LIP_COLORS.map((item) => {
              const selected = item.hex === null ? character.makeup.lipstick === null : character.makeup.lipstick === item.hex;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={selected ? 'swatch on' : 'swatch'}
                  style={{ background: item.hex ?? naturalLip(character.skin) }}
                  aria-label={item.label}
                  aria-pressed={selected}
                  onClick={() => patch({ ...character, makeup: { ...character.makeup, lipstick: item.hex } })}
                />
              );
            })}
          </div>
          <Slider label="Foundation" value={character.makeup.foundation} onChange={(value) => useGame.getState().previewCharacter({ ...character, makeup: { ...character.makeup, foundation: value } })} />
          <p className="hint">This face stays on when you open Wardrobe.</p>
        </div>
      );
    case 'hair':
      return (
        <div className="section">
          <Cycle
            label={labelOf(HAIR_STYLES, character.hair.style)}
            onPrev={() => patch({ ...character, hair: { ...character.hair, style: step(HAIR_STYLES, character.hair.style, -1) } })}
            onNext={() => patch({ ...character, hair: { ...character.hair, style: step(HAIR_STYLES, character.hair.style, 1) } })}
          />
          <div className="choices">
            {HAIR_STYLES.map((item) => (
              <button key={item.id} className={item.id === character.hair.style ? 'item on' : 'item'} type="button" onClick={() => patch({ ...character, hair: { ...character.hair, style: item.id } })}>
                {item.label}
              </button>
            ))}
          </div>
          <h2>Hair colour</h2>
          <Swatches colors={HAIR_COLORS} value={character.hair.color} onPick={(hex) => patch({ ...character, hair: { ...character.hair, color: hex } })} />
          <h2>Facial hair</h2>
          <div className="choices">
            {FACIAL_HAIR.map((item) => (
              <button key={item.id} className={item.id === character.facialHair.style ? 'item on' : 'item'} type="button" onClick={() => patch({ ...character, facialHair: { ...character.facialHair, style: item.id } })}>
                {item.label}
              </button>
            ))}
          </div>
          <Swatches colors={HAIR_COLORS} value={character.facialHair.color} onPick={(hex) => patch({ ...character, facialHair: { ...character.facialHair, color: hex } })} />
        </div>
      );
    case 'body':
      return (
        <div className="section">
          <Cycle
            label={BODY_STARTS.find((item) => Math.abs(item.height - character.body.height) < 0.03)?.label ?? 'Custom'}
            onPrev={() => patch(cycleBody(character, -1))}
            onNext={() => patch(cycleBody(character, 1))}
          />
          <Slider label="Height" value={character.body.height} onChange={(value) => useGame.getState().previewCharacter({ ...character, body: { ...character.body, height: value } })} />
          <Slider label="Build" value={character.body.build} onChange={(value) => useGame.getState().previewCharacter({ ...character, body: { ...character.body, build: value } })} />
          <Slider label="Shoulders" value={character.body.shoulder} onChange={(value) => useGame.getState().previewCharacter({ ...character, body: { ...character.body, shoulder: value } })} />
          <Slider label="Hips" value={character.body.hip} onChange={(value) => useGame.getState().previewCharacter({ ...character, body: { ...character.body, hip: value } })} />
        </div>
      );
    case 'clothing':
      return <DressingRoom character={character} patch={patch} />;
    case 'shoes':
      return (
        <div className="section">
          <ItemRow
            label={labelOf(SHOES, character.shoes.style)}
            items={SHOES}
            selected={character.shoes.style}
            onPick={(style) => patch({ ...character, shoes: { ...character.shoes, style } })}
          />
          <Swatches colors={CLOTH_COLORS} value={character.shoes.color} onPick={(color) => patch({ ...character, shoes: { ...character.shoes, color } })} />
        </div>
      );
    case 'accessories':
      return (
        <div className="section">
          <h2>Headwear</h2>
          <ItemRow
            label={labelOf(HEADWEAR, character.accessories.headwear)}
            items={HEADWEAR}
            selected={character.accessories.headwear}
            onPick={(headwear) => patch({ ...character, accessories: { ...character.accessories, headwear } })}
          />
          <Swatches colors={CLOTH_COLORS} value={character.accessories.headwearColor} onPick={(headwearColor) => patch({ ...character, accessories: { ...character.accessories, headwearColor } })} />
          <h2>Bag</h2>
          <ItemRow
            label={labelOf(BAGS, character.accessories.bag)}
            items={BAGS}
            selected={character.accessories.bag}
            onPick={(bag) => patch({ ...character, accessories: { ...character.accessories, bag } })}
          />
          <Swatches colors={CLOTH_COLORS} value={character.accessories.bagColor} onPick={(bagColor) => patch({ ...character, accessories: { ...character.accessories, bagColor } })} />
          <h2>Details</h2>
          <div className="choices">
            <Toggle on={character.accessories.glasses} label="Glasses" onClick={() => patch({ ...character, accessories: { ...character.accessories, glasses: !character.accessories.glasses } })} />
            <Toggle on={character.accessories.earrings} label="Earrings" onClick={() => patch({ ...character, accessories: { ...character.accessories, earrings: !character.accessories.earrings } })} />
            <Toggle on={character.accessories.chain} label="Chain" onClick={() => patch({ ...character, accessories: { ...character.accessories, chain: !character.accessories.chain } })} />
            <Toggle on={character.accessories.watch} label="Watch" onClick={() => patch({ ...character, accessories: { ...character.accessories, watch: !character.accessories.watch } })} />
          </div>
          <h2>Nails</h2>
          <ItemRow
            label={labelOf(NAILS, character.nails.style)}
            items={NAILS}
            selected={character.nails.style}
            onPick={(style) => patch({ ...character, nails: { ...character.nails, style } })}
          />
          <Swatches colors={LIP_COLORS.flatMap((item) => (item.hex ? [{ id: item.id, label: item.label, hex: item.hex }] : []))} value={character.nails.color} onPick={(color) => patch({ ...character, nails: { ...character.nails, color } })} />
        </div>
      );
    case 'final':
      return (
        <div className="section">
          <h2>This look</h2>
          <p>
            {labelOf(PRESENTATIONS, character.presentation)} · {labelOf(HAIR_STYLES, character.hair.style)} ·{' '}
            {character.clothing.dress !== 'none' ? labelOf(DRESSES, character.clothing.dress) : `${labelOf(TOPS, character.clothing.top)}, ${labelOf(BOTTOMS, character.clothing.bottom)}`} ·{' '}
            {labelOf(SHOES, character.shoes.style)}
          </p>
          <p className="hint">Home base later: {character.lifestyle.neighbourhood}. Focus: {labelOf(FOCUSES, character.lifestyle.focus)}.</p>
          <label className="field">
            Look name
            <input value={lookName} onChange={(event) => setLookName(event.target.value)} maxLength={24} />
          </label>
        </div>
      );
    default: {
      const _exhaustive: never = tab;
      return _exhaustive;
    }
  }
}

function step<T extends string>(items: { id: T }[], current: T, direction: 1 | -1): T {
  const index = Math.max(0, items.findIndex((item) => item.id === current));
  return items[nextIndex(index, items.length, direction)].id;
}

function NullableSwatches({
  colors,
  value,
  onPick,
}: {
  colors: { id: string; label: string; hex: string | null }[];
  value: string | null;
  onPick: (hex: string | null) => void;
}) {
  return (
    <div className="swatches">
      {colors.map((color) => {
        const selected = color.hex === value;
        return (
          <button
            key={color.id}
            type="button"
            className={selected ? 'swatch on' : 'swatch'}
            style={{ background: color.hex ?? '#f4f0e8' }}
            aria-label={color.label}
            aria-pressed={selected}
            onClick={() => onPick(color.hex)}
          />
        );
      })}
    </div>
  );
}

function Swatches({ colors, value, onPick }: { colors: { id: string; label: string; hex: string }[]; value: string; onPick: (hex: string) => void }) {
  return (
    <div className="swatches">
      {colors.map((color) => (
        <button
          key={color.id}
          type="button"
          className={color.hex === value ? 'swatch on' : 'swatch'}
          style={{ background: color.hex }}
          aria-label={color.label}
          aria-pressed={color.hex === value}
          onClick={() => onPick(color.hex)}
        />
      ))}
    </div>
  );
}

function Cycle({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="cycle">
      <button className="btn small" type="button" onClick={onPrev} aria-label={`Previous ${label}`}>Prev</button>
      <strong>{label}</strong>
      <button className="btn small" type="button" onClick={onNext} aria-label={`Next ${label}`}>Next</button>
    </div>
  );
}

function ItemRow<T extends string>({
  label,
  items,
  selected,
  onPick,
}: {
  label: string;
  items: { id: T; label: string }[];
  selected: T;
  onPick: (id: T) => void;
}) {
  return (
    <>
      <Cycle label={label} onPrev={() => onPick(step(items, selected, -1))} onNext={() => onPick(step(items, selected, 1))} />
      <div className="choices">
        {items.map((item) => (
          <button key={item.id} className={item.id === selected ? 'item on' : 'item'} type="button" onClick={() => onPick(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button className={on ? 'choice on' : 'choice'} type="button" aria-pressed={on} onClick={onClick}>
      {label}
    </button>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const beginGesture = useGame((state) => state.beginGesture);
  const endGesture = useGame((state) => state.endGesture);
  return (
    <label className="slider">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onFocus={beginGesture}
        onPointerDown={beginGesture}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        onPointerUp={endGesture}
        onBlur={endGesture}
      />
    </label>
  );
}
