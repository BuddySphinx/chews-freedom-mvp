import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { io } from "socket.io-client";
import type { Card, Command, Controller, GameState, Seat } from "./game-types";
import { FOOD_DECK, FOOD_DECK_BY_ID } from "./food-deck";
import { EVENT_DEFINITIONS, EVENT_OCCURRENCE_PERCENT } from "./event-deck";
import samPortrait from "./assets/characters-v2/sam.png";
import mayaPortrait from "./assets/characters-v2/maya.png";
import leoPortrait from "./assets/characters-v2/leo-standing.png";
import zoePortrait from "./assets/characters-v2/zoe-clean.png";
import setupTableScene from "./assets/setup/chews-freedom-table-scene.png";

// Vite runs on 5173 while the local Fastify game service runs on 5174. In a
// Vercel deployment, the serverless API shares the page's origin instead.
const isLocalVite = window.location.hostname === "127.0.0.1" && window.location.port === "5173";
const SERVER_URL = isLocalVite ? "http://127.0.0.1:5174" : window.location.origin;
const supportsSocketUpdates = isLocalVite || window.location.port === "5174";
const usesBrowserGameSave = !supportsSocketUpdates;
const BROWSER_GAME_KEY = "chews-freedom-public-game-v2";
const PLAYER_NAMES_KEY = "chews-freedom-player-names-v1";
const DEFAULT_PLAYER_NAMES = ["Sam", "Maya", "Leo", "Zoe"];
const TUTORIAL_SEED = 1;
const TUTORIAL_CONTROLLERS: Controller[] = ["HUMAN", "HUMAN", "HUMAN", "HUMAN"];
const ART_SPRITE = "/Chews_Freedom_Artful_Sample.svg";
const PLAYER_PORTRAITS = [samPortrait, mayaPortrait, leoPortrait, zoePortrait];
const FOOD_ART = import.meta.glob("./assets/food-cards/*.png", { eager: true, import: "default", query: "?url" }) as Record<string, string>;
const ORCHARD_FRUITS = [
  { name: "Apple", artId: "food-01-apple", visual: "apple" as const },
  { name: "Banana", artId: "food-04-banana", visual: "banana" as const },
  { name: "Orange", artId: "food-05-orange", visual: "orange" as const },
  { name: "Watermelon", artId: "food-03-watermelon", visual: "watermelon" as const }
];
type FoodVisual =
  | "apple" | "cucumber" | "watermelon" | "banana" | "orange" | "broccoli" | "potato" | "corn" | "peas" | "avocado" | "mushroom"
  | "rice" | "bread" | "pasta" | "oats" | "cornflakes" | "beans" | "milk" | "green-beans" | "egg" | "peanut" | "yogurt"
  | "hummus" | "cheese" | "tofu" | "black-beans" | "fish" | "salmon" | "poultry" | "meat" | "almonds" | "fish-fingers"
  | "prawns" | "sardines" | "mussels" | "steak" | "lentils" | "sausage" | "mackerel" | "ham";

type FoodCardDetail = { name: string; tone: string; dish: string; visual: FoodVisual; artId?: string; category?: string; portion?: string };

const FOOD: Record<number, FoodCardDetail> = {
  0: { name: "Herb tea", visual: "green-beans", tone: "leaf", dish: "tea" },
  1: { name: "Rice porridge", visual: "rice", tone: "sun", dish: "porridge" },
  2: { name: "Scrambled tofu", visual: "tofu", tone: "sun", dish: "tofu" },
  3: { name: "Lentil stew", visual: "lentils", tone: "rose", dish: "stew" },
  5: { name: "Bean & quinoa bowl", visual: "beans", tone: "earth", dish: "quinoa" },
  7: { name: "Chickpea curry", visual: "hummus", tone: "sun", dish: "curry" },
  9: { name: "Nutty pasta", visual: "pasta", tone: "rose", dish: "pasta" }
};

const CATEGORY_CARD_DETAILS: Record<string, Omit<FoodCardDetail, "name" | "category" | "portion" | "visual">> = {
  Fruit: { tone: "rose", dish: "porridge" },
  Vegetable: { tone: "leaf", dish: "greens" },
  Grain: { tone: "sun", dish: "porridge" },
  Legume: { tone: "earth", dish: "stew" },
  Dairy: { tone: "sun", dish: "porridge" },
  Protein: { tone: "sun", dish: "tofu" },
  Spread: { tone: "earth", dish: "curry" },
  Dip: { tone: "earth", dish: "curry" },
  Soy: { tone: "sun", dish: "tofu" },
  Fish: { tone: "rose", dish: "pasta" },
  Poultry: { tone: "earth", dish: "stew" },
  Meat: { tone: "rose", dish: "stew" },
  Nuts: { tone: "earth", dish: "quinoa" },
  Seafood: { tone: "rose", dish: "curry" }
};

const FOOD_VISUALS: Record<string, FoodVisual> = {
  "food-01-apple": "apple", "food-02-cucumber": "cucumber", "food-03-watermelon": "watermelon", "food-04-banana": "banana", "food-05-orange": "orange",
  "food-06-broccoli": "broccoli", "food-07-boiled-potato": "potato", "food-08-sweetcorn": "corn", "food-09-green-peas": "peas", "food-10-avocado": "avocado",
  "food-11-button-mushrooms": "mushroom", "food-12-cooked-white-rice": "rice", "food-13-wholemeal-bread": "bread", "food-14-cooked-spaghetti": "pasta", "food-15-rolled-oats": "oats",
  "food-16-cornflakes": "cornflakes", "food-17-canned-baked-beans": "beans", "food-18-whole-milk": "milk", "food-19-cooked-green-beans": "green-beans", "food-20-boiled-egg": "egg",
  "food-21-smooth-peanut-butter": "peanut", "food-22-greek-yogurt": "yogurt", "food-23-hummus": "hummus", "food-24-cooked-kidney-beans": "beans", "food-25-cheddar-cheese": "cheese",
  "food-26-firm-tofu": "tofu", "food-27-cooked-black-beans": "black-beans", "food-28-canned-tuna-in-water": "fish", "food-29-cooked-salmon": "salmon", "food-30-cooked-turkey-breast": "poultry",
  "food-31-cooked-lean-beef-mince": "meat", "food-32-almonds": "almonds", "food-33-fish-fingers": "fish-fingers", "food-34-cooked-cod": "fish", "food-35-cooked-prawns": "prawns",
  "food-36-canned-sardines": "sardines", "food-37-cooked-pork-loin": "meat", "food-38-cooked-mussels": "mussels", "food-39-cooked-chicken-breast": "poultry", "food-40-cooked-haddock": "fish",
  "food-41-cooked-trout": "fish", "food-42-cooked-lamb-leg": "meat", "food-43-cooked-beef-steak": "steak", "food-44-corned-beef": "meat", "food-45-cooked-lentils": "lentils",
  "food-46-pork-sausage": "sausage", "food-47-cooked-mackerel": "mackerel", "food-48-cooked-ham": "ham"
};

const CATEGORY_FALLBACK_VISUALS: Record<string, FoodVisual> = {
  Fruit: "apple", Vegetable: "broccoli", Grain: "rice", Legume: "lentils", Dairy: "yogurt", Protein: "egg", Spread: "peanut", Dip: "hummus", Soy: "tofu", Fish: "fish", Poultry: "poultry", Meat: "meat", Nuts: "almonds", Seafood: "prawns"
};

