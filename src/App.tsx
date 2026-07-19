import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import type { Card, Command, Controller, GameState, Seat } from "./game-types";

// Vite runs on 5173 while the local Fastify game service runs on 5174. In a
// Vercel deployment, the serverless API shares the page's origin instead.
const isLocalVite = window.location.hostname === "127.0.0.1" && window.location.port === "5173";
const SERVER_URL = isLocalVite ? "http://127.0.0.1:5174" : window.location.origin;
const supportsSocketUpdates = isLocalVite || window.location.port === "5174";
const usesBrowserGameSave = !supportsSocketUpdates;
const BROWSER_GAME_KEY = "chews-freedom-public-game-v1";
const NAMES = ["Rain", "Rice", "Joy", "Sail"];
const ART_SPRITE = "/Chews_Freedom_Artful_Sample.svg";
const PORTRAITS = ["portrait-a", "portrait-b", "portrait-c", "portrait-d"];
const FOOD: Record<number, { name: string; art: string; garnish: string; tone: string; dish: string }> = {
  0: { name: "Herb tea", art: "cabbage", garnish: "cucumber", tone: "leaf", dish: "tea" },
  1: { name: "Rice porridge", art: "pear", garnish: "broccoli", tone: "sun", dish: "porridge" },
  2: { name: "Scrambled tofu", art: "corn", garnish: "carrot", tone: "sun", dish: "tofu" },
  3: { name: "Lentil stew", art: "potato", garnish: "carrot", tone: "rose", dish: "stew" },
  5: { name: "Bean & quinoa bowl", art: "broccoli", garnish: "apple", tone: "earth", dish: "quinoa" },
  7: { name: "Chickpea curry", art: "corn", garnish: "cabbage", tone: "sun", dish: "curry" },
  9: { name: "Nutty pasta", art: "cucumber", garnish: "carrot", tone: "rose", dish: "pasta" }
};

function ArtSprite({ id, className }: { id: string; className: string }) {
  return <svg className={className} aria-hidden="true" viewBox={id.startsWith("portrait") ? "0 0 90 130" : "0 0 64 64"}><use href={`${ART_SPRITE}#${id}`} /></svg>;
}

type FoodCardDetail = { name: string; art: string; garnish: string; tone: string; dish: string };

function FoodDish({ food }: { food: FoodCardDetail }) {
  const isTea = food.dish === "tea";
  return (
    <svg className={`food-dish food-dish-${food.dish}`} aria-hidden="true" viewBox="0 0 88 72">
      <ellipse className="dish-shadow" cx="44" cy="61" rx="32" ry="5" />
      {isTea ? (
        <>
          <path className="tea-steam" d="M31 11c-6 7 5 8-1 16M43 7c-6 7 5 8-1 16M55 12c-5 6 5 8 0 15" />
          <path className="tea-cup" d="M22 30h42v22c0 8-7 12-21 12s-21-4-21-12z" />
          <path className="tea-handle" d="M64 36c15-2 15 18 1 18" />
          <ellipse className="tea-surface" cx="43" cy="31" rx="21" ry="6" />
          <use href={`${ART_SPRITE}#${food.art}`} x="31" y="21" width="23" height="23" />
        </>
      ) : (
        <>
          <ellipse className="dish-plate-rim" cx="44" cy="54" rx="33" ry="12" />
          <path className="dish-bowl" d="M16 43c3 17 11 23 28 23s25-6 28-23c-14 5-42 5-56 0z" />
          <ellipse className="dish-food" cx="44" cy="43" rx="28" ry="10" />
          <path className="dish-swirl" d="M25 43c7-7 13 5 20-1 7-6 12 5 19-1M28 48c6-5 11 4 17-1 7-5 11 4 17-1" />
          <circle className="dish-speck dish-speck-one" cx="28" cy="40" r="2" />
          <circle className="dish-speck dish-speck-two" cx="58" cy="44" r="2.5" />
          <circle className="dish-speck dish-speck-three" cx="46" cy="37" r="1.7" />
          <use className="dish-main-art" href={`${ART_SPRITE}#${food.art}`} x="28" y="19" width="32" height="32" />
          <use className="dish-garnish-art" href={`${ART_SPRITE}#${food.garnish}`} x="54" y="30" width="20" height="20" />
        </>
      )}
    </svg>
  );
}

