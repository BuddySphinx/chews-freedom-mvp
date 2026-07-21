import type { EventCard } from "./game-types";

export const EVENT_OCCURRENCE_PERCENT = 72;

// Round modifiers. These live
// in one shared deck so the engine and the Rule Book always describe the same cards.
export const EVENT_DEFINITIONS: EventCard[] = [
  { id: "COLD", name: "Cold Day", shortName: "Cold", summary: "For this round, the protein limit is 1 lower.", kind: "THRESHOLD", amount: -1 },
  { id: "FOLLOW_UP_VISIT", name: "Follow-up Visit", shortName: "Visit", summary: "For this round, the protein limit is 1 lower.", kind: "THRESHOLD", amount: -1 },
  { id: "PARTY_CAKE", name: "Party Cake", shortName: "Party", summary: "For this round, the protein limit is 2 lower.", kind: "THRESHOLD", amount: -2 },
  { id: "SNACK_SHARING", name: "Snack Sharing", shortName: "Snack", summary: "For this round, the protein limit is 1 lower.", kind: "THRESHOLD", amount: -1 },
  { id: "SUPERMARKET_RESTOCK", name: "Supermarket Restock", shortName: "Restock", summary: "Add 1 fruit pick to the shared Orchard.", kind: "GARDEN", amount: 1 },
  { id: "MENU_UPDATE", name: "Menu Update", shortName: "Menu", summary: "For this round, the protein limit is 1 higher.", kind: "THRESHOLD", amount: 1 },
  { id: "STORM", name: "Storm", shortName: "Storm", summary: "Remove 1 fruit pick from the shared Orchard.", kind: "GARDEN", amount: -1 },
  { id: "RAIN", name: "Rain", shortName: "Rain", summary: "Add 1 fruit pick to the shared Orchard.", kind: "GARDEN", amount: 1 },
  { id: "NUTRITIONIST_TRAINING", name: "Today’s Nutritionist Training", shortName: "Training", summary: "For this round, the protein limit is 1 higher.", kind: "THRESHOLD", amount: 1 },
  { id: "TRAVEL_MODE", name: "Travel Mode", summary: "For this round, the protein limit is 2 lower.", shortName: "Travel", kind: "THRESHOLD", amount: -2 }
];