function foodForCard(card: Card): FoodCardDetail {
  if (card.source === "VEGETABLE_SUPPLY") {
    const fruit = ORCHARD_FRUITS[[...card.id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % ORCHARD_FRUITS.length];
    return { name: `Orchard ${fruit.name}`, visual: fruit.visual, artId: fruit.artId, tone: "rose", dish: "porridge", category: "Fruit" };
  }
  const workbookFood = card.foodId ? FOOD_DECK_BY_ID[card.foodId] : undefined;
  if (workbookFood) return {
    name: workbookFood.name,
    category: workbookFood.category,
    portion: workbookFood.portion,
    artId: workbookFood.id,
    visual: FOOD_VISUALS[workbookFood.id] ?? CATEGORY_FALLBACK_VISUALS[workbookFood.category],
    ...CATEGORY_CARD_DETAILS[workbookFood.category]
  };
  return FOOD[card.value] ?? FOOD[0];
}

function FoodIngredientArt({ visual }: { visual: FoodVisual }) {
  const leaf = <path className="ingredient-leaf" d="M61 30c6-6 12-4 14 0-5 5-10 5-14 0z" />;
  switch (visual) {
    case "apple": return <g className="food-ingredient"><circle className="ingredient-red" cx="42" cy="37" r="15" /><circle className="ingredient-red-dark" cx="53" cy="39" r="12" /><path className="ingredient-stem" d="M47 23c0-6 2-9 6-11" />{leaf}<circle className="ingredient-shine" cx="36" cy="32" r="3" /><path className="ingredient-cut" d="M60 48c8-1 12 5 8 11-5 5-14 2-15-5z" /></g>;
    case "cucumber": return <g className="food-ingredient"><rect className="ingredient-cucumber" x="27" y="29" width="37" height="15" rx="8" transform="rotate(-19 45 36)" /><circle className="ingredient-cucumber-slice" cx="62" cy="48" r="9" /><circle className="ingredient-cucumber-core" cx="62" cy="48" r="4" /><path className="ingredient-seeds" d="M60 45h4M60 49h4M61 52h2" /></g>;
    case "watermelon": return <g className="food-ingredient"><path className="ingredient-rind" d="M23 54 56 21l12 35z" /><path className="ingredient-watermelon" d="M27 52 55 25l10 27z" /><path className="ingredient-seeds" d="M45 40l1 2M54 39l1 2M50 48l1 2M60 47l1 2" /></g>;
    case "banana": return <g className="food-ingredient"><path className="ingredient-banana-shadow" d="M24 29c8 22 29 24 44 7-8 24-36 29-49 1z" /><path className="ingredient-banana" d="M21 25c10 20 30 22 46 5-6 19-32 30-46 4z" /><path className="ingredient-stem" d="M21 25l-3-7M67 30l4-4" /></g>;
    case "orange": return <g className="food-ingredient"><circle className="ingredient-orange" cx="43" cy="40" r="17" /><circle className="ingredient-orange-light" cx="39" cy="35" r="5" /><path className="ingredient-orange-segments" d="M43 24v32M27 40h32M31 28l23 23M54 28 31 51" />{leaf}</g>;
    case "broccoli": return <g className="food-ingredient"><path className="ingredient-broccoli-stem" d="M37 39h15l4 20H34z" /><circle className="ingredient-broccoli" cx="33" cy="34" r="10" /><circle className="ingredient-broccoli" cx="45" cy="27" r="12" /><circle className="ingredient-broccoli-dark" cx="56" cy="35" r="11" /><path className="ingredient-vein" d="M43 42l-2 13M49 41l3 14" /></g>;
    case "potato": return <g className="food-ingredient"><ellipse className="ingredient-potato" cx="43" cy="42" rx="21" ry="14" transform="rotate(-15 43 42)" /><path className="ingredient-potato-cut" d="M57 28c11 4 13 15 7 23-6-4-10-11-7-23z" /><path className="ingredient-speckles" d="M31 39h1M37 49h1M47 35h1M52 47h1" /></g>;
    case "corn": return <g className="food-ingredient"><path className="ingredient-corn-husk" d="M26 28c-7 13-3 28 16 33-5-12-6-21-16-33zM59 27c7 13 3 28-16 34 5-13 7-22 16-34z" /><rect className="ingredient-corn" x="34" y="19" width="20" height="41" rx="10" /><path className="ingredient-corn-lines" d="M39 24v31M44 21v37M49 22v35M36 30h16M35 38h18M36 47h16" /></g>;
    case "peas": return <g className="food-ingredient"><path className="ingredient-pea-pod" d="M22 44c9-17 30-19 45-7-8 14-30 20-45 7z" /><circle className="ingredient-pea" cx="33" cy="42" r="4" /><circle className="ingredient-pea" cx="42" cy="40" r="4" /><circle className="ingredient-pea" cx="51" cy="40" r="4" /><circle className="ingredient-pea" cx="59" cy="38" r="3.4" /></g>;
    case "avocado": return <g className="food-ingredient"><path className="ingredient-avocado" d="M36 20c15-4 28 12 23 27-4 13-17 19-27 12-13-10-9-34 4-39z" /><path className="ingredient-avocado-flesh" d="M39 25c10-3 19 9 16 20-3 10-13 14-20 8-10-8-6-25 4-28z" /><circle className="ingredient-pit" cx="46" cy="43" r="8" /><path className="ingredient-avocado-slice" d="M63 27c8 3 9 12 4 18-6-2-10-10-4-18z" /></g>;
    case "mushroom": return <g className="food-ingredient"><path className="ingredient-mushroom-stem" d="M31 42h12l2 16H28z" /><path className="ingredient-mushroom-cap" d="M22 42c1-15 30-20 37-1-12 4-25 4-37 1z" /><path className="ingredient-mushroom-stem" d="M53 42h8l2 12h-12z" /><path className="ingredient-mushroom-cap-light" d="M48 41c2-10 19-12 23 0-7 3-16 3-23 0z" /></g>;
    case "rice": return <g className="food-ingredient"><path className="ingredient-rice-bowl" d="M24 43h40c-2 14-10 20-20 20S27 57 24 43z" /><ellipse className="ingredient-rice" cx="44" cy="43" rx="20" ry="8" /><path className="ingredient-rice-grains" d="M31 39l3 1M38 36l3 2M46 38l3 1M54 36l3 2M58 42l3 1M34 45l3 1M43 47l3 1M51 45l3 2" /></g>;
    case "bread": return <g className="food-ingredient"><path className="ingredient-bread-crust" d="M22 32c1-12 10-18 22-15 12-4 22 5 22 16v23H22z" /><path className="ingredient-bread" d="M26 34c2-9 10-13 18-10 10-3 17 4 18 12v16H26z" /><path className="ingredient-bread-lines" d="M33 31c4 1 7 4 9 8M45 27c5 2 8 5 10 9M30 47h28" /></g>;
    case "pasta": return <g className="food-ingredient"><path className="ingredient-pasta" d="M24 35c10-12 23 9 37-4M22 41c9-12 25 10 43-4M24 48c11-11 24 10 39-3M29 54c8-8 20 7 31-2" /><circle className="ingredient-tomato" cx="29" cy="28" r="4" />{leaf}</g>;
    case "oats": return <g className="food-ingredient"><path className="ingredient-rice-bowl" d="M24 43h40c-2 14-10 20-20 20S27 57 24 43z" /><ellipse className="ingredient-oats" cx="44" cy="42" rx="20" ry="8" /><path className="ingredient-oat-flakes" d="M31 40l3-2M37 38l3-2M43 40l3-2M50 38l3-2M56 42l3-2M35 45l3-2M48 46l3-2" /></g>;
    case "cornflakes": return <g className="food-ingredient"><path className="ingredient-rice-bowl" d="M24 44h40c-2 13-10 19-20 19S27 57 24 44z" /><path className="ingredient-flakes" d="M29 38l7-5 5 5-5 6zM42 32l8 3-1 8-8-2zM54 38l7-3 4 6-6 6zM35 47l7-3 4 6-7 4zM49 47l8-2 3 7-7 4z" /></g>;
    case "beans": return <g className="food-ingredient"><path className="ingredient-rice-bowl" d="M24 45h40c-2 12-10 18-20 18S27 57 24 45z" /><ellipse className="ingredient-sauce" cx="44" cy="44" rx="20" ry="8" /><path className="ingredient-beans" d="M30 40c4-5 9 0 6 4-3 5-9 2-6-4zM41 36c4-5 9 0 6 4-3 5-9 2-6-4zM53 39c4-5 9 0 6 4-3 5-9 2-6-4zM36 48c4-5 9 0 6 4-3 5-9 2-6-4zM49 48c4-5 9 0 6 4-3 5-9 2-6-4z" /></g>;
    case "milk": return <g className="food-ingredient"><path className="ingredient-milk-glass" d="M29 22h29l-3 38H32z" /><path className="ingredient-milk" d="M31 34h25l-2 24H33z" /><path className="ingredient-milk-glass-line" d="M29 22h29M31 34h25" /><circle className="ingredient-shine" cx="37" cy="29" r="2" /></g>;
    case "green-beans": return <g className="food-ingredient"><path className="ingredient-green-bean" d="M23 33c12 2 23 7 38 0M25 42c10 3 22 7 39 1M29 51c8 1 18 5 30-1" /><path className="ingredient-green-bean-dark" d="M24 36c12 1 24 6 38-1M27 47c10 2 22 5 35 0" />{leaf}</g>;
    case "egg": return <g className="food-ingredient"><path className="ingredient-egg-white" d="M25 43c-3-9 6-16 13-14 4-7 14-5 16 1 8-2 14 7 9 14 2 9-6 14-14 11-7 6-17 3-18-4-8 0-10-4-6-8z" /><circle className="ingredient-yolk" cx="45" cy="42" r="8" /><circle className="ingredient-yolk-light" cx="42" cy="39" r="2.5" /></g>;
    case "peanut": return <g className="food-ingredient"><path className="ingredient-jar" d="M28 26h31l-3 31H31z" /><path className="ingredient-jar-lid" d="M27 22h33v7H27z" /><path className="ingredient-peanut-spread" d="M32 35c7-7 19-5 22 3-3 8-17 9-22 2 3-3 10-3 15-1" /><path className="ingredient-peanut" d="M25 48c-8-4-3-13 3-12 4-6 13-1 12 6-1 7-9 10-15 6z" /></g>;
    case "yogurt": return <g className="food-ingredient"><path className="ingredient-yogurt-cup" d="M28 29h30l-3 31H31z" /><ellipse className="ingredient-yogurt" cx="43" cy="30" rx="15" ry="5" /><path className="ingredient-yogurt-swirl" d="M34 31c3-6 14-4 17 0-4 4-10-1-14 2" /><circle className="ingredient-berry" cx="49" cy="23" r="4" /><circle className="ingredient-berry" cx="55" cy="27" r="3" /></g>;
    case "hummus": return <g className="food-ingredient"><path className="ingredient-rice-bowl" d="M23 45h42c-3 12-11 18-21 18S26 57 23 45z" /><ellipse className="ingredient-hummus" cx="44" cy="44" rx="21" ry="9" /><path className="ingredient-hummus-swirl" d="M31 44c4-9 18-9 24-2 3 4-1 8-6 7-4-1-4-6 1-7" /><circle className="ingredient-chickpea" cx="59" cy="39" r="4" />{leaf}</g>;
    case "cheese": return <g className="food-ingredient"><path className="ingredient-cheese" d="M24 55 60 25l8 30z" /><circle className="ingredient-cheese-hole" cx="52" cy="42" r="4" /><circle className="ingredient-cheese-hole" cx="58" cy="49" r="2.5" /><circle className="ingredient-cheese-hole" cx="42" cy="51" r="3" /></g>;
    case "tofu": return <g className="food-ingredient"><path className="ingredient-tofu" d="M26 35l16-8 14 8-15 10z" /><path className="ingredient-tofu-side" d="M26 35l15 10v14L26 49zM41 45l15-10v14L41 59z" /><path className="ingredient-tofu" d="M47 28l13 7-12 8-13-7z" /><path className="ingredient-tofu-specks" d="M34 40h2M49 35h2M34 50h2M49 48h2" />{leaf}</g>;
    case "black-beans": return <g className="food-ingredient"><path className="ingredient-rice-bowl" d="M24 45h40c-2 12-10 18-20 18S27 57 24 45z" /><ellipse className="ingredient-black-bean-bed" cx="44" cy="44" rx="20" ry="8" /><path className="ingredient-black-beans" d="M30 40h5v5h-5zM39 37h5v5h-5zM49 39h5v5h-5zM57 40h5v5h-5zM34 48h5v5h-5zM45 48h5v5h-5zM54 48h5v5h-5z" /></g>;
    case "fish": return <g className="food-ingredient"><path className="ingredient-fish" d="M25 41c8-15 26-17 36-4l9-8v25l-10-8c-11 11-27 7-35-5z" /><circle className="ingredient-fish-eye" cx="34" cy="38" r="2" /><path className="ingredient-fish-lines" d="M41 35c5 3 9 7 12 12M45 31c7 4 11 9 13 15" /></g>;
    case "salmon": return <g className="food-ingredient"><path className="ingredient-salmon" d="M24 51c5-20 26-30 43-20-3 19-23 30-43 20z" /><path className="ingredient-salmon-lines" d="M31 47c8-5 15-9 28-11M34 53c8-5 16-9 27-11M35 40c8-5 15-8 25-9" />{leaf}</g>;
    case "poultry": return <g className="food-ingredient"><path className="ingredient-poultry" d="M24 48c3-17 18-25 33-18 11 5 8 20-2 25-12 6-25 2-31-7z" /><path className="ingredient-poultry-light" d="M31 43c5-8 14-11 22-8M33 50c6 2 14 1 21-4" /><path className="ingredient-herb" d="M58 27l7 8M61 29l4-3" /></g>;
    case "meat": return <g className="food-ingredient"><path className="ingredient-meat" d="M24 45c4-14 18-23 32-16 13 6 10 23-2 28-13 6-27 1-30-12z" /><path className="ingredient-meat-marble" d="M31 43c6-7 13-8 20-4M33 51c7 4 14 2 20-4" /><circle className="ingredient-herb-dot" cx="59" cy="31" r="2" /><circle className="ingredient-herb-dot" cx="63" cy="35" r="2" /></g>;
    case "almonds": return <g className="food-ingredient"><path className="ingredient-almond" d="M28 49c-7-11 2-20 8-25 8 8 7 18-1 26zM42 53c-7-11 2-20 8-25 8 8 7 18-1 26zM55 49c-6-9 1-17 6-21 7 7 6 16-1 23z" /><path className="ingredient-almond-line" d="M33 32l-2 13M47 36l-2 13M59 35l-1 11" /></g>;
    case "fish-fingers": return <g className="food-ingredient"><rect className="ingredient-fish-finger" x="24" y="37" width="36" height="10" rx="5" transform="rotate(-12 42 42)" /><rect className="ingredient-fish-finger" x="31" y="47" width="34" height="10" rx="5" transform="rotate(10 48 52)" /><path className="ingredient-crumbs" d="M32 39h2M40 37h2M49 40h2M40 51h2M51 53h2" /></g>;
    case "prawns": return <g className="food-ingredient"><path className="ingredient-prawn" d="M29 32c17-12 33 8 20 24-8 9-21 4-20-6 0-7 9-8 12-4" /><path className="ingredient-prawn" d="M45 27c16-8 27 10 14 22-8 7-18 0-15-8 2-6 8-7 11-3" /><path className="ingredient-prawn-lines" d="M33 35l12 10M47 30l11 10" /></g>;
    case "sardines": return <g className="food-ingredient"><path className="ingredient-tin" d="M24 32h42v26H24z" /><ellipse className="ingredient-tin-rim" cx="45" cy="32" rx="21" ry="5" /><path className="ingredient-sardine" d="M29 42c6-7 14-7 20-2l7-4v12l-7-4c-7 5-15 4-20-2z" /><path className="ingredient-sardine" d="M39 50c5-6 12-5 18-1l6-3v10l-6-3c-6 4-13 3-18-3z" /></g>;
    case "mussels": return <g className="food-ingredient"><path className="ingredient-mussel-shell" d="M24 48c4-17 21-22 29-7-4 13-18 17-29 7z" /><path className="ingredient-mussel-flesh" d="M30 45c5-7 13-7 18-2-5 7-12 8-18 2z" /><path className="ingredient-mussel-shell" d="M47 52c3-14 18-18 25-5-3 11-16 15-25 5z" /><path className="ingredient-mussel-flesh" d="M52 50c4-5 11-5 15-1-4 5-10 6-15 1z" /></g>;
    case "steak": return <g className="food-ingredient"><path className="ingredient-steak" d="M26 46c0-17 17-27 31-19 16 9 10 28-4 32-12 4-27-1-27-13z" /><path className="ingredient-steak-grill" d="M34 36l17 13M31 44l16 12M45 32l12 10" /><circle className="ingredient-herb-dot" cx="61" cy="28" r="2" /><circle className="ingredient-herb-dot" cx="65" cy="32" r="2" /></g>;
    case "lentils": return <g className="food-ingredient"><path className="ingredient-rice-bowl" d="M24 45h40c-2 12-10 18-20 18S27 57 24 45z" /><ellipse className="ingredient-lentil-bed" cx="44" cy="44" rx="20" ry="8" /><path className="ingredient-lentils" d="M30 40h4v4h-4zM38 38h4v4h-4zM46 40h4v4h-4zM54 39h4v4h-4zM34 48h4v4h-4zM42 48h4v4h-4zM50 48h4v4h-4z" />{leaf}</g>;
    case "sausage": return <g className="food-ingredient"><path className="ingredient-sausage" d="M26 35c10-9 26 4 18 15-8 10-22 4-18-15z" /><path className="ingredient-sausage" d="M45 29c11-8 25 7 16 18-8 9-21 2-16-18z" /><path className="ingredient-sausage-shine" d="M31 37c4-3 8 1 8 4M50 32c4-2 8 2 8 5" /></g>;
    case "mackerel": return <g className="food-ingredient"><path className="ingredient-mackerel" d="M23 44c7-18 27-23 39-8l9-7v25l-10-7c-11 10-30 8-38-3z" /><path className="ingredient-mackerel-stripe" d="M39 30l6 18M47 28l6 20M55 30l5 17" /><circle className="ingredient-fish-eye" cx="32" cy="39" r="2" /></g>;
    case "ham": return <g className="food-ingredient"><path className="ingredient-ham" d="M27 33c11-10 26-3 28 9 2 13-11 22-24 15-12-6-13-16-4-24z" /><path className="ingredient-ham-fat" d="M32 37c8-6 16-1 17 6M34 48c6 5 14 2 17-4" /><path className="ingredient-ham" d="M54 31c8-4 15 4 11 11-4 7-13 5-13-2 0-3 1-6 2-9z" /></g>;
  }
}

function FoodDish({ food }: { food: FoodCardDetail }) {
  const isTea = food.dish === "tea";
  const generatedArt = food.artId ? FOOD_ART[`./assets/food-cards/${food.artId}.png`] : undefined;
  if (generatedArt) return <img className="food-dish-image" src={generatedArt} alt="" aria-hidden="true" />;
  return (
    <svg className={`food-dish food-dish-${food.dish}`} aria-hidden="true" viewBox="0 0 88 72">
      <ellipse className="dish-shadow" cx="44" cy="61" rx="32" ry="5" />
      {isTea ? (
        <>
          <path className="tea-steam" d="M31 11c-6 7 5 8-1 16M43 7c-6 7 5 8-1 16M55 12c-5 6 5 8 0 15" />
          <path className="tea-cup" d="M22 30h42v22c0 8-7 12-21 12s-21-4-21-12z" />
          <path className="tea-handle" d="M64 36c15-2 15 18 1 18" />
          <ellipse className="tea-surface" cx="43" cy="31" rx="21" ry="6" />
          <path className="tea-leaves" d="M35 30c-4-5-8-5-10-1 4 4 7 4 10 1M52 31c4-5 8-4 10 0-4 4-7 4-10 0" />
        </>
      ) : (
        <>
          <ellipse className="dish-plate-rim" cx="44" cy="54" rx="33" ry="12" />
          <path className="dish-bowl" d="M16 43c3 17 11 23 28 23s25-6 28-23c-14 5-42 5-56 0z" />
          <ellipse className="dish-food" cx="44" cy="43" rx="28" ry="10" />
          <path className="dish-plate-detail" d="M18 54c16 7 37 7 52 0" />
          <FoodIngredientArt visual={food.visual} />
        </>
      )}
    </svg>
  );
}

function FoodCardFace({ card }: { card: Card }) {
  const food = foodForCard(card);
  return (
    <>
      <span className="food-card-header" aria-hidden="true"><span>{food.category ?? "Food card"}</span><span className="food-value" title={`Protein level ${card.value}`}>{card.value}</span></span>
      <span className="food-illustration" aria-hidden="true">
        <FoodDish food={food} />
      </span>
      <span className="food-name">{food.name}</span>
      <span className="food-card-caption" aria-hidden="true">{food.portion ?? "freshly drawn"}</span>
    </>
  );
}

function LegacyPlayerCharacter({ seat }: { seat: Seat }) {
  const faces = <g className="character-face-details">
    <path className="character-brow" d="M34.5 36.7c2.5-2 5.2-2.2 7.6-.4M53.6 36.3c2.4-1.9 5.2-1.7 7.6.4" />
    <ellipse className="character-eye-sclera" cx="39" cy="45" rx="6.1" ry="7.55" />
    <ellipse className="character-eye-sclera" cx="57" cy="45" rx="6.1" ry="7.55" />
    <ellipse className="character-eye" cx="39" cy="45.4" rx="4.55" ry="6.35" />
    <ellipse className="character-eye" cx="57" cy="45.4" rx="4.55" ry="6.35" />
    <ellipse className="character-pupil" cx="39" cy="46.7" rx="2.35" ry="3.85" />
    <ellipse className="character-pupil" cx="57" cy="46.7" rx="2.35" ry="3.85" />
    <ellipse className="character-eye-shine" cx="37.25" cy="42.65" rx="1.85" ry="2.25" />
    <ellipse className="character-eye-shine" cx="55.25" cy="42.65" rx="1.85" ry="2.25" />
    <circle className="character-eye-spark" cx="41.1" cy="49.5" r=".95" />
    <circle className="character-eye-spark" cx="59.1" cy="49.5" r=".95" />
    <ellipse className="character-cheek" cx="29.8" cy="54" rx="5.4" ry="2.8" />
    <ellipse className="character-cheek" cx="66.2" cy="54" rx="5.4" ry="2.8" />
    <path className="character-cheek-stroke character-detail" d="M26.5 54l3.5 1.4M65.5 55.4l3.5-1.4" />
    <path className="character-nose" d="M48 49.5l-1 4 2.3.3" />
    <path className="character-smile" d="M43 57c3.1 3.5 7.8 3.5 10.8 0" />
    <path className="character-mouth-light character-detail" d="M45.5 58.6c1.8 1.2 3.8 1.2 5.6 0" />
  </g>;

  const figures = [
    <>
      <g className="character-legs-body"><path className="character-trouser" d="M31 93l-5 23h14l5-18 4 18h14l-6-24z" /><path className="character-shoe" d="M22 114h20c2 3-1 6-6 6H22z" /><path className="character-shoe" d="M49 114h19c2 3-1 6-6 6H48z" /></g>
      <g className="character-clothing"><path className="character-coat" d="M27 76c7-6 30-6 38 0l5 29H22z" /><path className="character-coat-dark" d="M43 76l5 12 5-12 7 7-12 13-12-13z" /><path className="character-sleeve" d="M27 78c-8 4-10 12-7 19l8 3 7-16z" /><path className="character-sleeve" d="M64 78c8 4 10 12 7 19l-8 3-7-16z" /><circle className="character-button character-detail" cx="49" cy="94" r="1.2" /><circle className="character-button character-detail" cx="49" cy="100" r="1.2" /></g>
      <g className="character-head"><ellipse className="character-ear" cx="25" cy="46" rx="4.2" ry="5.7" /><ellipse className="character-ear" cx="71" cy="46" rx="4.2" ry="5.7" /><path className="character-head-shape" d="M25 38c0-16 10-25 23-25s23 9 23 25c0 17-9 30-23 30S25 55 25 38z" /></g>
      <g className="character-hair"><path className="character-hair-fill" d="M23 39c-5-17 3-29 15-29l3-6 5 5 7-5 3 6c14 1 21 13 16 29-4-8-10-13-18-16-3 5-9 8-15 9-3 4-10 7-17 7z" /><path className="character-hair-fill" d="M28 26c-7-3-5-12 2-11 2-8 11-10 14-3 6-6 14-3 14 4 8-2 11 8 5 12-11-6-25-6-35-2z" /></g>
      {faces}
      <g className="character-prop"><path className="character-hand" d="M60 82c4-3 7 0 5 4l-4 5-4-3z" /><path className="character-clipboard" d="M61 73l14 4-6 23-14-4z" /><path className="character-paper" d="M62 77l9 3-4 14-9-3z" /><path className="character-clip character-detail" d="M65 75c1-4 5-3 5 0" /><path className="character-pencil character-detail" d="M60 91l12 4" /></g>
      <g className="character-accessory"><path className="character-token-leaf" d="M24 111c-8-4-9-11-7-16 7 1 12 6 10 14" /><path className="character-token-leaf" d="M66 111c8-4 9-11 7-16-7 1-12 6-10 14" /><path className="character-token-vein character-detail" d="M18 99l7 9M72 99l-7 9" /></g>
    </>,
    <>
      <g className="character-legs-body"><path className="character-trouser" d="M31 94l-4 21h13l5-16 5 16h13l-5-22z" /><path className="character-shoe" d="M23 113h19c2 3-1 6-6 6H23z" /><path className="character-shoe" d="M50 113h19c2 3-1 6-6 6H49z" /></g>
      <g className="character-clothing"><path className="character-coat" d="M26 75c7-5 31-5 39 1l5 29H22z" /><path className="character-rain-flap" d="M31 78l17 10 17-9-2 24H33z" /><path className="character-sleeve" d="M27 78c-9 4-10 14-7 20l9 2 6-15z" /><path className="character-sleeve" d="M65 78c7 4 9 13 6 19l-8 3-6-15z" /><circle className="character-button character-detail" cx="48" cy="93" r="1.2" /><circle className="character-button character-detail" cx="48" cy="100" r="1.2" /></g>
      <g className="character-head"><ellipse className="character-ear" cx="25" cy="46" rx="4.2" ry="5.7" /><ellipse className="character-ear" cx="71" cy="46" rx="4.2" ry="5.7" /><path className="character-head-shape" d="M25 38c0-16 10-25 23-25s23 9 23 25c0 17-9 30-23 30S25 55 25 38z" /></g>
      <g className="character-hair"><path className="character-hair-fill" d="M21 48c-5-19 5-36 25-36 18 0 29 13 26 36l-7-8V27c-8-8-23-8-33 0v20z" /><path className="character-hair-fill" d="M23 26c-6 3-7 15 1 20l7-4V25z" /><path className="character-hair-fill" d="M73 28c6 5 4 15-2 19l-6-5V29z" /></g>
      {faces}
      <g className="character-prop"><path className="character-hand" d="M28 82c4-2 6 1 4 5l-4 5-5-3z" /><path className="character-basket" d="M10 87c5-5 17-4 21 1l-2 14H13z" /><path className="character-basket-weave character-detail" d="M12 91l17 4M13 97l15 3M18 85c1-6 8-7 10 1" /><circle className="character-fruit character-detail" cx="17" cy="89" r="2" /><circle className="character-fruit character-detail" cx="23" cy="90" r="2" /></g>
      <g className="character-accessory"><path className="character-bow" d="M33 16c-6-8-12-2-7 4-7 4-1 11 5 7l3-5 4 5c7 4 10-4 3-7 5-8-4-11-8-4z" /><circle className="character-bow-centre" cx="34" cy="21" r="2.2" /></g>
    </>,
    <>
      <g className="character-wheelchair"><circle className="character-wheel" cx="35" cy="101" r="18" /><circle className="character-wheel-inner" cx="35" cy="101" r="11" /><path className="character-wheel-spoke character-detail" d="M35 84v34M18 101h34M23 89l24 24M47 89l-24 24" /><path className="character-chair-frame" d="M45 74v26h17M45 91H31l-7 17M62 100l4 12h8" /><path className="character-chair-seat" d="M39 79h24l-3 15H40z" /></g>
      <g className="character-legs-body"><path className="character-trouser" d="M38 88l23 2 8 13-13 5-7-9-12 1z" /><path className="character-shoe" d="M60 103l14-4c4 2 3 6-1 7l-12 4z" /></g>
      <g className="character-clothing"><path className="character-coat" d="M26 75c8-6 30-6 38 1l2 21H29z" /><path className="character-coat-dark" d="M43 76l5 12 5-12 7 7-12 12-12-12z" /><path className="character-sleeve" d="M28 78c-8 4-9 14-5 20l10-2 4-14z" /><path className="character-sleeve" d="M64 79c7 4 8 12 5 18l-9-1-4-14z" /></g>
      <g className="character-head"><ellipse className="character-ear" cx="25" cy="46" rx="4.2" ry="5.7" /><ellipse className="character-ear" cx="71" cy="46" rx="4.2" ry="5.7" /><path className="character-head-shape" d="M25 38c0-16 10-25 23-25s23 9 23 25c0 17-9 30-23 30S25 55 25 38z" /></g>
      <g className="character-hair"><path className="character-hair-fill" d="M23 39c-4-14 3-28 17-29 2-7 13-8 16-1 12-1 20 12 16 30-4-8-10-13-18-16-8 6-16 8-31 16z" /><circle className="character-hair-fill" cx="27" cy="20" r="7" /><circle className="character-hair-fill" cx="39" cy="13" r="8" /><circle className="character-hair-fill" cx="52" cy="14" r="8" /><circle className="character-hair-fill" cx="64" cy="21" r="7" /></g>
      {faces}
      <g className="character-prop"><path className="character-hand" d="M61 84c4-3 6 0 4 4l-4 4-4-3z" /><path className="character-book" d="M61 78l14 4-4 15-14-4z" /><path className="character-book-page character-detail" d="M64 82l7 2M63 87l7 2" /></g>
      <g className="character-accessory"><path className="character-token-spark character-detail" d="M73 64l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" /></g>
    </>,
    <>
      <g className="character-legs-body"><path className="character-skirt" d="M29 91h36l6 18H24z" /><path className="character-leg" d="M34 107v10M58 107v10" /><path className="character-shoe" d="M27 115h15c2 3-1 5-6 5H27z" /><path className="character-shoe" d="M54 115h15c2 3-1 5-6 5H54z" /></g>
      <g className="character-clothing"><path className="character-coat" d="M27 76c7-6 30-6 38 1l3 22H27z" /><path className="character-sleeve" d="M28 78c-7 4-10 12-7 19l9 3 6-15z" /><path className="character-sleeve" d="M64 78c7 4 9 13 6 19l-8 3-6-15z" /><path className="character-collar" d="M40 77l8 10 8-10 5 5-13 11-13-11z" /></g>
      <g className="character-head"><ellipse className="character-ear" cx="25" cy="46" rx="4.2" ry="5.7" /><ellipse className="character-ear" cx="71" cy="46" rx="4.2" ry="5.7" /><path className="character-head-shape" d="M25 38c0-16 10-25 23-25s23 9 23 25c0 17-9 30-23 30S25 55 25 38z" /></g>
      <g className="character-hair"><path className="character-hair-fill" d="M22 48c-5-20 6-36 26-36 19 0 30 16 26 36l-8-9V28c-8-8-23-8-35 0v18z" /><path className="character-hair-fill" d="M65 27c15 1 18 16 9 27l-8-2c5-9 4-16-1-25z" /></g>
      {faces}
      <g className="character-prop"><path className="character-hand" d="M63 88c4-3 6 1 4 4l-4 5-5-3z" /><path className="character-cat" d="M69 94c7-6 17-1 16 9 5 6 1 14-7 14H64c-8 0-10-10-4-15l-1-8 5 3z" /><path className="character-cat-ear" d="M62 98l1-8 6 6M76 96l6-5-1 9" /><circle className="character-cat-eye" cx="68" cy="104" r="1.3" /><circle className="character-cat-eye" cx="77" cy="104" r="1.3" /><path className="character-cat-face" d="M71 109l2 1 2-1M70 111l-3 1M76 111l3 1" /><path className="character-cat-stripe character-detail" d="M63 108l4 1M78 108l3-1" /></g>
      <g className="character-accessory"><path className="character-ribbon" d="M27 18c-7-7-12 2-5 7-8 5 0 12 6 6l4-6-5-7z" /><path className="character-ribbon" d="M68 18c7-7 12 2 5 7 8 5 0 12-6 6l-4-6 5-7z" /><circle className="character-ribbon-centre" cx="28" cy="24" r="2" /><circle className="character-ribbon-centre" cx="68" cy="24" r="2" /></g>
    </>
  ][seat];

  return (
    <svg className={`portrait-token character-${seat}`} viewBox="0 0 96 132" aria-hidden="true" focusable="false">
      <g className="character-shadow"><ellipse cx="48" cy="122" rx="35" ry="6.5" /></g>
      <g className="character-token"><ellipse className="character-token-base" cx="48" cy="113" rx="34" ry="12" /><ellipse className="character-token-rim" cx="48" cy="110" rx="30" ry="9" /><path className="character-token-glow character-detail" d="M28 109c11-5 27-6 39-1" /></g>
      {figures}
    </svg>
  );
}

function PlayerCharacter({ seat, isTodaysNutritionist = false }: { seat: Seat; isTodaysNutritionist?: boolean }) {
  return (
    <span className={`portrait-token illustrated-character character-${seat} ${isTodaysNutritionist ? "is-todays-nutritionist" : ""}`} aria-hidden="true">
      <img src={PLAYER_PORTRAITS[seat]} alt="" />
      {isTodaysNutritionist && <span className="nutritionist-uniform" aria-hidden="true"><i /><b>✦</b></span>}
    </span>
  );
}

function roleFor(game: GameState, seat: number): string {
  if (game.currentRoles.active === seat) return "Today's Nutritionist";
  if (game.currentRoles.assistant === seat) return "Assistant";
  if (game.currentRoles.patient1 === seat) return "Tyro Friend 1";
  return "Tyro Friend 2";
}

function nameFor(names: string[], seat: number): string {
  return names[seat]?.trim() || DEFAULT_PLAYER_NAMES[seat] || `Player ${seat + 1}`;
}

function currentActor(game: GameState): Seat | null {
  if (game.phase === "ACTIVE_RESCUE") return game.currentRoles.active;
  if (game.phase === "ASSISTANT_RESCUE") return game.currentRoles.assistant;
  return null;
}

function strictTarget(game: GameState): Seat | null {
  const first = game.currentRoles.patient1;
  const second = game.currentRoles.patient2;
  const total = (seat: Seat) => game.hands[seat].reduce((sum, card) => sum + card.value, 0);
  const excess = (seat: Seat) => Math.max(0, total(seat) - game.threshold);
  const failing = [first, second].filter((seat) => total(seat) > game.threshold);
  if (!failing.length) return null;
  if (failing.length === 1) return failing[0];
  return excess(first) >= excess(second) ? first : second;
}

function total(hand: Card[]): number { return hand.reduce((sum, card) => sum + card.value, 0); }

// Presentation-only mirror of the server's legal-rescue check. It keeps the
// cards grouped with their player while revealing only actions that can work.
function hasHelpfulRescueForCard(game: GameState, actor: Seat | null, actorIndex: number): boolean {
  if (actor === null || (game.phase !== "ACTIVE_RESCUE" && game.phase !== "ASSISTANT_RESCUE")) return false;
  const actorCard = game.hands[actor][actorIndex];
  if (!actorCard) return false;
  return [game.currentRoles.patient1, game.currentRoles.patient2].some((patient) =>
    total(game.hands[patient]) > game.threshold
    && game.hands[patient].some((patientCard) => actorCard.value < patientCard.value)
  );
}

function hasHelpfulRescue(game: GameState, actor: Seat | null): boolean {
  return actor !== null && game.hands[actor].some((_, index) => hasHelpfulRescueForCard(game, actor, index));
}

function aiDecisionIsDue(game: GameState): boolean {
  const actor = currentActor(game);
  if (actor !== null) return game.controllers[actor] === "AI";
  return game.phase === "PATIENT_SWAP"
    && game.controllers[game.currentRoles.patient1] === "AI"
    && game.controllers[game.currentRoles.patient2] === "AI";
}

function turnCue(game: GameState, seat: Seat): { label: string; current: boolean } | null {
  const actor = currentActor(game);
  if (actor === seat) return { label: game.controllers[seat] === "AI" ? "AI is moving" : "Make a move", current: true };
  if (game.phase === "PATIENT_SWAP" && (seat === game.currentRoles.patient1 || seat === game.currentRoles.patient2)) {
    return game.controllers[seat] === "AI"
      ? { label: "AI chooses with partner", current: false }
      : { label: "Choose a card", current: true };
  }
  if (game.phase === "VEGETABLE_RESOLUTION" && strictTarget(game) === seat) return { label: "Choose an Orchard card", current: true };
  return null;
}

function currentStep(game: GameState): number {
  if (game.phase === "ACTIVE_RESCUE") return 0;
  if (game.phase === "ASSISTANT_RESCUE") return 1;
  if (game.phase === "PATIENT_SWAP") return 2;
  if (game.phase === "VEGETABLE_RESOLUTION") return 3;
  return 4;
}

function TurnFlow({ game, names, compact = false }: { game: GameState; names: string[]; compact?: boolean }) {
  const step = currentStep(game);
  const items = [
    { label: `Today's Nutritionist · ${nameFor(names, game.currentRoles.active)}`, note: "rescue" },
    { label: `Assistant · ${nameFor(names, game.currentRoles.assistant)}`, note: "only if needed" },
    { label: `Tyro Friends · ${nameFor(names, game.currentRoles.patient1)} + ${nameFor(names, game.currentRoles.patient2)}`, note: "one shared swap" },
    { label: "Orchard", note: "only if needed" }
  ];
  return (
    <nav className={`turn-flow ${compact ? "is-compact" : ""}`} aria-label="Round turn order">
      {items.map((item, index) => {
        const status = index < step ? "complete" : index === step ? "current" : "upcoming";
        return <div className={`flow-step ${status}`} key={item.label}><span>{index + 1}</span><div><strong>{item.label}</strong><small>{status === "current" ? "Now" : status === "complete" ? "Done" : item.note}</small></div></div>;
      })}
    </nav>
  );
}

function RoundWheel({ game, names }: { game: GameState; names: string[] }) {
  const outcome = game.lastRoundOutcome?.round === game.round - 1 ? game.lastRoundOutcome : null;
  const day = ((game.round - 1) % 12) + 1;
  const players = [game.currentRoles.active, game.currentRoles.assistant, game.currentRoles.patient1, game.currentRoles.patient2];

  return (
    <section className="round-wheel-face" aria-live="polite" aria-label={`Day ${game.round} event and date wheel`}>
      <div className="wheel-wood-banner"><span>Garden calendar</span></div>
      <div className="wheel-layout">
        <div className="round-wheel" style={{ "--active-day": day } as CSSProperties}>
          <div className="wheel-rim" aria-hidden="true" />
          {Array.from({ length: 12 }, (_, index) => {
            const tileDay = index + 1;
            const angle = index * 30;
            return (
              <span
                className={`wheel-day-tile ${tileDay === day ? "is-today" : ""}`}
                key={tileDay}
                style={{ "--wheel-angle": `${angle}deg`, "--wheel-counter-angle": `${-angle}deg` } as CSSProperties}
              >
                <span>{tileDay}</span>
                <i aria-hidden="true" />
              </span>
            );
          })}
          <div className="wheel-garden-scene" aria-hidden="true">
            <span className="wheel-cloud wheel-cloud-one" />
            <span className="wheel-cloud wheel-cloud-two" />
            <span className="wheel-hill wheel-hill-back" />
            <span className="wheel-hill wheel-hill-front" />
            <span className="wheel-cottage"><i /><b /><em /></span>
            <span className="wheel-flower wheel-flower-one" />
            <span className="wheel-flower wheel-flower-two" />
            <span className="wheel-flower wheel-flower-three" />
          </div>
          <div className="wheel-day-plaque"><span>Day</span><strong>{day}</strong><small>of 12</small></div>
          {players.map((seat, index) => {
            const markerDay = ((day - 1 + index * 3) % 12) + 1;
            const angle = (markerDay - 1) * 30 - 90;
            return (
              <div
                className="wheel-player-marker"
                key={seat}
                style={{ "--wheel-angle": `${angle}deg`, "--wheel-counter-angle": `${-angle}deg`, "--marker-delay": `${index * 85}ms` } as CSSProperties}
              >
                <PlayerCharacter seat={seat} isTodaysNutritionist={seat === game.currentRoles.active} />
                <span>{nameFor(names, seat)}</span>
              </div>
            );
          })}
        </div>
        <aside className="wheel-event-card" aria-label="Current event">
          <span className="wheel-event-label">Event drawn</span>
          <div className="wheel-event-crest" aria-hidden="true"><i /><i /><i /></div>
          <strong>{game.currentEvent?.shortName ?? "Clear"}</strong>
          <h2>{game.currentEvent?.name ?? "Clear day"}</h2>
          <p>{game.currentEvent?.summary ?? "The standard rules apply this round."}</p>
          <small>{game.threshold} protein limit · {game.eventPool.length} event cards remain</small>
        </aside>
      </div>
      <div className="wheel-story-strip">
        {outcome && <span className={`wheel-outcome ${outcome.kind.toLowerCase()}`}>Yesterday · {outcome.title}</span>}
        <h2>Round {game.round}: {nameFor(names, game.currentRoles.active)} is now Today's Nutritionist.</h2>
        <p>{outcome ? outcome.detail : `${nameFor(names, game.currentRoles.active)} leads the first rescue after the board turns.`}</p>
        <small>Players move around the calendar, then the board turns to the food table.</small>
      </div>
    </section>
  );
}

function GardenField({ tokens }: { tokens: number }) {
  return (
    <div className={`garden-field ${tokens === 0 ? "is-empty" : ""}`} role="img" aria-label={tokens === 0 ? "The Orchard is empty" : `${tokens} zero-protein fruit picks are available in the Orchard`}>
      {Array.from({ length: tokens }, (_, index) => {
        const fruit = ORCHARD_FRUITS[index % ORCHARD_FRUITS.length];
        return <span className="garden-crop" aria-hidden="true" key={`orchard-fruit-${index}`}><img className="orchard-fruit" src={FOOD_ART[`./assets/food-cards/${fruit.artId}.png`]} alt="" /></span>;
      })}
    </div>
  );
}

async function responsePayload(response: Response): Promise<{ game?: GameState | null; error?: string }> {
  const body = await response.text();
  try {
    return JSON.parse(body) as { game?: GameState | null; error?: string };
  } catch {
    throw new Error(response.ok
      ? "The game service sent an invalid response. Please reload and try again."
      : `The game service returned ${response.status}. Please reload and try again.`);
  }
}

function savedBrowserGame(): GameState | null {
  if (!usesBrowserGameSave) return null;
  try {
    const raw = window.localStorage.getItem(BROWSER_GAME_KEY);
    return raw ? JSON.parse(raw) as GameState : null;
  } catch {
    window.localStorage.removeItem(BROWSER_GAME_KEY);
    return null;
  }
}

function saveBrowserGame(game: GameState): void {
  if (usesBrowserGameSave) window.localStorage.setItem(BROWSER_GAME_KEY, JSON.stringify(game));
}

function savedPlayerNames(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(PLAYER_NAMES_KEY) ?? "null");
    if (Array.isArray(stored) && stored.length === 4 && stored.every((name) => typeof name === "string")) return stored;
  } catch {
    // Default names keep the setup screen immediately playable.
  }
  return [...DEFAULT_PLAYER_NAMES];
}

