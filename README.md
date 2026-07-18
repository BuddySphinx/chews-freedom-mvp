# Chews Freedom MVP

An English-language, four-seat cooperative food-swap game prototype. Event cards are enabled. This is a game prototype only and does not give medical advice.

## Run locally

```sh
pnpm install
pnpm dev
```

Open `http://127.0.0.1:5173`.

## Quality checks

```sh
pnpm test
pnpm build
python3 reference_simulator.py --self-test
```

## Public Vercel preview

The Vercel deployment runs the same rules engine behind `/api/*` and uses polling rather than Socket.IO. It is intentionally an ephemeral shared demo table: a Vercel serverless cold start can reset the current game. For durable games or concurrent multiplayer, connect the API to a persistent store before a production release.

Core rules and build decisions are documented in [CHEWS_FREEDOM_ENGLISH_PROJECT_GUIDE.md](./CHEWS_FREEDOM_ENGLISH_PROJECT_GUIDE.md).
