import { FOOD_DECK } from "../src/food-deck.js";
import { EVENT_DEFINITIONS as SHARED_EVENT_DEFINITIONS, EVENT_OCCURRENCE_PERCENT } from "../src/event-deck.js";

export { SHARED_EVENT_DEFINITIONS as EVENT_DEFINITIONS };

export type Seat = 0 | 1 | 2 | 3;
export type Controller = "HUMAN" | "AI";
export type Phase = "ACTIVE_RESCUE" | "ASSISTANT_RESCUE" | "PATIENT_SWAP" | "VEGETABLE_RESOLUTION" | "GAME_OVER";

export interface Card {
  id: string;
  value: number;
  source: "MAIN_DECK" | "VEGETABLE_SUPPLY";
  foodId?: string;
}

export interface Score {
  nutritionistPoints: number;
  patientMutualAidPoints: number;
  totalPoints: number;
}

export type RoundOutcomeKind = "NUTRITIONIST" | "PATIENT" | "GARDEN" | "UNRESOLVED";

export interface RoundOutcome {
  round: number;
  kind: RoundOutcomeKind;
  title: string;
  detail: string;
}

export interface EventCard {
  id: string;
  name: string;
  shortName: string;
  summary: string;
  kind: "THRESHOLD" | "GARDEN";
  amount: number;
}

export interface GameLog {
  id: string;
  round: number;
  phase: Phase | "ROUND_START" | "SETTLEMENT";
  type: string;
  message: string;
}

export interface GameState {
  specVersion: string;
  rulesVersion: string;
  eventsEnabled: boolean;
  revision: number;
  seed: number;
  rngState: number;
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
  lastRoundOutcome: RoundOutcome | null;
  log: GameLog[];
  endReason?: string;
}

const BASE_THRESHOLD = 10;
export const LOCAL_RULES_VERSION = "3.0-local-mvp-draft.5-player-chosen-rescue-target-events-enabled";

function nextRandom(state: GameState): number {
  let value = state.rngState += 0x6D2B79F5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function shuffle<T>(items: T[], state: GameState): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom(state) * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function rolesFor(active: Seat): GameState["currentRoles"] {
  return {
    active,
    assistant: ((active + 2) % 4) as Seat,
    patient1: ((active + 1) % 4) as Seat,
    patient2: ((active + 3) % 4) as Seat
  };
}

function message(state: GameState, phase: GameLog["phase"], type: string, text: string): void {
  state.log.unshift({ id: `${state.round}-${state.revision}-${state.log.length}`, round: state.round, phase, type, message: text });
  state.log = state.log.slice(0, 80);
}

function touch(state: GameState): void {
  state.revision += 1;
  validateState(state);
}

function total(hand: Card[]): number {
  return hand.reduce((sum, card) => sum + card.value, 0);
}

function isCompliant(hand: Card[], threshold: number): boolean {
  return total(hand) <= threshold;
}

function excess(hand: Card[], threshold: number): number {
  return Math.max(0, total(hand) - threshold);
}

function patients(state: GameState): Seat[] {
  return [state.currentRoles.patient1, state.currentRoles.patient2];
}

function failingPatients(state: GameState): Seat[] {
  return patients(state).filter((seat) => !isCompliant(state.hands[seat], state.threshold));
}

export function strictTarget(state: GameState): Seat | null {
  const [patient1, patient2] = patients(state);
  const failures = failingPatients(state);
  if (!failures.length) return null;
  if (failures.length === 1) return failures[0];
  return excess(state.hands[patient1], state.threshold) >= excess(state.hands[patient2], state.threshold) ? patient1 : patient2;
}

export interface RescueAction { actorIndex: number; patientIndex: number; target: Seat; }
export interface VegetableAction { patient: Seat; cardIndex: number; }

function eligibleRescueTargets(state: GameState): Seat[] {
  if (state.phase === "ACTIVE_RESCUE") return failingPatients(state);
  if (state.phase === "ASSISTANT_RESCUE") return failingPatients(state);
  return [];
}

export function legalRescues(state: GameState, actor: Seat): RescueAction[] {
  const actions: RescueAction[] = [];
  for (const target of eligibleRescueTargets(state)) {
    for (let actorIndex = 0; actorIndex < 3; actorIndex += 1) {
      for (let patientIndex = 0; patientIndex < 3; patientIndex += 1) {
        // A helpful rescue lowers the chosen patient's total. It does not have
        // to finish the rescue: the assistant receives the second attempt.
        if (state.hands[actor][actorIndex].value < state.hands[target][patientIndex].value) {
          actions.push({ actorIndex, patientIndex, target });
        }
      }
    }
  }
  return actions;
}

export function legalVegetableReplacements(state: GameState): VegetableAction[] {
  if (state.phase !== "VEGETABLE_RESOLUTION" || state.gardenTokens <= 0) return [];
  const target = strictTarget(state);
  if (target === null) return [];
  const highestValue = Math.max(...state.hands[target].map((card) => card.value));
  if (highestValue <= 0) return [];
  return state.hands[target]
    .map((card, cardIndex) => ({ card, cardIndex }))
    .filter(({ card }) => card.value === highestValue)
    .map(({ cardIndex }) => ({ patient: target, cardIndex }));
}

function swap(state: GameState, firstSeat: Seat, firstIndex: number, secondSeat: Seat, secondIndex: number): void {
  const first = state.hands[firstSeat][firstIndex];
  state.hands[firstSeat][firstIndex] = state.hands[secondSeat][secondIndex];
  state.hands[secondSeat][secondIndex] = first;
}

function copyForSimulation(state: GameState): GameState {
  return structuredClone(state);
}

function patientNeed(state: GameState): number {
  return patients(state).reduce<number>((needed, seat) => {
    const values = state.hands[seat].map((card) => card.value).sort((a, b) => b - a);
    let running = total(state.hands[seat]);
    let count = 0;
    for (const value of values) {
      if (running <= state.threshold) break;
      running -= value;
      count += 1;
    }
    return needed + count;
  }, 0);
}

function totalPatientExcess(state: GameState): number {
  return patients(state).reduce<number>((sum, seat) => sum + excess(state.hands[seat], state.threshold), 0);
}

function compareRank(left: number[], right: number[]): number {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return right[index] - left[index];
  }
  return 0;
}