function savePlayerNames(names: string[]): void {
  window.localStorage.setItem(PLAYER_NAMES_KEY, JSON.stringify(names.map((name, index) => name.trim() || DEFAULT_PLAYER_NAMES[index])));
}

interface SeatPanelProps {
  game: GameState;
  names: string[];
  seat: Seat;
  selectedActorCard: number | null;
  selectedPatientCards: [number | null, number | null];
  onSelect: (seat: Seat, index: number) => void;
}

function SeatPanel({ game, names, seat, selectedActorCard, selectedPatientCards, onSelect }: SeatPanelProps) {
  const actor = currentActor(game);
  const target = game.phase === "VEGETABLE_RESOLUTION" ? strictTarget(game) : null;
  const isPatient = seat === game.currentRoles.patient1 || seat === game.currentRoles.patient2;
  const roleClass = isPatient ? "role-patient" : "role-care-team";
  const boardRole = seat === game.currentRoles.active
    ? "board-active"
    : seat === game.currentRoles.assistant
      ? "board-assistant"
      : seat === game.currentRoles.patient1
        ? "board-patient-one"
        : "board-patient-two";
  const isTarget = target === seat;
  const cue = turnCue(game, seat);
  const rescuePhase = game.phase === "ACTIVE_RESCUE" || game.phase === "ASSISTANT_RESCUE";
  const rescueActorIsHuman = rescuePhase && seat === actor && game.controllers[seat] === "HUMAN";
  const patientSwapChoice = game.phase === "PATIENT_SWAP" && isPatient && game.controllers[seat] === "HUMAN";
  const patientPosition = seat === game.currentRoles.patient1 ? 0 : 1;
  const chosenPatientCard = selectedPatientCards[patientPosition];
  const cardIsSelected = (index: number) => (seat === actor && selectedActorCard === index) || (game.phase === "PATIENT_SWAP" && isPatient && chosenPatientCard === index);
  const handTotal = total(game.hands[seat]);
  const withinLimit = !isPatient || handTotal <= game.threshold;
  const highestTargetValue = isTarget ? Math.max(...game.hands[seat].map((card) => card.value)) : -1;
  const tutorialTarget = seat === game.currentRoles.active
    ? "nutritionist-seat"
    : seat === game.currentRoles.assistant
      ? "assistant-seat"
      : seat === game.currentRoles.patient1
        ? "friend-one-seat"
        : "friend-two-seat";

  return (
    <article data-tutorial-target={tutorialTarget} className={`seat-panel seat-${seat} ${boardRole} ${roleClass} ${isTarget ? "is-target" : ""} ${seat === actor ? "is-actor" : ""} ${cue?.current ? "is-turn" : ""}`}>
      <div className="seat-heading">
        <div className="seat-identity">
          <PlayerCharacter seat={seat} isTodaysNutritionist={seat === game.currentRoles.active} />
          <div>
            <p className="seat-number">Seat {seat + 1}</p>
            <h3>{nameFor(names, seat)}</h3>
            <span className="role-label">{roleFor(game, seat)}</span>
            {cue && <span className={`turn-cue ${cue.current ? "current" : ""}`}>{cue.label}</span>}
          </div>
        </div>
        <div className={`control-badge ${game.controllers[seat] === "AI" ? "ai" : "human"}`}>{game.controllers[seat] === "AI" ? "AI" : "Human"}</div>
      </div>
      <div className="hand" aria-label={`${nameFor(names, seat)}'s public food cards`}>
        {game.hands[seat].map((card, index) => {
          const vegetableChoice = game.phase === "VEGETABLE_RESOLUTION" && isTarget && card.value > 0 && card.value === highestTargetValue && game.gardenTokens > 0;
          const helpfulActorCard = rescueActorIsHuman && hasHelpfulRescueForCard(game, actor, index);
          const activeRescueChoice = game.phase === "ACTIVE_RESCUE" && isPatient && !withinLimit && selectedActorCard !== null && actor !== null && game.hands[actor][selectedActorCard].value < card.value;
          const assistantRescueChoice = game.phase === "ASSISTANT_RESCUE" && isPatient && !withinLimit && selectedActorCard !== null && actor !== null && game.hands[actor][selectedActorCard].value < card.value;
          const targetChoice = activeRescueChoice || assistantRescueChoice;
          const cardInteractive = game.phase === "PATIENT_SWAP"
            ? patientSwapChoice
            : game.phase === "VEGETABLE_RESOLUTION"
              ? vegetableChoice
              : helpfulActorCard || targetChoice;
          const actionLabel = vegetableChoice ? "Pick" : helpfulActorCard ? "Pick" : targetChoice ? "Swap" : patientSwapChoice ? "Pick" : null;
          return (
            <button
              key={card.id}
              type="button"
              className={`food-card ${foodForCard(card).tone} ${cardIsSelected(index) ? "selected" : ""} ${vegetableChoice ? "garden-choice" : ""} ${helpfulActorCard ? "actor-choice" : ""} ${targetChoice ? "target-choice" : ""} ${cardInteractive ? "clickable" : ""}`}
              onClick={() => { if (cardInteractive) onSelect(seat, index); }}
              disabled={!cardInteractive}
              aria-pressed={cardIsSelected(index)}
              aria-label={`${nameFor(names, seat)}: ${foodForCard(card).name}, protein level ${card.value}${actionLabel ? `. ${actionLabel}` : ""}${vegetableChoice ? ". Click to replace this card with a zero-protein Orchard fruit" : ""}${card.source === "VEGETABLE_SUPPLY" ? ", Orchard fruit replacement" : ""}`}
            >
              <FoodCardFace card={card} />
              {actionLabel && <span className="card-action-mark" aria-hidden="true">{actionLabel}</span>}
            </button>
          );
        })}
      </div>
      {isPatient && <div className={`patient-total ${withinLimit ? "safe" : "risk"}`}><span>Protein total</span><strong>{handTotal} / {game.threshold}</strong><small>{withinLimit ? "Within protein limit" : "Over protein limit"}</small></div>}
      <div className="seat-score"><span>Rescue points</span><strong>{game.scores[seat].totalPoints}</strong><small>Today's Nutritionist {game.scores[seat].nutritionistPoints} · Tyro Friend swap {game.scores[seat].patientMutualAidPoints}</small></div>
    </article>
  );
}

