export type Seat = 0 | 1 | 2 | 3;
export type Controller = "HUMAN" | "AI";
export type Phase = "ACTIVE_RESCUE" | "ASSISTANT_RESCUE" | "PATIENT_SWAP" | "VEGETABLE_RESOLUTION" | "GAME_OVER";

export interface Card { id: string; value: number; source: "MAIN_DECK" | "VEGETABLE_SUPPLY"; }
export interface Score { nutritionistPoints: number; patientMutualAidPoints: number; totalPoints: number; }
export interface EventCard { id: string; name: string; shortName: string; summary: string; kind: "THRESHOLD" | "GARDEN"; amount: number; }
export interface GameLog { id: string; round: number; phase: string; type: string; message: string; }
export interface GameState {
  specVersion: string;
  rulesVersion: string;
  eventsEnabled: boolean;
  revision: number;
  seed: number;
  round: number;
  phase: Phase;
  activeSeat: Seat;
  threshold: number;
  gardenTokens: number;
  controllers: Controller[];
  hands: Card[][];
  drawPile: Card[];
  discardPile: Card[];
  scores: Score[];
  eventPool: EventCard[];
  currentEvent: EventCard | null;
  currentRoles: { active: Seat; assistant: Seat; patient1: Seat; patient2: Seat };
  rescueTarget: Seat | null;
  log: GameLog[];
  endReason?: string;
}

export type Command =
  | { type: "RESCUE"; expectedRevision: number; actor: number; actorIndex: number; target: number; targetIndex: number }
  | { type: "RESCUE_PASS"; expectedRevision: number; actor: number }
  | { type: "PATIENT_SWAP"; expectedRevision: number; patient1Index: number; patient2Index: number }
  | { type: "PATIENT_PASS"; expectedRevision: number }
  | { type: "TAKE_VEGETABLE"; expectedRevision: number; patient: number; cardIndex: number }
  | { type: "ADVANCE_AI"; expectedRevision: number };
