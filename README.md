# Chews Freedom

[Play the public prototype](https://chews-freedom-mvp.vercel.app)

Chews Freedom is an English-language, four-seat cooperative food-card game. Players take turns as **Today's Nutritionist**, **Assistant**, and two **Tyro Friends**, using thoughtful food-card swaps and the Orchard to help everyone reach their protein target.

This is an educational game prototype. It does not provide medical, nutritional, or individual dietary advice.

## Included in this prototype

- A 48-card food deck with protein values
- Enabled event cards and Orchard fruit cards with zero protein
- Clear, guided phases: Today's Nutritionist, Assistant, Tyro Friend mutual aid, then Orchard
- Optional AI-controlled seats and editable player names
- A one-round interactive tutorial and an in-game rulebook
- Round summaries, score tracking, rotating roles, and a public Vercel deployment

## How a round works

1. Today's Nutritionist chooses a Tyro Friend to help with one food-card swap.
2. If needed, the Assistant can help either Tyro Friend with a second swap.
3. If needed, both Tyro Friends may make one mutual-aid swap.
4. If a target is still not met, the Orchard supplies zero-protein fruit cards for additional swaps.

The game presents the active phase, eligible cards, and the next required action throughout play. Event cards remain enabled.

## Run locally

```sh
pnpm install
pnpm dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Verify the project

```sh
pnpm test
pnpm build
python3 reference_simulator.py --self-test
```

## Deployment

The live game is deployed on Vercel at [chews-freedom-mvp.vercel.app](https://chews-freedom-mvp.vercel.app). The deployed app uses the same rules engine through `/api/*`.

Each browser keeps its own game state. Selecting **New Game** or clearing browser data starts a new local game. This prototype is not real-time multiplayer; invite rooms and cross-device shared games would need persistent storage.

## Project references

- [English project guide](./CHEWS_FREEDOM_ENGLISH_PROJECT_GUIDE.md)
- [Launch instructions](./START_HERE.md)
- [Prototype configuration](./config/local-mvp-prototype.json)

## Repository hygiene

Only source code, configuration, and intentionally selected game assets should be committed. Local exports, working reference images, temporary output, and private source material are deliberately kept out of version control unless they are explicitly needed by the project.