function FoodCardFace({ card }: { card: Card }) {
  const food = card.source === "VEGETABLE_SUPPLY"
    ? { name: "Garden greens", art: "cabbage", garnish: "carrot", tone: "leaf", dish: "greens" }
    : FOOD[card.value] ?? FOOD[0];
  return (
    <>
      <span className="food-card-header" aria-hidden="true"><span>Food card</span><span className="food-value">{card.value}</span></span>
      <span className="food-illustration" aria-hidden="true">
        <FoodDish food={food} />
      </span>
      <span className="food-name">{food.name}</span>
      <span className="food-card-caption" aria-hidden="true">freshly drawn</span>
    </>
  );
}

function roleFor(game: GameState, seat: number): string {
  if (game.currentRoles.active === seat) return "Active nutritionist";
  if (game.currentRoles.assistant === seat) return "Assistant";
  if (game.currentRoles.patient1 === seat) return "Patient 1";
  return "Patient 2";
}

function currentActor(game: GameState): Seat | null {
  if (game.phase === "ACTIVE_RESCUE") return game.currentRoles.active;
  if (game.phase === "ASSISTANT_RESCUE") return game.currentRoles.assistant;
  return null;
}

function strictTarget(game: GameState): Seat | null {
  const first = game.currentRoles.patient1;
  const second = game.currentRoles.patient2;
  const total = (seat: Seat) => game.hands[seat].reduce((sum, card) => sum + card.value, 0);
  const excess = (seat: Seat) => Math.max(0, total(seat) - game.threshold);
  const failing = [first, second].filter((seat) => total(seat) > game.threshold);
  if (!failing.length) return null;
  if (failing.length === 1) return failing[0];
  return excess(first) >= excess(second) ? first : second;
}

function total(hand: Card[]): number { return hand.reduce((sum, card) => sum + card.value, 0); }

// Presentation-only mirror of the server's legal-rescue check. It keeps the
// cards grouped with their player while revealing only actions that can work.
function hasHelpfulRescueForCard(game: GameState, actor: Seat | null, actorIndex: number): boolean {
  if (actor === null || (game.phase !== "ACTIVE_RESCUE" && game.phase !== "ASSISTANT_RESCUE")) return false;
  const actorCard = game.hands[actor][actorIndex];
  if (!actorCard) return false;
  return [game.currentRoles.patient1, game.currentRoles.patient2].some((patient) =>
    total(game.hands[patient]) > game.threshold
    && game.hands[patient].some((patientCard) => actorCard.value < patientCard.value)
  );
}

function hasHelpfulRescue(game: GameState, actor: Seat | null): boolean {
  return actor !== null && game.hands[actor].some((_, index) => hasHelpfulRescueForCard(game, actor, index));
}

function aiDecisionIsDue(game: GameState): boolean {
  const actor = currentActor(game);
  if (actor !== null) return game.controllers[actor] === "AI";
  return game.phase === "PATIENT_SWAP"
    && game.controllers[game.currentRoles.patient1] === "AI"
    && game.controllers[game.currentRoles.patient2] === "AI";
}

function turnCue(game: GameState, seat: Seat): { label: string; current: boolean } | null {
  const actor = currentActor(game);
  if (actor === seat) return { label: game.controllers[seat] === "AI" ? "AI is moving" : "Make a move", current: true };
  if (game.phase === "PATIENT_SWAP" && (seat === game.currentRoles.patient1 || seat === game.currentRoles.patient2)) {
    return game.controllers[seat] === "AI"
      ? { label: "AI chooses with partner", current: false }
      : { label: "Choose a card", current: true };
  }
  if (game.phase === "VEGETABLE_RESOLUTION" && strictTarget(game) === seat) return { label: "Choose a garden card", current: true };
  return null;
}

function currentStep(game: GameState): number {
  if (game.phase === "ACTIVE_RESCUE") return 0;
  if (game.phase === "ASSISTANT_RESCUE") return 1;
  if (game.phase === "PATIENT_SWAP") return 2;
  if (game.phase === "VEGETABLE_RESOLUTION") return 3;
  return 4;
}

