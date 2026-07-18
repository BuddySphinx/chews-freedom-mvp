# Chews Freedom /《营养师之王》V2
## Codex 实现、执行与验证规格书

**规格版本：** `2.0-codex-1`  
**文档状态：** 规范性基准（Normative Baseline）  
**适用范围：** 四人基础模式、无事件数值版、实体桌游规则引擎、数字原型、蒙特卡洛平衡模拟  
**最后更新：** 2026-07-16

---

## 0. Codex 执行摘要

Codex 应当把本文件视为 V2 基础规则的唯一规范来源。实现时必须满足以下五条核心约束：

1. 游戏固定四人，每轮依次为一名当班营养师、一名对面助理和两名患者。
2. 营养师换牌后本人是否达标完全不影响合法性；只检查目标患者是否立刻达标。
3. 每次营养师行动只能处理当前“最危险患者”。若无法在一次一换一后使其达标，本次机会直接结束，**不得改救较轻患者**。
4. 两名营养师行动后仍有人不达标，患者才可互换一次并计分；若患者均已达标，必须跳过，禁止刷分。
5. 菜地是独立于48张主牌堆的公共资源。摘菜只用于最终自救，0分；菜地归零后完成当前轮结算并结束游戏。

> **关键平衡警告：** “不得改救较轻患者”不是可有可无的文字细节。若允许转救，当前牌堆下当班营养师得分率会由约50.6%上升至约65%，破坏已接受的角色平衡。

---

# 1. 规范语言与实现原则

本文使用以下术语：

- **必须 / MUST**：实现不可偏离。
- **不得 / MUST NOT**：明确禁止。
- **应当 / SHOULD**：默认执行，除非有记录充分的工程原因。
- **可以 / MAY**：允许但不是必需。
- **未定 / TBD**：不可自行猜测数值；只可预留接口。

## 1.1 确定性要求

同一份初始状态、同一随机种子和同一策略模式，程序必须产生完全相同的：

- 洗牌结果；
- 发牌结果；
- 目标患者；
- 换牌动作；
- 每人得分；
- 菜地消耗；
- 游戏终止轮次。

所有模拟输出必须记录：

- `spec_version`
- `seed`
- `round_count` 或 `game_count`
- `events_enabled`
- 牌堆配置摘要
- 患者阈值
- AI策略名称

## 1.2 不得由 Codex 自行补完的内容

以下项目在V2基础版中尚未最终批准，Codex不得自行赋值：

- 感冒、复诊、聚会、零食、风暴、下雨、旅行等事件的具体数值；
- 棋盘格数量、移动路线和骰子面数；
- 事件同时触发时的优先级；
- 商业版美术、卡面文字和疾病科普内容。

这些内容只能作为扩展接口存在，基础模拟必须设置 `events_enabled = false`。

---

# 2. 游戏目标与教育目标

Chews Freedom 以罕见代谢病儿童的特殊营养管理为主题。玩家通过计算食物数值、营养师救援、患者互助和低蛋白食物自救，学习：

- 识别饮食风险；
- 理解个体化营养需求；
- 主动求助和提供帮助；
- 建立自主选择能力；
- 理解“饮食不同”不等于“生活低人一等”。

本游戏包含个人得分，但不是零和游戏。一次行动可以同时改善患者状态并使多名玩家得分。

---

# 3. 固定参数

## 3.1 基础参数表

| 参数 | 标识符 | V2值 |
|---|---|---:|
| 玩家数 | `PLAYER_COUNT` | 4 |
| 每人手牌数 | `HAND_SIZE` | 3 |
| 每轮发牌数 | `CARDS_PER_ROUND` | 12 |
| 患者基础上限 | `PATIENT_THRESHOLD` | 10 |
| 主牌堆大小 | `DECK_SIZE` | 48 |
| 菜地初始数量 | `VEGETABLE_SUPPLY` | 10 |
| 菜卡替换值 | `VEGETABLE_VALUE` | 0 |
| 正常重洗周期 | `RESHUFFLE_INTERVAL` | 4轮 |
| 当班成功分 | `ACTIVE_RESCUE_POINTS` | 1 |
| 助理成功分 | `ASSISTANT_RESCUE_POINTS` | 1 |
| 患者双达标分 | `PATIENT_BOTH_PASS_POINTS` | 每人2 |
| 患者单达标分 | `PATIENT_ONE_PASS_POINTS` | 每人1 |
| 摘菜得分 | `VEGETABLE_POINTS` | 0 |

