export type AppScreen =
  | 'connect'
  | 'role'
  | 'solar-system'
  | 'mission-complete'
  | 'mission-control';

export type ChallengeType =
  | 'SCENARIO'
  | 'ROLEPLAY'
  | 'DETECTIVE'
  | 'BUILD'
  | 'TRANSMISSION_DECODE';

export type PlanetStatus = 'locked' | 'available' | 'active' | 'completed';

export type AstronautRank =
  | 'Cadet'
  | 'Explorer'
  | 'Specialist'
  | 'Commander'
  | 'Mission Veteran';

export interface MCPConnection {
  url: string;
  token: string;
  status: 'idle' | 'connecting' | 'connected' | 'failed';
  documentCount: number;
  sources: MCPSource[];
}

export interface MCPSource {
  name: string;
  count: number;
}

export interface MCPDocument {
  id: string;
  source: string;
  title: string;
  content: string;
  metadata: Record<string, string>;
}

export interface UserProfile {
  roleDescription: string;
  parsedRole: string;
  parsedFocus: string[];
  experience: string;
}

export interface Planet {
  id: string;
  name: string;
  subtitle: string;
  order: number;
  status: PlanetStatus;
  domainType: string;
  visualConfig: PlanetVisualConfig;
  briefing: string | null;
  insiderTip: string | null;
  challenge: Challenge | null;
  debrief: Debrief | null;
  xpAwarded: number;
}

export interface PlanetVisualConfig {
  size: number;
  color: string;
  secondaryColor: string;
  emissiveColor: string;
  orbitRadius: number;
  orbitSpeed: number;
  hasRings: boolean;
  ringSeed: number;
  atmosphereColor: string;
  textureType: 'rocky' | 'gas' | 'icy' | 'lava' | 'ocean' | 'storm';
}

export interface Challenge {
  type: ChallengeType;
  title: string;
  setup: string;
  prompt: string;
  options?: ChallengeOption[];
  clues?: string[];
  codeSnippets?: CodeSnippet[];
  artefact?: string;
  userResponse: string;
}

export interface ChallengeOption {
  id: string;
  label: string;
  text: string;
}

export interface CodeSnippet {
  id: string;
  label: string;
  language: string;
  code: string;
}

export interface Debrief {
  strengths: string;
  gaps: string;
  deeperContext: string;
  xpAwarded: number;
  personalisation: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  referencedDocuments?: string[];
}

export interface MissionBriefingCard {
  projectSnapshot: string;
  roleAndOwnership: string;
  topPriorities: string[];
  topRisks: string[];
  keyContacts: KeyContact[];
  thingsNotToBreak: string[];
  firstWeekFocus: string;
}

export interface KeyContact {
  name: string;
  role: string;
  owns: string;
}

export interface OrbitState {
  mcpConnection: MCPConnection;
  mcpDocuments: MCPDocument[];
  userProfile: UserProfile | null;
  planets: Planet[];
  activePlanetId: string | null;
  activePlanetPhase: 'transmission' | 'mission' | 'debrief' | null;
  totalXP: number;
  missionBriefingCard: MissionBriefingCard | null;
  astronautRank: AstronautRank | null;
  chatMessages: ChatMessage[];
  isChatOpen: boolean;
  currentScreen: AppScreen;
  isLoading: boolean;
  loadingMessage: string;
}
