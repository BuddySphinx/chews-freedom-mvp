# Start Chews Freedom

This is a local browser prototype. It runs only on your computer and stores the most recent game in the local `data/` folder.

## Fastest start on macOS

1. Double-click `start-local.command`.
2. Keep the Terminal window open while playing.
3. Your browser should open to `http://127.0.0.1:5174`.
4. Choose Human or AI for each of the four seats, then select **Start local game**.

If macOS asks for confirmation the first time, choose **Open**. If the browser does not open by itself, paste `http://127.0.0.1:5174` into your browser.

## What you can play now

- Four fixed seats, using any mix of human and AI controllers. AI nutritionists and assistants take their turns automatically; in a mixed patient pair, the AI chooses its own card after the human patient chooses theirs.
- Public food cards, a two-nutritionist helpful-rescue chain, player-controlled patient swap, a visible click-to-replace zero-value garden phase, scores on every seat, garden end condition, and replayable local state. Each round opens with a Day / Good morning transition, highlights the current decision-maker, and preserves the previous round's outcome summary.
- Ten event cards are enabled. At most one is drawn before a round's deal; it is then removed from that game.
- Event effects are clearly marked as prototype game mechanics. They are not medical guidance and need approved content before a formal release.

## Troubleshooting

- **“Node is required”**: install Node.js 22 or newer, then start again.
- **“pnpm is required”**: run `corepack enable` once in Terminal, then start again.
- **The page does not load**: make sure the Terminal window is still open, then open `http://127.0.0.1:5174` manually.
- **Port already in use**: close the other Chews Freedom Terminal window, wait a few seconds, then start again.

## For developers

```bash
pnpm install
pnpm dev
```

Use `pnpm build` for a production bundle and `pnpm test` for the local rule checks.