## 3.2 主牌堆

主牌堆必须恰好包含：

| 卡值 | 张数 |
|---:|---:|
| 0 | 6 |
| 1 | 4 |
| 2 | 7 |
| 3 | 7 |
| 5 | 7 |
| 7 | 13 |
| 9 | 4 |
| **合计** | **48** |

### 3.2.1 牌的身份

实体卡应有唯一 `card_id`。逻辑属性至少包括：

```text
Card {
  card_id: string
  value: 0 | 1 | 2 | 3 | 5 | 7 | 9
  source: MAIN_DECK
}
```

相同数值的牌在规则效果上等价，但唯一ID用于：

- 日志；
- 重放；
- 处理重复数值时的确定性选择；
- 测试换牌是否真的交换了对应卡片。

## 3.3 菜地不是主牌堆的一部分

主牌堆中的6张数值0卡，是普通低蛋白食物卡。菜地中的10颗菜是独立公共资源，不属于48张牌。

Codex应把摘菜实现为“当前轮的虚拟0值替换”，而不是向主牌堆永久加入新卡：

```text
VegetableReplacement {
  value: 0
  source: VEGETABLE_SUPPLY
  temporary: true
}
```

轮末：

- 被替换掉的主牌进入弃牌堆；
- 临时菜卡离开本轮状态，不洗回主牌堆；
- 已消耗的菜地代币不恢复。

---

# 4. 座位、角色与轮换

## 4.1 座位编号

四个固定座位按顺时针编号：

```text
Seat 0 -> Seat 1 -> Seat 2 -> Seat 3 -> Seat 0
```

## 4.2 每轮角色映射

若本轮当班营养师座位为 `A`：

```text
active_nutritionist = A
assistant_nutritionist = (A + 2) mod 4
patient_1 = (A + 1) mod 4
patient_2 = (A + 3) mod 4
```

其中：

- `patient_1` 是当班营养师顺时针相邻者；
- `patient_2` 是逆时针相邻者；
- 目标危险度完全相同时，`patient_1`优先。

## 4.3 起始玩家

每局开始时，当班营养师必须：

- 由四个座位均匀随机产生；或
- 由调用者明确传入。

默认必须随机。固定由Seat 0开始会在“菜地耗尽导致非四轮倍数结束”时产生轻微座位偏差。

## 4.4 角色轮换

每完成一轮：

```text
next_active = (current_active + 1) mod 4
```

四轮构成一个完整角色周期。每位玩家在四轮中恰好：

- 当班营养师1次；
- 助理1次；
- 患者2次。

---

# 5. 游戏状态数据结构

推荐最小模型：

```text
GameState {
  spec_version: string
  seed: integer
  round_number: integer
  active_seat: 0..3
  patient_threshold: integer
  vegetable_tokens: integer
  draw_pile: Card[]
  discard_pile: Card[]
  hands_by_seat: map<seat, Card[3]>
  player_scores: PlayerScore[4]
  pending_events: Event[]
  phase: Phase
  ended: boolean
  event_log: LogEntry[]
}

PlayerScore {
  nutritionist_points: integer
  patient_mutual_aid_points: integer
  total_points: integer
}
```

`total_points`必须始终满足：

```text
total_points = nutritionist_points + patient_mutual_aid_points
```

推荐阶段枚举：

```text
SETUP
ROLE_ASSIGNMENT
DEAL
INITIAL_ASSESSMENT
ACTIVE_RESCUE
ASSISTANT_RESCUE
PATIENT_SWAP
VEGETABLE_RESOLUTION
SCORE_COMMIT
DISCARD
END_CHECK
ROUND_COMPLETE
GAME_OVER
```

非法阶段调用必须抛出错误，而不是静默跳转。

---

# 6. 开局流程

1. 验证恰好有4名不同玩家。
2. 创建48张主牌并验证数值计数。
3. 创建10个菜地代币。
4. 将所有玩家三类得分清零。
5. 初始化确定性随机数生成器。
6. 洗牌。
7. 随机或读取起始当班座位。
8. 设置 `round_number = 1`。
9. 进入第一轮。

开局时必须验证：

```text
len(draw_pile) = 48
len(discard_pile) = 0
vegetable_tokens = 10
sum(all player scores) = 0
```