function Setup({ controllers, setControllers, names, openNameDialog, openTutorial, loading }: { controllers: Controller[]; setControllers: (items: Controller[]) => void; names: string[]; openNameDialog: () => void; openTutorial: () => void; loading: boolean }) {
  return (
    <main className="setup-shell">
      <section className="setup-copy">
        <p className="kicker">Chews Freedom</p>
        <h1>Help each other make the best food swap.</h1>
        <p className="intro">A local four-seat cooperative game. Event cards are enabled as configurable game-play mechanics.</p>
        <div className="setup-actions"><button className="primary-button" type="button" onClick={openNameDialog} disabled={loading}>{loading ? "Starting game..." : "Name players & start"}</button><button className="secondary-button" type="button" onClick={openTutorial}>Play the tutorial</button></div>
      </section>
      <section className="setup-art" aria-label="Hand-painted Chews Freedom game table"><img src={setupTableScene} alt="Four children play Chews Freedom around a hand-painted wooden table covered in detailed food cards and fresh ingredients" /></section>
      <section className="setup-seats" aria-labelledby="seat-setup-title">
        <div><h2 id="seat-setup-title">Choose who controls each seat</h2><p>Human seats are played on this computer. AI seats use the cooperative rule policy.</p></div>
        <div className="controller-grid">
          {controllers.map((controller, index) => <label className="controller-choice" key={`${nameFor(names, index)}-${index}`}><span><strong>{nameFor(names, index)}</strong><small>Seat {index + 1}</small></span><select value={controller} onChange={(event) => { const next = [...controllers]; next[index] = event.target.value as Controller; setControllers(next); }}><option value="HUMAN">Human</option><option value="AI">AI</option></select></label>)}
        </div>
        <p className="tiny-note">All food cards stay visible. AI seats play automatically when their role is called; during a mixed Tyro Friend swap, the AI chooses its own card after the human Tyro Friend chooses theirs.</p>
      </section>
    </main>
  );
}