function chooseAssistant(state: GameState): RescueAction | null {
  const actions = legalRescues(state, state.currentRoles.assistant);
  if (!actions.length) return null;
  return [...actions].sort((left, right) => {
    const score = (action: RescueAction) => {
      const copy = copyForSimulation(state);
      swap(copy, copy.currentRoles.assistant, action.actorIndex, action.target, action.patientIndex);
      const compliant = patients(copy).filter((seat) => isCompliant(copy.hands[seat], copy.threshold)).length;
      return [compliant, -totalPatientExcess(copy), -action.actorIndex, -action.patientIndex];
    };
    return compareRank(score(left), score(right));
  })[0];
}

function choosePatientSwap(state: GameState): { firstIndex: number; secondIndex: number; score: number } | null {
  if (!patients(state).some((seat) => !isCompliant(state.hands[seat], state.threshold))) return null;
  const [patient1, patient2] = patients(state);
  const candidates = [{ firstIndex: -1, secondIndex: -1, score: 0 }];
  for (let firstIndex = 0; firstIndex < 3; firstIndex += 1) {
    for (let secondIndex = 0; secondIndex < 3; secondIndex += 1) {
      const copy = copyForSimulation(state);
      swap(copy, patient1, firstIndex, patient2, secondIndex);
      const compliant = patients(copy).filter((seat) => isCompliant(copy.hands[seat], copy.threshold)).length;
      candidates.push({ firstIndex, secondIndex, score: compliant === 2 ? 2 : compliant === 1 ? 1 : 0 });
    }
  }
  return candidates.sort((left, right) => {
    const evaluate = (candidate: typeof left) => {
      const copy = copyForSimulation(state);
      if (candidate.firstIndex >= 0) swap(copy, patient1, candidate.firstIndex, patient2, candidate.secondIndex);
      return [candidate.score, -patientNeed(copy), -totalPatientExcess(copy), candidate.firstIndex === -1 ? 1 : 0, -candidate.firstIndex, -candidate.secondIndex];
    };
    const a = evaluate(left); const b = evaluate(right);
    return compareRank(a, b);
  })[0];
}

