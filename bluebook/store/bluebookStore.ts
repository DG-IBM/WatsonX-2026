import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  BluebookState,
  MCPConnection,
  MCPDocument,
  UserProfile,
  KnowledgeNode,
  QuizScore,
  NodeStatus,
  OnboardingBriefingCard,
  MissionBriefingCard,
  ChatMessage,
  AppScreen,
  OverallScore,
  AstronautRank,
} from '@/types/bluebook';

// ─── Overall score computation ────────────────────────────────────────────────

function computeOverallScore(nodes: KnowledgeNode[]): OverallScore {
  const totalNodes = nodes.length;
  const completedNodes = nodes.filter((n) => n.status === 'complete').length;
  const greenNodes = nodes.filter((n) => n.score?.nodeColour === 'green').length;
  const yellowNodes = nodes.filter((n) => n.score?.nodeColour === 'yellow').length;
  const redNodes = nodes.filter((n) => n.score?.nodeColour === 'red').length;

  const scored = nodes.filter((n) => n.score !== null);
  const averagePercentage =
    scored.length > 0
      ? Math.round(scored.reduce((acc, n) => acc + (n.score?.percentage ?? 0), 0) / scored.length)
      : 0;

  let readinessLevel: OverallScore['readinessLevel'] = 'Not Started';
  if (completedNodes === 0) {
    readinessLevel = 'Not Started';
  } else if (completedNodes < totalNodes) {
    readinessLevel = 'In Progress';
  } else if (completedNodes === totalNodes && redNodes === 0) {
    readinessLevel = greenNodes === totalNodes ? 'Fully Prepared' : 'Ready';
  } else {
    readinessLevel = 'Partially Ready';
  }

  return {
    totalNodes,
    completedNodes,
    greenNodes,
    yellowNodes,
    redNodes,
    averagePercentage,
    readinessLevel,
  };
}

// ─── Store actions ────────────────────────────────────────────────────────────

interface BluebookActions {
  setMCPConnection: (connection: Partial<MCPConnection>) => void;
  setMCPDocuments: (documents: MCPDocument[]) => void;
  setUserProfile: (profile: UserProfile) => void;
  // Node actions
  setNodes: (nodes: KnowledgeNode[]) => void;
  selectNode: (id: string | null) => void;
  updateNodeScore: (nodeId: string, score: QuizScore) => void;
  updateNodeStatus: (nodeId: string, status: NodeStatus) => void;
  enrichNode: (nodeId: string, patch: Partial<KnowledgeNode>) => void;
  recalculateOverallScore: () => void;
  // Legacy planet compat
  setPlanets: (planets: KnowledgeNode[]) => void;
  updatePlanet: (planetId: string, updates: Partial<KnowledgeNode>) => void;
  setActivePlanet: (planetId: string | null) => void;
  setActivePlanetPhase: (phase: BluebookState['activePlanetPhase']) => void;
  completePlanet: (planetId: string, debrief: unknown) => void;
  addXP: (amount: number) => void;
  setOnboardingBriefingCard: (card: OnboardingBriefingCard) => void;
  setMissionBriefingCard: (card: MissionBriefingCard) => void;
  setAstronautRank: (rank: AstronautRank) => void;
  // Chat
  addChatMessage: (message: ChatMessage) => void;
  setChatOpen: (open: boolean) => void;
  // App
  setCurrentScreen: (screen: AppScreen) => void;
  setLoading: (isLoading: boolean, message?: string) => void;
  resetForNewSession: () => void;
  resetGame: () => void;
}

const emptyOverallScore: OverallScore = {
  totalNodes: 0,
  completedNodes: 0,
  greenNodes: 0,
  yellowNodes: 0,
  redNodes: 0,
  averagePercentage: 0,
  readinessLevel: 'Not Started',
};

const initialState: BluebookState = {
  mcpConnection: {
    url: '',
    token: '',
    apiKey: '',
    status: 'idle',
    documentCount: 0,
    sources: [],
  },
  mcpDocuments: [],
  userProfile: null,
  nodes: [],
  selectedNodeId: null,
  overallScore: emptyOverallScore,
  onboardingBriefingCard: null,
  missionBriefingCard: null,
  chatMessages: [],
  isChatOpen: false,
  currentScreen: 'connect',
  isLoading: false,
  loadingMessage: '',
  // Legacy compat
  planets: [],
  activePlanetId: null,
  activePlanetPhase: null,
  totalXP: 0,
  astronautRank: null,
};