function TurnFlow({ game }: { game: GameState }) {
  const step = currentStep(game);
  const items = [
    { label: `${NAMES[game.currentRoles.active]} · nutritionist`, note: "rescue" },
    { label: `${NAMES[game.currentRoles.assistant]} · assistant`, note: "only if needed" },
    { label: `${NAMES[game.currentRoles.patient1]} + ${NAMES[game.currentRoles.patient2]}`, note: "patient aid" },
    { label: "Vegetable patch", note: "only if needed" }
  ];
  return (
    <nav className="turn-flow" aria-label="Round turn order">
      {items.map((item, index) => {
        const status = index < step ? "complete" : index === step ? "current" : "upcoming";
        return <div className={`flow-step ${status}`} key={item.note}><span>{index + 1}</span><div><strong>{item.label}</strong><small>{status === "current" ? "Now" : status === "complete" ? "Done" : item.note}</small></div></div>;
      })}
    </nav>
  );
}

function RoundTransition({ game }: { game: GameState }) {
  const outcome = game.lastRoundOutcome?.round === game.round - 1 ? game.lastRoundOutcome : null;
  return (
    <section className="round-transition" aria-live="polite" aria-label={`Day ${game.round} begins`}>
      <div className="round-transition-card">
        {outcome && <p className={`outcome-kicker ${outcome.kind.toLowerCase()}`}>Yesterday · {outcome.title}</p>}
        <p className="day-number">Day {game.round}</p>
        <h2>Good morning.</h2>
        <p>{outcome ? outcome.detail : "A new round is ready. Follow the turn order around the table."}</p>
        <small>First move · {NAMES[game.currentRoles.active]}, active nutritionist</small>
      </div>
    </section>
  );
}

function CabbagePlant() {
  return (
    <svg className="garden-cabbage" viewBox="0 0 64 64" aria-hidden="true">
      <ellipse className="cabbage-soil" cx="32" cy="53" rx="26" ry="7" />
      <path className="cabbage-leaf cabbage-leaf-back" d="M13 43c-6-16 5-29 19-22 6-13 24-8 23 9 12 3 10 20-3 22-10 2-32 3-39-9z" />
      <path className="cabbage-leaf cabbage-leaf-left" d="M14 46c-5-12 3-24 15-19 5 5 5 17-2 24-5 3-10 1-13-5z" />
      <path className="cabbage-leaf cabbage-leaf-right" d="M50 47c6-12-2-25-15-20-6 5-6 17 1 24 5 3 10 1 14-4z" />
      <circle className="cabbage-head" cx="32" cy="39" r="16" />
      <path className="cabbage-vein" d="M32 24v29M20 34c6 1 10 5 12 10M44 34c-6 1-10 5-12 10M23 45c4-3 8-3 12 0M41 45c-4-3-8-3-12 0" />
    </svg>
  );
}

function GardenField({ tokens }: { tokens: number }) {
  return (
    <div className={`garden-field ${tokens === 0 ? "is-empty" : ""}`} role="img" aria-label={tokens === 0 ? "The vegetable field is empty" : `${tokens} cabbage plots are available for zero-value vegetable replacements`}>
      {Array.from({ length: tokens }, (_, index) => <span className="garden-crop" aria-hidden="true" key={`garden-crop-${index}`}><CabbagePlant /></span>)}
    </div>
  );
}

async function responsePayload(response: Response): Promise<{ game?: GameState | null; error?: string }> {
  const body = await response.text();
  try {
    return JSON.parse(body) as { game?: GameState | null; error?: string };
  } catch {
    throw new Error(response.ok
      ? "The game service sent an invalid response. Please reload and try again."
      : `The game service returned ${response.status}. Please reload and try again.`);
  }
}

function savedBrowserGame(): GameState | null {
  if (!usesBrowserGameSave) return null;
  try {
    const raw = window.localStorage.getItem(BROWSER_GAME_KEY);
    return raw ? JSON.parse(raw) as GameState : null;
  } catch {
    window.localStorage.removeItem(BROWSER_GAME_KEY);
    return null;
  }
}

function saveBrowserGame(game: GameState): void {
  if (usesBrowserGameSave) window.localStorage.setItem(BROWSER_GAME_KEY, JSON.stringify(game));
}

interface SeatPanelProps {
  game: GameState;
  seat: Seat;
  selectedActorCard: number | null;
  selectedPatientCards: [number | null, number | null];
  onSelect: (seat: Seat, index: number) => void;
}