---

# 7. 发牌与重洗

## 7.1 发牌顺序

为了重放确定性，参考实现按相对于当班角色的顺序发牌：

1. 当班营养师3张；
2. 助理3张；
3. patient_1三张；
4. patient_2三张。

每个角色的三张牌按牌堆顶顺序保留索引0、1、2。

实体游戏中即使玩家逐张轮流拿牌，只要牌堆充分随机，概率分布等价；数字实现必须固定一种发牌方式。

## 7.2 正常重洗

无事件基础模式下，每轮使用12张，因此48张正好支持4轮。

- 一轮结束后，本轮所有主牌进入弃牌堆；
- 完成第4轮后，将48张弃牌全部重洗成新牌堆；
- 下一轮从新牌堆发牌。

## 7.3 紧急重洗

若未来事件导致抽牌或弃牌数量变化，使抽牌堆不足以完成下一次必须操作：

1. 将弃牌堆洗回抽牌堆；
2. 保留当前仍在手中或事件区的卡；
3. 继续操作；
4. 记录 `EMERGENCY_RESHUFFLE`。

基础模式通常不会触发此分支，但实现必须支持。

---

# 8. 达标判定

患者手牌总值：

```text
patient_total = sum(card.value for card in hand)
```

患者达标条件：

```text
patient_total <= patient_threshold
```

患者超标值：

```text
excess = max(0, patient_total - patient_threshold)
```

V2基础阈值为10。边界条件：

- 总值10：达标；
- 总值11：超标1；
- 负数不允许；
- 阈值在一轮开始后锁定，救援过程中不得改变。

营养师自己的总值不需要达标，也不存在营养师范围检查。

---

# 9. 最危险患者规则

每次营养师行动开始时重新计算当前未达标患者。

## 9.1 目标选择

- 0名患者未达标：没有目标，行动跳过；
- 1名患者未达标：该患者是唯一目标；
- 2名患者未达标：超标值较大者是唯一目标；
- 超标值相同：`patient_1`是唯一目标。

伪代码：

```text
function select_strict_target(p1, p2, threshold):
    failing = patients with total > threshold
    if failing is empty:
        return NONE
    if failing has one patient:
        return that patient
    if excess(p1) > excess(p2):
        return p1
    if excess(p2) > excess(p1):
        return p2
    return p1
```

## 9.2 严格禁止转救

若营养师无法通过一次一换一使唯一目标达标：

- 本次营养师行动结束；
- 得0分；
- 不得尝试另一位患者。

这是V2规范性规则，不是AI策略偏好。

---

# 10. 营养师救援

## 10.1 行动顺序

1. 当班营养师行动；
2. 根据更新后的患者手牌重新判断状态；
3. 助理行动。

## 10.2 合法救援动作

动作形式：

```text
swap exactly one card from rescuer
with exactly one card from strict target patient
```

一个动作合法，当且仅当：

1. 当前存在严格目标患者；
2. 两张牌均来自各自当前手牌；
3. 每边恰好一张；
4. 交换后目标患者总值 `<= threshold`；
5. 本营养师本轮尚未成功救援；
6. 交换前后游戏仍处于对应营养师阶段。

以下因素不影响合法性：

- 营养师换后总值；
- 营养师换前是否“达标”；
- 营养师是否因此获得高值牌；
- 另一名患者是否仍超标。

## 10.3 得分

- 成功执行一个合法换牌：营养师获得1分；
- 无合法动作或选择跳过：0分；
- 每名营养师每轮最多1分。

基础自动策略中，只要存在合法动作，AI不得无故跳过。

## 10.4 同值交换

若交换两张相同数值的卡，目标患者总值不变。由于目标患者在行动开始时必然未达标，同值交换不可能使其达标，因此必然非法。

## 10.5 当班成功后助理是否仍行动

- 若仍至少一名患者未达标：助理照常行动；
- 若两名患者均达标：助理阶段跳过且0分；
- 当班不能为助理预留“无意义换牌得分”。

---

# 11. 多个合法救援动作时的Codex标准策略

实体玩家可在所有合法动作中自行选择。为了让Codex模拟可复现，必须实现 `CANONICAL_COOPERATIVE_POLICY_V2`。

## 11.1 当班营养师排序