export const useBluebookStore = create<BluebookState & BluebookActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setMCPConnection: (connection) =>
        set((state) => ({
          mcpConnection: { ...state.mcpConnection, ...connection },
        })),

      setMCPDocuments: (documents) => set({ mcpDocuments: documents }),

      setUserProfile: (profile) => set({ userProfile: profile }),

      // ── Node actions ──────────────────────────────────────────

      setNodes: (nodes) =>
        set({
          nodes,
          planets: nodes, // keep legacy alias in sync
          overallScore: computeOverallScore(nodes),
        }),

      selectNode: (id) =>
        set((state) => {
          // Mark the node as reading when selected (if untouched)
          const nodes = state.nodes.map((n) =>
            n.id === id && n.status === 'untouched' ? { ...n, status: 'reading' as NodeStatus } : n
          );
          return {
            selectedNodeId: id,
            nodes,
            planets: nodes,
            activePlanetId: id,
            activePlanetPhase: id ? 'transmission' : null,
          };
        }),

      updateNodeScore: (nodeId, score) =>
        set((state) => {
          const nodes = state.nodes.map((n) =>
            n.id === nodeId ? { ...n, score, status: 'complete' as NodeStatus } : n
          );
          return {
            nodes,
            planets: nodes,
            overallScore: computeOverallScore(nodes),
          };
        }),

      updateNodeStatus: (nodeId, status) =>
        set((state) => {
          const nodes = state.nodes.map((n) =>
            n.id === nodeId ? { ...n, status } : n
          );
          return { nodes, planets: nodes, overallScore: computeOverallScore(nodes) };
        }),

      enrichNode: (nodeId, patch) =>
        set((state) => {
          const nodes = state.nodes.map((n) =>
            n.id === nodeId ? { ...n, ...patch } : n
          );
          return { nodes, planets: nodes };
        }),

      recalculateOverallScore: () =>
        set((state) => ({ overallScore: computeOverallScore(state.nodes) })),

      // ── Legacy planet compat ──────────────────────────────────

      setPlanets: (planets) =>
        set({
          planets,
          nodes: planets,
          overallScore: computeOverallScore(planets),
        }),

      updatePlanet: (planetId, updates) =>
        set((state) => {
          const nodes = state.nodes.map((n) =>
            n.id === planetId ? { ...n, ...updates } : n
          );
          return { nodes, planets: nodes };
        }),

      setActivePlanet: (planetId) =>
        set({
          activePlanetId: planetId,
          selectedNodeId: planetId,
          activePlanetPhase: planetId ? 'transmission' : null,
        }),

      setActivePlanetPhase: (phase) => set({ activePlanetPhase: phase }),

      completePlanet: (planetId, _debrief) =>
        set((state) => {
          const nodes = state.nodes.map((n) =>
            n.id === planetId ? { ...n, status: 'complete' as NodeStatus } : n
          );
          return {
            nodes,
            planets: nodes,
            overallScore: computeOverallScore(nodes),
            activePlanetId: null,
            activePlanetPhase: null,
          };
        }),

      addXP: () => set({}), // no-op — XP replaced by quiz scores

      setOnboardingBriefingCard: (card) => set({ onboardingBriefingCard: card }),

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

      // Clear nodes/briefing/profile before a new generation — prevents stale
      // state showing when the architect call fails or is retried
      resetForNewSession: () =>
        set({
          nodes: [],
          planets: [],
          selectedNodeId: null,
          activePlanetId: null,
          onboardingBriefingCard: null,
          userProfile: null,
          overallScore: {
            totalNodes: 0, completedNodes: 0,
            greenNodes: 0, yellowNodes: 0, redNodes: 0,
            averagePercentage: 0, readinessLevel: 'Not Started',
          },
        }),

      resetGame: () => set(initialState),
    }),
    {
      name: 'bluebook-game-state',
      partialize: (state) => ({
        mcpConnection: state.mcpConnection,
        mcpDocuments: state.mcpDocuments,
        userProfile: state.userProfile,
        nodes: state.nodes,
        planets: state.nodes,
        overallScore: state.overallScore,
        onboardingBriefingCard: state.onboardingBriefingCard,
        missionBriefingCard: state.missionBriefingCard,
        chatMessages: state.chatMessages,
        currentScreen: state.currentScreen,
      }),
      // On rehydrate, sync planets alias, recompute score, and migrate missing fields
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.planets = state.nodes;
          state.overallScore = computeOverallScore(state.nodes);
          state.selectedNodeId = null;
          state.activePlanetId = null;
          state.activePlanetPhase = null;
          // Migration: apiKey added after initial release — default to '' if missing
          if (!state.mcpConnection.apiKey) {
            state.mcpConnection.apiKey = '';
          }
        }
      },
    }
  )
);