function PlayerNameDialog({ names, setNames, onStart, onClose, loading }: { names: string[]; setNames: (names: string[]) => void; onStart: () => void; onClose: () => void; loading: boolean }) {
  return <div className="game-dialog-overlay" role="presentation">
    <section className="game-dialog name-dialog" role="dialog" aria-modal="true" aria-labelledby="player-names-title">
      <p className="dialog-kicker">Before the first round</p>
      <h2 id="player-names-title">Name your players</h2>
      <p>Each player is shown as their real name plus today’s rotating role.</p>
      <div className="name-input-grid">
        {names.map((name, index) => <label key={index}><span>Seat {index + 1}</span><input value={name} maxLength={18} onChange={(event) => { const next = [...names]; next[index] = event.target.value; setNames(next); }} placeholder={DEFAULT_PLAYER_NAMES[index]} autoFocus={index === 0} /></label>)}
      </div>
      <div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>Back</button><button className="primary-button" type="button" onClick={onStart} disabled={loading}>{loading ? "Starting game..." : "Start the game"}</button></div>
    </section>
  </div>;
}

type TutorialStep = "round" | "event" | "nutritionist-card" | "nutritionist-target" | "assistant-card" | "assistant-target" | "friends-first" | "friends-second" | "friends-confirm" | "orchard-intro" | "orchard-pick" | "complete";

function TutorialStartDialog({ onClose, onStart, loading }: { onClose: () => void; onStart: () => void; loading: boolean }) {
  return <div className="game-dialog-overlay" role="presentation">
    <section className="game-dialog tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <p className="dialog-kicker">Tutorial level</p>
      <h2 id="tutorial-title">Play one guided round</h2>
      <p>This prepared round pauses at every part of the board. The rest of the table dims while the next card, panel, or button is highlighted.</p>
      <div className="tutorial-steps"><h3>You will try every option</h3><p>See an event, make both support swaps, choose one Tyro Friend card from each hand, then use zero-protein Orchard fruit when the Orchard is triggered.</p></div>
      <div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>Back</button><button className="primary-button" type="button" onClick={onStart} disabled={loading}>{loading ? "Preparing round..." : "Start guided round"}</button></div>
    </section>
  </div>;
}

function tutorialTargetFor(step: TutorialStep, game: GameState): string {
  if (step === "round") return "round-wheel";
  if (step === "event") return "event-card";
  if (step === "nutritionist-card" || step === "nutritionist-target") return step === "nutritionist-card" ? "nutritionist-seat" : "friend-one-seat";
  if (step === "assistant-card" || step === "assistant-target") return step === "assistant-card" ? "assistant-seat" : "friend-two-seat";
  if (step === "friends-first") return "friend-one-seat";
  if (step === "friends-second") return "friend-two-seat";
  if (step === "friends-confirm") return "confirm-swap";
  if (step === "orchard-intro") return "orchard";
  if (step === "orchard-pick") {
    return strictTarget(game) === game.currentRoles.patient1 ? "friend-one-seat" : "friend-two-seat";
  }
  return "prompt-bar";
}

function TutorialSpotlight({ target }: { target: string }) {
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const element = document.querySelector<HTMLElement>(`[data-tutorial-target="${target}"]`);
    if (!element) { setBox(null); return; }

    // A tutorial spotlight is an instruction for the current stop, not a
    // live cursor. Freeze its position until the tutorial changes steps so
    // swapping a card never makes the highlight appear to travel with it.
    const rect = element.getBoundingClientRect();
    setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }, [target]);

  const style = box ? {
    top: `${Math.max(8, box.top - 8)}px`,
    left: `${Math.max(8, box.left - 8)}px`,
    width: `${box.width + 16}px`,
    height: `${box.height + 16}px`
  } : undefined;
  return <div className="tutorial-spotlight-layer" aria-hidden="true">{box && <span className="tutorial-spotlight-hole" style={style} />}</div>;
}