枚举当前严格目标的全部合法换牌。对每个候选动作，向前模拟助理的标准行动和患者标准互换，然后按以下优先级选择：

1. 使助理阶段结束后达标患者数量最大；
2. 若相同，优先使助理也能成功救援；
3. 若相同，使患者互助后所需菜地代币数量最少；
4. 若相同，使助理阶段后患者总超标值最小；
5. 若仍相同，选择字典序最小的动作。

字典序动作建议表示为：

```text
(target_patient_id, rescuer_card_index, patient_card_index, rescuer_card_id, patient_card_id)
```

## 11.2 助理排序

对严格目标的全部合法动作，按以下顺序选择：

1. 行动后达标患者数量最大；
2. 患者总超标值最小；
3. 字典序最小动作。

## 11.3 为什么需要固定策略

角色“是否有机会得1分”主要由手牌决定，但助理和患者后续机会也会受到当班具体换哪张牌影响。若不固定策略：

- 相同随机种子可能得到不同得分；
- 平衡模拟不可复现；
- 单元测试会不稳定；
- 用户界面提示无法与模拟器一致。

程序可以额外支持：

- `HUMAN_CHOICE`
- `RANDOM_LEGAL_CHOICE`
- `SELFISH_SCORE_POLICY`

但所有官方统计必须使用标准合作策略。

---

# 12. 患者互助交换

## 12.1 触发条件

仅当两位营养师阶段结束后仍至少一名患者未达标，才进入本阶段。

若两名患者均已达标：

- 跳过本阶段；
- 两名患者本轮互助得分均为0；
- 不允许换牌；
- 不允许通过重新排列已达标手牌刷分。

## 12.2 动作

两名患者最多执行一次一换一：

```text
patient_1 gives exactly one card to patient_2
patient_2 simultaneously gives exactly one card to patient_1
```

与营养师救援不同，患者互换在执行前不要求保证达标。

## 12.3 得分

互换完成后立即判断：

| 结果 | patient_1 | patient_2 |
|---|---:|---:|
| 两人均达标 | +2 | +2 |
| 恰好一人达标 | +1 | +1 |
| 两人均未达标 | 0 | 0 |
| 未换牌 | 0 | 0 |

两名患者得分永远相同。

## 12.4 标准患者策略

枚举9种卡位交换和“不交换”，按以下优先级选择：

1. 患者得分档位最高；
2. 后续需要的菜地代币最少；
3. 剩余患者总超标值最小；
4. 若实质结果完全相同，优先不进行无意义交换；
5. 再按字典序选择。

## 12.5 数学限制

患者互换不改变两名患者手牌总和。两人都达标需要：

```text
combined_patient_total <= 2 * threshold
```

因此“双达标+2”天然较少见，这是牌堆和计分结构的结果，不是程序错误。

---

# 13. 菜地自救

## 13.1 进入条件

患者互助阶段后，任何仍未达标患者进入菜地自救。

## 13.2 单次摘菜效果

每使用一个菜地代币：

1. 菜地代币减1；
2. 选择该患者一张主牌；
3. 将该主牌替换为本轮临时0值菜卡；
4. 被替换主牌进入本轮弃牌集合；
5. 重新计算患者总值。

摘菜不增加任何得分。

## 13.3 最少资源策略

标准策略必须优先替换当前最高值卡，因为这会以最少代币达到阈值。

例：患者为 `[3, 7, 9]`，总值19：

- 替换9为0后，总值10；
- 只需1个菜地代币。

例：患者为 `[7, 7, 9]`，总值23：

- 替换9后为14，仍超标；
- 再替换一个7后为7；
- 共需2个代币。

## 13.4 两名患者同时需要菜且资源不足

数字实现必须枚举可分配方案，并按以下优先级分配剩余菜：

1. 使最终达标患者数量最大；
2. 若相同，使总剩余超标值最小；
3. 若相同，优先超标值更大的患者；
4. 若仍相同，`patient_1`优先；
5. 每个患者内部始终先替换最高值卡，数值相同则最低 `card_id` 优先。

若剩余菜不足以使任何患者达标，也要按上述原则用完剩余代币。最后一颗菜的替换仍然有效。

## 13.5 菜地耗尽

菜地从正数降至0时：

- 完成本轮所有已发生动作和计分；
- 记录最终状态；
- 不开始下一轮；
- 不再进行无实际意义的移动或下一轮事件；
- 游戏进入 `GAME_OVER`。

