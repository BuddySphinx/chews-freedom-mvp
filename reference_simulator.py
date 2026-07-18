#!/usr/bin/env python3
"""Reference rules engine and Monte Carlo simulator for Chews Freedom V2.

This module is intentionally dependency-free. It is the executable reference
for the normative Markdown specification shipped with it.
"""
from __future__ import annotations

import argparse
import json
import math
import random
import statistics
from collections import Counter
from dataclasses import dataclass, asdict
from typing import Iterable, Optional, Sequence

SPEC_VERSION = "2.0-codex-1"
PLAYER_COUNT = 4
HAND_SIZE = 3
PATIENT_THRESHOLD = 10
VEGETABLE_SUPPLY = 10
VEGETABLE_VALUE = 0
DECK_COUNTS = {0: 6, 1: 4, 2: 7, 3: 7, 5: 7, 7: 13, 9: 4}
DECK = tuple(v for v, n in DECK_COUNTS.items() for _ in range(n))

ACTIVE = 0
ASSISTANT = 1
PATIENT_1 = 2
PATIENT_2 = 3
PATIENTS = (PATIENT_1, PATIENT_2)

Hand = tuple[int, int, int]
State = tuple[Hand, Hand, Hand, Hand]
Action = tuple[int, int, int, int]  # actor, target, actor_card_index, target_card_index


@dataclass(frozen=True)
class RoundResult:
    active_score: int
    assistant_score: int
    patient_1_score: int
    patient_2_score: int
    vegetable_tokens_required: int
    active_action: Optional[Action]
    assistant_action: Optional[Action]
    patient_action: Optional[Action]
    initial_state: State
    state_after_patient_phase: State


def normalise_state(hands: Sequence[Sequence[int]]) -> State:
    if len(hands) != 4 or any(len(h) != HAND_SIZE for h in hands):
        raise ValueError("Expected four hands of exactly three cards each")
    return tuple(tuple(int(v) for v in h) for h in hands)  # preserve indices


def hand_total(hand: Sequence[int]) -> int:
    return sum(hand)


def is_compliant(hand: Sequence[int], threshold: int = PATIENT_THRESHOLD) -> bool:
    return hand_total(hand) <= threshold


def excess(hand: Sequence[int], threshold: int = PATIENT_THRESHOLD) -> int:
    return max(0, hand_total(hand) - threshold)


def swap_cards(state: State, actor: int, target: int, actor_index: int, target_index: int) -> State:
    mutable = [list(h) for h in state]
    mutable[actor][actor_index], mutable[target][target_index] = (
        mutable[target][target_index],
        mutable[actor][actor_index],
    )
    return tuple(tuple(h) for h in mutable)  # type: ignore[return-value]


def failing_patients(state: State, threshold: int = PATIENT_THRESHOLD) -> list[int]:
    return [p for p in PATIENTS if not is_compliant(state[p], threshold)]


def strict_priority_target(state: State, threshold: int = PATIENT_THRESHOLD) -> Optional[int]:
    """Return the only eligible rescue target.

    Higher excess is more dangerous. A tie is resolved in favour of PATIENT_1.
    There is deliberately no fallback to the less-dangerous patient.
    """
    failing = failing_patients(state, threshold)
    if not failing:
        return None
    return min(failing, key=lambda p: (-excess(state[p], threshold), p))


def legal_rescue_actions(
    state: State,
    rescuer: int,
    threshold: int = PATIENT_THRESHOLD,
    allowed_targets: Optional[Sequence[int]] = None,
) -> list[tuple[Action, State]]:
    """Return helpful swaps for the local-MVP player-chosen recovery chain.

    Both nutritionists may independently choose either failing patient. A lower
    incoming card is helpful even if it does not finish compliance.
    """
    targets = list(allowed_targets) if allowed_targets is not None else failing_patients(state, threshold)
    actions: list[tuple[Action, State]] = []
    for target in targets:
        if target not in failing_patients(state, threshold):
            continue
        for i in range(HAND_SIZE):
            for j in range(HAND_SIZE):
                new_state = swap_cards(state, rescuer, target, i, j)
                if hand_total(new_state[target]) < hand_total(state[target]):
                    actions.append(((rescuer, target, i, j), new_state))
    return actions


def vegetable_tokens_for_hand(hand: Sequence[int], threshold: int = PATIENT_THRESHOLD) -> int:
    """Minimum virtual 0-value vegetable replacements required for compliance."""
    if is_compliant(hand, threshold):
        return 0
    running = hand_total(hand)
    for count, value in enumerate(sorted(hand, reverse=True), start=1):
        running -= value
        if running <= threshold:
            return count
    return HAND_SIZE