function TutorialCoach({ step, game, names, onAdvance, onContinue, onExit }: { step: TutorialStep; game: GameState; names: string[]; onAdvance: () => void; onContinue: () => void; onExit: () => void }) {
  const nutritionist = nameFor(names, game.currentRoles.active);
  const assistant = nameFor(names, game.currentRoles.assistant);
  const firstFriend = nameFor(names, game.currentRoles.patient1);
  const secondFriend = nameFor(names, game.currentRoles.patient2);
  const copy: Record<TutorialStep, { title: string; body: string; action?: string }> = {
    round: { title: "A round begins on the calendar", body: `This tutorial uses one prepared round so every stage appears. Day ${game.round} shows who leads first and when the food table will turn over.`, action: "See today’s event" },
    event: { title: `${game.currentEvent?.name ?? "Clear day"} is this round’s event`, body: game.currentEvent ? `${game.currentEvent.summary} Events can change the protein limit or the Orchard. Read this card before deciding how many swaps may be needed.` : "A clear day keeps the usual protein limit and Orchard supply.", action: "Begin the first rescue" },
    "nutritionist-card": { title: `${nutritionist} leads as Today’s Nutritionist`, body: `Start by choosing Kidney Beans, worth 5 protein, from ${nutritionist}’s hand. Only the glowing card can move first.` },
    "nutritionist-target": { title: `Give help to ${firstFriend}`, body: `Now choose ${firstFriend}’s Almonds, worth 7 protein. This trade lowers ${firstFriend}’s total and shows how a rescue swap works.` },
    "assistant-card": { title: `${assistant} gets one independent rescue`, body: `${firstFriend} is safe, but ${secondFriend} still needs help. Choose Mussels, worth 9 protein, from ${assistant}’s hand.` },
    "assistant-target": { title: `Help ${secondFriend} next`, body: `Choose ${secondFriend}’s Lamb Leg, worth 11 protein. The Assistant may choose either Tyro Friend who needs help, not just the first one.` },
    "friends-first": { title: "Tyro Friends now have one shared swap", body: `${firstFriend}, choose your Kidney Beans card. Each Tyro Friend selects one card to trade away before either card moves.` },
    "friends-second": { title: `${secondFriend}, choose your card`, body: `Choose Mussels from ${secondFriend}’s hand. The two selections stay visible so everyone can confirm what will be traded.` },
    "friends-confirm": { title: "Confirm the Tyro Friend swap", body: "Both cards are selected. Use the highlighted confirmation button to make the one shared swap. This panel appears only when the support swaps have not solved the round." },
    "orchard-intro": { title: "The Orchard is now triggered", body: "The Orchard opens only when a Tyro Friend still needs help after the available swaps. Its fruit is always worth zero protein, and it can be used again whenever this phase is triggered.", action: "Show the card to replace" },
    "orchard-pick": { title: "Pick fruit for the highlighted card", body: `Choose the highlighted highest-protein card on ${nameFor(names, strictTarget(game) ?? game.currentRoles.patient2)}. Each pick replaces one food card with zero-protein Orchard fruit. Continue while the Orchard is active.` },
    complete: { title: "This guided round is complete", body: "You have seen the full recovery path: event, Nutritionist, Assistant, Tyro Friend mutual aid, and Orchard fruit. In a normal round, later steps are skipped whenever everyone is already within the protein limit." }
  };
  const current = copy[step];
  const waitingForAction = !current.action && step !== "complete";
  return <section className="tutorial-coach" role="status" aria-live="polite" data-tutorial-allowed>
    <p className="tutorial-coach-kicker">Guided round</p>
    <h2>{current.title}</h2>
    <p>{current.body}</p>
    {waitingForAction && <small>Use the highlighted part of the board to continue.</small>}
    <div className="tutorial-coach-actions">
      {current.action && <button className="primary-button" type="button" onClick={onAdvance} data-tutorial-allowed>{current.action}</button>}
      {step === "complete" && <button className="primary-button" type="button" onClick={onContinue} data-tutorial-allowed>Continue this game</button>}
      <button className="secondary-button" type="button" onClick={onExit} data-tutorial-allowed>{step === "complete" ? "Back to setup" : "Leave tutorial"}</button>
    </div>
  </section>;
}

function MutualAidDialog({ game, names, onReady }: { game: GameState; names: string[]; onReady: () => void }) {
  const first = nameFor(names, game.currentRoles.patient1);
  const second = nameFor(names, game.currentRoles.patient2);
  return <div className="game-dialog-overlay mutual-aid-overlay" role="presentation">
    <section className="game-dialog mutual-aid-dialog" role="dialog" aria-modal="true" aria-labelledby="mutual-aid-title">
      <p className="dialog-kicker">Tyro Friend swap</p>
      <h2 id="mutual-aid-title">One shared chance to help</h2>
      <p>{first} and {second}, please try swapping food once to lower protein intake. Please select the cards you each want to trade away.</p>
      <button className="primary-button" type="button" onClick={onReady}>Ready to choose cards</button>
    </section>
  </div>;
}

function RulebookButton({ onOpen, triggerRef }: { onOpen: () => void; triggerRef: RefObject<HTMLButtonElement | null> }) {
  return (
    <section className="rulebook-launcher" aria-labelledby="rulebook-launcher-title">
      <p>Need a reminder?</p>
      <button ref={triggerRef} className="rulebook-button" type="button" onClick={onOpen} aria-haspopup="dialog" aria-controls="chews-rulebook">
        <span className="ancient-book-icon" aria-hidden="true">
          <span className="ancient-book-pages" />
          <span className="ancient-book-cover"><span>RULE</span><strong>BOOK</strong><i /><b /></span>
          <span className="ancient-book-bookmark" />
        </span>
        <span className="rulebook-button-copy">
          <strong id="rulebook-launcher-title">Open the rulebook</strong>
          <small>Rules, events, and all 48 food cards</small>
        </span>
      </button>
    </section>
  );
}

function RulebookFoodPage({ foods, pageNumber }: { foods: typeof FOOD_DECK; pageNumber: number }) {
  const start = (pageNumber - 3) * 24 + 1;
  const end = start + foods.length - 1;
  return (
    <section className={`rulebook-page rulebook-deck-page ${pageNumber === 3 ? "rulebook-deck-left-page" : "rulebook-deck-right-page"}`}>
      <header className="deck-page-heading"><div><span>Food deck</span><h3>Cards {start}-{end}</h3></div><p>Each badge is that card’s protein level for its listed child portion.</p></header>
      <ol className="food-index" aria-label={`Food cards ${start} through ${end} and their protein levels`}>
        {foods.map((food) => {
          const art = FOOD_ART[`./assets/food-cards/${food.id}.png`];
          return (
            <li className="food-index-card" key={food.id}>
              <span className="food-index-art" aria-hidden="true">{art ? <img src={art} alt="" /> : null}</span>
              <span className="food-index-copy"><strong>{food.name}</strong><small>{food.category} - {food.portion}</small></span>
              <span className="food-index-value" aria-label={`${food.score} protein level`}><b>{food.score}</b><small>protein</small></span>
            </li>
          );
        })}
      </ol>
      <p className="rulebook-page-number">Page {pageNumber}</p>
    </section>
  );
}

function Rulebook({ onClose, closeRef }: { onClose: () => void; closeRef: RefObject<HTMLButtonElement | null> }) {
  const [spread, setSpread] = useState<0 | 1>(0);
  const [turnDirection, setTurnDirection] = useState<"forward" | "back" | null>(null);
  const firstPage = spread * 2 + 1;
  const turnPage = (direction: "forward" | "back") => {
    setTurnDirection(direction);
    setSpread(direction === "forward" ? 1 : 0);
  };
  return (
    <div className="rulebook-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section id="chews-rulebook" className="rulebook-dialog" role="dialog" aria-modal="true" aria-labelledby="rulebook-title" aria-describedby={spread === 0 ? "rulebook-description" : undefined}>
        <header className="rulebook-titlebar">
          <div><span>The Chews Freedom Rulebook</span><h2 id="rulebook-title">The Rulebook of Swaps</h2></div>
          <div className="rulebook-title-actions">
            <nav className="rulebook-page-navigation" aria-label="Rule Book pages">
              <button className="rulebook-page-turn" type="button" onClick={() => turnPage("back")} disabled={spread === 0} aria-label="Turn to the previous pages">Previous</button>
              <span aria-live="polite">Pages {firstPage}-{firstPage + 1} of 4</span>
              <button className="rulebook-page-turn" type="button" onClick={() => turnPage("forward")} disabled={spread === 1} aria-label="Turn to the next pages">Next</button>
            </nav>
            <button ref={closeRef} className="rulebook-close" type="button" onClick={onClose}>Close book</button>
          </div>
        </header>
        <div key={spread} className={`rulebook-spread ${turnDirection ? `is-turning-${turnDirection}` : ""}`}>
          <div className="rulebook-binding" aria-hidden="true"><i /><i /><i /></div>
          {spread === 0 ? <>
            <section className="rulebook-page rulebook-rules-page">
              <p id="rulebook-description" className="rulebook-intro">Keep every Tyro Friend at or below this round’s protein limit. Food-card numbers are protein levels, used for swaps and Tyro Friend totals.</p>
              <h3>How a round works</h3>
              <ol className="rulebook-steps">
                <li><span>1</span><p><strong>Event and deal.</strong> A day can reveal one event before everyone receives three food cards. An event can change this round’s limit or the Orchard.</p></li>
                <li><span>2</span><p><strong>Today’s Nutritionist rescue.</strong> Today’s Nutritionist may choose either Tyro Friend over the protein limit and swap in a lower-protein card for one of that Tyro Friend’s higher-protein cards.</p></li>
                <li><span>3</span><p><strong>Assistant rescue.</strong> If anyone is still over the protein limit, the Assistant gets one rescue attempt and may choose the same Tyro Friend or the other Tyro Friend.</p></li>
                <li><span>4</span><p><strong>Tyro Friend swap.</strong> If needed, the two Tyro Friends may each choose one card for one shared swap, or they can pass.</p></li>
                <li><span>5</span><p><strong>Orchard.</strong> If a Tyro Friend is still over, replace the highlighted highest-protein card with a zero-protein Orchard fruit. Continue until everyone is within the limit or the Orchard is empty.</p></li>
              </ol>
              <section className="rulebook-score-note">
                <h3>Points</h3>
                <p>Today’s Nutritionist earns 1 point when their own swap brings the chosen Tyro Friend within the limit. After a Tyro Friend swap, both Tyro Friends earn 2 points each if both are within the limit, 1 point each if only one is within it, or 0 otherwise. Orchard fruit gives no points.</p>
              </section>
              <section className="rulebook-end-note">
                <h3>How the game ends</h3>
                <p>The game ends if the Orchard runs out, or if a Tyro Friend is still over the protein limit after every Today’s Nutritionist rescue, Assistant rescue, Tyro Friend swap, and Orchard fruit replacement has been tried.</p>
              </section>
              <p className="rulebook-page-number">Page 1</p>
            </section>
            <section className="rulebook-page rulebook-events-page">
              <p className="rulebook-intro">At the start of a round there is a {EVENT_OCCURRENCE_PERCENT}% chance to draw one event. Drawn events are removed from the event deck; a clear day keeps the usual protein limit of 10.</p>
              <h3>The event deck</h3>
              <ol className="event-index" aria-label="All event cards and their effects">
                {EVENT_DEFINITIONS.map((event) => {
                  const effect = event.kind === "THRESHOLD" ? `${event.amount > 0 ? "+" : ""}${event.amount} protein limit` : `${event.amount > 0 ? "+" : ""}${event.amount} Orchard fruit`;
                  return <li className={`event-index-card ${event.kind.toLowerCase()}`} key={event.id}>
                    <span className="event-index-mark" aria-hidden="true"><i /></span>
                    <span className="event-index-copy"><strong>{event.name}</strong><small>{event.summary}</small></span>
                    <span className="event-index-effect">{effect}</span>
                  </li>;
                })}
              </ol>
              <p className="rulebook-page-number">Page 2</p>
            </section>
          </> : <>
            <RulebookFoodPage foods={FOOD_DECK.slice(0, 24)} pageNumber={3} />
            <RulebookFoodPage foods={FOOD_DECK.slice(24)} pageNumber={4} />
          </>}
        </div>
      </section>
    </div>
  );
}

type ActionSummary = { title: string; details: string[] };