---

# 14. 每轮完整状态机

```text
1. ROLE_ASSIGNMENT
   assign active, assistant, patient_1, patient_2

2. DEAL
   deal 3 cards to each role

3. INITIAL_ASSESSMENT
   calculate both patient totals and excess values

4. ACTIVE_RESCUE
   select strict target
   execute at most one legal swap
   award 1 or 0

5. ASSISTANT_RESCUE
   recalculate strict target from current state
   execute at most one legal swap
   award 1 or 0

6. PATIENT_SWAP
   if any patient fails:
       execute zero or one canonical patient swap
       award 0, 1 each, or 2 each
   else:
       skip and award 0 each

7. VEGETABLE_RESOLUTION
   replace cards with temporary 0s as required/possible
   award no points

8. SCORE_COMMIT
   add staged points to separate score fields

9. DISCARD
   all main-deck cards used this round go to discard
   temporary vegetable cards leave play

10. END_CHECK
   if vegetable_tokens == 0:
       GAME_OVER
   else:
       rotate active seat and increment round number
```

任何实现都不得把患者互助放到助理之前，也不得在菜地自救后再补算患者互助分。

---

# 15. 计分、榜单与平局

## 15.1 分项记录

每位玩家必须分别记录：

- `nutritionist_points`：当班或助理成功救援所得；
- `patient_mutual_aid_points`：作为患者互助所得；
- `total_points`：两者之和。

## 15.2 推荐奖项

- **营养师之王：** `nutritionist_points`最高者；
- **互救之星：** `patient_mutual_aid_points`最高者；
- **综合得分：** 可显示，但不是必须的唯一冠军。

## 15.3 平局

任何榜单并列最高时：

- 所有并列者共同获奖；
- 不按菜地使用、座位、最后得分时间或随机骰子破平。

若产品后续需要单一赢家，必须另行批准破平规则。

---

# 16. 全部主要边界情况

## 16.1 两名患者发牌后均达标

- 当班跳过；
- 助理跳过；
- 患者互助跳过；
- 不摘菜；
- 四人本轮均0分。

## 16.2 只有一名患者超标

- 该患者是两次营养师阶段的唯一可能目标；
- 当班若救成功，助理跳过；
- 当班若失败，助理尝试；
- 两者均失败才进入患者互助。

## 16.3 两名患者都超标

- 每个营养师阶段重新选当前最危险者；
- 不能救最危险者时不得转救另一位；
- 当班救完后，助理必须根据新状态重新排序，而不是沿用旧目标。

## 16.4 危险度相同

`patient_1`是唯一目标。不得随机选择。

## 16.5 营养师会因换牌严重“超标”

不影响动作。V2没有营养师范围检查。

## 16.6 营养师存在多个合法换牌

实体玩家选择；Codex标准执行使用第11节策略。

## 16.7 患者互换后只救到一人

两名患者均得1分，而不是只有获救者得分。

## 16.8 患者互换后无人达标，但可减少菜地消耗

标准AI可以执行该交换，因为资源消耗排序高于“无意义不换”。得分仍为0。

## 16.9 菜地正好用完

最后一次替换有效；本轮分数有效；本轮后结束。

## 16.10 菜地不足以满足全部需求

按第13.4节分配，不得产生负数代币。

## 16.11 主牌堆不足

紧急重洗弃牌；临时菜卡不得进入主牌。

## 16.12 玩家断线或放弃操作

数字版建议：

- 超时后由标准AI接管当前动作；
- 不得自动判定玩家故意放弃合法得分，除非房间配置允许 `ALLOW_PASS_WITH_LEGAL_ACTION`；
-接管必须写入日志。

## 16.13 输入非法卡值

出现非 `0,1,2,3,5,7,9` 主牌值必须拒绝载入，而不是四舍五入或转换。

## 16.14 阈值非法

阈值必须为非负整数。V2官方统计只使用10。

---

# 17. 事件扩展接口

V2基础版不启用事件，但引擎应预留：

```text
before_deal(game_state)
after_deal_before_assessment(game_state)
before_active_rescue(game_state)
after_round(game_state)
```

事件设计原则：

- 阈值变化必须在发牌或初始判断前锁定；
- 强制加入食物卡应在初始判断前完成；
- 菜地增减可即时执行；
- 持续事件必须记录剩余轮数；
- 同一阶段多个事件的顺序必须在未来事件规格中明确。