function chooseAiPatientCard(state: GameState, aiSeat: Seat, humanSeat: Seat, humanIndex: number): { firstIndex: number; secondIndex: number } {
  const { patient1, patient2 } = state.currentRoles;
  if (!Number.isInteger(humanIndex) || humanIndex < 0 || humanIndex >= 3) throw new Error("Choose one of the human patient's cards.");
  const candidates = [0, 1, 2].map((aiIndex) => ({
    firstIndex: patient1 === aiSeat ? aiIndex : humanIndex,
    secondIndex: patient2 === aiSeat ? aiIndex : humanIndex
  }));
  return candidates.sort((left, right) => {
    const evaluate = (candidate: typeof left) => {
      const copy = copyForSimulation(state);
      swap(copy, patient1, candidate.firstIndex, patient2, candidate.secondIndex);
      const compliant = patients(copy).filter((seat) => isCompliant(copy.hands[seat], copy.threshold)).length;
      return [compliant, -patientNeed(copy), -totalPatientExcess(copy), -candidate.firstIndex, -candidate.secondIndex];
    };
    return compareRank(evaluate(left), evaluate(right));
  })[0];
}

function chooseActive(state: GameState): RescueAction | null {
  const actions = legalRescues(state, state.currentRoles.active);
  if (!actions.length) return null;
  return actions.sort((left, right) => {
    const evaluate = (action: RescueAction) => {
      const copy = copyForSimulation(state);
      swap(copy, copy.currentRoles.active, action.actorIndex, action.target, action.patientIndex);
      const assistant = chooseAssistant(copy);
      if (assistant) swap(copy, copy.currentRoles.assistant, assistant.actorIndex, assistant.target, assistant.patientIndex);
      const compliantAfterAssistant = patients(copy).filter((seat) => isCompliant(copy.hands[seat], copy.threshold)).length;
      const assistantSuccess = assistant && isCompliant(copy.hands[assistant.target], copy.threshold) ? 1 : 0;
      const patientAction = choosePatientSwap(copy);
      if (patientAction && patientAction.firstIndex >= 0) swap(copy, copy.currentRoles.patient1, patientAction.firstIndex, copy.currentRoles.patient2, patientAction.secondIndex);
      return [compliantAfterAssistant, assistantSuccess, -patientNeed(copy), -totalPatientExcess(copy), -action.actorIndex, -action.patientIndex];
    };
    const a = evaluate(left); const b = evaluate(right);
    return compareRank(a, b);
  })[0];
}

function applyEvent(state: GameState): void {
  state.threshold = BASE_THRESHOLD;
  state.currentEvent = null;
  if (!state.eventPool.length || nextRandom(state) * 100 > EVENT_OCCURRENCE_PERCENT) {
    message(state, "ROUND_START", "NO_EVENT", "No event card this round.");
    return;
  }
  const index = Math.floor(nextRandom(state) * state.eventPool.length);
  const [event] = state.eventPool.splice(index, 1);
  state.currentEvent = event;
  if (event.kind === "THRESHOLD") state.threshold = Math.max(0, BASE_THRESHOLD + event.amount);
  if (event.kind === "GARDEN") state.gardenTokens = Math.max(0, state.gardenTokens + event.amount);
  message(state, "ROUND_START", "EVENT_DRAWN", `${event.name}: ${event.summary}`);
}

function shuffleDiscardIntoDraw(state: GameState): void {
  state.drawPile = shuffle(state.discardPile, state);
  state.discardPile = [];
  message(state, "ROUND_START", "RESHUFFLED", "The main deck was reshuffled for the next round.");
}

function startRound(state: GameState): void {
  if (state.drawPile.length < 12) shuffleDiscardIntoDraw(state);
  state.round += 1;
  state.currentRoles = rolesFor(state.activeSeat);
  state.rescueTarget = null;
  applyEvent(state);
  const order = [state.currentRoles.active, state.currentRoles.assistant, state.currentRoles.patient1, state.currentRoles.patient2];
  for (const seat of order) state.hands[seat] = state.drawPile.splice(0, 3);
  state.phase = "ACTIVE_RESCUE";
  message(state, "ROUND_START", "ROUND_STARTED", `Round ${state.round} begins. The active nutritionist is Seat ${state.currentRoles.active + 1}.`);
  const failing = failingPatients(state);
  message(state, "ACTIVE_RESCUE", "ACTIVE_RESCUE_CHOICE", failing.length ? "Active nutritionist may choose either patient who is over the limit." : "Both patients are within the limit. Rescue is skipped.");
}