def total_vegetables_required(state: State, threshold: int = PATIENT_THRESHOLD) -> int:
    return sum(vegetable_tokens_for_hand(state[p], threshold) for p in PATIENTS)


def total_patient_excess(state: State, threshold: int = PATIENT_THRESHOLD) -> int:
    return sum(excess(state[p], threshold) for p in PATIENTS)


def patient_phase(state: State, threshold: int = PATIENT_THRESHOLD) -> tuple[int, State, Optional[Action]]:
    """Choose the canonical optional patient-to-patient swap.

    Ranking: higher patient score tier; fewer vegetables needed; lower residual
    excess; no swap preferred when all substantive outcomes are equal; then
    lexicographically smaller card-index action.
    """
    if not failing_patients(state, threshold):
        return 0, state, None

    candidates: list[tuple[tuple, int, State, Optional[Action]]] = []
    base_key = (
        0,
        -total_vegetables_required(state, threshold),
        -total_patient_excess(state, threshold),
        1,  # prefer no-op if substantive outcomes tie
        0,
        0,
    )
    candidates.append((base_key, 0, state, None))

    for i in range(HAND_SIZE):
        for j in range(HAND_SIZE):
            new_state = swap_cards(state, PATIENT_1, PATIENT_2, i, j)
            compliant_count = sum(is_compliant(new_state[p], threshold) for p in PATIENTS)
            score = 2 if compliant_count == 2 else 1 if compliant_count == 1 else 0
            key = (
                score,
                -total_vegetables_required(new_state, threshold),
                -total_patient_excess(new_state, threshold),
                0,
                -i,
                -j,
            )
            candidates.append((key, score, new_state, (PATIENT_1, PATIENT_2, i, j)))

    _, score, chosen_state, action = max(candidates, key=lambda item: item[0])
    return score, chosen_state, action


def assistant_phase(state: State, threshold: int = PATIENT_THRESHOLD) -> tuple[int, State, Optional[Action]]:
    legal = legal_rescue_actions(state, ASSISTANT, threshold)
    if not legal:
        return 0, state, None

    ranked: list[tuple[tuple, Action, State]] = []
    for action, new_state in legal:
        compliant_count = sum(is_compliant(new_state[p], threshold) for p in PATIENTS)
        key = (
            compliant_count,
            -total_patient_excess(new_state, threshold),
            -action[2],
            -action[3],
        )
        ranked.append((key, action, new_state))
    _, action, chosen_state = max(ranked, key=lambda item: item[0])
    return int(is_compliant(chosen_state[action[1]], threshold)), chosen_state, action


def active_phase(state: State, threshold: int = PATIENT_THRESHOLD) -> tuple[int, State, Optional[Action]]:
    legal = legal_rescue_actions(state, ACTIVE, threshold)
    if not legal:
        return 0, state, None

    ranked: list[tuple[tuple, Action, State]] = []
    for action, new_state in legal:
        assistant_score, after_assistant, _ = assistant_phase(new_state, threshold)
        if failing_patients(after_assistant, threshold):
            _, after_patient, _ = patient_phase(after_assistant, threshold)
        else:
            after_patient = after_assistant
        compliant_count = sum(is_compliant(after_assistant[p], threshold) for p in PATIENTS)
        key = (
            compliant_count,
            assistant_score,
            -total_vegetables_required(after_patient, threshold),
            -total_patient_excess(after_assistant, threshold),
            -action[2],
            -action[3],
        )
        ranked.append((key, action, new_state))
    _, action, chosen_state = max(ranked, key=lambda item: item[0])
    return int(is_compliant(chosen_state[action[1]], threshold)), chosen_state, action


def play_round(hands: Sequence[Sequence[int]], threshold: int = PATIENT_THRESHOLD) -> RoundResult:
    initial = normalise_state(hands)
    active_score, state, active_action = active_phase(initial, threshold)
    assistant_score, state, assistant_action = assistant_phase(state, threshold)

    patient_score = 0
    patient_action: Optional[Action] = None
    if failing_patients(state, threshold):
        patient_score, state, patient_action = patient_phase(state, threshold)

    vegetables = total_vegetables_required(state, threshold)
    return RoundResult(
        active_score=active_score,
        assistant_score=assistant_score,
        patient_1_score=patient_score,
        patient_2_score=patient_score,
        vegetable_tokens_required=vegetables,
        active_action=active_action,
        assistant_action=assistant_action,
        patient_action=patient_action,
        initial_state=initial,
        state_after_patient_phase=state,
    )