当前实现可建立以下名称占位，但必须保持禁用：

```text
COLD
FOLLOW_UP_VISIT
PARTY_CAKE
SNACK_SHARING
SUPERMARKET_RESTOCK
MENU_UPDATE
STORM
RAIN
NUTRITIONIST_TRAINING
TRAVEL_MODE
```

---

# 18. 参考平衡数据

## 18.1 模拟方法

以下数据由随包提供的 `reference_simulator.py` 产生。该脚本是合法动作、计分、策略和菜地需求的参考模拟器；完整产品仍须依照第13.4节实现菜地不足时的逐卡分配和卡片ID日志：

- 独立基础轮数：500,000；
- 随机种子：`20260716`；
- 事件：关闭；
- 患者阈值：10；
- 牌堆：V2 48张配比；
- 策略：`CANONICAL_COOPERATIVE_POLICY_V2`；
- 抽样：每轮从完整48张随机牌堆取前12张；
- 95%区间：二项近似；患者期望分使用样本二阶矩。

模拟值不是数学常数。若改变阈值、牌堆、优先目标、策略或事件，必须重新模拟。

## 18.2 各角色得分率

| 角色/结果 | 概率或期望 | 95%区间 |
|---|---:|---:|
| 当班营养师本轮得1分 | 50.6494% | 50.5108%–50.7880% |
| 助理本轮得1分 | 28.8134% | 28.6879%–28.9389% |
| 患者本轮得0分 | 76.1116% | — |
| 患者本轮得1分 | 22.5522% | — |
| 患者本轮得2分 | 1.3362% | — |
| 患者本轮获得任意分 | 23.8884% | — |
| 患者每人每患者轮期望分 | 0.252246 | 0.250960–0.253532 |

患者两人的分数在同一轮相同，因此上表既适用于patient_1，也适用于patient_2。

## 18.3 四轮角色周期

每位玩家四轮中经历：1次当班、1次助理、2次患者。因此期望总分：

```text
0.506494 + 0.288134 + 2 × 0.252246 = 1.299120
```

即每位玩家每个完整角色周期期望约1.299分。无事件且随机起始时，四个固定座位长期期望相同。

## 18.4 初始患者状态

| 发牌后状态 | 概率 |
|---|---:|
| 两名患者均达标 | 11.6076% |
| 恰好一名达标 | 47.7662% |
| 两名均未达标 | 40.6262% |

## 18.5 两位营养师联合结果

| 当班 | 助理 | 概率 |
|---:|---:|---:|
| 0 | 0 | 38.7300% |
| 0 | 1 | 10.6206% |
| 1 | 0 | 32.4566% |
| 1 | 1 | 18.1928% |

## 18.6 患者阶段和菜地

- 患者互助阶段触发概率：34.3686%；
- 每轮平均需要菜地代币：0.584218个。

| 本轮需要的菜地代币 | 概率 |
|---:|---:|
| 0 | 66.9676% |
| 1 | 13.5836% |
| 2 | 13.9490% |
| 3 | 5.0590% |
| 4 | 0.4408% |

“患者阶段触发”高于“患者获得任意分”，因为部分互换无法直接获得分数，之后仍需菜地。

## 18.7 完整游戏长度

完整游戏模拟参数：

- 游戏数：30,000；
- 菜地：10；
- 起始当班座位：均匀随机；
- 随机种子：`20260717`；
- 菜地归零后完成当前轮并结束。

结果：

| 指标 | 结果 |
|---|---:|
| 平均轮数 | 17.7023 |
| 中位数 | 17 |
| 10%分位 | 11 |
| 25%分位 | 14 |
| 75%分位 | 21 |
| 90%分位 | 25 |
| 95%分位 | 28 |
| 每局平均总得分 | 23.103 |

固定座位平均得分约为5.763、5.772、5.783、5.785；并列折算后的胜率份额约为24.84%、24.92%、24.98%、25.25%。差异符合模拟误差，未显示实质座位偏差。

---

# 19. 为什么得分率依赖策略

得分率不是只由牌堆决定。以下规则变化会显著改变结果：

- 允许营养师转救较轻患者；
- 当班故意选择会阻断助理的换牌；
- 患者优先节省菜，而不是优先得分；
- 允许已经达标的患者互换刷分；
- 营养师重新要求自己也达标；
- 改变患者阈值；
- 加入事件。