function addScore(state: GameState, seat: Seat, kind: "nutritionistPoints" | "patientMutualAidPoints", amount: number): void {
  state.scores[seat][kind] += amount;
  state.scores[seat].totalPoints = state.scores[seat].nutritionistPoints + state.scores[seat].patientMutualAidPoints;
}

function replaceWithVegetable(state: GameState, seat: Seat, index: number): void {
  const displaced = state.hands[seat][index];
  state.discardPile.push(displaced);
  state.hands[seat][index] = { id: `veg-r${state.round}-${seat}-${index}-${state.gardenTokens}`, value: 0, source: "VEGETABLE_SUPPLY" };
  state.gardenTokens -= 1;
  message(state, "VEGETABLE_RESOLUTION", "VEGETABLE_REPLACEMENT", `A zero-protein cabbage replaced ${displaced.value} protein for Seat ${seat + 1}.`);
}

function beginVegetableResolution(state: GameState): void {
  if (!failingPatients(state).length) {
    settleRound(state);
    return;
  }
  if (state.gardenTokens <= 0) {
    message(state, "VEGETABLE_RESOLUTION", "GARDEN_EXHAUSTED", "No zero-protein cabbages remain while a patient is still over the protein limit.");
    settleRound(state);
    return;
  }
  state.phase = "VEGETABLE_RESOLUTION";
  message(state, "VEGETABLE_RESOLUTION", "GARDEN_PHASE", "Garden phase: choose the highest-protein food card on the highlighted patient to replace with a zero-protein cabbage.");
}

function executeVegetableReplacement(state: GameState, patient: Seat, cardIndex: number, automated: boolean): void {
  const action = legalVegetableReplacements(state).find((candidate) => candidate.patient === patient && candidate.cardIndex === cardIndex);
  if (!action) throw new Error("Choose a highest-protein food card on the highlighted patient for the cabbage replacement.");
  replaceWithVegetable(state, action.patient, action.cardIndex);
  if (!failingPatients(state).length) {
    message(state, "VEGETABLE_RESOLUTION", automated ? "AI_GARDEN_COMPLETE" : "GARDEN_COMPLETE", "Every patient is now within the limit.");
    settleRound(state);
    return;
  }
  if (state.gardenTokens === 0) {
    message(state, "VEGETABLE_RESOLUTION", "GARDEN_EXHAUSTED", "The field used every available zero-protein cabbage, but a patient is still over the protein limit.");
    settleRound(state);
    return;
  }
  message(state, "VEGETABLE_RESOLUTION", automated ? "AI_GARDEN_REPLACEMENT" : "GARDEN_REPLACEMENT", "A cabbage was taken. Choose the next highlighted highest-protein card while the patient remains over the protein limit.");
}

function settleRound(state: GameState): void {
  const unresolvedPatients = failingPatients(state).length > 0;
  const outcome: RoundOutcome = unresolvedPatients
    ? { round: state.round, kind: "UNRESOLVED", title: "The garden ran out.", detail: "At least one patient remained over the limit." }
    : state.phase === "VEGETABLE_RESOLUTION"
      ? { round: state.round, kind: "GARDEN", title: "The vegetable patch came through.", detail: "A zero-protein cabbage completed the rescue." }
      : state.phase === "PATIENT_SWAP"
        ? { round: state.round, kind: "PATIENT", title: "We succeeded together.", detail: "Patient mutual aid completed the rescue." }
        : { round: state.round, kind: "NUTRITIONIST", title: "The nutritionists were amazing.", detail: "The rescue was completed before patient aid was needed." };
  state.lastRoundOutcome = outcome;
  message(state, "SETTLEMENT", "ROUND_RESULT", `${outcome.title} ${outcome.detail}`);
  for (let seat = 0; seat < 4; seat += 1) {
    for (const card of state.hands[seat]) if (card.source === "MAIN_DECK") state.discardPile.push(card);
    state.hands[seat] = [];
  }
  message(state, "SETTLEMENT", "SCORES_COMMITTED", "Round scores were committed and the hands were discarded.");
  if (unresolvedPatients || state.gardenTokens === 0) {
    state.phase = "GAME_OVER";
    state.endReason = unresolvedPatients ? "Garden supply exhausted before every patient was compliant" : "Garden supply exhausted";
    message(state, "SETTLEMENT", "GAME_ENDED", `${state.endReason}.`);
    return;
  }
  state.activeSeat = ((state.activeSeat + 1) % 4) as Seat;
  startRound(state);
}

