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

The Vercel deployment runs the same rules engine behind `/api/*`. Each evaluator's game is saved in that browser and is sent with every command, so serverless cold starts do not erase a round or replace it with someone else's game. Clearing browser data or selecting **New game** starts over. This is an independent public prototype, not real-time shared multiplayer; durable rooms, invite codes, and simultaneous cross-device play still need a persistent database.

Core rules and build decisions are documented in [CHEWS_FREEDOM_ENGLISH_PROJECT_GUIDE.md](./CHEWS_FREEDOM_ENGLISH_PROJECT_GUIDE.md).
