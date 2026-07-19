// Source: Food_Cards_48_Unique_Specific_Foods_v3.xlsx, sheet “48 Unique Food Cards”.
// Card score = the workbook's rounded calculated protein per listed child portion.
export interface FoodCardDefinition {
  id: string;
  number: number;
  category: string;
  name: string;
  chineseName: string;
  proteinPer100g: number;
  portionGrams: number;
  score: number;
  portion: string;
}

export const FOOD_DECK: FoodCardDefinition[] = [
  {"id": "food-01-apple", "number": 1, "category": "Fruit", "name": "Apple", "chineseName": "苹果", "proteinPer100g": 0.26, "portionGrams": 80, "score": 0, "portion": "1 small child portion"},
  {"id": "food-02-cucumber", "number": 2, "category": "Vegetable", "name": "Cucumber", "chineseName": "黄瓜", "proteinPer100g": 0.65, "portionGrams": 60, "score": 0, "portion": "raw sticks/slices"},
  {"id": "food-03-watermelon", "number": 3, "category": "Fruit", "name": "Watermelon", "chineseName": "西瓜", "proteinPer100g": 0.61, "portionGrams": 80, "score": 0, "portion": "1 small slice"},
  {"id": "food-04-banana", "number": 4, "category": "Fruit", "name": "Banana", "chineseName": "香蕉", "proteinPer100g": 1.09, "portionGrams": 80, "score": 1, "portion": "1 small banana"},
  {"id": "food-05-orange", "number": 5, "category": "Fruit", "name": "Orange", "chineseName": "橙子", "proteinPer100g": 0.94, "portionGrams": 100, "score": 1, "portion": "1 small orange"},
  {"id": "food-06-broccoli", "number": 6, "category": "Vegetable", "name": "Broccoli", "chineseName": "西兰花", "proteinPer100g": 2.82, "portionGrams": 70, "score": 2, "portion": "small cooked portion"},
  {"id": "food-07-boiled-potato", "number": 7, "category": "Vegetable", "name": "Boiled potato", "chineseName": "煮土豆", "proteinPer100g": 2.05, "portionGrams": 100, "score": 2, "portion": "1 small potato"},
  {"id": "food-08-sweetcorn", "number": 8, "category": "Vegetable", "name": "Sweetcorn", "chineseName": "甜玉米粒", "proteinPer100g": 3.27, "portionGrams": 60, "score": 2, "portion": "small serving"},
  {"id": "food-09-green-peas", "number": 9, "category": "Vegetable", "name": "Green peas", "chineseName": "青豌豆", "proteinPer100g": 5.42, "portionGrams": 35, "score": 2, "portion": "small serving"},
  {"id": "food-10-avocado", "number": 10, "category": "Fruit", "name": "Avocado", "chineseName": "牛油果", "proteinPer100g": 2, "portionGrams": 100, "score": 2, "portion": "about half a medium avocado"},
  {"id": "food-11-button-mushrooms", "number": 11, "category": "Vegetable", "name": "Button mushrooms", "chineseName": "白蘑菇", "proteinPer100g": 3.09, "portionGrams": 70, "score": 2, "portion": "small cooked portion"},
  {"id": "food-12-cooked-white-rice", "number": 12, "category": "Grain", "name": "Cooked white rice", "chineseName": "熟白米饭", "proteinPer100g": 2.69, "portionGrams": 110, "score": 3, "portion": "1 small bowl"},
  {"id": "food-13-wholemeal-bread", "number": 13, "category": "Grain", "name": "Wholemeal bread", "chineseName": "全麦面包", "proteinPer100g": 12.45, "portionGrams": 24, "score": 3, "portion": "1 small slice"},
  {"id": "food-14-cooked-spaghetti", "number": 14, "category": "Grain", "name": "Cooked spaghetti", "chineseName": "熟意大利细面", "proteinPer100g": 5.15, "portionGrams": 60, "score": 3, "portion": "half child portion"},
  {"id": "food-15-rolled-oats", "number": 15, "category": "Grain", "name": "Rolled oats", "chineseName": "燕麦片", "proteinPer100g": 16.9, "portionGrams": 18, "score": 3, "portion": "dry weight"},
  {"id": "food-16-cornflakes", "number": 16, "category": "Grain", "name": "Cornflakes", "chineseName": "玉米片", "proteinPer100g": 7.5, "portionGrams": 40, "score": 3, "portion": "small dry bowl"},
  {"id": "food-17-canned-baked-beans", "number": 17, "category": "Legume", "name": "Canned baked beans", "chineseName": "番茄汁焗豆", "proteinPer100g": 4.8, "portionGrams": 60, "score": 3, "portion": "small serving"},
  {"id": "food-18-whole-milk", "number": 18, "category": "Dairy", "name": "Whole milk", "chineseName": "全脂牛奶", "proteinPer100g": 3.15, "portionGrams": 100, "score": 3, "portion": "half a small glass"},
  {"id": "food-19-cooked-green-beans", "number": 19, "category": "Vegetable", "name": "Cooked green beans", "chineseName": "熟四季豆", "proteinPer100g": 1.83, "portionGrams": 165, "score": 3, "portion": "child vegetable portion"},
  {"id": "food-20-boiled-egg", "number": 20, "category": "Protein", "name": "Boiled egg", "chineseName": "水煮鸡蛋", "proteinPer100g": 12.6, "portionGrams": 40, "score": 5, "portion": "about 3/4 medium egg"},
  {"id": "food-21-smooth-peanut-butter", "number": 21, "category": "Spread", "name": "Smooth peanut butter", "chineseName": "幼滑花生酱", "proteinPer100g": 25.1, "portionGrams": 20, "score": 5, "portion": "1 tablespoon"},
  {"id": "food-22-greek-yogurt", "number": 22, "category": "Dairy", "name": "Greek yogurt", "chineseName": "希腊酸奶", "proteinPer100g": 10, "portionGrams": 50, "score": 5, "portion": "small serving"},
  {"id": "food-23-hummus", "number": 23, "category": "Dip", "name": "Hummus", "chineseName": "鹰嘴豆泥", "proteinPer100g": 7.9, "portionGrams": 65, "score": 5, "portion": "2–3 tablespoons"},
  {"id": "food-24-cooked-kidney-beans", "number": 24, "category": "Legume", "name": "Cooked kidney beans", "chineseName": "熟红腰豆", "proteinPer100g": 8.67, "portionGrams": 55, "score": 5, "portion": "small serving"},
  {"id": "food-25-cheddar-cheese", "number": 25, "category": "Dairy", "name": "Cheddar cheese", "chineseName": "切达奶酪", "proteinPer100g": 24.9, "portionGrams": 28, "score": 7, "portion": "small cheese portion"},
  {"id": "food-26-firm-tofu", "number": 26, "category": "Soy", "name": "Firm tofu", "chineseName": "老豆腐", "proteinPer100g": 8.1, "portionGrams": 85, "score": 7, "portion": "child portion"},
  {"id": "food-27-cooked-black-beans", "number": 27, "category": "Legume", "name": "Cooked black beans", "chineseName": "熟黑豆", "proteinPer100g": 8.86, "portionGrams": 80, "score": 7, "portion": "child portion"},
  {"id": "food-28-canned-tuna-in-water", "number": 28, "category": "Fish", "name": "Canned tuna in water", "chineseName": "水浸金枪鱼罐头", "proteinPer100g": 24, "portionGrams": 29, "score": 7, "portion": "small spooned portion"},
  {"id": "food-29-cooked-salmon", "number": 29, "category": "Fish", "name": "Cooked salmon", "chineseName": "熟三文鱼", "proteinPer100g": 20.4, "portionGrams": 34, "score": 7, "portion": "small piece"},
  {"id": "food-30-cooked-turkey-breast", "number": 30, "category": "Poultry", "name": "Cooked turkey breast", "chineseName": "熟火鸡胸肉", "proteinPer100g": 29, "portionGrams": 24, "score": 7, "portion": "small slices"},
  {"id": "food-31-cooked-lean-beef-mince", "number": 31, "category": "Meat", "name": "Cooked lean beef mince", "chineseName": "熟瘦牛肉末", "proteinPer100g": 26, "portionGrams": 27, "score": 7, "portion": "small serving"},
  {"id": "food-32-almonds", "number": 32, "category": "Nuts", "name": "Almonds", "chineseName": "杏仁", "proteinPer100g": 21.2, "portionGrams": 33, "score": 7, "portion": "small handful"},
  {"id": "food-33-fish-fingers", "number": 33, "category": "Fish", "name": "Fish fingers", "chineseName": "鱼条", "proteinPer100g": 11.7, "portionGrams": 60, "score": 7, "portion": "about 2 fish fingers"},
  {"id": "food-34-cooked-cod", "number": 34, "category": "Fish", "name": "Cooked cod", "chineseName": "熟鳕鱼", "proteinPer100g": 22, "portionGrams": 41, "score": 9, "portion": "small fillet piece"},
  {"id": "food-35-cooked-prawns", "number": 35, "category": "Seafood", "name": "Cooked prawns", "chineseName": "熟虾仁", "proteinPer100g": 24, "portionGrams": 38, "score": 9, "portion": "small serving"},
  {"id": "food-36-canned-sardines", "number": 36, "category": "Fish", "name": "Canned sardines", "chineseName": "沙丁鱼罐头", "proteinPer100g": 25, "portionGrams": 36, "score": 9, "portion": "about 1–2 small sardines"},
  {"id": "food-37-cooked-pork-loin", "number": 37, "category": "Meat", "name": "Cooked pork loin", "chineseName": "熟猪里脊", "proteinPer100g": 27, "portionGrams": 33, "score": 9, "portion": "small slices"},
  {"id": "food-38-cooked-mussels", "number": 38, "category": "Seafood", "name": "Cooked mussels", "chineseName": "熟淡菜", "proteinPer100g": 23.8, "portionGrams": 38, "score": 9, "portion": "small serving, without shells"},
  {"id": "food-39-cooked-chicken-breast", "number": 39, "category": "Poultry", "name": "Cooked chicken breast", "chineseName": "熟鸡胸肉", "proteinPer100g": 27.3, "portionGrams": 40, "score": 11, "portion": "half child meat portion"},
  {"id": "food-40-cooked-haddock", "number": 40, "category": "Fish", "name": "Cooked haddock", "chineseName": "熟黑线鳕", "proteinPer100g": 24, "portionGrams": 46, "score": 11, "portion": "small fillet piece"},
  {"id": "food-41-cooked-trout", "number": 41, "category": "Fish", "name": "Cooked trout", "chineseName": "熟鳟鱼", "proteinPer100g": 20.5, "portionGrams": 54, "score": 11, "portion": "small fillet piece"},
  {"id": "food-42-cooked-lamb-leg", "number": 42, "category": "Meat", "name": "Cooked lamb leg", "chineseName": "熟羊腿肉", "proteinPer100g": 25, "portionGrams": 44, "score": 11, "portion": "small slices"},
  {"id": "food-43-cooked-beef-steak", "number": 43, "category": "Meat", "name": "Cooked beef steak", "chineseName": "熟牛排", "proteinPer100g": 26, "portionGrams": 42, "score": 11, "portion": "small strips"},
  {"id": "food-44-corned-beef", "number": 44, "category": "Meat", "name": "Corned beef", "chineseName": "咸牛肉", "proteinPer100g": 26.8, "portionGrams": 41, "score": 11, "portion": "2–3 thin slices"},
  {"id": "food-45-cooked-lentils", "number": 45, "category": "Legume", "name": "Cooked lentils", "chineseName": "熟扁豆", "proteinPer100g": 9, "portionGrams": 122, "score": 11, "portion": "child portion"},
  {"id": "food-46-pork-sausage", "number": 46, "category": "Meat", "name": "Pork sausage", "chineseName": "猪肉香肠", "proteinPer100g": 18, "portionGrams": 60, "score": 11, "portion": "1 small sausage"},
  {"id": "food-47-cooked-mackerel", "number": 47, "category": "Fish", "name": "Cooked mackerel", "chineseName": "熟鲭鱼", "proteinPer100g": 20, "portionGrams": 65, "score": 13, "portion": "small fillet"},
  {"id": "food-48-cooked-ham", "number": 48, "category": "Meat", "name": "Cooked ham", "chineseName": "熟火腿", "proteinPer100g": 21, "portionGrams": 62, "score": 13, "portion": "2–3 medium slices"},
];

export const FOOD_DECK_BY_ID: Record<string, FoodCardDefinition> = Object.fromEntries(
  FOOD_DECK.map((food) => [food.id, food])
);

export const FOOD_SCORE_DISTRIBUTION: Record<number, number> = FOOD_DECK.reduce<Record<number, number>>((distribution, food) => {
  distribution[food.score] = (distribution[food.score] ?? 0) + 1;
  return distribution;
}, {});
