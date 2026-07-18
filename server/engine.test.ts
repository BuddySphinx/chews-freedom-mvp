import { describe, expect, it } from "vitest";
import { command, EVENT_DEFINITIONS, createGame, legalRescues, legalVegetableReplacements, strictTarget, validateState } from "./engine.js";

describe("Chews Freedom local prototype engine", () => {
  it("keeps the 48-card main deck conserved after automated turns", () => {
    const game = createGame(["AI", "AI", "AI", "AI"], 20260717);
    expect(game.eventsEnabled).toBe(true);
    expect(() => validateState(game)).not.toThrow();
    const mainCards = [...game.drawPile, ...game.discardPile, ...game.hands.flat().filter((card) => card.source === "MAIN_DECK")];
    expect(mainCards).toHaveLength(48);
    expect(new Set(mainCards.map((card) => card.id)).size).toBe(48);
  });

  it("selects patient 1 when both patients have the same excess", () => {
    const game = createGame(["HUMAN", "HUMAN", "HUMAN", "HUMAN"], 7);
    game.threshold = 10;
    game.hands[game.currentRoles.patient1] = [{ id: "p1a", value: 9, source: "MAIN_DECK" }, { id: "p1b", value: 3, source: "MAIN_DECK" }, { id: "p1c", value: 0, source: "MAIN_DECK" }];
    game.hands[game.currentRoles.patient2] = [{ id: "p2a", value: 7, source: "MAIN_DECK" }, { id: "p2b", value: 5, source: "MAIN_DECK" }, { id: "p2c", value: 0, source: "MAIN_DECK" }];
    expect(strictTarget(game)).toBe(game.currentRoles.patient1);
  });

  it("lets the active nutritionist choose the less-dangerous patient and keeps that choice for support", () => {
    const game = createGame(["HUMAN", "HUMAN", "HUMAN", "HUMAN"], 20260717);
    const active = game.currentRoles.active;
    const [patient1, patient2] = [game.currentRoles.patient1, game.currentRoles.patient2];
    const lowerDangerPatient = [patient1, patient2].sort((left, right) => {
      const leftTotal = game.hands[left].reduce((sum, card) => sum + card.value, 0);
      const rightTotal = game.hands[right].reduce((sum, card) => sum + card.value, 0);
      return leftTotal - rightTotal;
    })[0];
    expect(game.hands[lowerDangerPatient].reduce((sum, card) => sum + card.value, 0)).toBeGreaterThan(game.threshold);
    const action = legalRescues(game, active).find((candidate) => candidate.target === lowerDangerPatient);
    expect(action).toBeDefined();
    command(game, { type: "RESCUE", expectedRevision: game.revision, actor: active, actorIndex: action!.actorIndex, target: action!.target, targetIndex: action!.patientIndex });
    expect(game.rescueTarget).toBe(lowerDangerPatient);
  });

  it("ships the full enabled event-card pool rather than an events-disabled baseline", () => {
    expect(EVENT_DEFINITIONS).toHaveLength(10);
    expect(EVENT_DEFINITIONS.map((event) => event.id)).toContain("RAIN");
    expect(EVENT_DEFINITIONS.some((event) => event.kind === "THRESHOLD")).toBe(true);
    expect(EVENT_DEFINITIONS.some((event) => event.kind === "GARDEN")).toBe(true);
  });

  it("lets the assistant choose a different patient, then keeps garden recovery player-controlled", () => {
    const game = createGame(["HUMAN", "HUMAN", "HUMAN", "HUMAN"], 20260717);
    expect(game.phase).toBe("ACTIVE_RESCUE");

    const active = game.currentRoles.active;
    const partialAction = legalRescues(game, active).find((action) => {
      const targetTotal = game.hands[action.target].reduce((sum, card) => sum + card.value, 0);
      return targetTotal - game.hands[action.target][action.patientIndex].value + game.hands[active][action.actorIndex].value > game.threshold;
    });
    expect(partialAction).toBeDefined();
    command(game, { type: "RESCUE", expectedRevision: game.revision, actor: active, actorIndex: partialAction!.actorIndex, target: partialAction!.target, targetIndex: partialAction!.patientIndex });
    expect(game.phase).toBe("ASSISTANT_RESCUE");
    expect(game.rescueTarget).toBe(partialAction!.target);
    expect(game.scores[active].nutritionistPoints).toBe(0);
    expect(game.log.some((entry) => entry.message.includes("helpful swap"))).toBe(true);

    const assistant = game.currentRoles.assistant;
    const completingAction = legalRescues(game, assistant).find((action) => {
      const targetTotal = game.hands[action.target].reduce((sum, card) => sum + card.value, 0);
      return action.target !== partialAction!.target && targetTotal - game.hands[action.target][action.patientIndex].value + game.hands[assistant][action.actorIndex].value <= game.threshold;
    });
    expect(completingAction).toBeDefined();
    command(game, { type: "RESCUE", expectedRevision: game.revision, actor: assistant, actorIndex: completingAction!.actorIndex, target: completingAction!.target, targetIndex: completingAction!.patientIndex });
    expect(game.scores[assistant].nutritionistPoints).toBe(1);
    expect(game.phase).toBe("PATIENT_SWAP");

    // Force a two-vegetable need while leaving one token. The field must still
    // spend that final zero-value vegetable rather than hold it back.
    const patient2 = game.currentRoles.patient2;
    const donorIndex = game.hands[assistant].findIndex((card) => card.value === 7);
    expect(donorIndex).toBeGreaterThanOrEqual(0);
    [game.hands[patient2][1], game.hands[assistant][donorIndex]] = [game.hands[assistant][donorIndex], game.hands[patient2][1]];
    game.gardenTokens = 1;
    command(game, { type: "PATIENT_PASS", expectedRevision: game.revision });
    expect(game.phase).toBe("VEGETABLE_RESOLUTION");
    expect(game.gardenTokens).toBe(1);
    const vegetableAction = legalVegetableReplacements(game)[0];
    expect(vegetableAction).toBeDefined();
    command(game, { type: "TAKE_VEGETABLE", expectedRevision: game.revision, patient: vegetableAction.patient, cardIndex: vegetableAction.cardIndex });
    expect(game.gardenTokens).toBe(0);
    expect(game.log.some((entry) => entry.type === "VEGETABLE_REPLACEMENT")).toBe(true);
    expect(game.log.some((entry) => entry.type === "GARDEN_EXHAUSTED")).toBe(true);
    expect(game.phase).toBe("GAME_OVER");
    expect(() => validateState(game)).not.toThrow();
  });
});
