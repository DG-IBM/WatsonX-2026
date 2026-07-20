import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  OrbitState,
  MCPConnection,
  MCPDocument,
  UserProfile,
  Planet,
  Debrief,
  MissionBriefingCard,
  AstronautRank,
  ChatMessage,
  AppScreen,
} from '@/types/orbit';
import { calculateRank } from '@/lib/gameUtils';

interface OrbitActions {
  setMCPConnection: (connection: Partial<MCPConnection>) => void;
  setMCPDocuments: (documents: MCPDocument[]) => void;
  setUserProfile: (profile: UserProfile) => void;
  setPlanets: (planets: Planet[]) => void;
  updatePlanet: (planetId: string, updates: Partial<Planet>) => void;
  setActivePlanet: (planetId: string | null) => void;
  setActivePlanetPhase: (phase: OrbitState['activePlanetPhase']) => void;
  completePlanet: (planetId: string, debrief: Debrief) => void;
  addXP: (amount: number) => void;
  setMissionBriefingCard: (card: MissionBriefingCard) => void;
  setAstronautRank: (rank: AstronautRank) => void;
  addChatMessage: (message: ChatMessage) => void;
  setChatOpen: (open: boolean) => void;
  setCurrentScreen: (screen: AppScreen) => void;
  setLoading: (isLoading: boolean, message?: string) => void;
  resetGame: () => void;
}

const initialState: OrbitState = {
  mcpConnection: {
    url: '',
    token: '',
    status: 'idle',
    documentCount: 0,
    sources: [],
  },
  mcpDocuments: [],
  userProfile: null,
  planets: [],
  activePlanetId: null,
  activePlanetPhase: null,
  totalXP: 0,
  missionBriefingCard: null,
  astronautRank: null,
  chatMessages: [],
  isChatOpen: false,
  currentScreen: 'connect',
  isLoading: false,
  loadingMessage: '',
};

export const useOrbitStore = create<OrbitState & OrbitActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setMCPConnection: (connection) =>
        set((state) => ({
          mcpConnection: { ...state.mcpConnection, ...connection },
        })),

      setMCPDocuments: (documents) => set({ mcpDocuments: documents }),

      setUserProfile: (profile) => set({ userProfile: profile }),

      setPlanets: (planets) => set({ planets }),

      updatePlanet: (planetId, updates) =>
        set((state) => ({
          planets: state.planets.map((p) =>
            p.id === planetId ? { ...p, ...updates } : p
          ),
        })),

      setActivePlanet: (planetId) =>
        set({
          activePlanetId: planetId,
          activePlanetPhase: planetId ? 'transmission' : null,
        }),

      setActivePlanetPhase: (phase) => set({ activePlanetPhase: phase }),

      completePlanet: (planetId, debrief) =>
        set((state) => {
          const planets = state.planets.map((p) => {
            if (p.id === planetId) {
              return {
                ...p,
                status: 'completed' as const,
                debrief,
                xpAwarded: debrief.xpAwarded,
              };
            }
            // Unlock the next planet in order
            const completedPlanet = state.planets.find((pp) => pp.id === planetId);
            if (completedPlanet && p.order === completedPlanet.order + 1 && p.status === 'locked') {
              return { ...p, status: 'available' as const };
            }
            return p;
          });

          const newTotalXP = state.totalXP + debrief.xpAwarded;
          const newRank = calculateRank(newTotalXP);

          return {
            planets,
            totalXP: newTotalXP,
            astronautRank: newRank,
            activePlanetId: null,
            activePlanetPhase: null,
          };
        }),

      addXP: (amount) =>
        set((state) => {
          const newXP = state.totalXP + amount;
          return { totalXP: newXP, astronautRank: calculateRank(newXP) };
        }),

      setMissionBriefingCard: (card) => set({ missionBriefingCard: card }),

      setAstronautRank: (rank) => set({ astronautRank: rank }),

      addChatMessage: (message) =>
        set((state) => ({
          chatMessages: [...state.chatMessages, message],
        })),

      setChatOpen: (open) => set({ isChatOpen: open }),

      setCurrentScreen: (screen) => set({ currentScreen: screen }),

      setLoading: (isLoading, message = '') =>
        set({ isLoading, loadingMessage: message }),

      resetGame: () => set(initialState),
    }),
    {
      name: 'orbit-game-state',
      partialize: (state) => ({
        mcpConnection: state.mcpConnection,
        mcpDocuments: state.mcpDocuments,
        userProfile: state.userProfile,
        planets: state.planets,
        totalXP: state.totalXP,
        missionBriefingCard: state.missionBriefingCard,
        astronautRank: state.astronautRank,
        chatMessages: state.chatMessages,
        currentScreen: state.currentScreen,
      }),
    }
  )
);