function advanceAfterRescue(state: GameState): void {
  if (state.phase === "ACTIVE_RESCUE") {
    if (!failingPatients(state).length) {
      message(state, "ACTIVE_RESCUE", "ACTIVE_RESCUE_COMPLETE", "The active nutritionist brought every patient within the limit. Assistant rescue and patient mutual aid are skipped.");
      settleRound(state);
      return;
    }
    state.phase = "ASSISTANT_RESCUE";
    const target = state.rescueTarget;
    message(state, "ASSISTANT_RESCUE", "SUPPORT_CHOICE", target === null ? "The active nutritionist did not make a helpful swap. At least one patient is still over the limit, so the assistant gets one rescue attempt and may choose either failing patient." : `Active nutritionist chose Patient Seat ${target + 1}, but at least one patient is still over the limit. The assistant now gets one rescue attempt and may choose either failing patient.`);
  } else if (state.phase === "ASSISTANT_RESCUE") {
    if (!failingPatients(state).length) settleRound(state);
    else {
      state.phase = "PATIENT_SWAP";
      message(state, "PATIENT_SWAP", "PATIENT_PHASE", "At least one patient is still over the limit. Patients may swap once or pass.");
    }
  }
}

export function runAiTurns(state: GameState): void {
  let safety = 64;
  while (state.phase !== "GAME_OVER" && safety-- > 0) {
    if (state.phase === "ACTIVE_RESCUE") {
      const actor = state.currentRoles.active;
      // Human players must never be left waiting for an impossible card choice.
      // If active rescue cannot finish recovery, the assistant receives the next attempt.
      if (!legalRescues(state, actor).length) {
        message(state, "ACTIVE_RESCUE", "RESCUE_SKIPPED_NO_HELPFUL_ACTION", "Active nutritionist has no helpful swap for either over-limit patient. The assistant receives the next rescue attempt.");
        advanceAfterRescue(state);
        continue;
      }
      if (state.controllers[actor] !== "AI") return;
      const action = chooseActive(state);
      if (action) executeRescue(state, actor, action.actorIndex, action.target, action.patientIndex, true);
      continue;
    }
    if (state.phase === "ASSISTANT_RESCUE") {
      const actor = state.currentRoles.assistant;
      if (!legalRescues(state, actor).length) {
        message(state, "ASSISTANT_RESCUE", "RESCUE_SKIPPED_NO_HELPFUL_ACTION", "Assistant has no helpful swap for either over-limit patient. Patient swap and garden resolution remain available.");
        advanceAfterRescue(state);
        continue;
      }
      if (state.controllers[actor] !== "AI") return;
      const action = chooseAssistant(state);
      if (action) executeRescue(state, actor, action.actorIndex, action.target, action.patientIndex, true);
      continue;
    }
    if (state.phase === "PATIENT_SWAP") {
      const { patient1, patient2 } = state.currentRoles;
      if (state.controllers[patient1] !== "AI" || state.controllers[patient2] !== "AI") return;
      const action = choosePatientSwap(state);
      if (action && action.firstIndex >= 0) executePatientSwap(state, action.firstIndex, action.secondIndex, true);
      else { message(state, "PATIENT_SWAP", "AI_PASS", "Patients chose not to swap."); beginVegetableResolution(state); }
      continue;
    }
    if (state.phase === "VEGETABLE_RESOLUTION") {
      const { patient1, patient2 } = state.currentRoles;
      if (state.controllers[patient1] !== "AI" || state.controllers[patient2] !== "AI") return;
      const action = legalVegetableReplacements(state)[0];
      if (action) executeVegetableReplacement(state, action.patient, action.cardIndex, true);
      else beginVegetableResolution(state);
    }
  }
}

