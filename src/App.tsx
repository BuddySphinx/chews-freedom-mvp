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

function GardenField({ tokens }: { tokens: number }) {
  return (
    <div className={`garden-field ${tokens === 0 ? "is-empty" : ""}`} role="img" aria-label={tokens === 0 ? "The vegetable field is empty" : `${tokens} cabbage plots are available for zero-value vegetable replacements`}>
      {Array.from({ length: tokens }, (_, index) => <span className="garden-crop" aria-hidden="true" key={`garden-crop-${index}`}><ArtSprite className="garden-crop-art" id="cabbage" /></span>)}
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
  const rescueActorIsHuman = seat === actor && game.controllers[seat] === "HUMAN";
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
            <span className="role-label">{roleFor(game, seat)}</span>
            {cue && <span className={`turn-cue ${cue.current ? "current" : ""}`}>{cue.label}</span>}
          </div>
        </div>
        <div className={`control-badge ${game.controllers[seat] === "AI" ? "ai" : "human"}`}>{game.controllers[seat] === "AI" ? "AI" : "Human"}</div>
      </div>
      <div className="hand" aria-label={`${NAMES[seat]}'s public food cards`}>
        {game.hands[seat].map((card, index) => {
          const vegetableChoice = game.phase === "VEGETABLE_RESOLUTION" && isTarget && card.value > 0 && card.value === highestTargetValue && game.gardenTokens > 0;
          const activeRescueChoice = game.phase === "ACTIVE_RESCUE" && isPatient && !withinLimit && selectedActorCard !== null && actor !== null && game.hands[actor][selectedActorCard].value < card.value;
          const assistantRescueChoice = game.phase === "ASSISTANT_RESCUE" && isPatient && !withinLimit && selectedActorCard !== null && actor !== null && game.hands[actor][selectedActorCard].value < card.value;
          const cardInteractive = game.phase === "PATIENT_SWAP"
            ? patientSwapChoice
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
              <FoodCardFace card={card} />
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

const GARDEN_ART = ["carrot", "broccoli", "corn", "cabbage", "apple", "cucumber", "eggplant", "pear", "orange", "corn"];
const GARDEN_COUNTS = [3, 2, 1, 2, 3, 2, 1, 2, 2, 1];

function roleColour(game: GameState, seat: Seat): string {
  if (seat === game.currentRoles.active) return "moss";
  if (seat === game.currentRoles.assistant) return "gold";
  return seat === game.currentRoles.patient1 ? "blue" : "plum";
}

function GardenResourceBar({ game }: { game: GameState }) {
  return (
    <section className="garden-resource-bar" aria-label="Our garden resources">
      <div className="garden-wood-title"><span>Our garden</span></div>
      <div className="garden-resource-frame">
        {GARDEN_ART.map((art, index) => {
          const remaining = Math.max(0, game.gardenTokens - index);
          return <div className={`resource-crop ${remaining === 0 ? "spent" : ""}`} key={`${art}-${index}`}>
            <ArtSprite id={art} className="resource-art" />
            <strong>{remaining === 0 ? 0 : GARDEN_COUNTS[index]}</strong>
          </div>;
        })}
      </div>
      <p className="garden-instruction">Use vegetables to activate Food Cards and reach your protein goals!</p>
    </section>
  );
}

function StorySidebar() {
  return (
    <aside className="storybook-sidebar" aria-label="Chews Freedom guide">
      <div className="storybook-logo"><span>Chews</span><strong>Freedom</strong><i>❦</i></div>
      <div className="motto-ribbon">Eat safely, choose boldly,<br />live fully.</div>
      <section className="side-parchment introduction-panel">
        <p>A board game of food, choices, and courage for children with true metabolic conditions and the people who support them.</p>
        <div className="little-friends" aria-hidden="true"><ArtSprite id="portrait-a" className="little-friend" /><ArtSprite id="portrait-b" className="little-friend" /></div>
        <strong>You’re never alone on<br />this journey.</strong>
      </section>
      <section className="side-parchment how-to-panel">
        <h2>How to play</h2>
        <ul>
          <li><b>✦</b> Goal</li><li><b>✦</b> Your Turn</li><li><b>✦</b> Roles</li><li><b>✦</b> Food Cards</li><li><b>✦</b> Events</li><li><b>✦</b> End of Round</li>
        </ul>
      </section>
      <section className="help-panel"><span>♡</span><div><strong>Need more help?</strong><small>Read the full guide →</small></div></section>
    </aside>
  );
}

function CottageScene({ game, prompt, aiTurn }: { game: GameState; prompt: string; aiTurn: boolean }) {
  return (
    <div className="cottage-scene" aria-live="polite">
      <svg className="cottage-art" viewBox="0 0 330 250" aria-hidden="true">
        <defs>
          <linearGradient id="cottage-sky" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#83b9c7" /><stop offset="1" stopColor="#e7d69e" /></linearGradient>
          <linearGradient id="cottage-roof" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#b15a34" /><stop offset="1" stopColor="#643a2a" /></linearGradient>
        </defs>
        <ellipse cx="165" cy="129" rx="148" ry="105" fill="url(#cottage-sky)" opacity=".82" />
        <path d="M17 177c40-33 75-36 108-18 37-28 79-31 111-7 30-21 60-20 78 8v51H17z" fill="#728b58" opacity=".95" />
        <path d="M51 183c20-35 45-47 74-36 13-24 47-37 74-11 26-17 59-4 68 23" fill="none" stroke="#476b42" strokeWidth="13" strokeLinecap="round" opacity=".8" />
        <path d="M111 138l54-48 57 48v72h-111z" fill="#bd8b56" stroke="#4e3725" strokeWidth="5" strokeLinejoin="round" />
        <path d="M95 141l69-67 73 67-16 7-57-49-52 47z" fill="url(#cottage-roof)" stroke="#4e3725" strokeWidth="5" strokeLinejoin="round" />
        <path d="M140 210v-42c0-13 11-22 24-22s24 9 24 22v42z" fill="#4f654e" stroke="#3b2c20" strokeWidth="4" />
        <path d="M121 156h18v23h-18zM191 156h18v23h-18z" fill="#d9c77d" stroke="#4e3725" strokeWidth="3" />
        <path d="M152 104h25v22h-25z" fill="#e6d58d" stroke="#4e3725" strokeWidth="3" />
        <path d="M231 93v50M222 94h18" stroke="#65432a" strokeWidth="5" strokeLinecap="round" />
        <path d="M232 69c-9 13-6 18 5 26" fill="none" stroke="#efe1af" strokeWidth="5" strokeLinecap="round" />
        <g fill="#e2aa56" stroke="#5c4130" strokeWidth="1.4"><circle cx="83" cy="197" r="7" /><circle cx="101" cy="208" r="6" /><circle cx="224" cy="198" r="7" /><circle cx="244" cy="210" r="5" /><circle cx="58" cy="214" r="5" /><circle cx="270" cy="185" r="5" /></g>
        <g fill="#d77d75"><circle cx="96" cy="190" r="4" /><circle cx="235" cy="190" r="4" /><circle cx="262" cy="199" r="4" /></g>
      </svg>
      <div className="cottage-message"><strong>{aiTurn ? "Thinking together" : "Work together."}</strong><span>{prompt}</span></div>
    </div>
  );
}

function BoardPiece({ game, seat, placement }: { game: GameState; seat: Seat; placement: "northwest" | "northeast" | "southwest" | "southeast" }) {
  const role = roleFor(game, seat);
  const roleClass = roleColour(game, seat);
  const cue = turnCue(game, seat);
  return (
    <section className={`board-piece board-piece-${placement} ${cue?.current ? "piece-current" : ""}`} aria-label={`${NAMES[seat]}, ${role}`}>
      <div className={`role-scroll role-scroll-${roleClass}`}>{role}</div>
      <div className={`piece-pedestal pedestal-${roleClass}`}><ArtSprite id={PORTRAITS[seat]} className="board-character" /></div>
      <strong>{NAMES[seat]}</strong>
      {cue && <small>{cue.label}</small>}
    </section>
  );
}

function StorybookBoard({ game, prompt, aiTurn, showRoundTransition }: { game: GameState; prompt: string; aiTurn: boolean; showRoundTransition: boolean }) {
  return (
    <section className="storybook-board" aria-label="Circular Chews Freedom game board">
      <div className="stone-track" aria-hidden="true"><span className="track-glyph glyph-heart">♥</span><span className="track-glyph glyph-leaf">❦</span><span className="track-glyph glyph-cart">✧</span><span className="track-glyph glyph-snow">✦</span><span className="track-glyph glyph-question">?</span><span className="track-glyph glyph-run">✧</span></div>
      <CottageScene game={game} prompt={prompt} aiTurn={aiTurn} />
      <BoardPiece game={game} seat={game.currentRoles.active} placement="northwest" />
      <BoardPiece game={game} seat={game.currentRoles.assistant} placement="northeast" />
      <BoardPiece game={game} seat={game.currentRoles.patient1} placement="southwest" />
      <BoardPiece game={game} seat={game.currentRoles.patient2} placement="southeast" />
      {showRoundTransition && <RoundTransition game={game} />}
    </section>
  );
}

interface FoodShelfProps {
  game: GameState;
  selectedActorCard: number | null;
  selectedPatientCards: [number | null, number | null];
  onSelect: (seat: Seat, index: number) => void;
}

function FoodShelf({ game, selectedActorCard, selectedPatientCards, onSelect }: FoodShelfProps) {
  const actor = currentActor(game);
  const target = game.phase === "VEGETABLE_RESOLUTION" ? strictTarget(game) : null;
  return (
    <section className="food-shelf" aria-label="Public food cards">
      <div className="food-deck-back" aria-hidden="true"><span>Food</span><strong>Deck</strong><i>❦</i></div>
      <div className="food-card-row">
        {game.hands.flatMap((hand, seatIndex) => hand.map((card, index) => {
          const seat = seatIndex as Seat;
          const isPatient = seat === game.currentRoles.patient1 || seat === game.currentRoles.patient2;
          const isTarget = seat === target;
          const handTotal = total(game.hands[seat]);
          const highestTargetValue = isTarget ? Math.max(...game.hands[seat].map((candidate) => candidate.value)) : -1;
          const vegetableChoice = game.phase === "VEGETABLE_RESOLUTION" && isTarget && card.value > 0 && card.value === highestTargetValue && game.gardenTokens > 0;
          const rescueActorIsHuman = seat === actor && game.controllers[seat] === "HUMAN";
          const activeRescueChoice = game.phase === "ACTIVE_RESCUE" && isPatient && handTotal > game.threshold && selectedActorCard !== null && actor !== null && game.hands[actor][selectedActorCard].value < card.value;
          const assistantRescueChoice = game.phase === "ASSISTANT_RESCUE" && isPatient && handTotal > game.threshold && selectedActorCard !== null && actor !== null && game.hands[actor][selectedActorCard].value < card.value;
          const patientSwapChoice = game.phase === "PATIENT_SWAP" && isPatient && game.controllers[seat] === "HUMAN";
          const interactive = game.phase === "PATIENT_SWAP" ? patientSwapChoice : game.phase === "VEGETABLE_RESOLUTION" ? vegetableChoice : rescueActorIsHuman || activeRescueChoice || assistantRescueChoice;
          const patientPosition = seat === game.currentRoles.patient1 ? 0 : 1;
          const selected = (seat === actor && selectedActorCard === index) || (game.phase === "PATIENT_SWAP" && isPatient && selectedPatientCards[patientPosition] === index);
          return <button key={card.id} type="button" className={`food-card shelf-card owner-${seat} ${FOOD[card.value]?.tone ?? "leaf"} ${selected ? "selected" : ""} ${vegetableChoice ? "garden-choice" : ""} ${interactive ? "clickable" : ""}`} onClick={() => { if (interactive) onSelect(seat, index); }} disabled={!interactive} aria-pressed={selected} aria-label={`${NAMES[seat]}: ${card.source === "VEGETABLE_SUPPLY" ? "Garden greens" : FOOD[card.value]?.name ?? "Vegetable"}, value ${card.value}`}>
            <span className="card-owner">{NAMES[seat]}</span><FoodCardFace card={card} />
          </button>;
        }))}
      </div>
      <p className="protein-label">Protein Value</p>
    </section>
  );
}

function CakeDayCard() {
  return <section className="cake-day-card" aria-label="Cake Day celebration card"><span>Cake day!</span><ArtSprite id="cake" className="cake-art" /><strong>Celebrate!</strong><small>Each player takes a slice.</small></section>;
}

function EventIllustration({ index }: { index: number }) {
  if (index === 0) return <svg className="event-illustration" viewBox="0 0 64 64" aria-hidden="true"><g className="event-ink"><path d="M32 7v50M10 19l44 26M10 45l44-26M17 9l30 46M47 9L17 55" /><circle cx="32" cy="32" r="7" /></g></svg>;
  if (index === 1) return <svg className="event-illustration" viewBox="0 0 64 64" aria-hidden="true"><path className="event-cloud" d="M13 33c-4-11 10-18 18-12 6-11 23-5 22 8 10 2 8 17-2 18H17c-8 0-10-9-4-14z" /><path className="event-rain" d="M20 49l-3 8M32 49l-3 8M44 49l-3 8" /></svg>;
  if (index === 2) return <svg className="event-illustration" viewBox="0 0 64 64" aria-hidden="true"><path className="event-cloud dark" d="M11 33c-3-11 10-18 18-12 7-10 24-4 22 8 10 2 8 18-3 18H17c-8 0-10-9-6-14z" /><path className="event-bolt" d="M35 36H25l8-13-1 10h9L29 53z" /></svg>;
  if (index === 3) return <svg className="event-illustration" viewBox="0 0 64 64" aria-hidden="true"><path className="event-market-roof" d="M8 24h48l-5-12H13z" /><path className="event-market" d="M13 25h38v28H13z" /><path className="event-ink" d="M22 25v28M41 25v28M14 36h36" /><circle cx="25" cy="43" r="4" className="event-produce" /><circle cx="38" cy="43" r="4" className="event-produce" /></svg>;
  return <svg className="event-illustration" viewBox="0 0 64 64" aria-hidden="true"><path className="event-case" d="M11 20h42v33H11z" /><path className="event-case" d="M24 14h16v7H24z" /><path className="event-ink" d="M12 33h40M23 20v33M41 20v33" /><circle cx="22" cy="55" r="4" className="event-wheel" /><circle cx="43" cy="55" r="4" className="event-wheel" /></svg>;
}

function EventShelf({ game }: { game: GameState }) {
  const events = [game.currentEvent, ...game.eventPool].filter((event): event is NonNullable<typeof event> => Boolean(event)).slice(0, 5);
  return <section className="event-shelf" aria-label="Event cards"><div className="event-shelf-title">Events <small>Draw at end of round</small></div><div className="event-card-row">{events.map((event, index) => <article className={`event-mini-card event-colour-${index % 5}`} key={event.id}><EventIllustration index={index} /><strong>{event.shortName}</strong><span>{event.summary}</span></article>)}</div></section>;
}

function ScoreSidebar({ game }: { game: GameState }) {
  const roleSeats = [game.currentRoles.active, game.currentRoles.assistant, game.currentRoles.patient1, game.currentRoles.patient2];
  return (
    <aside className="score-sidebar" aria-label="Round and scoreboard">
      <div className="round-and-quote"><div className="round-medallion"><span>Round</span><strong>{game.round}</strong><small>of 12</small></div><blockquote>Courage grows<br />with every choice.<b>♥</b></blockquote></div>
      <section className="scoreboard-panel"><h2>Scoreboard</h2><div className="scoreboard-head"><span>Player</span><span>Role</span><span>Protein</span><span>Points</span></div>{game.scores.map((score, seat) => <div className="scoreboard-entry" key={NAMES[seat]}><span className="score-avatar"><ArtSprite id={PORTRAITS[seat]} className="score-avatar-art" />{NAMES[seat]}</span><em className={`score-role score-${roleColour(game, seat as Seat)}`}>{roleFor(game, seat)}</em><b>{total(game.hands[seat])}</b><strong>{score.totalPoints}</strong></div>)}</section>
      <section className="current-roles-panel"><h2>Current roles this round</h2>{roleSeats.map((seat) => <div className="role-row" key={`${seat}-${roleFor(game, seat)}`}><i className={`role-dot role-${roleColour(game, seat)}`} /><span>{roleFor(game, seat)}</span><b>{NAMES[seat]}</b></div>)}<p>The Nutritionist is making choices this round with help from the Assistant.</p></section>
    </aside>
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

  return (
    <main className="storybook-game-shell">
      <div className="storybook-game-stage">
        <StorySidebar />
        <GardenResourceBar game={game} />
        <ScoreSidebar game={game} />
        <section className="main-board-area">
          <StorybookBoard game={game} prompt={prompt} aiTurn={aiTurn} showRoundTransition={showRoundTransition} />
          <div className="game-action-banner"><div><strong>{loading ? "Checking action…" : aiTurn ? "A friend is choosing a move" : game.phase === "VEGETABLE_RESOLUTION" ? "Choose a garden replacement" : "Your turn"}</strong><span>{message}</span></div><div className="game-action-buttons">{game.phase === "PATIENT_SWAP" && !(patient1Ai && patient2Ai) && <><button className="storybook-secondary" type="button" onClick={() => void send({ type: "PATIENT_PASS", expectedRevision: game.revision })} disabled={loading}>Do not swap</button><button className="storybook-primary" type="button" onClick={() => void send({ type: "PATIENT_SWAP", expectedRevision: game.revision, patient1Index: selectedPatientCards[0] ?? undefined, patient2Index: selectedPatientCards[1] ?? undefined })} disabled={loading || !canSubmitPatientSwap}>{patient1Ai || patient2Ai ? "Swap with AI choice" : "Swap selected food"}</button></>}{game.phase === "GAME_OVER" && <button className="storybook-primary" type="button" onClick={() => void start()} disabled={loading}>Play again</button>}</div></div>
        </section>
        <section className="bottom-card-area" aria-label="Food deck and events"><FoodShelf game={game} selectedActorCard={selectedActorCard} selectedPatientCards={selectedPatientCards} onSelect={onSelect} /><CakeDayCard /><EventShelf game={game} /></section>
        <footer className="storybook-footer"><span>♥&nbsp; We’re here for every step of the journey.</span><strong>Chews Freedom celebrates safe eating, strong choices, and the amazing kids who inspire us every day.</strong><nav><a href="#about">About</a><a href="#resources">Resources</a><a href="#community">Community</a><button type="button" onClick={() => { if (usesBrowserGameSave) window.localStorage.removeItem(BROWSER_GAME_KEY); setShowSetup(true); setMessage("Choose controllers and start a new game."); }}>New game</button></nav></footer>
      </div>
    </main>
  );
}
