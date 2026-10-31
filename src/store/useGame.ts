import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CharacterConfig, LifestyleFocus, Neighbourhood, SavedLook } from '../game/character/types';
import { completeCharacter, createDefaultCharacter } from '../game/character/presets';
import { buyCar, buyHome, buyMeal, buyShopping, completeLife, dance, drink, emptyLife, helpOut, payFare, payRide, rest, tickNeeds, workShift, type FurnitureId, type LifeState } from '../game/life/economy';
import { applyFloor, applyLook, applyWall, chooseLoan, chooseScratch, movePiece, placePiece, removePiece, repayLoan, rotatePiece, type FloorId, type Opening, type PieceId, type WallHeight, type WallId } from '../game/life/house';
import { applyTemplate, clearPlan, drawRoom, drawWall, eraseWall, markOpening, setWallHeight, type PlanTemplateId } from '../game/life/plan';
export type Phase = 'welcome' | 'account' | 'create' | 'lifestyle' | 'world';
export type TimeOfDay = 'day' | 'sunset' | 'evening' | 'night';

interface CampaignStat {
  impressions: number;
  interactions: number;
}

interface GameStore {
  phase: Phase;
  creatorReturn: 'lifestyle' | 'world';
  character: CharacterConfig;
  history: CharacterConfig[];
  future: CharacterConfig[];
  gesture: CharacterConfig | null;
  savedLooks: SavedLook[];
  timeOfDay: TimeOfDay;
  campaignStats: Record<string, CampaignStat>;
  routeTargetId: string | null;
  life: LifeState;
  notice: string;
  setPhase: (phase: Phase) => void;
  beginCreation: () => void;
  openWardrobe: () => void;
  commitCharacter: (next: CharacterConfig) => void;
  previewCharacter: (next: CharacterConfig) => void;
  beginGesture: () => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;
  confirmCharacter: () => void;
  saveLook: (name: string) => void;
  loadLook: (id: string) => void;
  setLifestyle: (neighbourhood: Neighbourhood, focus: LifestyleFocus) => void;
  setTimeOfDay: (time: TimeOfDay) => void;
  recordImpression: (id: string) => void;
  recordInteraction: (id: string) => void;
  setRouteTarget: (id: string | null) => void;
  applyLife: (result: { ok: boolean; life: LifeState; message: string }) => void;
  earnShift: (open: boolean) => void;
  spendMeal: (open: boolean) => void;
  spendShopping: (open: boolean) => void;
  purchaseHome: (x: number, z: number) => boolean;
  purchaseCar: () => void;
  purchaseFurniture: (id: FurnitureId) => boolean;
  arriveFromVillage: () => void;
  arriveWithNothing: () => void;
  repayVillageLoan: () => void;
  paintFloor: (id: FloorId) => void;
  paintWall: (id: WallId) => void;
  useRoomLook: (id: 'timber' | 'plaster' | 'courtyard') => void;
  addPiece: (id: PieceId) => void;
  nudgePiece: (uid: string, axis: 'x' | 'z', step: number) => void;
  turnPiece: (uid: string) => void;
  sellPiece: (uid: string) => void;
  drawPlanWall: (x1: number, z1: number, x2: number, z2: number) => void;
  drawPlanRoom: (x1: number, z1: number, x2: number, z2: number) => void;
  markPlanOpening: (uid: string, opening: Opening) => void;
  erasePlanWall: (uid: string) => void;
  clearPlanWalls: () => void;
  usePlanTemplate: (id: PlanTemplateId) => void;
  setPlanHeight: (height: WallHeight) => void;
  drive: () => boolean;
  tickBody: (moving: boolean, pace: 'walk' | 'run' | 'sprint') => void;
  takeDrink: () => void;
  takeRest: () => void;
  takeDance: () => boolean;
  takeTask: () => void;
  payForRide: (coins: number, label: string) => boolean;
}

function take(result: { life: LifeState; message: string }) {
  return { life: result.life, notice: result.message };
}