function summarizeAction(before: GameState, after: GameState, input: Command, names: string[]): ActionSummary | null {
  if (input.type === "RESCUE") {
    const target = input.target as Seat;
    const actor = input.actor as Seat;
    const beforeTotal = total(before.hands[target]);
    const afterTotal = total(after.hands[target]);
    const earned = after.scores[actor].nutritionistPoints - before.scores[actor].nutritionistPoints;
    const details = [`${nameFor(names, target)}’s protein changed from ${beforeTotal} to ${afterTotal}.`];
    if (earned > 0) details.push(`${nameFor(names, actor)} earns ${earned} point${earned === 1 ? "" : "s"}.`);
    if (afterTotal > after.threshold) details.push(`${nameFor(names, target)} still needs help: ${afterTotal} is above the target of ${after.threshold}.`);
    if (after.phase === "ASSISTANT_RESCUE") details.push(`${nameFor(names, after.currentRoles.assistant)} may now try one swap.`);
    return { title: earned > 0 ? "Rescue successful!" : "Helpful swap completed.", details };
  }
  if (input.type === "PATIENT_SWAP") {
    const first = after.currentRoles.patient1;
    const second = after.currentRoles.patient2;
    return { title: "Tyro Friend swap completed.", details: [`${nameFor(names, first)} now has ${total(after.hands[first])} protein; ${nameFor(names, second)} now has ${total(after.hands[second])} protein.`, "The Orchard step begins only if more help is needed."] };
  }
  if (input.type === "TAKE_VEGETABLE") {
    const target = input.patient as Seat;
    return { title: "Orchard fruit collected!", details: [`${nameFor(names, target)}’s protein is now ${total(after.hands[target])}.`, `${after.gardenTokens} Orchard fruit pick${after.gardenTokens === 1 ? "" : "s"} remain.`] };
  }
  return null;
}