function SeatPanel({ game, seat, selectedActorCard, selectedPatientCards, onSelect }: SeatPanelProps) {
  const actor = currentActor(game);
  const target = game.phase === "VEGETABLE_RESOLUTION" ? strictTarget(game) : null;
  const isPatient = seat === game.currentRoles.patient1 || seat === game.currentRoles.patient2;
  const roleClass = isPatient ? "role-patient" : "role-care-team";
  const boardRole = seat === game.currentRoles.active
    ? "board-active"
    : seat === game.currentRoles.assistant
      ? "board-assistant"
      : seat === game.currentRoles.patient1
        ? "board-patient-one"
        : "board-patient-two";
  const isTarget = target === seat;
  const cue = turnCue(game, seat);
  const rescuePhase = game.phase === "ACTIVE_RESCUE" || game.phase === "ASSISTANT_RESCUE";
  const rescueActorIsHuman = rescuePhase && seat === actor && game.controllers[seat] === "HUMAN";
  const patientSwapChoice = game.phase === "PATIENT_SWAP" && isPatient && game.controllers[seat] === "HUMAN";
  const patientPosition = seat === game.currentRoles.patient1 ? 0 : 1;
  const chosenPatientCard = selectedPatientCards[patientPosition];
  const cardIsSelected = (index: number) => (seat === actor && selectedActorCard === index) || (game.phase === "PATIENT_SWAP" && isPatient && chosenPatientCard === index);
  const handTotal = total(game.hands[seat]);
  const withinLimit = !isPatient || handTotal <= game.threshold;
  const highestTargetValue = isTarget ? Math.max(...game.hands[seat].map((card) => card.value)) : -1;

  return (
    <article className={`seat-panel seat-${seat} ${boardRole} ${roleClass} ${isTarget ? "is-target" : ""} ${seat === actor ? "is-actor" : ""} ${cue?.current ? "is-turn" : ""}`}>
      <div className="seat-heading">
        <div className="seat-identity">
          <ArtSprite className="portrait-token" id={PORTRAITS[seat]} />
          <div>
            <p className="seat-number">Seat {seat + 1}</p>
            <h3>{NAMES[seat]}</h3>
            <span className="role-label">Role · {roleFor(game, seat)}</span>
            {cue && <span className={`turn-cue ${cue.current ? "current" : ""}`}>{cue.label}</span>}
          </div>
        </div>
        <div className={`control-badge ${game.controllers[seat] === "AI" ? "ai" : "human"}`}>{game.controllers[seat] === "AI" ? "AI" : "Human"}</div>
      </div>
      <div className="hand" aria-label={`${NAMES[seat]}'s public food cards`}>
        {game.hands[seat].map((card, index) => {
          const vegetableChoice = game.phase === "VEGETABLE_RESOLUTION" && isTarget && card.value > 0 && card.value === highestTargetValue && game.gardenTokens > 0;
          const helpfulActorCard = rescueActorIsHuman && hasHelpfulRescueForCard(game, actor, index);
          const activeRescueChoice = game.phase === "ACTIVE_RESCUE" && isPatient && !withinLimit && selectedActorCard !== null && actor !== null && game.hands[actor][selectedActorCard].value < card.value;
          const assistantRescueChoice = game.phase === "ASSISTANT_RESCUE" && isPatient && !withinLimit && selectedActorCard !== null && actor !== null && game.hands[actor][selectedActorCard].value < card.value;
          const targetChoice = activeRescueChoice || assistantRescueChoice;
          const cardInteractive = game.phase === "PATIENT_SWAP"
            ? patientSwapChoice
            : game.phase === "VEGETABLE_RESOLUTION"
              ? vegetableChoice
              : helpfulActorCard || targetChoice;
          const actionLabel = vegetableChoice ? "Pick" : helpfulActorCard ? "Pick" : targetChoice ? "Swap" : patientSwapChoice ? "Pick" : null;
          return (
            <button
              key={card.id}
              type="button"
              className={`food-card ${FOOD[card.value]?.tone ?? "leaf"} ${cardIsSelected(index) ? "selected" : ""} ${vegetableChoice ? "garden-choice" : ""} ${helpfulActorCard ? "actor-choice" : ""} ${targetChoice ? "target-choice" : ""} ${cardInteractive ? "clickable" : ""}`}
              onClick={() => { if (cardInteractive) onSelect(seat, index); }}
              disabled={!cardInteractive}
              aria-pressed={cardIsSelected(index)}
              aria-label={`${NAMES[seat]}: ${FOOD[card.value]?.name ?? "Vegetable"}, value ${card.value}${actionLabel ? `. ${actionLabel}` : ""}${vegetableChoice ? ". Click to replace this card with a zero-value vegetable" : ""}${card.source === "VEGETABLE_SUPPLY" ? ", vegetable replacement" : ""}`}
            >
              <FoodCardFace card={card} />
              {actionLabel && <span className="card-action-mark" aria-hidden="true">{actionLabel}</span>}
            </button>
          );
        })}
      </div>
      {isPatient && <div className={`patient-total ${withinLimit ? "safe" : "risk"}`}><span>Patient total</span><strong>{handTotal} / {game.threshold}</strong><small>{withinLimit ? "Within limit" : "Over the limit"}</small></div>}
      <div className="seat-score"><span>Points earned</span><strong>{game.scores[seat].totalPoints}</strong><small>Nutritionist {game.scores[seat].nutritionistPoints} · Patient aid {game.scores[seat].patientMutualAidPoints}</small></div>
    </article>
  );
}