def confidence_interval_binomial(successes: int, n: int, z: float = 1.96) -> tuple[float, float]:
    p = successes / n
    margin = z * math.sqrt(p * (1.0 - p) / n)
    return max(0.0, p - margin), min(1.0, p + margin)


def simulate_rounds(rounds: int, seed: int) -> dict:
    rng = random.Random(seed)
    counts: Counter = Counter()
    deck = list(DECK)

    for _ in range(rounds):
        rng.shuffle(deck)
        hands = [deck[i * HAND_SIZE : (i + 1) * HAND_SIZE] for i in range(4)]
        initial_pass_count = sum(is_compliant(hands[p]) for p in PATIENTS)
        result = play_round(hands)
        counts["active"] += result.active_score
        counts["assistant"] += result.assistant_score
        counts["patient_points"] += result.patient_1_score
        counts[("patient_score", result.patient_1_score)] += 1
        counts[("vegetables", result.vegetable_tokens_required)] += 1
        counts[("initial_pass_count", initial_pass_count)] += 1
        counts[("nutritionist_pair", result.active_score, result.assistant_score)] += 1
        triggered = int(result.patient_1_score > 0 or result.vegetable_tokens_required > 0)
        counts[("patient_phase_triggered", triggered)] += 1

    active_p = counts["active"] / rounds
    assistant_p = counts["assistant"] / rounds
    p1 = counts[("patient_score", 1)] / rounds
    p2 = counts[("patient_score", 2)] / rounds
    patient_expected = p1 + 2 * p2
    patient_second_moment = p1 + 4 * p2
    patient_se = math.sqrt(max(0.0, patient_second_moment - patient_expected**2) / rounds)

    return {
        "spec_version": SPEC_VERSION,
        "mode": "independent_base_rounds",
        "rounds": rounds,
        "seed": seed,
        "events_enabled": False,
        "active_score_probability": active_p,
        "active_score_probability_95ci": confidence_interval_binomial(counts["active"], rounds),
        "assistant_score_probability": assistant_p,
        "assistant_score_probability_95ci": confidence_interval_binomial(counts["assistant"], rounds),
        "patient_score_probabilities": {
            "0_points": counts[("patient_score", 0)] / rounds,
            "1_point": p1,
            "2_points": p2,
            "any_points": p1 + p2,
        },
        "patient_expected_points_per_patient_round": patient_expected,
        "patient_expected_points_95ci": (
            patient_expected - 1.96 * patient_se,
            patient_expected + 1.96 * patient_se,
        ),
        "expected_points_per_player_per_four_round_role_cycle": active_p + assistant_p + 2 * patient_expected,
        "initial_patient_compliance": {
            "both_compliant": counts[("initial_pass_count", 2)] / rounds,
            "exactly_one_compliant": counts[("initial_pass_count", 1)] / rounds,
            "neither_compliant": counts[("initial_pass_count", 0)] / rounds,
        },
        "patient_phase_trigger_probability": counts[("patient_phase_triggered", 1)] / rounds,
        "expected_vegetable_tokens_per_round": sum(
            k * counts[("vegetables", k)] for k in range(0, 7)
        ) / rounds,
        "vegetable_tokens_distribution": {
            str(k): counts[("vegetables", k)] / rounds for k in range(0, 7)
            if counts[("vegetables", k)]
        },
        "nutritionist_joint_outcomes": {
            f"active_{a}_assistant_{b}": counts[("nutritionist_pair", a, b)] / rounds
            for a in (0, 1) for b in (0, 1)
        },
    }