type Persistable = Pick<GameStore, 'phase' | 'creatorReturn' | 'character' | 'savedLooks' | 'timeOfDay' | 'campaignStats' | 'life'>;

/** Fields that survive a refresh. An in-progress walk is not one of them. */
export function persistedGameSlice(state: Persistable) {
  return {
    phase: state.phase,
    creatorReturn: state.creatorReturn,
    character: state.character,
    savedLooks: state.savedLooks,
    timeOfDay: state.timeOfDay,
    campaignStats: state.campaignStats,
    life: state.life,
  };
}

export const useGame = create<GameStore>()(
  persist(
    (set) => ({
      phase: 'welcome',
      creatorReturn: 'lifestyle',
      character: createDefaultCharacter(),
      history: [],
      future: [],
      gesture: null,
      savedLooks: [],
      timeOfDay: 'sunset',
      campaignStats: {},
      routeTargetId: null,
      life: emptyLife(),
      notice: '',
      setPhase: (phase) => set({ phase }),
      beginCreation: () => set({ phase: 'account', creatorReturn: 'lifestyle' }),
      openWardrobe: () => set({ phase: 'create', creatorReturn: 'world' }),
      commitCharacter: (next) =>
        set((state) => ({
          character: next,
          history: [...state.history, state.character].slice(-40),
          future: [],
        })),
      previewCharacter: (next) => set({ character: next }),
      beginGesture: () =>
        set((state) => (state.gesture ? {} : { gesture: structuredClone(state.character) })),
      endGesture: () =>
        set((state) =>
          state.gesture
            ? { history: [...state.history, state.gesture].slice(-40), future: [], gesture: null }
            : {},
        ),
      undo: () =>
        set((state) => {
          const previous = state.history[state.history.length - 1];
          if (!previous) return {};
          return {
            character: previous,
            history: state.history.slice(0, -1),
            future: [...state.future, state.character],
          };
        }),
      redo: () =>
        set((state) => {
          const next = state.future[state.future.length - 1];
          if (!next) return {};
          return {
            character: next,
            future: state.future.slice(0, -1),
            history: [...state.history, state.character].slice(-40),
          };
        }),
      confirmCharacter: () =>
        set((state) => ({
          character: { ...state.character, confirmed: true },
          phase: state.creatorReturn === 'world' ? 'world' : 'lifestyle',
        })),
      saveLook: (name) =>
        set((state) => ({
          savedLooks: [
            { id: `${Date.now()}`, name: name.trim() || 'Look', config: structuredClone(state.character) },
            ...state.savedLooks,
          ].slice(0, 6),
        })),
      loadLook: (id) =>
        set((state) => {
          const look = state.savedLooks.find((item) => item.id === id);
          if (!look) return {};
          return {
            history: [...state.history, state.character].slice(-40),
            future: [],
            character: {
              ...look.config,
              displayName: state.character.displayName,
              username: state.character.username,
              confirmed: state.character.confirmed,
              lifestyle: state.character.lifestyle,
            },
          };
        }),
      setLifestyle: (neighbourhood, focus) =>
        set((state) => ({
          phase: 'world',
          character: {
            ...state.character,
            confirmed: true,
            lifestyle: { neighbourhood, focus },
          },
        })),
      setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
      recordImpression: (id) =>
        set((state) => {
          const current = state.campaignStats[id] ?? { impressions: 0, interactions: 0 };
          return { campaignStats: { ...state.campaignStats, [id]: { ...current, impressions: current.impressions + 1 } } };
        }),
      recordInteraction: (id) =>
        set((state) => {
          const current = state.campaignStats[id] ?? { impressions: 0, interactions: 0 };
          return { campaignStats: { ...state.campaignStats, [id]: { ...current, interactions: current.interactions + 1 } } };
        }),
      setRouteTarget: (routeTargetId) => set({ routeTargetId }),
      applyLife: (result) => set({ life: result.life, notice: result.message }),
      earnShift: (open) => set((state) => ({ ...take(workShift(state.life, Date.now(), open)) })),
      spendMeal: (open) => set((state) => ({ ...take(buyMeal(state.life, open)) })),
      spendShopping: (open) => set((state) => ({ ...take(buyShopping(state.life, open)) })),
      purchaseHome: (x, z) => {
        const result = buyHome(useGame.getState().life, x, z);
        useGame.setState({ life: result.life, notice: result.message });
        return result.ok;
      },
      purchaseCar: () => set((state) => ({ ...take(buyCar(state.life)) })),
      purchaseFurniture: (id) => {
        const result = placePiece(useGame.getState().life, id === 'table' ? 'coffee-table' : id);
        useGame.setState({ life: result.life, notice: result.message });
        return result.ok;
      },
      arriveFromVillage: () => set((state) => ({ ...take(chooseLoan(state.life)) })),
      arriveWithNothing: () => set((state) => ({ ...take(chooseScratch(state.life)) })),
      repayVillageLoan: () => set((state) => ({ ...take(repayLoan(state.life)) })),
      paintFloor: (id) => set((state) => ({ ...take(applyFloor(state.life, id)) })),
      paintWall: (id) => set((state) => ({ ...take(applyWall(state.life, id)) })),
      useRoomLook: (id) => set((state) => ({ ...take(applyLook(state.life, id)) })),
      addPiece: (id) => set((state) => ({ ...take(placePiece(state.life, id)) })),
      nudgePiece: (uid, axis, step) => set((state) => ({ ...take(movePiece(state.life, uid, axis, step)) })),
      turnPiece: (uid) => set((state) => ({ ...take(rotatePiece(state.life, uid)) })),
      sellPiece: (uid) => set((state) => ({ ...take(removePiece(state.life, uid)) })),
      drawPlanWall: (x1, z1, x2, z2) => set((state) => ({ ...take(drawWall(state.life, x1, z1, x2, z2)) })),
      drawPlanRoom: (x1, z1, x2, z2) => set((state) => ({ ...take(drawRoom(state.life, x1, z1, x2, z2)) })),
      markPlanOpening: (uid, opening) => set((state) => ({ ...take(markOpening(state.life, uid, opening)) })),
      erasePlanWall: (uid) => set((state) => ({ ...take(eraseWall(state.life, uid)) })),
      clearPlanWalls: () => set((state) => ({ ...take(clearPlan(state.life)) })),
      usePlanTemplate: (id) => set((state) => ({ ...take(applyTemplate(state.life, id)) })),
      setPlanHeight: (height) => set((state) => ({ ...take(setWallHeight(state.life, height)) })),
      drive: () => {
        const result = payFare(useGame.getState().life);
        useGame.setState({ life: result.life, notice: result.message });
        return result.ok;
      },
      tickBody: (moving, pace) => set((state) => ({ life: tickNeeds(state.life, moving, pace) })),
      takeDrink: () => set((state) => ({ ...take(drink(state.life)) })),
      takeRest: () => set((state) => ({ ...take(rest(state.life)) })),
      takeDance: () => {
        const result = dance(useGame.getState().life);
        useGame.setState({ life: result.life, notice: result.message });
        return result.ok;
      },
      takeTask: () => set((state) => ({ ...take(helpOut(state.life, Date.now())) })),
      payForRide: (coins, label) => {
        const result = payRide(useGame.getState().life, coins, label);
        useGame.setState({ life: result.life, notice: result.message });
        return result.ok;
      },
    }),
    {
      name: 'nairobidiaries-v1',
      version: 1,
      partialize: (state: GameStore) => persistedGameSlice(state),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.character = completeCharacter(state.character);
        state.savedLooks = state.savedLooks.map((look) => ({ ...look, config: completeCharacter(look.config) }));
        state.life = completeLife(state.life);
        if (state.phase === 'world' && !state.character.confirmed) state.phase = 'create';
      },
    },
  ),
);
