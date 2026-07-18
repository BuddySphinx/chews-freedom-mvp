CHEWS FREEDOM V2 — CODEX IMPLEMENTATION PACK

Start here:
0. CHEWS_FREEDOM_ENGLISH_PROJECT_GUIDE.md — English game-design and local-MVP execution guide; the recommended reading order for English-speaking reviewers.
0a. START_HERE.md — how to launch the playable local MVP.
0b. config/local-mvp-prototype.json — enabled prototype event-card configuration.
1. Chews_Freedom_V2_Codex_Spec.md — normative machine-facing specification.
2. chews_freedom_v2_config.json — baseline configuration.
3. reference_simulator.py — executable reference and regression simulator.

Human-readable review copy:
- Chews_Freedom_V2_Codex_Spec.docx

Chinese archival sources:
- Chews_Freedom_V2_Codex_Spec.md and Chews_Freedom_V2_Codex_Spec.docx — V2 normative baseline.
- Chews_Freedom_Local_MVP_Engineering_Plan.md — current local-first MVP plan.
- Chews_Freedom_V2_Online_Engineering_Plan.md — deferred online-plan reference.

Reference outputs:
- round_stats.json — 500,000 independent rounds, seed 20260716.
- game_stats.json — 30,000 complete games, seed 20260717.

Run checks:
python reference_simulator.py --self-test
python reference_simulator.py --rounds 500000 --seed 20260716
python reference_simulator.py --games 30000 --seed 20260717

Normative rule version: 2.0-codex-1
Events are disabled in the V2 baseline because event values are not yet finalized.