function Setup({ controllers, setControllers, start, loading }: { controllers: Controller[]; setControllers: (items: Controller[]) => void; start: () => void; loading: boolean }) {
  return (
    <main className="setup-shell">
      <section className="setup-copy">
        <p className="kicker">Chews Freedom</p>
        <h1>Help each other make the best food swap.</h1>
        <p className="intro">A local four-seat cooperative game. Event cards are enabled as configurable prototype mechanics, not medical advice.</p>
        <div className="setup-actions"><button className="primary-button" type="button" onClick={start} disabled={loading}>{loading ? "Starting game..." : "Start local game"}</button></div>
      </section>
      <section className="setup-art" aria-label="Whimsical family sketch visual reference"><img src="/Chews_Freedom_Artful_Sample.svg" alt="A hand-drawn Chews Freedom game table with four players and food" /></section>
      <section className="setup-seats" aria-labelledby="seat-setup-title">
        <div><h2 id="seat-setup-title">Choose who controls each seat</h2><p>Human seats are played on this computer. AI seats use the cooperative rule policy.</p></div>
        <div className="controller-grid">
          {controllers.map((controller, index) => <label className="controller-choice" key={NAMES[index]}><span><strong>{NAMES[index]}</strong><small>Seat {index + 1}</small></span><select value={controller} onChange={(event) => { const next = [...controllers]; next[index] = event.target.value as Controller; setControllers(next); }}><option value="HUMAN">Human</option><option value="AI">AI</option></select></label>)}
        </div>
        <p className="tiny-note">All food cards stay visible. AI seats play automatically when their role is called; in a mixed patient pair, the AI chooses its own card after the human patient chooses theirs.</p>
      </section>
    </main>
  );
}