export function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [controllers, setControllers] = useState<Controller[]>(["HUMAN", "HUMAN", "HUMAN", "HUMAN"]);
  const [playerNames, setPlayerNames] = useState<string[]>(() => savedPlayerNames());
  const [message, setMessage] = useState("Loading the local game service...");
  const [loading, setLoading] = useState(false);
  const [selectedActorCard, setSelectedActorCard] = useState<number | null>(null);
  const [selectedPatientCards, setSelectedPatientCards] = useState<[number | null, number | null]>([null, null]);
  const [showRoundWheel, setShowRoundWheel] = useState(false);
  const [rulebookOpen, setRulebookOpen] = useState(false);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [tutorialIntroOpen, setTutorialIntroOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep | null>(null);
  const [mutualAidOpen, setMutualAidOpen] = useState(false);
  const [actionSummary, setActionSummary] = useState<ActionSummary | null>(null);
  const seenRound = useRef<number | null>(null);
  const seenOutcomeRound = useRef<number | null>(null);
  const autoAdvancedRevision = useRef<number | null>(null);
  const mutualAidSeen = useRef<string | null>(null);
  const rulebookTriggerRef = useRef<HTMLButtonElement | null>(null);
  const rulebookCloseRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async (initial = false) => {
      const saved = savedBrowserGame();
      if (saved) {
        if (!cancelled) {
          setGame(saved);
          if (initial) setMessage("Restored this browser's saved game.");
        }
        return;
      }
      try {
        const response = await fetch(`${SERVER_URL}/api/game`);
        const data = await responsePayload(response);
        if (!response.ok) throw new Error(data.error ?? "The game service could not load the game.");
        if (cancelled) return;
        setGame(data.game ?? null);
        if (initial) setMessage(data.game ? "Restored the most recent game." : "Choose controllers and start a new game.");
      } catch {
        if (!cancelled) setMessage("The game service is not running yet. Start it with pnpm dev.");
      }
    };
    void refresh(true);

    // A public Vercel preview is browser-owned. Polling a serverless function
    // could replace this evaluator's table with another warm function instance.
    if (usesBrowserGameSave) return () => { cancelled = true; };

    if (supportsSocketUpdates) {
      const socket = io(SERVER_URL);
      socket.on("game:update", (next: GameState | null) => { if (next) setGame(next); });
      return () => { cancelled = true; socket.close(); };
    }

    // Serverless functions do not hold a WebSocket connection. A short poll
    // keeps a public Vercel preview in sync for people judging the same table.
    const interval = window.setInterval(() => { void refresh(); }, 2_500);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  useEffect(() => { setSelectedActorCard(null); setSelectedPatientCards([null, null]); }, [game?.revision, game?.phase]);

  useEffect(() => {
    if (tutorialStep || !game || game.phase !== "PATIENT_SWAP" || (game.controllers[game.currentRoles.patient1] === "AI" && game.controllers[game.currentRoles.patient2] === "AI")) {
      if (!game || game.phase !== "PATIENT_SWAP") mutualAidSeen.current = null;
      setMutualAidOpen(false);
      return;
    }
    const key = `${game.round}:${game.phase}`;
    if (mutualAidSeen.current !== key) {
      mutualAidSeen.current = key;
      setMutualAidOpen(true);
    }
  }, [game?.round, game?.phase, game?.controllers, tutorialStep]);

  const closeRulebook = () => {
    setRulebookOpen(false);
    window.requestAnimationFrame(() => rulebookTriggerRef.current?.focus());
  };

  useEffect(() => {
    if (!rulebookOpen) return;
    rulebookCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") closeRulebook(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [rulebookOpen]);

  const send = async (input: Command) => {
    const before = game;
    const tutorialStepBeforeAction = tutorialStep;
    setLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/api/game/command`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(usesBrowserGameSave ? { ...input, game } : input) });
      const data = await responsePayload(response);
      if (!response.ok) throw new Error(data.error ?? "Action rejected.");
      if (!data.game) throw new Error("The game service did not return an updated game.");
      saveBrowserGame(data.game);
      setGame(data.game);
      const summary = before ? summarizeAction(before, data.game, input, playerNames) : null;
      setActionSummary(summary);
      setMessage(summary?.title ?? "Action accepted.");
      if (tutorialStepBeforeAction === "nutritionist-target" && input.type === "RESCUE") setTutorialStep("assistant-card");
      if (tutorialStepBeforeAction === "assistant-target" && input.type === "RESCUE") setTutorialStep("friends-first");
      if (tutorialStepBeforeAction === "friends-confirm" && input.type === "PATIENT_SWAP") setTutorialStep("orchard-intro");
      if (tutorialStepBeforeAction === "orchard-pick" && input.type === "TAKE_VEGETABLE" && before && data.game.round > before.round) {
        setTutorialStep("complete");
        setShowRoundWheel(false);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action rejected."); }
    finally { setLoading(false); }
  };

  const start = async (options: { tutorial?: boolean } = {}) => {
    const isTutorial = options.tutorial === true;
    const normalizedNames = playerNames.map((name, index) => name.trim() || DEFAULT_PLAYER_NAMES[index]);
    setPlayerNames(normalizedNames);
    savePlayerNames(normalizedNames);
    setLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/api/game`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ controllers: isTutorial ? TUTORIAL_CONTROLLERS : controllers, seed: isTutorial ? TUTORIAL_SEED : undefined }) });
      const data = await responsePayload(response);
      if (!response.ok) throw new Error(data.error ?? "Unable to start the game.");
      if (!data.game) throw new Error("The game service did not return a new game.");
      saveBrowserGame(data.game); setGame(data.game); setShowSetup(false); setNameDialogOpen(false); setTutorialIntroOpen(false); setActionSummary(null); setTutorialStep(isTutorial ? "round" : null); setShowRoundWheel(isTutorial); setMessage(isTutorial ? "Tutorial round ready. Follow the highlighted board area." : "A new game has started. Event cards are enabled.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start the game."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!game || showSetup) {
      seenRound.current = null;
      seenOutcomeRound.current = null;
      setShowRoundWheel(false);
      return;
    }
    if (tutorialStep === "round") {
      setShowRoundWheel(true);
      return;
    }
    if (tutorialStep === "complete") {
      setShowRoundWheel(false);
      return;
    }
    const outcomeRound = game.lastRoundOutcome?.round ?? null;
    const isNewRound = seenRound.current !== game.round;
    const isNewOutcome = outcomeRound !== null && seenOutcomeRound.current !== outcomeRound;
    if (!isNewRound && !isNewOutcome) return;
    seenRound.current = game.round;
    seenOutcomeRound.current = outcomeRound;
    setShowRoundWheel(true);
    const timer = window.setTimeout(() => setShowRoundWheel(false), 2_800);
    return () => window.clearTimeout(timer);
  }, [game?.round, game?.lastRoundOutcome?.round, showSetup, tutorialStep]);

  useEffect(() => {
    if (!game || showSetup || loading || !aiDecisionIsDue(game)) {
      if (!game || !aiDecisionIsDue(game)) autoAdvancedRevision.current = null;
      return;
    }
    if (autoAdvancedRevision.current === game.revision) return;
    autoAdvancedRevision.current = game.revision;
    setMessage("AI is taking the next turn...");
    void send({ type: "ADVANCE_AI", expectedRevision: game.revision });
  }, [game?.revision, game?.phase, loading, showSetup]);

  const onSelect = (seat: Seat, index: number) => {
    if (!game) return;
    const expectedTutorialPick = tutorialStep === "nutritionist-card"
      ? { seat: game.currentRoles.active, index: 0, label: "Kidney Beans" }
      : tutorialStep === "nutritionist-target"
        ? { seat: game.currentRoles.patient1, index: 2, label: "Almonds" }
        : tutorialStep === "assistant-card"
          ? { seat: game.currentRoles.assistant, index: 0, label: "Mussels" }
          : tutorialStep === "assistant-target"
            ? { seat: game.currentRoles.patient2, index: 0, label: "Lamb Leg" }
            : tutorialStep === "friends-first"
              ? { seat: game.currentRoles.patient1, index: 2, label: "Kidney Beans" }
              : tutorialStep === "friends-second"
                ? { seat: game.currentRoles.patient2, index: 0, label: "Mussels" }
                : null;
    if (tutorialStep && !expectedTutorialPick && tutorialStep !== "orchard-pick") {
      setMessage("Follow the highlighted tutorial control to continue.");
      return;
    }
    if (expectedTutorialPick && (seat !== expectedTutorialPick.seat || index !== expectedTutorialPick.index)) {
      setMessage(`For this guided round, choose ${expectedTutorialPick.label}.`);
      return;
    }
    if (game.phase === "VEGETABLE_RESOLUTION") {
      void send({ type: "TAKE_VEGETABLE", expectedRevision: game.revision, patient: seat, cardIndex: index });
      return;
    }
    if (game.phase === "PATIENT_SWAP") {
      if (game.controllers[seat] === "AI") return;
      if (seat === game.currentRoles.patient1) {
        setSelectedPatientCards(([_, second]) => [index, second]);
        if (tutorialStep === "friends-first") setTutorialStep("friends-second");
      }
      if (seat === game.currentRoles.patient2) {
        setSelectedPatientCards(([first]) => [first, index]);
        if (tutorialStep === "friends-second") setTutorialStep("friends-confirm");
      }
      return;
    }
    if (seat === currentActor(game)) {
      setSelectedActorCard(index);
      if (tutorialStep === "nutritionist-card") setTutorialStep("nutritionist-target");
      if (tutorialStep === "assistant-card") setTutorialStep("assistant-target");
    }
    const activeMayChoose = game.phase === "ACTIVE_RESCUE" && (seat === game.currentRoles.patient1 || seat === game.currentRoles.patient2) && total(game.hands[seat]) > game.threshold;
    const assistantMayChoose = game.phase === "ASSISTANT_RESCUE" && (seat === game.currentRoles.patient1 || seat === game.currentRoles.patient2) && total(game.hands[seat]) > game.threshold;
    if ((activeMayChoose || assistantMayChoose) && selectedActorCard !== null) {
      void send({ type: "RESCUE", expectedRevision: game.revision, actor: currentActor(game)!, actorIndex: selectedActorCard, target: seat, targetIndex: index });
    }
  };

  const prompt = useMemo(() => {
    if (!game) return "Set up a local game.";
    if (game.phase === "GAME_OVER") return game.endReason ?? "The game has ended.";
    if (game.phase === "PATIENT_SWAP") {
      const { patient1, patient2 } = game.currentRoles;
      const humanPatients = [patient1, patient2].filter((seat) => game.controllers[seat] === "HUMAN");
      const firstCard = selectedPatientCards[0] === null ? null : game.hands[patient1][selectedPatientCards[0]];
      const secondCard = selectedPatientCards[1] === null ? null : game.hands[patient2][selectedPatientCards[1]];
      if (!humanPatients.length) return "Both Tyro Friends are AI-controlled. They are choosing whether to swap.";
      if (firstCard && secondCard) return `Ready: ${nameFor(playerNames, patient1)} gives ${foodForCard(firstCard).name}; ${nameFor(playerNames, patient2)} gives ${foodForCard(secondCard).name}. Please confirm the swap.`;
      if (humanPatients.length === 1) return `${nameFor(playerNames, humanPatients[0])}, choose one card. The AI Tyro Friend will choose its own best card when you confirm.`;
      if (firstCard) return `${nameFor(playerNames, patient2)}, choose one card to trade away with ${nameFor(playerNames, patient1)}.`;
      if (secondCard) return `${nameFor(playerNames, patient1)}, choose one card to trade away with ${nameFor(playerNames, patient2)}.`;
      return `${nameFor(playerNames, patient1)} and ${nameFor(playerNames, patient2)}, please try swapping food once to lower protein intake. Please select the cards you each want to trade away.`;
    }
    if (game.phase === "VEGETABLE_RESOLUTION") {
      const target = strictTarget(game);
      return target === null ? "All Tyro Friends are within the protein limit." : `Orchard turn: click a highlighted highest-protein card on ${nameFor(playerNames, target)}. It will be replaced by one zero-protein Orchard fruit. Keep choosing fruit until every Tyro Friend is within the protein limit or the Orchard is empty.`;
    }
    const actor = currentActor(game)!;
    const friends = [game.currentRoles.patient1, game.currentRoles.patient2].filter((seat) => total(game.hands[seat]) > game.threshold);
    const actorCard = selectedActorCard === null ? null : game.hands[actor][selectedActorCard];
    const friendNames = friends.map((seat) => nameFor(playerNames, seat));
    const roleName = game.phase === "ACTIVE_RESCUE" ? "Today’s Nutritionist" : "Assistant";
    if (actorCard) return `Giving: ${foodForCard(actorCard).name}, ${actorCard.value} protein. Choose a higher-protein card from ${friendNames.join(" or ")} to receive.`;
    if (game.phase === "ACTIVE_RESCUE") {
      if (!friends.length) return `${roleName} has no Tyro Friend to rescue. The round will continue.`;
      if (friends.length === 1) return `${nameFor(playerNames, actor)}’s turn. ${nameFor(playerNames, friends[0])} needs help; the other Tyro Friend is already on target. Choose a card from ${nameFor(playerNames, actor)}’s hand to give away.`;
      return `${nameFor(playerNames, actor)}’s turn. Help ${friendNames.join(" or ")} reach their protein target. Choose a card from ${nameFor(playerNames, actor)}’s hand to give away.`;
    }
    if (!friends.length) return "Both Tyro Friends are within the protein limit. The round will continue.";
    if (friends.length === 1) return `${nameFor(playerNames, friends[0])} still needs help. ${nameFor(playerNames, actor)} may try one Assistant rescue: choose a card to give away.`;
    return `${nameFor(playerNames, actor)}’s Assistant rescue. Help ${friendNames.join(" or ")} by choosing a card to give away.`;
  }, [game, playerNames, selectedActorCard, selectedPatientCards]);

  const advanceTutorial = () => {
    if (tutorialStep === "round") { setShowRoundWheel(false); setTutorialStep("event"); }
    if (tutorialStep === "event") setTutorialStep("nutritionist-card");
    if (tutorialStep === "orchard-intro") setTutorialStep("orchard-pick");
  };
  const continueTutorialGame = () => {
    setTutorialStep(null);
    setShowRoundWheel(false);
    setMessage("Tutorial complete. Continue playing this game whenever you are ready.");
  };
  const leaveTutorial = () => {
    setTutorialStep(null);
    setTutorialIntroOpen(false);
    setMutualAidOpen(false);
    setShowRoundWheel(false);
    setActionSummary(null);
    if (usesBrowserGameSave) window.localStorage.removeItem(BROWSER_GAME_KEY);
    setGame(null);
    setShowSetup(true);
    setMessage("Tutorial closed. Choose names and controllers to start a game.");
  };

  if (showSetup || !game) return <><Setup controllers={controllers} setControllers={setControllers} names={playerNames} openNameDialog={() => setNameDialogOpen(true)} openTutorial={() => setTutorialIntroOpen(true)} loading={loading} />{nameDialogOpen && <PlayerNameDialog names={playerNames} setNames={setPlayerNames} onStart={() => void start()} onClose={() => setNameDialogOpen(false)} loading={loading} />}{tutorialIntroOpen && <TutorialStartDialog onClose={() => setTutorialIntroOpen(false)} onStart={() => void start({ tutorial: true })} loading={loading} />}</>;

  const actor = currentActor(game);
  const patient1Ai = game.controllers[game.currentRoles.patient1] === "AI";
  const patient2Ai = game.controllers[game.currentRoles.patient2] === "AI";
  const canSubmitPatientSwap = (patient1Ai || selectedPatientCards[0] !== null) && (patient2Ai || selectedPatientCards[1] !== null);
  const aiTurn = aiDecisionIsDue(game);
  const rescuePhase = game.phase === "ACTIVE_RESCUE" || game.phase === "ASSISTANT_RESCUE";
  const noHelpfulRescue = rescuePhase && actor !== null && game.controllers[actor] === "HUMAN" && !hasHelpfulRescue(game, actor);
  const tutorialTarget = tutorialStep ? tutorialTargetFor(tutorialStep, game) : null;
  const actionHeading = loading
    ? "Checking action..."
    : aiTurn
      ? "AI turn: choosing a move"
      : noHelpfulRescue
        ? `${nameFor(playerNames, actor!)} has no helpful rescue`
        : game.phase === "VEGETABLE_RESOLUTION"
          ? "Orchard turn: choose a highlighted replacement"
          : game.phase === "PATIENT_SWAP"
            ? "Tyro Friend turn: choose one card from each Tyro Friend"
            : actor === null
              ? "Your turn board"
              : `${nameFor(playerNames, actor)}’s turn · ${game.phase === "ACTIVE_RESCUE" ? "Today’s Nutritionist" : "Assistant"}`;

  return (
    <main className={`app-shell ${tutorialTarget ? `tutorial-running tutorial-focus-${tutorialTarget}` : ""}`}>
      <header className="app-header">
        <a className="wordmark" href="/" aria-label="Chews Freedom home"><span className="wordmark-leaf">✦</span><span>Chews Freedom</span></a>
        <div className="header-meta"><span>Round {game.round}</span><span>Public food</span><button type="button" className="quiet-button" onClick={() => { if (usesBrowserGameSave) window.localStorage.removeItem(BROWSER_GAME_KEY); setShowSetup(true); setMessage("Choose controllers and start a new game."); }}>New game</button></div>
      </header>
      <section className="game-layout">
        <aside className="left-rail">
          <div className="event-card-panel" data-tutorial-target="event-card">
            <div className="panel-heading"><span>Event card</span><strong>{game.currentEvent ? game.currentEvent.shortName : "Clear round"}</strong></div>
            <h2>{game.currentEvent?.name ?? "No event this round"}</h2>
            <p>{game.currentEvent?.summary ?? "The standard rules apply this round."}</p>
            <small>{game.eventPool.length} event cards remain in this game</small>
          </div>
          {game.lastRoundOutcome && <section className={`round-recap ${game.lastRoundOutcome.kind.toLowerCase()}`} aria-label={`Day ${game.lastRoundOutcome.round} result`}><span>Day {game.lastRoundOutcome.round} result</span><h2>{game.lastRoundOutcome.title}</h2><p>{game.lastRoundOutcome.detail}</p></section>}
          <div className="rule-panel"><h2>Dynamic prompt</h2><p>{prompt}</p></div>
        </aside>
        <section className="table-area" aria-label="Chews Freedom game board">
          <div data-tutorial-target="orchard" className={`garden-panel board-garden ${game.phase === "VEGETABLE_RESOLUTION" ? "is-active" : ""}`}><div><span>Our Orchard</span><p>{game.phase === "VEGETABLE_RESOLUTION" ? "Pick a highlighted food card for fruit replacement." : "Zero-protein fruit replacements."}</p></div><GardenField tokens={game.gardenTokens} /></div>
          <TurnFlow game={game} names={playerNames} />
          <div data-tutorial-target="round-wheel" className={`board-flip-stage ${showRoundWheel ? "show-wheel" : "show-table"}`}>
            <div className="board-flip-inner">
              <div className="board-face board-face-wheel"><RoundWheel game={game} names={playerNames} /></div>
              <div className="board-face board-face-table">
                <div className="table-felt">
                  <SeatPanel game={game} names={playerNames} seat={game.currentRoles.active} selectedActorCard={selectedActorCard} selectedPatientCards={selectedPatientCards} onSelect={onSelect} />
                  <SeatPanel game={game} names={playerNames} seat={game.currentRoles.patient1} selectedActorCard={selectedActorCard} selectedPatientCards={selectedPatientCards} onSelect={onSelect} />
                  <section className="centre-status" aria-live="polite">
                    <p className="phase-label">{game.phase.replaceAll("_", " ")}</p>
                    <strong>{game.phase === "GAME_OVER" ? "Game complete" : aiTurn ? "AI is moving" : game.phase === "VEGETABLE_RESOLUTION" ? "Orchard turn" : `${game.threshold} protein limit`}</strong>
                    <span>{game.phase === "GAME_OVER" && game.lastRoundOutcome ? game.lastRoundOutcome.title : game.phase === "VEGETABLE_RESOLUTION" ? `${game.gardenTokens} zero-protein fruit ready` : aiTurn ? "The game will advance automatically." : game.currentEvent ? "Event modifier active" : "Follow the highlighted player."}</span>
                    {game.phase === "GAME_OVER" && <button type="button" className="primary-button" onClick={() => void start()} disabled={loading}>Play again</button>}
                  </section>
                  <SeatPanel game={game} names={playerNames} seat={game.currentRoles.patient2} selectedActorCard={selectedActorCard} selectedPatientCards={selectedPatientCards} onSelect={onSelect} />
                  <SeatPanel game={game} names={playerNames} seat={game.currentRoles.assistant} selectedActorCard={selectedActorCard} selectedPatientCards={selectedPatientCards} onSelect={onSelect} />
                </div>
              </div>
            </div>
          </div>
          <div className="action-tray">
            <div data-tutorial-target="prompt-bar" className="dynamic-prompt-bar"><TurnFlow game={game} names={playerNames} compact /><strong>{actionHeading}</strong><p>{prompt}</p>{actionSummary && <section className="action-summary" aria-live="polite"><strong>{actionSummary.title}</strong>{actionSummary.details.map((detail) => <span key={detail}>{detail}</span>)}</section>}<small>{message}</small></div>
            <div data-tutorial-target="confirm-swap" className="action-buttons">
              {noHelpfulRescue && actor !== null && <button className="primary-button" type="button" onClick={() => void send({ type: "RESCUE_PASS", expectedRevision: game.revision, actor })} disabled={loading}>Continue</button>}
              {game.phase === "PATIENT_SWAP" && !(patient1Ai && patient2Ai) && <><button className="secondary-button" type="button" onClick={() => void send({ type: "PATIENT_PASS", expectedRevision: game.revision })} disabled={loading || tutorialStep !== null}>Do not swap</button><button className="primary-button" type="button" onClick={() => void send({ type: "PATIENT_SWAP", expectedRevision: game.revision, patient1Index: selectedPatientCards[0] ?? undefined, patient2Index: selectedPatientCards[1] ?? undefined })} disabled={loading || !canSubmitPatientSwap}>{patient1Ai || patient2Ai ? "Confirm swap with AI choice" : "Please confirm the swap"}</button></>}
            </div>
          </div>
        </section>
        <aside className="right-rail">
          <section className="scores-panel"><h2>Shared scoreboard</h2>{game.scores.map((score, seat) => <div className="score-row" key={nameFor(playerNames, seat)}><span>{nameFor(playerNames, seat)}</span><div><small>Today’s Nutritionist {score.nutritionistPoints} · Tyro Friend swap {score.patientMutualAidPoints}</small><strong>{score.totalPoints}</strong></div></div>)}</section>
          <RulebookButton onOpen={() => setRulebookOpen(true)} triggerRef={rulebookTriggerRef} />
        </aside>
      </section>
      {rulebookOpen && <Rulebook onClose={closeRulebook} closeRef={rulebookCloseRef} />}
      {mutualAidOpen && <MutualAidDialog game={game} names={playerNames} onReady={() => setMutualAidOpen(false)} />}
      {tutorialStep && tutorialTarget && <><TutorialSpotlight target={tutorialTarget} /><TutorialCoach step={tutorialStep} game={game} names={playerNames} onAdvance={advanceTutorial} onContinue={continueTutorialGame} onExit={leaveTutorial} /></>}
    </main>
  );
}
