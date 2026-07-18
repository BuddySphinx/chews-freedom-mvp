import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import type { Card, Command, Controller, GameState, Seat } from "./game-types";

// Vite runs on 5173 while the local Fastify game service runs on 5174. In a
// Vercel deployment, the serverless API shares the page's origin instead.
const isLocalVite = window.location.hostname === "127.0.0.1" && window.location.port === "5173";
const SERVER_URL = isLocalVite ? "http://127.0.0.1:5174" : window.location.origin;
const supportsSocketUpdates = isLocalVite || window.location.port === "5174";
const NAMES = ["Rain", "Rice", "Joy", "Sail"];
const FOOD: Record<number, { name: string; icon: string; tone: string }> = {
  0: { name: "Cucumber", icon: "🥒", tone: "leaf" },
  1: { name: "Pear", icon: "🍐", tone: "sun" },
  2: { name: "Banana", icon: "🍌", tone: "sun" },
  3: { name: "Apple", icon: "🍎", tone: "rose" },
  5: { name: "Potato", icon: "🥔", tone: "earth" },
  7: { name: "Corn", icon: "🌽", tone: "sun" },
  9: { name: "Cake", icon: "🍰", tone: "rose" }
};

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
  const isTarget = target === seat;
  const rescueActorIsHuman = seat === actor && game.controllers[seat] === "HUMAN";
  const patientPosition = seat === game.currentRoles.patient1 ? 0 : 1;
  const chosenPatientCard = selectedPatientCards[patientPosition];
  const cardIsSelected = (index: number) => (seat === actor && selectedActorCard === index) || (game.phase === "PATIENT_SWAP" && chosenPatientCard === index);
  const handTotal = total(game.hands[seat]);
  const withinLimit = !isPatient || handTotal <= game.threshold;
  const highestTargetValue = isTarget ? Math.max(...game.hands[seat].map((card) => card.value)) : -1;

  return (
    <article className={`seat-panel seat-${seat} ${isTarget ? "is-target" : ""} ${seat === actor ? "is-actor" : ""}`}>
      <div className="seat-heading">
        <div>
          <p className="seat-number">Seat {seat + 1}</p>
          <h3>{NAMES[seat]}</h3>
          <span className="role-label">{roleFor(game, seat)}</span>
        </div>
        <div className={`control-badge ${game.controllers[seat] === "AI" ? "ai" : "human"}`}>{game.controllers[seat] === "AI" ? "AI" : "Human"}</div>
      </div>
      <div className="hand" aria-label={`${NAMES[seat]}'s public food cards`}>
        {game.hands[seat].map((card, index) => {
          const vegetableChoice = game.phase === "VEGETABLE_RESOLUTION" && isTarget && card.value > 0 && card.value === highestTargetValue && game.gardenTokens > 0;
          const activeRescueChoice = game.phase === "ACTIVE_RESCUE" && isPatient && !withinLimit && selectedActorCard !== null && actor !== null && game.hands[actor][selectedActorCard].value < card.value;
          const assistantRescueChoice = game.phase === "ASSISTANT_RESCUE" && isPatient && !withinLimit && selectedActorCard !== null && actor !== null && game.hands[actor][selectedActorCard].value < card.value;
          const cardInteractive = game.phase === "PATIENT_SWAP"
            ? isPatient
            : game.phase === "VEGETABLE_RESOLUTION"
              ? vegetableChoice
              : rescueActorIsHuman || activeRescueChoice || assistantRescueChoice;
          return (
            <button
              key={card.id}
              type="button"
              className={`food-card ${FOOD[card.value]?.tone ?? "leaf"} ${cardIsSelected(index) ? "selected" : ""} ${vegetableChoice ? "garden-choice" : ""} ${cardInteractive ? "clickable" : ""}`}
              onClick={() => { if (cardInteractive) onSelect(seat, index); }}
              disabled={!cardInteractive}
              aria-pressed={cardIsSelected(index)}
              aria-label={`${FOOD[card.value]?.name ?? "Vegetable"}, value ${card.value}${vegetableChoice ? ". Click to replace this card with a zero-value vegetable" : ""}${card.source === "VEGETABLE_SUPPLY" ? ", vegetable replacement" : ""}`}
            >
              <span className="food-icon">{card.source === "VEGETABLE_SUPPLY" ? "🥬" : FOOD[card.value]?.icon}</span>
              <span className="food-name">{card.source === "VEGETABLE_SUPPLY" ? "Garden veg" : FOOD[card.value]?.name}</span>
              <strong>{card.value}</strong>
              {vegetableChoice && <span className="garden-replace-mark" aria-hidden="true">🥬 replace</span>}
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
        <p className="tiny-note">All food cards stay visible. You can start with any mix of human and AI players.</p>
      </section>
    </main>
  );
}

export function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [controllers, setControllers] = useState<Controller[]>(["HUMAN", "HUMAN", "HUMAN", "HUMAN"]);
  const [message, setMessage] = useState("Loading the local game service...");
  const [loading, setLoading] = useState(false);
  const [selectedActorCard, setSelectedActorCard] = useState<number | null>(null);
  const [selectedPatientCards, setSelectedPatientCards] = useState<[number | null, number | null]>([null, null]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async (initial = false) => {
      try {
        const response = await fetch(`${SERVER_URL}/api/game`);
        const data = await response.json();
        if (cancelled) return;
        setGame(data.game);
        if (initial) setMessage(data.game ? "Restored the most recent game." : "Choose controllers and start a new game.");
      } catch {
        if (!cancelled) setMessage("The game service is not running yet. Start it with pnpm dev.");
      }
    };
    void refresh(true);

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
      const response = await fetch(`${SERVER_URL}/api/game/command`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Action rejected.");
      setGame(data.game); setMessage("Action accepted.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action rejected."); }
    finally { setLoading(false); }
  };

  const start = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/api/game`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ controllers }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to start the game.");
      setGame(data.game); setMessage("A new local game has started. Event cards are enabled.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start the game."); }
    finally { setLoading(false); }
  };

  const onSelect = (seat: Seat, index: number) => {
    if (!game) return;
    if (game.phase === "VEGETABLE_RESOLUTION") {
      void send({ type: "TAKE_VEGETABLE", expectedRevision: game.revision, patient: seat, cardIndex: index });
      return;
    }
    if (game.phase === "PATIENT_SWAP") {
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
    if (game.phase === "PATIENT_SWAP") return "Patients may each select one card to swap, or choose not to swap. If either patient is still over the limit afterward, the players move to the garden step.";
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
    return hasFailingPatient ? `${NAMES[actor]} may independently choose either patient who is still over the limit. Select one of ${NAMES[actor]}'s cards, then a lower-value swap on the patient you choose.` : "Both patients are within the limit. The server will continue the round.";
  }, [game]);

  if (!game) return <Setup controllers={controllers} setControllers={setControllers} start={start} loading={loading} />;

  const actor = currentActor(game);
  const canSubmitPatientSwap = selectedPatientCards[0] !== null && selectedPatientCards[1] !== null;
  const canAdvanceAi = actor !== null ? game.controllers[actor] === "AI" : game.phase === "PATIENT_SWAP" && game.controllers[game.currentRoles.patient1] === "AI" && game.controllers[game.currentRoles.patient2] === "AI";

  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="wordmark" href="/" aria-label="Chews Freedom home"><span className="wordmark-leaf">✦</span><span>Chews Freedom</span></a>
        <div className="header-meta"><span>Round {game.round}</span><span>Public food</span><button type="button" className="quiet-button" onClick={() => { setGame(null); setMessage("Choose controllers and start a new game."); }}>New game</button></div>
      </header>
      <section className="game-layout">
        <aside className="left-rail">
          <div className="event-card-panel">
            <div className="panel-heading"><span>Event card</span><strong>{game.currentEvent ? game.currentEvent.shortName : "Clear round"}</strong></div>
            <h2>{game.currentEvent?.name ?? "No event this round"}</h2>
            <p>{game.currentEvent?.summary ?? "The standard rules apply this round."}</p>
            <small>{game.eventPool.length} event cards remain in this game</small>
          </div>
          <div className={`garden-panel ${game.phase === "VEGETABLE_RESOLUTION" ? "is-active" : ""}`}><span>Garden supply</span><strong>{game.gardenTokens}</strong><p>{game.phase === "VEGETABLE_RESOLUTION" ? "Garden turn: click a highlighted patient card to take one zero-value vegetable." : "Vegetables replace the highest remaining food with value 0 and never give points."}</p></div>
          <div className="rule-panel"><h2>Rule reason</h2><p>{prompt}</p></div>
        </aside>
        <section className="table-area" aria-label="Chews Freedom public game table">
          <div className="table-felt">
            <SeatPanel game={game} seat={game.currentRoles.active} selectedActorCard={selectedActorCard} selectedPatientCards={selectedPatientCards} onSelect={onSelect} />
            <SeatPanel game={game} seat={game.currentRoles.patient1} selectedActorCard={selectedActorCard} selectedPatientCards={selectedPatientCards} onSelect={onSelect} />
            <section className="centre-status" aria-live="polite">
              <p className="phase-label">{game.phase.replaceAll("_", " ")}</p>
              <strong>{game.phase === "GAME_OVER" ? "Game complete" : game.phase === "VEGETABLE_RESOLUTION" ? "Choose a garden card" : `${game.threshold} limit`}</strong>
              <span>{game.phase === "VEGETABLE_RESOLUTION" ? `${game.gardenTokens} zero-value vegetables ready` : game.currentEvent ? "Event modifier active" : "Standard round"}</span>
              {game.phase === "GAME_OVER" && <button type="button" className="primary-button" onClick={() => void start()} disabled={loading}>Play again</button>}
            </section>
            <SeatPanel game={game} seat={game.currentRoles.patient2} selectedActorCard={selectedActorCard} selectedPatientCards={selectedPatientCards} onSelect={onSelect} />
            <SeatPanel game={game} seat={game.currentRoles.assistant} selectedActorCard={selectedActorCard} selectedPatientCards={selectedPatientCards} onSelect={onSelect} />
          </div>
          <div className="action-tray">
            <div><strong>{loading ? "Checking action..." : game.phase === "VEGETABLE_RESOLUTION" ? "Garden turn — players choose the replacement" : "Your turn board"}</strong><p>{message}</p></div>
            <div className="action-buttons">
              {game.phase === "PATIENT_SWAP" && <><button className="secondary-button" type="button" onClick={() => void send({ type: "PATIENT_PASS", expectedRevision: game.revision })} disabled={loading}>Do not swap</button><button className="primary-button" type="button" onClick={() => void send({ type: "PATIENT_SWAP", expectedRevision: game.revision, patient1Index: selectedPatientCards[0]!, patient2Index: selectedPatientCards[1]! })} disabled={loading || !canSubmitPatientSwap}>Swap selected food</button></>}
              {canAdvanceAi && <button className="primary-button" type="button" onClick={() => void send({ type: "ADVANCE_AI", expectedRevision: game.revision })} disabled={loading}>Let AI continue</button>}
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