因此每份统计必须附带策略和规则版本。不得只输出“得分率”而没有元数据。

---

# 20. 参考伪代码

```text
function play_round(state):
    assign_roles(state.active_seat)
    deal_three_cards_to_each_role()
    lock_threshold_for_round()

    active_points = rescue_step(ACTIVE)
    assistant_points = rescue_step(ASSISTANT)

    if any_patient_noncompliant():
        patient_points = canonical_patient_swap()
    else:
        patient_points = 0

    vegetables_used = resolve_vegetables()

    commit(active_points, assistant_points, patient_points)
    discard_all_main_cards_used_this_round()
    remove_temporary_vegetable_cards()

    if vegetable_supply == 0:
        end_game_after_current_round()
    else:
        rotate_active_clockwise()
        begin_next_round()
```

```text
function rescue_step(rescuer):
    target = select_strict_target()
    if target is NONE:
        return 0

    legal = all one-for-one swaps where target total after swap <= threshold
    if legal is empty:
        return 0

    action = canonical_choice(legal, rescuer)
    execute(action)
    return 1
```

---

# 21. 必需日志

每局至少记录：

```text
GAME_CREATED
SEED_SET
DECK_SHUFFLED
ROUND_STARTED
ROLES_ASSIGNED
CARDS_DEALT
PATIENT_ASSESSED
STRICT_TARGET_SELECTED
RESCUE_ACTION_EXECUTED | RESCUE_NO_LEGAL_ACTION | RESCUE_SKIPPED_NO_TARGET
PATIENT_SWAP_EXECUTED | PATIENT_SWAP_SKIPPED
VEGETABLE_REPLACEMENT
SCORES_COMMITTED
ROUND_DISCARDED
EMERGENCY_RESHUFFLE
GAME_ENDED
```

每次动作日志至少包括：

- round number；
- phase；
- actor seat and role；
- target seat；
- before hands；
- exchanged card IDs and values；
- after hands；
- threshold；
- score change；
- reason code。

建议错误原因码：

```text
NO_FAILING_PATIENT
NOT_STRICT_TARGET
TARGET_NOT_COMPLIANT_AFTER_SWAP
WRONG_PHASE
ACTION_ALREADY_USED
INVALID_CARD_INDEX
CARD_NOT_OWNED
PATIENT_SWAP_NOT_TRIGGERED
VEGETABLE_SUPPLY_EMPTY
```

---

# 22. API建议

```text
create_game(players, seed?, config?) -> GameState
start_round(game_id) -> RoundView
evaluate_legal_actions(game_id, actor_seat) -> Action[]
submit_action(game_id, actor_seat, action) -> ActionResult
run_canonical_action(game_id) -> ActionResult
resolve_round(game_id) -> RoundResult
simulate_rounds(n, seed, config) -> Statistics
simulate_games(n, seed, config) -> Statistics
replay(log) -> GameState
validate_state(game_state) -> ValidationReport
```

`evaluate_legal_actions`在营养师阶段只能返回严格目标相关动作。前端不得显示“救另一患者”按钮。

---

# 23. 状态不变量

每次状态变更后必须验证：

1. 每位玩家在发牌至弃牌阶段始终有3张逻辑手牌；
2. 主牌ID不能同时存在于两个位置；
3. 主牌总数守恒：抽牌堆+弃牌堆+各手牌+事件区=48；
4. 临时菜卡不计入48；
5. 菜地代币在0到10之间；
6. 分数为非负整数；
7. 患者互助两人的本轮得分相同；
8. 每名营养师单轮得分只能为0或1；
9. 当前阶段只允许相应角色行动；
10. `total_points`等于两个分项之和；
11. 游戏结束后拒绝所有新动作；
12. 同一动作不得重复提交。

---

# 24. 必需单元测试与验收案例

## T01 两患者均达标

```text
active:    [0,3,7]
assistant: [1,5,7]
patient_1: [0,3,7] = 10
patient_2: [1,2,5] = 8
```

期望：所有人0分，菜地0消耗，无换牌。

## T02 当班救援成功，营养师自身状态无关

```text
active:    [0,3,7]
patient_1: [2,7,9] = 18
```

当班可用0换9，使患者变为9。即使当班变为19，动作仍合法，当班+1。