def simulate_games(games: int, seed: int, vegetable_supply: int = VEGETABLE_SUPPLY) -> dict:
    rng = random.Random(seed)
    lengths: list[int] = []
    total_scores: list[int] = []
    seat_score_sums = [0.0] * 4
    seat_win_shares = [0.0] * 4

    for _ in range(games):
        active_seat = rng.randrange(4)
        vegetables = vegetable_supply
        scores = [0, 0, 0, 0]
        round_number = 0
        deck: list[int] = []
        pointer = len(DECK)

        while True:
            if pointer + 12 > len(DECK):
                deck = list(DECK)
                rng.shuffle(deck)
                pointer = 0
            chunk = deck[pointer : pointer + 12]
            pointer += 12
            relative_hands = [chunk[i * 3 : (i + 1) * 3] for i in range(4)]
            result = play_round(relative_hands)

            assistant_seat = (active_seat + 2) % 4
            patient_1_seat = (active_seat + 1) % 4
            patient_2_seat = (active_seat + 3) % 4
            scores[active_seat] += result.active_score
            scores[assistant_seat] += result.assistant_score
            scores[patient_1_seat] += result.patient_1_score
            scores[patient_2_seat] += result.patient_2_score

            vegetables = max(0, vegetables - result.vegetable_tokens_required)
            round_number += 1
            active_seat = (active_seat + 1) % 4
            if vegetables == 0:
                break

        lengths.append(round_number)
        total_scores.append(sum(scores))
        for seat, score in enumerate(scores):
            seat_score_sums[seat] += score
        top = max(scores)
        winners = [seat for seat, score in enumerate(scores) if score == top]
        for seat in winners:
            seat_win_shares[seat] += 1.0 / len(winners)

    sorted_lengths = sorted(lengths)
    def quantile(q: float) -> float:
        index = (len(sorted_lengths) - 1) * q
        low = math.floor(index)
        high = math.ceil(index)
        if low == high:
            return float(sorted_lengths[low])
        fraction = index - low
        return sorted_lengths[low] * (1 - fraction) + sorted_lengths[high] * fraction

    return {
        "spec_version": SPEC_VERSION,
        "mode": "complete_games",
        "games": games,
        "seed": seed,
        "vegetable_supply": vegetable_supply,
        "starting_active_seat": "uniform_random",
        "mean_rounds": statistics.fmean(lengths),
        "median_rounds": statistics.median(lengths),
        "round_quantiles": {
            "q10": quantile(0.10),
            "q25": quantile(0.25),
            "q75": quantile(0.75),
            "q90": quantile(0.90),
            "q95": quantile(0.95),
        },
        "mean_total_points_per_game": statistics.fmean(total_scores),
        "mean_points_by_fixed_seat": [v / games for v in seat_score_sums],
        "win_share_by_fixed_seat": [v / games for v in seat_win_shares],
    }


def self_test() -> None:
    # Both patients already compliant: no action and no points.
    r = play_round([[0, 3, 7], [1, 5, 7], [0, 3, 7], [1, 2, 5]])
    assert (r.active_score, r.assistant_score, r.patient_1_score, r.vegetable_tokens_required) == (0, 0, 0, 0)

    # Rescuer's own total is irrelevant; target patient becomes compliant.
    r = play_round([[0, 3, 7], [7, 7, 9], [2, 5, 7], [0, 1, 2]])
    assert r.active_score == 1

    # Both nutritionists can choose either failing patient.
    state = normalise_state([[0, 7, 9], [7, 7, 9], [7, 7, 9], [2, 3, 9]])
    assert {action[1] for action, _ in legal_rescue_actions(state, ACTIVE)} == {PATIENT_1, PATIENT_2}
    r = play_round([[0, 7, 9], [7, 7, 9], [7, 7, 9], [2, 3, 9]])
    assert r.active_action is not None and r.assistant_action is not None

    # A partial active rescue is followed by the assistant's second attempt.
    r = play_round([[3, 9, 9], [0, 9, 9], [7, 5, 3], [0, 1, 2]])
    assert r.active_score == 0 and r.assistant_score == 1

    # Patient swap can make both patients compliant and awards 2 each.
    state = normalise_state([[7, 7, 9], [7, 7, 9], [0, 1, 2], [1, 3, 7]])
    score, after, action = patient_phase(state)
    assert score == 2 and all(is_compliant(after[p]) for p in PATIENTS)

    assert vegetable_tokens_for_hand([3, 7, 9]) == 1
    assert vegetable_tokens_for_hand([7, 7, 9]) == 2


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rounds", type=int, default=0, help="simulate independent base rounds")
    parser.add_argument("--games", type=int, default=0, help="simulate complete games")
    parser.add_argument("--seed", type=int, default=20260716)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        self_test()
    outputs = []
    if args.rounds:
        outputs.append(simulate_rounds(args.rounds, args.seed))
    if args.games:
        outputs.append(simulate_games(args.games, args.seed + 1))
    if not outputs and not args.self_test:
        parser.error("Specify --rounds, --games, or --self-test")
    if outputs:
        print(json.dumps(outputs[0] if len(outputs) == 1 else outputs, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