function executeRescue(state: GameState, actor: Seat, actorIndex: number, target: Seat, patientIndex: number, automated: boolean): void {
  const legal = legalRescues(state, actor);
  const action = legal.find((candidate) => candidate.actorIndex === actorIndex && candidate.target === target && candidate.patientIndex === patientIndex);
  if (!action) throw new Error("That swap is not a helpful rescue for the selected patient.");
  swap(state, actor, actorIndex, action.target, patientIndex);
  if (state.phase === "ACTIVE_RESCUE") state.rescueTarget = action.target;
  const completedRescue = isCompliant(state.hands[action.target], state.threshold);
  if (completedRescue) addScore(state, actor, "nutritionistPoints", 1);
  message(
    state,
    state.phase,
    automated ? "AI_RESCUE" : "RESCUE",
    completedRescue
      ? `Seat ${actor + 1} rescued Patient Seat ${action.target + 1} and earned 1 nutritionist point.`
      : `Seat ${actor + 1} made a helpful swap for Patient Seat ${action.target + 1}. The patient is still over the limit, so the next recovery step will be tried.`
  );
  advanceAfterRescue(state);
}

function executePatientSwap(state: GameState, firstIndex: number, secondIndex: number, automated: boolean): void {
  if (state.phase !== "PATIENT_SWAP") throw new Error("Patient swapping is not available now.");
  if (![firstIndex, secondIndex].every((index) => Number.isInteger(index) && index >= 0 && index < 3)) throw new Error("Choose one card from each patient.");
  const { patient1, patient2 } = state.currentRoles;
  swap(state, patient1, firstIndex, patient2, secondIndex);
  const compliant = patients(state).filter((seat) => isCompliant(state.hands[seat], state.threshold)).length;
  const points = compliant === 2 ? 2 : compliant === 1 ? 1 : 0;
  addScore(state, patient1, "patientMutualAidPoints", points);
  addScore(state, patient2, "patientMutualAidPoints", points);
  message(state, "PATIENT_SWAP", automated ? "AI_PATIENT_SWAP" : "PATIENT_SWAP", `Patients swapped once. Each patient earned ${points} mutual-aid point${points === 1 ? "" : "s"}.`);
  beginVegetableResolution(state);
}

export function createGame(controllers: Controller[] = ["HUMAN", "AI", "AI", "AI"], seed = Math.floor(Math.random() * 2 ** 31)): GameState {
  if (controllers.length !== 4) throw new Error("Choose a controller for each of the four seats.");
  const initial = {} as GameState;
  Object.assign(initial, {
    specVersion: "2.1-codex-48-unique-foods",
    rulesVersion: LOCAL_RULES_VERSION,
    eventsEnabled: true,
    revision: 0,
    seed,
    rngState: seed,
    round: 0,
    phase: "ACTIVE_RESCUE",
    activeSeat: Math.floor((seed >>> 0) % 4) as Seat,
    threshold: BASE_THRESHOLD,
    gardenTokens: 10,
    controllers,
    hands: [[], [], [], []],
    drawPile: [],
    discardPile: [],
    scores: Array.from({ length: 4 }, () => ({ nutritionistPoints: 0, patientMutualAidPoints: 0, totalPoints: 0 })),
    eventPool: structuredClone(SHARED_EVENT_DEFINITIONS),
    currentEvent: null,
    currentRoles: rolesFor(0),
    rescueTarget: null,
    lastRoundOutcome: null,
    log: []
  });
  const deck = FOOD_DECK.map((food) => ({ id: food.id, foodId: food.id, value: food.score, source: "MAIN_DECK" as const }));
  initial.drawPile = shuffle(deck, initial);
  startRound(initial);
  runAiTurns(initial);
  touch(initial);
  return initial;
}

