import type { IncomingMessage, ServerResponse } from "node:http";
import {
  command,
  createGame,
  LOCAL_RULES_VERSION,
  publicView,
  runAiTurns,
  type Controller,
  type GameState,
  validateState
} from "../server/engine.js";

type ApiRequest = IncomingMessage & {
  body?: unknown;
  query?: { path?: string | string[]; route?: string };
};

type CreatePayload = { controllers?: Controller[]; seed?: number };
type CommandPayload = Parameters<typeof command>[1] & { game?: GameState };

// Vercel may reuse an active Node.js function instance. This gives a group of
// preview visitors one shared game without exposing a database credential in a
// prototype. It is deliberately ephemeral: a cold start begins a new table.
declare global {
  // eslint-disable-next-line no-var
  var chewsFreedomPreviewGame: GameState | null | undefined;
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(payload));
}

function routeFor(request: ApiRequest): string {
  if (request.query?.route) return request.query.route;
  const path = request.query?.path;
  if (Array.isArray(path)) return path.join("/");
  if (path) return path;
  return new URL(request.url ?? "/", "http://localhost").pathname.replace(/^\/api\/?/, "");
}

function payloadFor(request: ApiRequest): unknown {
  if (typeof request.body === "string") return JSON.parse(request.body);
  return request.body ?? {};
}

function currentGame(): GameState {
  if (!globalThis.chewsFreedomPreviewGame) throw new Error("No preview game exists yet. Start one from the setup screen.");
  return globalThis.chewsFreedomPreviewGame;
}

function view(): GameState {
  return publicView(currentGame());
}

export default async function handler(request: ApiRequest, response: ServerResponse): Promise<void> {
  try {
    const route = routeFor(request);
    if (request.method === "GET" && route === "health") {
      sendJson(response, 200, { ok: true, gameLoaded: Boolean(globalThis.chewsFreedomPreviewGame), eventsEnabled: true, storage: "ephemeral-preview" });
      return;
    }

    if (route === "game" && request.method === "GET") {
      sendJson(response, 200, { game: globalThis.chewsFreedomPreviewGame ? view() : null });
      return;
    }

    if (route === "game" && request.method === "POST") {
      const body = payloadFor(request) as CreatePayload;
      globalThis.chewsFreedomPreviewGame = createGame(body.controllers, body.seed);
      runAiTurns(globalThis.chewsFreedomPreviewGame);
      sendJson(response, 200, { game: view() });
      return;
    }

    if (route === "game/command" && request.method === "POST") {
      const payload = payloadFor(request) as CommandPayload;
      if (payload.game) {
        validateState(payload.game);
        payload.game.rulesVersion = LOCAL_RULES_VERSION;
        payload.game.rescueTarget ??= null;
        payload.game.lastRoundOutcome ??= null;
        globalThis.chewsFreedomPreviewGame = payload.game;
      }
      const game = currentGame();
      command(game, payload);
      validateState(game);
      sendJson(response, 200, { game: view() });
      return;
    }

    sendJson(response, 404, { error: "API route not found." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The game action could not be applied.";
    sendJson(response, 400, { error: message });
  }
}

export const config = { maxDuration: 10 };
