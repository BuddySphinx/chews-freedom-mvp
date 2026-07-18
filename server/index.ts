import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { Server } from "socket.io";
import { command, createGame, LOCAL_RULES_VERSION, publicView, runAiTurns, type Controller, type GameState, validateState } from "./engine.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = path.join(root, "data");
const saveFile = path.join(dataDirectory, "latest-game.json");
const port = Number(process.env.PORT ?? 5174);
let game: GameState | null = null;

async function saveGame(): Promise<void> {
  if (!game) return;
  await mkdir(dataDirectory, { recursive: true });
  const temporary = `${saveFile}.tmp`;
  await writeFile(temporary, JSON.stringify(game, null, 2), "utf8");
  await rename(temporary, saveFile);
}

async function restoreGame(): Promise<void> {
  if (!existsSync(saveFile)) return;
  try {
    const parsed = JSON.parse(await readFile(saveFile, "utf8")) as GameState;
    validateState(parsed);
    parsed.rulesVersion = LOCAL_RULES_VERSION;
    parsed.rescueTarget ??= null;
    game = parsed;
    // Bring saves created before automatic no-action skipping forward as well.
    runAiTurns(game);
    await saveGame();
  } catch {
    // An unreadable local save must not prevent a new prototype game from starting.
    game = null;
  }
}

await restoreGame();

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/Chews_Freedom_Artful_Sample.svg", async (_request, reply) => {
  const asset = await readFile(path.join(root, "Chews_Freedom_Artful_Sample.svg"));
  return reply.type("image/svg+xml").send(asset);
});

const dist = path.join(root, "dist");
if (existsSync(dist)) {
  await app.register(fastifyStatic, { root: dist, prefix: "/" });
}

const io = new Server(app.server, { cors: { origin: true, methods: ["GET", "POST"] } });

function currentView(): GameState {
  if (!game) throw new Error("No local game exists yet. Start one from the setup screen.");
  return publicView(game);
}

async function publish(): Promise<GameState> {
  const view = currentView();
  await saveGame();
  io.emit("game:update", view);
  return view;
}

function create(controllers: Controller[] | undefined, seed: number | undefined): GameState {
  game = createGame(controllers, seed);
  return game;
}

app.get("/api/health", async () => ({ ok: true, gameLoaded: Boolean(game), eventsEnabled: true }));
app.get("/api/game", async () => ({ game: game ? currentView() : null }));
app.post<{ Body: { controllers?: Controller[]; seed?: number } }>("/api/game", async (request, reply) => {
  try {
    create(request.body?.controllers, request.body?.seed);
    return { game: await publish() };
  } catch (error) {
    return reply.status(400).send({ error: error instanceof Error ? error.message : "Could not create the game." });
  }
});
app.post<{ Body: Parameters<typeof command>[1] }>("/api/game/command", async (request, reply) => {
  try {
    if (!game) throw new Error("Start a game first.");
    command(game, request.body);
    return { game: await publish() };
  } catch (error) {
    return reply.status(400).send({ error: error instanceof Error ? error.message : "That action could not be applied." });
  }
});

io.on("connection", (socket) => {
  socket.emit("game:update", game ? currentView() : null);
  socket.on("game:create", async (payload: { controllers?: Controller[]; seed?: number }, acknowledge?: (response: unknown) => void) => {
    try {
      create(payload?.controllers, payload?.seed);
      const view = await publish();
      acknowledge?.({ game: view });
    } catch (error) {
      acknowledge?.({ error: error instanceof Error ? error.message : "Could not create the game." });
    }
  });
  socket.on("game:command", async (payload: Parameters<typeof command>[1], acknowledge?: (response: unknown) => void) => {
    try {
      if (!game) throw new Error("Start a game first.");
      command(game, payload);
      const view = await publish();
      acknowledge?.({ game: view });
    } catch (error) {
      acknowledge?.({ error: error instanceof Error ? error.message : "That action could not be applied." });
    }
  });
});

await app.listen({ host: "127.0.0.1", port });