export function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [controllers, setControllers] = useState<Controller[]>(["HUMAN", "HUMAN", "HUMAN", "HUMAN"]);
  const [message, setMessage] = useState("Loading the local game service...");
  const [loading, setLoading] = useState(false);
  const [selectedActorCard, setSelectedActorCard] = useState<number | null>(null);
  const [selectedPatientCards, setSelectedPatientCards] = useState<[number | null, number | null]>([null, null]);
  const [showRoundTransition, setShowRoundTransition] = useState(false);
  const seenRound = useRef<number | null>(null);
  const autoAdvancedRevision = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async (initial = false) => {
      const saved = savedBrowserGame();
      if (saved) {
        if (!cancelled) {
          setGame(saved);
          if (initial) setMessage("Restored this browser's saved game.");
        }
        return;
      }
      try {
        const response = await fetch(`${SERVER_URL}/api/game`);
        const data = await responsePayload(response);
        if (!response.ok) throw new Error(data.error ?? "The game service could not load the game.");
        if (cancelled) return;
        setGame(data.game ?? null);
        if (initial) setMessage(data.game ? "Restored the most recent game." : "Choose controllers and start a new game.");
      } catch {
        if (!cancelled) setMessage("The game service is not running yet. Start it with pnpm dev.");
      }
    };
    void refresh(true);

    // A public Vercel preview is browser-owned. Polling a serverless function
    // could replace this evaluator's table with another warm function instance.
    if (usesBrowserGameSave) return () => { cancelled = true; };

    if (supportsSocketUpdates) {
      const socket = io(SERVER_URL);
      socket.on("game:update", (next: GameState | null) => { if (next) setGame(next); });
      return () => { cancelled = true; socket.close(); };
    }

    // Serverless functions do not hold a WebSocket connection. A short poll
    // keeps a public Vercel preview in sync for people judging the same table.
    const interval = window.setInterval(() => { void refresh(); }, 2_500);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  useEffect(() => { setSelectedActorCard(null); setSelectedPatientCards([null, null]); }, [game?.revision, game?.phase]);

  const send = async (input: Command) => {
    setLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/api/game/command`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(usesBrowserGameSave ? { ...input, game } : input) });
      const data = await responsePayload(response);
      if (!response.ok) throw new Error(data.error ?? "Action rejected.");
      if (!data.game) throw new Error("The game service did not return an updated game.");
      saveBrowserGame(data.game); setGame(data.game); setMessage("Action accepted.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action rejected."); }
    finally { setLoading(false); }
  };

  const start = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/api/game`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ controllers }) });
      const data = await responsePayload(response);
      if (!response.ok) throw new Error(data.error ?? "Unable to start the game.");
      if (!data.game) throw new Error("The game service did not return a new game.");
      saveBrowserGame(data.game); setGame(data.game); setShowSetup(false); setMessage("A new game has started. Event cards are enabled.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start the game."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!game || showSetup) {
      seenRound.current = null;
      setShowRoundTransition(false);
      return;
    }
    if (seenRound.current === game.round) return;
    seenRound.current = game.round;
    setShowRoundTransition(true);
    const timer = window.setTimeout(() => setShowRoundTransition(false), 2_650);
    return () => window.clearTimeout(timer);
  }, [game?.round, showSetup]);

  useEffect(() => {
    if (!game || showSetup || loading || !aiDecisionIsDue(game)) {
      if (!game || !aiDecisionIsDue(game)) autoAdvancedRevision.current = null;
      return;
    }
    if (autoAdvancedRevision.current === game.revision) return;
    autoAdvancedRevision.current = game.revision;
    setMessage("AI is taking the next turn...");
    void send({ type: "ADVANCE_AI", expectedRevision: game.revision });
  }, [game?.revision, game?.phase, loading, showSetup]);

  const onSelect = (seat: Seat, index: number) => {
    if (!game) return;
    if (game.phase === "VEGETABLE_RESOLUTION") {
      void send({ type: "TAKE_VEGETABLE", expectedRevision: game.revision, patient: seat, cardIndex: index });
      return;
    }
    if (game.phase === "PATIENT_SWAP") {
      if (game.controllers[seat] === "AI") return;
      if (seat === game.currentRoles.patient1) setSelectedPatientCards(([_, second]) => [index, second]);
      if (seat === game.currentRoles.patient2) setSelectedPatientCards(([first]) => [first, index]);
      return;
    }
    if (seat === currentActor(game)) setSelectedActorCard(index);
    const activeMayChoose = game.phase === "ACTIVE_RESCUE" && (seat === game.currentRoles.patient1 || seat === game.currentRoles.patient2) && total(game.hands[seat]) > game.threshold;
    const assistantMayChoose = game.phase === "ASSISTANT_RESCUE" && (seat === game.currentRoles.patient1 || seat === game.currentRoles.patient2) && total(game.hands[seat]) > game.threshold;
    if ((activeMayChoose || assistantMayChoose) && selectedActorCard !== null) {
      void send({ type: "RESCUE", expectedRevision: game.revision, actor: currentActor(game)!, actorIndex: selectedActorCard, target: seat, targetIndex: index });
    }
  };

  const prompt = useMemo(() => {
    if (!game) return "Set up a local game.";
    if (game.phase === "GAME_OVER") return game.endReason ?? "The game has ended.";
    if (game.phase === "PATIENT_SWAP") {
      const { patient1, patient2 } = game.currentRoles;
      const humanPatients = [patient1, patient2].filter((seat) => game.controllers[seat] === "HUMAN");
      if (!humanPatients.length) return "Both patients are AI-controlled. They are choosing whether to swap.";
      if (humanPatients.length === 1) return `${NAMES[humanPatients[0]]}, choose one card. The AI patient will choose its own best card when you swap.`;
      return "Each patient chooses one card to swap, or the patients may pass. If either patient is still over the limit afterward, the players move to the garden step.";
    }
    if (game.phase === "VEGETABLE_RESOLUTION") {
      const target = strictTarget(game);
      return target === null ? "All patients are within the limit." : `Garden turn: click a highlighted highest-value card on ${NAMES[target]}. It will be replaced by one zero-value vegetable. Keep taking vegetables until every patient is within the limit or the field is empty.`;
    }
    const actor = currentActor(game)!;
    if (game.phase === "ACTIVE_RESCUE") {
      const hasFailingPatient = [game.currentRoles.patient1, game.currentRoles.patient2].some((seat) => total(game.hands[seat]) > game.threshold);
      return hasFailingPatient ? `${NAMES[actor]} may choose either patient who is over the limit. Select one of ${NAMES[actor]}'s cards, then a lower-value swap on the patient you choose.` : `${roleFor(game, actor)} has no patient to rescue. The server will continue the round.`;
    }
    const hasFailingPatient = [game.currentRoles.patient1, game.currentRoles.patient2].some((seat) => total(game.hands[seat]) > game.threshold);
    return hasFailingPatient ? `The active nutritionist did not bring every patient within the limit. ${NAMES[actor]} gets one support rescue and may independently choose either patient who is still over the limit. Select one of ${NAMES[actor]}'s cards, then a lower-value swap on the patient you choose.` : "Both patients are within the limit. The server will continue the round.";
  }, [game]);

  if (showSetup || !game) return <Setup controllers={controllers} setControllers={setControllers} start={start} loading={loading} />;

  const actor = currentActor(game);
  const patient1Ai = game.controllers[game.currentRoles.patient1] === "AI";
  const patient2Ai = game.controllers[game.currentRoles.patient2] === "AI";
  const canSubmitPatientSwap = (patient1Ai || selectedPatientCards[0] !== null) && (patient2Ai || selectedPatientCards[1] !== null);
  const aiTurn = aiDecisionIsDue(game);
  const rescuePhase = game.phase === "ACTIVE_RESCUE" || game.phase === "ASSISTANT_RESCUE";
  const noHelpfulRescue = rescuePhase && actor !== null && game.controllers[actor] === "HUMAN" && !hasHelpfulRescue(game, actor);
  const actionHeading = loading
    ? "Checking action..."
    : aiTurn
      ? "AI turn — choosing a move"
      : noHelpfulRescue
        ? `${NAMES[actor!]} has no helpful rescue`
        : game.phase === "VEGETABLE_RESOLUTION"
          ? "Garden turn — choose a highlighted replacement"
          : game.phase === "PATIENT_SWAP"
            ? "Patient turn — choose one card from each patient"
            : actor === null
              ? "Your turn board"
              : `${NAMES[actor]}'s rescue turn`;

  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="wordmark" href="/" aria-label="Chews Freedom home"><span className="wordmark-leaf">✦</span><span>Chews Freedom</span></a>
        <div className="header-meta"><span>Round {game.round}</span><span>Public food</span><button type="button" className="quiet-button" onClick={() => { if (usesBrowserGameSave) window.localStorage.removeItem(BROWSER_GAME_KEY); setShowSetup(true); setMessage("Choose controllers and start a new game."); }}>New game</button></div>
      </header>
      <section className="game-layout">
        <aside className="left-rail">
          <div className="event-card-panel">
            <div className="panel-heading"><span>Event card</span><strong>{game.currentEvent ? game.currentEvent.shortName : "Clear round"}</strong></div>
            <h2>{game.currentEvent?.name ?? "No event this round"}</h2>
            <p>{game.currentEvent?.summary ?? "The standard rules apply this round."}</p>
            <small>{game.eventPool.length} event cards remain in this game</small>
          </div>
          {game.lastRoundOutcome && <section className={`round-recap ${game.lastRoundOutcome.kind.toLowerCase()}`} aria-label={`Day ${game.lastRoundOutcome.round} result`}><span>Day {game.lastRoundOutcome.round} result</span><h2>{game.lastRoundOutcome.title}</h2><p>{game.lastRoundOutcome.detail}</p></section>}
          <div className="rule-panel"><h2>Rule reason</h2><p>{prompt}</p></div>
        </aside>
        <section className="table-area" aria-label="Chews Freedom public game table">
          <div className={`garden-panel board-garden ${game.phase === "VEGETABLE_RESOLUTION" ? "is-active" : ""}`}><div><span>Our garden</span><p>{game.phase === "VEGETABLE_RESOLUTION" ? "Harvest a highlighted food card." : "Zero-value cabbage replacements."}</p></div><GardenField tokens={game.gardenTokens} /></div>
          <TurnFlow game={game} />
          <div className="table-felt">
            {showRoundTransition && <RoundTransition game={game} />}
            <SeatPanel game={game} seat={game.currentRoles.active} selectedActorCard={selectedActorCard} selectedPatientCards={selectedPatientCards} onSelect={onSelect} />
            <SeatPanel game={game} seat={game.currentRoles.patient1} selectedActorCard={selectedActorCard} selectedPatientCards={selectedPatientCards} onSelect={onSelect} />
            <section className="centre-status" aria-live="polite">
              <p className="phase-label">{game.phase.replaceAll("_", " ")}</p>
              <strong>{game.phase === "GAME_OVER" ? "Game complete" : aiTurn ? "AI is moving" : game.phase === "VEGETABLE_RESOLUTION" ? "Garden turn" : `${game.threshold} limit`}</strong>
              <span>{game.phase === "GAME_OVER" && game.lastRoundOutcome ? game.lastRoundOutcome.title : game.phase === "VEGETABLE_RESOLUTION" ? `${game.gardenTokens} zero-value vegetables ready` : aiTurn ? "The game will advance automatically." : game.currentEvent ? "Event modifier active" : "Follow the highlighted player."}</span>
              {game.phase === "GAME_OVER" && <button type="button" className="primary-button" onClick={() => void start()} disabled={loading}>Play again</button>}
            </section>
            <SeatPanel game={game} seat={game.currentRoles.patient2} selectedActorCard={selectedActorCard} selectedPatientCards={selectedPatientCards} onSelect={onSelect} />
            <SeatPanel game={game} seat={game.currentRoles.assistant} selectedActorCard={selectedActorCard} selectedPatientCards={selectedPatientCards} onSelect={onSelect} />
          </div>
          <div className="action-tray">
            <div><strong>{actionHeading}</strong><p>{prompt}</p><small>{message}</small></div>
            <div className="action-buttons">
              {noHelpfulRescue && actor !== null && <button className="primary-button" type="button" onClick={() => void send({ type: "RESCUE_PASS", expectedRevision: game.revision, actor })} disabled={loading}>Continue</button>}
              {game.phase === "PATIENT_SWAP" && !(patient1Ai && patient2Ai) && <><button className="secondary-button" type="button" onClick={() => void send({ type: "PATIENT_PASS", expectedRevision: game.revision })} disabled={loading}>Do not swap</button><button className="primary-button" type="button" onClick={() => void send({ type: "PATIENT_SWAP", expectedRevision: game.revision, patient1Index: selectedPatientCards[0] ?? undefined, patient2Index: selectedPatientCards[1] ?? undefined })} disabled={loading || !canSubmitPatientSwap}>{patient1Ai || patient2Ai ? "Swap with AI choice" : "Swap selected food"}</button></>}
            </div>
          </div>
        </section>
        <aside className="right-rail">
          <section className="scores-panel"><h2>Shared scoreboard</h2>{game.scores.map((score, seat) => <div className="score-row" key={NAMES[seat]}><span>{NAMES[seat]}</span><div><small>Nutritionist {score.nutritionistPoints} · Mutual aid {score.patientMutualAidPoints}</small><strong>{score.totalPoints}</strong></div></div>)}</section>
          <section className="timeline-panel"><h2>What happened</h2><ol>{game.log.slice(0, 8).map((entry) => <li key={entry.id}><span>{entry.type.replaceAll("_", " ")}</span><p>{entry.message}</p></li>)}</ol></section>
        </aside>
      </section>
    </main>
  );
}