export function command(state: GameState, input: { type: "RESCUE" | "RESCUE_PASS" | "PATIENT_SWAP" | "PATIENT_PASS" | "TAKE_VEGETABLE" | "ADVANCE_AI"; actor?: number; actorIndex?: number; target?: number; targetIndex?: number; patient1Index?: number; patient2Index?: number; patient?: number; cardIndex?: number; expectedRevision: number }): GameState {
  if (input.expectedRevision !== state.revision) throw new Error("Your board is out of date. It has been refreshed.");
  if (state.phase === "GAME_OVER") throw new Error("This game has ended. Start a new game to play again.");
  if (input.type === "ADVANCE_AI") {
    runAiTurns(state);
  } else if (input.type === "RESCUE") {
    const actor = input.actor as Seat;
    const expected = state.phase === "ACTIVE_RESCUE" ? state.currentRoles.active : state.phase === "ASSISTANT_RESCUE" ? state.currentRoles.assistant : null;
    if (expected === null || actor !== expected) throw new Error("It is not this seat's rescue phase.");
    if (state.controllers[actor] === "AI") throw new Error("This seat is controlled by the standard AI.");
    executeRescue(state, actor, input.actorIndex ?? -1, input.target as Seat, input.targetIndex ?? -1, false);
  } else if (input.type === "RESCUE_PASS") {
    const actor = input.actor as Seat;
    const expected = state.phase === "ACTIVE_RESCUE" ? state.currentRoles.active : state.phase === "ASSISTANT_RESCUE" ? state.currentRoles.assistant : null;
    if (expected === null || actor !== expected) throw new Error("It is not this seat's rescue phase.");
    if (state.controllers[actor] === "AI") throw new Error("This seat is controlled by the standard AI.");
    if (legalRescues(state, actor).length) throw new Error("A helpful rescue swap is available. Select one of the highlighted card pairs.");
    message(state, state.phase, "RESCUE_SKIPPED_NO_HELPFUL_ACTION", `Seat ${actor + 1} has no helpful rescue swap.`);
    advanceAfterRescue(state);
  } else if (input.type === "PATIENT_SWAP") {
    if (state.phase !== "PATIENT_SWAP") throw new Error("Patient swapping is not available now.");
    const { patient1, patient2 } = state.currentRoles;
    const patient1Ai = state.controllers[patient1] === "AI";
    const patient2Ai = state.controllers[patient2] === "AI";
    if (patient1Ai && patient2Ai) {
      const action = choosePatientSwap(state);
      if (action && action.firstIndex >= 0) executePatientSwap(state, action.firstIndex, action.secondIndex, true);
      else { message(state, "PATIENT_SWAP", "AI_PASS", "AI patients chose not to swap."); beginVegetableResolution(state); }
    } else if (patient1Ai || patient2Ai) {
      const aiSeat = patient1Ai ? patient1 : patient2;
      const humanSeat = patient1Ai ? patient2 : patient1;
      const humanIndex = patient1Ai ? input.patient2Index : input.patient1Index;
      const action = chooseAiPatientCard(state, aiSeat, humanSeat, humanIndex ?? -1);
      message(state, "PATIENT_SWAP", "AI_PATIENT_CHOICE", `AI Seat ${aiSeat + 1} chose its best card to support Patient Seat ${humanSeat + 1}.`);
      executePatientSwap(state, action.firstIndex, action.secondIndex, false);
    } else {
      executePatientSwap(state, input.patient1Index ?? -1, input.patient2Index ?? -1, false);
    }
  } else if (input.type === "PATIENT_PASS") {
    if (state.phase !== "PATIENT_SWAP") throw new Error("A patient pass is not available now.");
    message(state, "PATIENT_SWAP", "PATIENT_PASS", "Patients chose not to swap this round.");
    beginVegetableResolution(state);
  } else {
    if (state.phase !== "VEGETABLE_RESOLUTION") throw new Error("Garden replacements are not available now.");
    executeVegetableReplacement(state, input.patient as Seat, input.cardIndex ?? -1, false);
  }
  runAiTurns(state);
  touch(state);
  return state;
}

export function publicView(state: GameState): GameState {
  return structuredClone(state);
}

export function validateState(state: GameState): void {
  const inHands = state.hands.flat();
  const mainCards = [...state.drawPile, ...state.discardPile, ...inHands.filter((card) => card.source === "MAIN_DECK")];
  if (mainCards.length !== 48) throw new Error(`Main deck conservation failed: expected 48, found ${mainCards.length}.`);
  if (new Set(mainCards.map((card) => card.id)).size !== 48) throw new Error("A main card exists in more than one location.");
  if (state.gardenTokens < 0) throw new Error("Garden tokens cannot be negative.");
  state.scores.forEach((score) => {
    if (score.totalPoints !== score.nutritionistPoints + score.patientMutualAidPoints) throw new Error("Score components are inconsistent.");
  });
}