## T03 严格目标禁止转救

```text
active:    [0,7,9]
patient_1: [7,7,9] = 23  (最危险)
patient_2: [2,3,9] = 14
```

当班无法一换一救patient_1；虽然0换patient_2的9可以救patient_2，当班仍必须0分且不得执行该动作。

## T04 危险度相同

两患者超标值相同，唯一目标必须是patient_1。

## T05 当班救一人，助理重算并救另一人

```text
active:    [0,7,9]
assistant: [1,7,9]
patient_1: [2,7,9] = 18
patient_2: [3,5,7] = 15
```

期望：当班以0换patient_1的9，使patient_1变为9并得1分；助理随后重新计算目标，以1换patient_2的7，使patient_2变为9并得1分。最终两患者均达标。

## T06 当班救完两患者都达标

助理阶段必须跳过，不能换牌得分。

## T07 患者双达标+2

患者阶段状态：

```text
patient_1: [0,1,2] = 3
patient_2: [1,3,7] = 11
```

交换patient_1的0与patient_2的7后：10和4，两人各+2。

## T08 患者单达标+1

患者阶段状态：

```text
patient_1: [1,3,9] = 13
patient_2: [2,5,7] = 14
```

两人合计27，因此不可能同时降至10以内。交换patient_1的9与patient_2的5后，patient_1为9并达标，patient_2为18且仍未达标；两名患者必须各+1。

## T09 已达标禁止刷分

两营养师结束后两患者均达标，患者互换API必须返回 `PATIENT_SWAP_NOT_TRIGGERED`。

## T10 摘菜一次

`[3,7,9] -> [3,7,0]`，消耗1菜，得0分。

## T11 摘菜两次

`[7,7,9] -> [7,7,0] -> [7,0,0]`，消耗2菜。

## T12 菜地不足

剩1颗菜但需求2颗：不得出现负数；最后一次替换有效；本轮后游戏结束。

## T13 四轮重洗

无事件连续4轮后，主牌弃牌应为48；下一轮前重洗并清空弃牌。

## T14 分数分项

当玩家作为助理得1分，只增加 `nutritionist_points`和`total_points`。

## T15 游戏结束后动作

进入 `GAME_OVER`后，任何 `submit_action`必须失败且状态不变。

## T16 模拟回归

运行：

```bash
python reference_simulator.py --self-test
python reference_simulator.py --rounds 500000 --seed 20260716
python reference_simulator.py --games 30000 --seed 20260717
```

结果允许因语言PRNG实现不同产生小幅差异，但若复用随包Python脚本，输出必须与随包JSON完全一致。其他实现建议满足：

- 当班得分率：50.3%–51.0%；
- 助理得分率：28.5%–29.2%；
- 患者每患者轮期望分：0.248–0.257；
- 平均菜地消耗：0.57–0.60/轮。

超出范围通常说明规则实现错误或策略不一致。

---

# 25. 集成验收标准

Codex交付的实现只有同时满足以下条件才算通过：

- 所有T01–T16通过；
- 配置文件可加载并验证；
- 模拟可传入随机种子；
- 日志可重放得到相同最终状态；
- 严格目标规则不可被UI绕过；
- 菜卡不污染48张主牌；
- 分项得分正确；
- 事件默认关闭；
- 500,000轮回归统计落入指定范围；
- 程序说明明确声明模拟策略。

---

# 26. 随包文件

```text
Chews_Freedom_V2_Codex_Spec.md    本规范
chews_freedom_v2_config.json      机器可读默认配置
reference_simulator.py            可执行参考规则与模拟器
round_stats.json                  500,000轮参考结果
game_stats.json                   30,000局参考结果
Chews_Freedom_V2_Codex_Spec.docx  人类阅读版
```

---

# 27. 版本变更原则

任何会影响合法动作或得分概率的修改必须提升规格版本，并重新生成统计。包括但不限于：

- 牌堆数量或比例；
- 患者阈值；
- 营养师是否检查自己；
- 是否允许转救；
- 患者刷分触发条件；
- 菜地数量；
- 计分值；
- 标准AI排序；
- 事件数值。

建议使用语义版本：

```text
major.minor-implementation_revision
```

例如：

- `2.0-codex-1`：当前基准；
- `2.1-codex-1`：加入已批准事件但不破坏基础动作；
- `3.0-codex-1`：修改核心救援或计分。

