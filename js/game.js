'use strict';

(() => {
  // ---------------------------------------------------------------------------
  // Core constants and helpers
  // ---------------------------------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const dist2 = (x1, y1, x2, y2) => (x1 - x2) ** 2 + (y1 - y2) ** 2;
  const TAU = Math.PI * 2;
  const AUTO_LOCK_CONE = Math.PI * 0.42;
  const VISION_RADIUS = 360;
  const REVEAL_RADIUS_TILES = 8;

  const TILE = 32;
  const MAP_W = 72;
  const MAP_H = 54;
  const VIEW_W = 960;
  const VIEW_H = 600;
  const MAP_PW = MAP_W * TILE;
  const MAP_PH = MAP_H * TILE;
  const SAVE_KEY = 'pixel_extract_save_v1';

  // Collector room: donate collectible boss materials for permanent bonuses.
  const COLLECTOR_TIERS = [
    { need: 1, label: '搜索速度 +8%', key: 'searchSpeed', value: 0.08 },
    { need: 2, label: '攻击力 +1', key: 'flatDamage', value: 1 },
    { need: 3, label: '攻击力 +1.5%', key: 'damage', value: 0.015 },
    { need: 4, label: '最大生命 +5', key: 'maxHp', value: 5 },
    { need: 5, label: '移动速度 +1%', key: 'moveSpeed', value: 0.01 },
    { need: 6, label: '暴击率 +1%', key: 'crit', value: 0.01 },
    { need: 7, label: '废料收益 +5%', key: 'scrap', value: 0.05 },
    { need: 8, label: '改装零件掉落 +8%', key: 'partDrop', value: 0.08 }
  ];

  // Daily contracts: three seeded goals per local day, ticked at raid settlement.
  const DAILY_BONUS = { scrap: 160, parts: 2 };
  const DAILY_DEFS = [
    { id: 'kills', label: '清剿', mode: 'sum', targets: [8, 12, 16], text: (n) => `累计击倒 ${n} 名敌人`, reward: { scrap: 80, parts: 1 } },
    { id: 'containers', label: '搜刮', mode: 'sum', targets: [6, 9, 12], text: (n) => `累计搜刮 ${n} 个补给箱`, reward: { scrap: 70, parts: 1 } },
    { id: 'extracts', label: '撤离', mode: 'sum', targets: [1, 2], text: (n) => `成功撤离 ${n} 次`, reward: { scrap: 90, parts: 1 } },
    { id: 'objectives', label: '目标', mode: 'sum', targets: [1, 2, 3], text: (n) => `完成 ${n} 个房间目标`, reward: { scrap: 80, parts: 1 } },
    { id: 'elites', label: '精英', mode: 'sum', targets: [1, 2], text: (n) => `击倒 ${n} 名精英敌人`, reward: { scrap: 100, parts: 1 } },
    { id: 'bosses', label: '首领', mode: 'sum', targets: [1], text: (n) => `击倒 ${n} 名首领`, reward: { scrap: 120, parts: 2 } },
    { id: 'depth', label: '深入', mode: 'max', targets: [5, 8], text: (n) => `单局撤离到 F${n} 层`, reward: { scrap: 110, parts: 1 } },
    { id: 'damage', label: '火力', mode: 'max', targets: [1500, 2500, 4000], text: (n) => `单局造成 ${n} 点伤害`, reward: { scrap: 80, parts: 1 } }
  ];

  let uidCounter = 0;
  function uid() {
    uidCounter += 1;
    return `${Date.now().toString(36)}-${uidCounter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // ---------------------------------------------------------------------------
  // Item and combat definitions
  // ---------------------------------------------------------------------------
  const WEAPON_DEFS = {
    pistol: {
      name: '旧式手枪', code: 'PISTOL', damage: 24, cooldown: 0.27, mag: 12,
      reload: 1.1, spread: 0.035, speed: 980, range: 650, auto: false,
      reserve: 84, color: '#d9c47e', desc: '可靠、省弹，但近距离压制力一般。'
    },
    smg: {
      name: '蜂鸣冲锋枪', code: 'SMG-9', damage: 15, cooldown: 0.085, mag: 30,
      reload: 1.45, spread: 0.072, speed: 900, range: 560, auto: true,
      reserve: 150, color: '#67d7ff', desc: '高射速全自动武器，适合近距离缠斗。'
    },
    rifle: {
      name: '荒原步枪', code: 'R-47', damage: 36, cooldown: 0.19, mag: 20,
      reload: 1.7, spread: 0.027, speed: 1150, range: 820, auto: true,
      reserve: 120, color: '#ffac5a', desc: '伤害高、弹道稳，但后坐节奏需要适应。'
    },
    dmr: {
      name: '长视者 DMR', code: 'DMR-12', damage: 58, cooldown: 0.52, mag: 8,
      reload: 2.0, spread: 0.008, speed: 1400, range: 1100, auto: false,
      reserve: 64, color: '#c49cff', desc: '精准步枪，远距离非常致命；触屏下同样自动连射。'
    },
    shotgun: {
      name: '破门霰弹枪', code: 'SG-12', damage: 16, cooldown: 0.72, mag: 5,
      reload: 2.2, spread: 0.14, speed: 820, range: 340, auto: false,
      reserve: 36, color: '#ffb35c', pellets: 6, shake: 6,
      desc: '一次发射 6 枚弹丸，近距离爆发极高。'
    },
    lmg: {
      name: '铁皮轻机枪', code: 'LMG-60', damage: 18, cooldown: 0.105, mag: 60,
      reload: 3.1, spread: 0.11, speed: 900, range: 650, auto: true,
      reserve: 180, color: '#ff7b68', shake: 2.8,
      desc: '60 发弹链持续压制，换弹很慢但火力凶猛。'
    },
    rail: {
      name: '磁轨手枪', code: 'RAIL-5', damage: 72, cooldown: 0.85, mag: 5,
      reload: 1.8, spread: 0.006, speed: 1600, range: 1150, auto: false,
      reserve: 30, color: '#b98cff', shake: 5.5,
      desc: '实验型磁轨武器，单发伤害极高，备弹稀少。'
    },
    boss: {
      name: '终焉协议', code: 'BOSS-01', damage: 30, cooldown: 0.27, mag: 24,
      reload: 2.1, spread: 0.04, speed: 1250, range: 900, auto: true,
      reserve: 144, color: '#ff4d8d', pellets: 2, shake: 4.2, bossWeapon: true,
      desc: '首领专属双管能量步枪。每次发射 2 枚高能弹丸。'
    },
    plasma: {
      name: '等离子步枪', code: 'PLASMA-30', damage: 26, cooldown: 0.13, mag: 30,
      reload: 2.3, spread: 0.055, speed: 1180, range: 820, auto: true,
      reserve: 180, color: '#7ef0ff', shake: 2.2,
      desc: '高频能量弹，弹匣大、后坐小，持续输出极高。'
    },
    annihilator: {
      name: '湮灭者', code: 'ANN-4', damage: 108, cooldown: 1.0, mag: 4,
      reload: 2.7, spread: 0.008, speed: 1750, range: 1250, auto: false,
      reserve: 28, color: '#ffd15c', shake: 7,
      desc: '单发重炮，贯穿力极强，命中首领时会撕开防御。'
    },
    quake: {
      name: '裂地炮', code: 'INT-90', damage: 26, cooldown: 0.9, mag: 6,
      reload: 2.5, spread: 0.16, speed: 850, range: 380, auto: false,
      reserve: 36, color: '#ff9c47', pellets: 5, shake: 6.5,
      desc: '泰坦的霰射主炮，五枚弹丸一次糊脸。'
    },
    prism: {
      name: '棱镜步枪', code: 'PRISM-7', damage: 22, cooldown: 0.14, mag: 27,
      reload: 2.2, spread: 0.055, speed: 1300, range: 820, auto: true,
      reserve: 135, color: '#c084ff', shake: 2.4,
      desc: '赛琳的棱镜武器，弹道又快又直，中距离压场。'
    },
    flame: {
      name: '熔核喷射器', code: 'HF-13', damage: 12, cooldown: 0.06, mag: 80,
      reload: 3.0, spread: 0.18, speed: 520, range: 260, auto: true,
      reserve: 240, color: '#ff7a45', shake: 1.2,
      desc: '赫菲的熔核喷嘴，贴脸喷射成片火舌。'
    },
    gravity: {
      name: '引力枪', code: 'OMEGA-Ω', damage: 34, cooldown: 0.34, mag: 10,
      reload: 2.0, spread: 0.02, speed: 1500, range: 1000, auto: false,
      reserve: 60, color: '#58a6ff', shake: 3.4,
      desc: 'Ω 的引力武器，弹道笔直穿透，后坐干净。'
    },
    phase: {
      name: '相位刃枪', code: 'NX-9', damage: 16, cooldown: 0.09, mag: 36,
      reload: 1.8, spread: 0.07, speed: 1100, range: 620, auto: true,
      reserve: 180, color: '#7ee8d2', shake: 1.6,
      desc: '诺克斯的相位连射枪，射速极高、换弹极快。'
    },
    array: {
      name: '终焉阵列炮', code: 'ARK-∞', damage: 120, cooldown: 1.15, mag: 3,
      reload: 2.8, spread: 0.01, speed: 1800, range: 1300, auto: false,
      reserve: 18, color: '#d6ff4d', shake: 7.5,
      desc: '阿基拉的阵列主炮，单发贯穿一整条走廊。'
    }
  };

  const ARMOR_DEFS = {
    none: { name: '无护甲', reduction: 0, color: '#778399', desc: '没有任何伤害减免。' },
    light: { name: '轻型护甲', reduction: 0.12, color: '#7ed7a0', desc: '减少 12% 受到的伤害。' },
    heavy: { name: '重型护甲', reduction: 0.26, color: '#ffbd63', desc: '减少 26% 受到的伤害，但比较笨重。' },
    riot: { name: '反应装甲', reduction: 0.38, color: '#c59cff', desc: '减少 38% 受到的伤害。' },
    scout: { name: '侦察背心', reduction: 0.08, speedBonus: 0.12, color: '#7ee8d2', desc: '减少 8% 伤害，移动速度 +12%。' },
    medic: { name: '战地医疗甲', reduction: 0.16, medkitBonus: 1, color: '#79f0a3', desc: '减少 16% 伤害，每次行动额外携带 1 个医疗包。' },
    ghost: { name: '幽灵纤维甲', reduction: 0.22, speedBonus: 0.04, stealth: 0.72, color: '#a98cff', desc: '减少 22% 伤害，移速 +4%，敌人视野降低 28%。' },
    phase: { name: '相位护甲', reduction: 0.32, stealth: 0.84, color: '#7ef0ff', desc: '减少 32% 伤害，敌人视野降低 16%。' }
  };

  const MAX_ENHANCE = 10;
  // Minimum stone tier per target level (1 = white ... 5 = red, 6 = rainbow always allowed).
  const ENHANCE_MIN_STONE = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 3, 7: 3, 8: 4, 9: 4, 10: 5 };
  const ENHANCE_DECAY = 0.03;
  const ENHANCE_LUCK_STEP = 10;
  const STONE_CHAIN = {
    stone_white: 'stone_green',
    stone_green: 'stone_blue',
    stone_blue: 'stone_purple',
    stone_purple: 'stone_red'
  };
  const STONE_TIER_LABEL = { 1: '白色', 2: '绿色', 3: '蓝色', 4: '紫色', 5: '红色', 6: '彩色' };
  const TRANSCEND_BASE_COST = 1000;
  const TRANSCEND_COST_MULT = 1.25;
  const TRANSCEND_RULES = {
    hp: 10,
    damage: 0.02,
    reduction: 0.01,
    speed: 0.01
  };
  const ENHANCE_RULES = {
    weapon: { perLevel: 0.05, label: '伤害' },
    armor: { perLevel: 0.015, label: '减伤' },
    pack: { perLevel: 1, label: '容量' }
  };

  const PACK_QUALITIES = {
    white: { label: '白色', color: '#e8edf2', bonus: 8, desc: '基础背包装备，提供 8 个额外物资格。' },
    green: { label: '绿色', color: '#6fe29a', bonus: 16, desc: '加固背包装备，提供 16 个额外物资格。' },
    blue: { label: '蓝色', color: '#58a6ff', bonus: 24, desc: '战术背包装备，提供 24 个额外物资格。' },
    purple: { label: '紫色', color: '#c084ff', bonus: 32, desc: '模块化背包装备，提供 32 个额外物资格。' },
    red: { label: '红色', color: '#ff536b', bonus: 40, desc: '重装背包装备，提供 40 个额外物资格。' },
    rainbow: { label: '彩色', color: '#ffd15c', bonus: 50, desc: '虹彩背包装备，提供 50 个额外物资格。' }
  };

  const CHARACTER_DEFS = {
    pioneer: {
      id: 'pioneer', name: '开拓者', code: 'PIONEER', role: '初始角色 / 生存自愈', color: '#d6ff4d',
      skill: { type: 'heal', name: '应急治疗', short: '治疗', cd: 10, desc: '立即恢复 10% 最大生命值。生命值已满时不会进入冷却。' },
      passive: { name: '求生本能', desc: '生命值低于 35% 时，受到的伤害降低 20%。' }
    },
    sniper: {
      id: 'sniper', name: '狙击兵', code: 'SNIPER', role: '远程 / 穿透', color: '#58c7ff',
      skill: { type: 'snipe', name: '猎杀协议', short: '猎杀', cd: 12, desc: '锁定一名可见敌人；1.5 秒后发射一枚造成 7 倍武器伤害的狙击弹，无视防御与墙体。' },
      passive: { name: '贯穿弹', desc: '你的所有子弹都可以穿透敌人，不会在命中首个目标后消失。' }
    },
    assault: {
      id: 'assault', name: '突击兵', code: 'ASSAULT', role: '爆发 / 射速', color: '#ff9c47',
      skill: { type: 'overdrive', name: '火力过载', short: '过载', cd: 16, desc: '4 秒内射速提高 45%。' },
      passive: { name: '快速换弹', desc: '换弹时间减少 20%。' }
    },
    juggernaut: {
      id: 'juggernaut', name: '重装兵', code: 'JUGGER', role: '防御 / 护盾', color: '#c59cff',
      skill: { type: 'shield', name: '应急护盾', short: '护盾', cd: 18, desc: '获得 60 点护盾，持续 8 秒；护盾会优先吸收伤害。' },
      passive: { name: '重型装甲', desc: '受到的伤害降低 12%。' }
    }
  };
  const CHARACTER_IDS = Object.keys(CHARACTER_DEFS);
  function currentCharacterDef() {
    return CHARACTER_DEFS[save.character] || CHARACTER_DEFS.pioneer;
  }

  const AFFIX_DEFS = {
    damage: { slot: 'weapon', name: '伤害校准', min: 0.06, max: 0.14, format: (v) => `伤害 +${Math.round(v * 100)}%` },
    fireRate: { slot: 'weapon', name: '高速循环', min: 0.06, max: 0.14, format: (v) => `射速 +${Math.round(v * 100)}%` },
    crit: { slot: 'weapon', name: '致命弱点', min: 0.05, max: 0.12, format: (v) => `暴击 +${Math.round(v * 100)}%` },
    pierce: { slot: 'weapon', name: '贯穿弹头', fixed: 1, format: () => '子弹穿透敌人' },
    antiBoss: { slot: 'weapon', name: '屠戮协议', min: 0.10, max: 0.20, format: (v) => `对首领伤害 +${Math.round(v * 100)}%` },
    lifesteal: { slot: 'weapon', name: '吸血弹头', min: 0.02, max: 0.04, format: (v) => `伤害吸血 ${Math.round(v * 100)}%` },
    defense: { slot: 'armor', name: '复合衬层', min: 0.03, max: 0.06, format: (v) => `伤害减免 +${Math.round(v * 100)}%` },
    moveSpeed: { slot: 'armor', name: '轻量骨架', min: 0.04, max: 0.08, format: (v) => `移速 +${Math.round(v * 100)}%` },
    dashCd: { slot: 'armor', name: '冲刺电容', min: 0.3, max: 0.8, format: (v) => `冲刺 CD -${v.toFixed(1)}s` },
    capacity: { slot: 'pack', name: '扩容模块', min: 2, max: 5, format: (v) => `容量 +${Math.round(v)}` },
    scrap: { slot: 'pack', name: '回收协议', min: 0.08, max: 0.18, format: (v) => `废料 +${Math.round(v * 100)}%` }
  };
  const AFFIX_KEYS = Object.keys(AFFIX_DEFS);

  const SET_DEFS = {
    raider: {
      name: '荒原猎手', color: '#ffb35c',
      bonuses: { 2: { damage: 0.08 }, 3: { crit: 0.10 } }
    },
    bulwark: {
      name: '壁垒协议', color: '#58a6ff',
      bonuses: { 2: { defense: 0.06 }, 3: { maxHp: 20 } }
    },
    specter: {
      name: '幽灵协议', color: '#a98cff',
      bonuses: { 2: { moveSpeed: 0.08 }, 3: { dashCd: 1.0 } }
    }
  };
  const SET_IDS = Object.keys(SET_DEFS);

  const ITEM_DEFS = {
    w_pistol: { name: '旧式手枪', icon: '▰', kind: 'weapon', weapon: 'pistol', rarity: 'common', sell: 28, stack: false, desc: '标配副武器。伤害 24，弹匣 12 发。' },
    w_smg: { name: '蜂鸣冲锋枪', icon: '⌁', kind: 'weapon', weapon: 'smg', rarity: 'uncommon', sell: 95, stack: false, desc: '全自动冲锋枪。伤害 15，弹匣 30 发。' },
    w_rifle: { name: '荒原步枪', icon: '╾', kind: 'weapon', weapon: 'rifle', rarity: 'rare', sell: 220, stack: false, desc: '高伤害自动步枪。伤害 36，弹匣 20 发。' },
    w_dmr: { name: '长视者 DMR', icon: '⌖', kind: 'weapon', weapon: 'dmr', rarity: 'epic', sell: 390, stack: false, desc: '精准半自动步枪。伤害 58，弹匣 8 发。' },
    w_shotgun: { name: '破门霰弹枪', icon: '≋', kind: 'weapon', weapon: 'shotgun', rarity: 'rare', sell: 150, stack: false, desc: '近距离发射 6 枚弹丸，爆发极高。' },
    w_lmg: { name: '铁皮轻机枪', icon: '▦', kind: 'weapon', weapon: 'lmg', rarity: 'rare', sell: 270, stack: false, desc: '60 发弹链，持续压制力极强。' },
    w_rail: { name: '磁轨手枪', icon: 'ϟ', kind: 'weapon', weapon: 'rail', rarity: 'epic', sell: 460, stack: false, desc: '高伤害实验武器，备弹稀少。' },
    w_boss: { name: '终焉协议', icon: '✦', kind: 'weapon', weapon: 'boss', rarity: 'legendary', sell: 900, stack: false, boss: true, desc: '首领专属双管能量步枪。每次发射 2 枚高能弹丸，无法从黑市购买。' },
    w_plasma: { name: '等离子步枪', icon: '⌁', kind: 'weapon', weapon: 'plasma', rarity: 'legendary', sell: 620, stack: false, desc: '高频能量步枪，弹道笔直、压制力极强。' },
    w_annihilator: { name: '湮灭者', icon: '⌾', kind: 'weapon', weapon: 'annihilator', rarity: 'legendary', sell: 780, stack: false, desc: '单发重炮，几乎无视护甲，专门对付首领与重装。' },
    a_phase: { name: '相位护甲', icon: '◈', kind: 'armor', armor: 'phase', rarity: 'legendary', sell: 500, stack: false, desc: '减伤 32%，受击后敌人视野短暂降低。' },
    w_quake: { name: '裂地炮', icon: '≋', kind: 'weapon', weapon: 'quake', rarity: 'legendary', sell: 700, stack: false, boss: true, desc: '泰坦的霰射主炮，五枚弹丸一次糊脸。' },
    w_prism: { name: '棱镜步枪', icon: '✦', kind: 'weapon', weapon: 'prism', rarity: 'legendary', sell: 720, stack: false, boss: true, desc: '赛琳的棱镜武器，弹道又快又直。' },
    w_flame: { name: '熔核喷射器', icon: '⌁', kind: 'weapon', weapon: 'flame', rarity: 'legendary', sell: 680, stack: false, boss: true, desc: '赫菲的熔核喷嘴，贴脸喷射成片火舌。' },
    w_gravity: { name: '引力枪', icon: '⌾', kind: 'weapon', weapon: 'gravity', rarity: 'legendary', sell: 740, stack: false, boss: true, desc: 'Ω 的引力武器，弹道笔直穿透。' },
    w_phase: { name: '相位刃枪', icon: '⌁', kind: 'weapon', weapon: 'phase', rarity: 'legendary', sell: 700, stack: false, boss: true, desc: '诺克斯的相位连射枪，射速极高。' },
    w_array: { name: '终焉阵列炮', icon: '⌖', kind: 'weapon', weapon: 'array', rarity: 'legendary', sell: 820, stack: false, boss: true, desc: '阿基拉的阵列主炮，单发贯穿一整条走廊。' },
    mat_titan: { name: '泰坦合金', icon: '▣', kind: 'collectible', rarity: 'legendary', sell: 180, stack: true, desc: '从裂地重装身上剥下的合金骨架，收藏室会收。' },
    mat_prism: { name: '棱镜碎片', icon: '◆', kind: 'collectible', rarity: 'legendary', sell: 180, stack: true, desc: '赛琳崩解后留下的棱镜残片。' },
    mat_magma: { name: '熔渣核心', icon: '◉', kind: 'collectible', rarity: 'legendary', sell: 180, stack: true, desc: '赫菲体内还在微微发烫的核心。' },
    mat_void: { name: '虚空残片', icon: '◌', kind: 'collectible', rarity: 'legendary', sell: 180, stack: true, desc: 'Ω 坍缩后留下的虚空碎片。' },
    mat_phase: { name: '相位碎片', icon: '◇', kind: 'collectible', rarity: 'legendary', sell: 180, stack: true, desc: '诺克斯闪现时遗落的相位结晶。' },
    mat_arch: { name: '终焉核心', icon: '✺', kind: 'collectible', rarity: 'legendary', sell: 180, stack: true, desc: '阿基拉阵列主炮的核心单元。' },
    a_light: { name: '轻型护甲', icon: '▤', kind: 'armor', armor: 'light', rarity: 'uncommon', sell: 55, stack: false, desc: '轻便护甲，减少 12% 伤害。' },
    a_heavy: { name: '重型护甲', icon: '▦', kind: 'armor', armor: 'heavy', rarity: 'rare', sell: 180, stack: false, desc: '厚重护甲，减少 26% 伤害。' },
    a_riot: { name: '反应装甲', icon: '▣', kind: 'armor', armor: 'riot', rarity: 'epic', sell: 360, stack: false, desc: '实验型装甲，减少 38% 伤害。' },
    a_scout: { name: '侦察背心', icon: '◈', kind: 'armor', armor: 'scout', rarity: 'uncommon', sell: 45, stack: false, desc: '减伤 8%，移动速度 +12%。' },
    a_medic: { name: '战地医疗甲', icon: '✚', kind: 'armor', armor: 'medic', rarity: 'rare', sell: 155, stack: false, desc: '减伤 16%，每次行动多带 1 个医疗包。' },
    a_ghost: { name: '幽灵纤维甲', icon: '◌', kind: 'armor', armor: 'ghost', rarity: 'epic', sell: 340, stack: false, desc: '减伤 22%，移速 +4%，敌人视野 -28%。' },
    p_white: { name: '白色背包', icon: '▣', kind: 'pack', pack: 'white', rarity: 'common', sell: 35, stack: false, desc: '白色品质背包装备。容量 +8。' },
    p_green: { name: '绿色背包', icon: '▤', kind: 'pack', pack: 'green', rarity: 'uncommon', sell: 80, stack: false, desc: '绿色品质背包装备。容量 +16。' },
    p_blue: { name: '蓝色背包', icon: '▥', kind: 'pack', pack: 'blue', rarity: 'rare', sell: 180, stack: false, desc: '蓝色品质背包装备。容量 +24。' },
    p_purple: { name: '紫色背包', icon: '▦', kind: 'pack', pack: 'purple', rarity: 'epic', sell: 360, stack: false, desc: '紫色品质背包装备。容量 +32。' },
    p_red: { name: '红色背包', icon: '▧', kind: 'pack', pack: 'red', rarity: 'legendary', sell: 720, stack: false, desc: '红色品质背包装备。容量 +40。' },
    p_rainbow: { name: '彩色背包', icon: '◈', kind: 'pack', pack: 'rainbow', rarity: 'mythic', sell: 1200, stack: false, desc: '彩色品质背包装备。容量 +50。' },
    mod_optic_1: { name: '简易瞄准镜', icon: '◎', kind: 'mod', modSlot: 'optic', rarity: 'common', sell: 45, stack: false, desc: '散射 -10%，射程 +8%。', stat: { spread: -0.1, range: 0.08 } },
    mod_optic_2: { name: '精密瞄准镜', icon: '◉', kind: 'mod', modSlot: 'optic', rarity: 'uncommon', sell: 95, stack: false, desc: '散射 -18%，射程 +15%。', stat: { spread: -0.18, range: 0.15 } },
    mod_optic_3: { name: '战术光学镜', icon: '⌖', kind: 'mod', modSlot: 'optic', rarity: 'rare', sell: 180, stack: false, desc: '散射 -26%，射程 +24%。', stat: { spread: -0.26, range: 0.24 } },
    mod_mag_1: { name: '扩容弹匣', icon: '▤', kind: 'mod', modSlot: 'mag', rarity: 'common', sell: 45, stack: false, desc: '弹匣 +20%，换弹 -5%。', stat: { mag: 0.2, reload: -0.05 } },
    mod_mag_2: { name: '快速弹匣', icon: '▥', kind: 'mod', modSlot: 'mag', rarity: 'uncommon', sell: 95, stack: false, desc: '弹匣 +35%，换弹 -10%。', stat: { mag: 0.35, reload: -0.1 } },
    mod_mag_3: { name: '战术弹鼓', icon: '▦', kind: 'mod', modSlot: 'mag', rarity: 'rare', sell: 180, stack: false, desc: '弹匣 +50%，换弹 -15%。', stat: { mag: 0.5, reload: -0.15 } },
    mod_barrel_1: { name: '加长枪管', icon: '⌐', kind: 'mod', modSlot: 'barrel', rarity: 'common', sell: 45, stack: false, desc: '伤害 +8%。', stat: { damage: 0.08 } },
    mod_barrel_2: { name: '强化枪管', icon: '⌐', kind: 'mod', modSlot: 'barrel', rarity: 'uncommon', sell: 95, stack: false, desc: '伤害 +15%。', stat: { damage: 0.15 } },
    mod_barrel_3: { name: '合金枪管', icon: '⌐', kind: 'mod', modSlot: 'barrel', rarity: 'rare', sell: 180, stack: false, desc: '伤害 +22%。', stat: { damage: 0.22 } },
    stone_white: { name: '白色强化石', icon: '◇', kind: 'stone', stoneLevel: 1, success: 0.30, rarity: 'common', sell: 12, stack: true, desc: '强化石 Lv.1。强化成功概率 30%。' },
    stone_green: { name: '绿色强化石', icon: '◈', kind: 'stone', stoneLevel: 2, success: 0.45, rarity: 'uncommon', sell: 28, stack: true, desc: '强化石 Lv.2。强化成功概率 45%。' },
    stone_blue: { name: '蓝色强化石', icon: '◆', kind: 'stone', stoneLevel: 3, success: 0.60, rarity: 'rare', sell: 65, stack: true, desc: '强化石 Lv.3。强化成功概率 60%。' },
    stone_purple: { name: '紫色强化石', icon: '✦', kind: 'stone', stoneLevel: 4, success: 0.75, rarity: 'epic', sell: 140, stack: true, desc: '强化石 Lv.4。强化成功概率 75%。' },
    stone_red: { name: '红色强化石', icon: '✧', kind: 'stone', stoneLevel: 5, success: 0.90, rarity: 'legendary', sell: 300, stack: true, desc: '强化石 Lv.5。强化成功概率 90%。' },
    stone_rainbow: { name: '彩色强化石', icon: '✺', kind: 'stone', stoneLevel: 6, success: 1.00, rarity: 'mythic', sell: 600, stack: true, desc: '强化石 Lv.6。强化必定成功。' },
    scrap: { name: '机械零件', icon: '⚙', kind: 'loot', rarity: 'common', sell: 4, stack: true, desc: '常见的工业废料，黑市会收。' },
    fiber: { name: '纤维束', icon: '≋', kind: 'loot', rarity: 'common', sell: 6, stack: true, desc: '从废弃织物和线缆中抽出的纤维。' },
    circuit: { name: '废旧电路', icon: '▦', kind: 'loot', rarity: 'common', sell: 9, stack: true, desc: '烧毁的线路板，仍有回收价值。' },
    chip: { name: '数据芯片', icon: '▣', kind: 'loot', rarity: 'uncommon', sell: 16, stack: true, desc: '还能读取的旧世界芯片。' },
    battery: { name: '高能电池', icon: '▮', kind: 'loot', rarity: 'uncommon', sell: 32, stack: true, desc: '鼓包但仍有电的军规电池。' },
    relic: { name: '旧世遗物', icon: '◆', kind: 'loot', rarity: 'rare', sell: 42, stack: true, desc: '收藏家愿意为它付个好价钱。' },
    lens: { name: '光学镜片', icon: '◎', kind: 'loot', rarity: 'rare', sell: 74, stack: true, desc: '从侦察设备上拆下的精密镜片。' },
    drone_core: { name: '无人机核心', icon: '✜', kind: 'loot', rarity: 'rare', sell: 92, stack: true, desc: '坠毁无人机里幸存的导航模块。' },
    medal: { name: '战地勋章', icon: '★', kind: 'loot', rarity: 'rare', sell: 66, stack: true, desc: '旧时代士兵留下的纪念章。' },
    core: { name: '反应核心', icon: '✦', kind: 'loot', rarity: 'epic', sell: 105, stack: true, desc: '从旧设施里拆出的高价值核心。' },
    quantum: { name: '量子存储器', icon: '◈', kind: 'loot', rarity: 'epic', sell: 186, stack: true, desc: '仍在闪烁的量子级数据载体。' },
    phase: { name: '相位遗物', icon: '✧', kind: 'loot', rarity: 'epic', sell: 248, stack: true, desc: '会在观测时轻微偏移的异常造物。' }
  };

  const RARITY_LABEL = { common: '普通', uncommon: '精良', rare: '稀有', epic: '史诗', legendary: '传说', mythic: '神话' };
  const RARITY_ORDER = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
  const RARITY_COLOR = {
    common: '#e8edf2', uncommon: '#6fe29a', rare: '#58a6ff',
    epic: '#c084ff', legendary: '#ff536b', mythic: '#ffd15c'
  };
  const LOOT_RARITY_PROFILES = {
    common: { common: 62, uncommon: 27, rare: 9, epic: 2 },
    rare: { common: 26, uncommon: 34, rare: 29, epic: 11 },
    vault: { common: 0, uncommon: 16, rare: 50, epic: 31, legendary: 3 }
  };
  const LOOT_POOLS = {
    common: ['scrap', 'fiber', 'circuit'],
    uncommon: ['chip', 'battery', 'w_smg', 'a_light', 'a_scout'],
    rare: ['relic', 'lens', 'drone_core', 'medal', 'w_rifle', 'w_shotgun', 'w_lmg', 'a_heavy', 'a_medic'],
    epic: ['core', 'quantum', 'phase', 'w_dmr', 'w_rail', 'a_riot', 'a_ghost'],
    legendary: ['w_plasma', 'w_annihilator', 'a_phase', 'p_red', 'stone_red']
  };
  const STONE_TIER_WEIGHTS = {
    normal: { white: 58, green: 27, blue: 11, purple: 3.2, red: 0.7, rainbow: 0.1 },
    elite: { white: 25, green: 32, blue: 25, purple: 12, red: 4.5, rainbow: 1.5 },
    boss: { white: 0, green: 10, blue: 30, purple: 38, red: 17, rainbow: 5 }
  };
  const PACK_TIER_WEIGHTS = {
    common: { white: 72, green: 22, blue: 5, purple: 0.8, red: 0.15, rainbow: 0.05 },
    rare: { white: 22, green: 38, blue: 28, purple: 9, red: 2.5, rainbow: 0.5 },
    vault: { white: 0, green: 12, blue: 40, purple: 34, red: 11, rainbow: 3 }
  };
  const RISK_DEFS = {
    normal: { label: '普通', hint: '稳定收益', enemyCount: 1, enemyHp: 1, enemyDamage: 1, rareChance: 0.24, color: '#7ed7a0' },
    danger: { label: '危险', hint: '更多敌人 · 更好掉落', enemyCount: 1.35, enemyHp: 1.25, enemyDamage: 1.2, rareChance: 0.42, color: '#ffad45' },
    extreme: { label: '极限', hint: '高压 · 最高收益', enemyCount: 1.75, enemyHp: 1.55, enemyDamage: 1.45, rareChance: 0.6, color: '#ff5b6e' }
  };

  const STAGE_DEFS = [
    {
      id: 'industrial', name: '废弃工业区', tag: '锈蚀厂房',
      floorPalette: ['#26333f', '#2a3a48', '#22303c', '#2d3d4c'],
      wallColor: '#151d26', edgePalette: ['#4a5f7a', '#3a4b62'],
      miniPalette: ['#304052', '#293747'], accent: 'rgba(85,217,255,.055)',
      enemyPool: ['grunt', 'grunt', 'scout', 'sniper', 'heavy']
    },
    {
      id: 'redline', name: '赤色封锁线', tag: '军事检查站',
      floorPalette: ['#3a2730', '#412d35', '#332129', '#46313a'],
      wallColor: '#1d1013', edgePalette: ['#7a4a56', '#56333d'],
      miniPalette: ['#4d303a', '#3b252d'], accent: 'rgba(255,91,110,.06)',
      enemyPool: ['grunt', 'heavy', 'scout', 'bomber', 'sniper']
    },
    {
      id: 'quantum', name: '量子深渊', tag: '失控实验层',
      floorPalette: ['#1e2a4a', '#233154', '#1a2642', '#27365c'],
      wallColor: '#0d1222', edgePalette: ['#41598f', '#2c3f68'],
      miniPalette: ['#2e4068', '#243454'], accent: 'rgba(88,166,255,.07)',
      enemyPool: ['orbiter', 'sniper', 'scout', 'grunt', 'bomber']
    },
    {
      id: 'foundry', name: '熔核铸造厂', tag: '高温禁区',
      floorPalette: ['#3a2c22', '#423327', '#33261e', '#4a3829'],
      wallColor: '#1e130c', edgePalette: ['#7a5535', '#54402a'],
      miniPalette: ['#4d3525', '#3c291b'], accent: 'rgba(255,173,69,.06)',
      enemyPool: ['heavy', 'bomber', 'orbiter', 'grunt', 'scout']
    },
    {
      id: 'void', name: '虚空回廊', tag: '相位裂隙',
      floorPalette: ['#2c2240', '#332748', '#241c36', '#3a2c50'],
      wallColor: '#120d1c', edgePalette: ['#5f4485', '#432f63'],
      miniPalette: ['#3e2e5c', '#2f2346'], accent: 'rgba(192,132,255,.065)',
      enemyPool: ['orbiter', 'sniper', 'bomber', 'heavy', 'scout']
    },
    {
      id: 'citadel', name: '终焉要塞', tag: '最后防线',
      floorPalette: ['#2c3738', '#333e3f', '#263132', '#3a4547'],
      wallColor: '#121718', edgePalette: ['#5d7072', '#40525a'],
      miniPalette: ['#3b494b', '#2c383a'], accent: 'rgba(214,255,77,.045)',
      enemyPool: ['heavy', 'orbiter', 'sniper', 'bomber', 'grunt']
    }
  ];

  const BOSS_VARIANTS = [
    {
      id: 'titan', name: '裂地重装·泰坦', color: '#ff9c47',
      hp: 360, speed: 54, vision: 760, range: 620, damage: 16,
      ringCount: 18, ringWaves: 3, ringSpeed: 330, slamCount: 2, slamRadius: 92,
      signature: { type: 'quake', label: '裂地冲击' },
    },
    {
      id: 'prism', name: '棱镜使徒·赛琳', color: '#c084ff',
      hp: 400, speed: 64, vision: 800, range: 660, damage: 15,
      ringCount: 22, ringWaves: 3, ringSpeed: 350, slamCount: 2, slamRadius: 100,
      signature: { type: 'prism', label: '棱镜审判' },
    },
    {
      id: 'tyrant', name: '熔核暴君·赫菲', color: '#ff536b',
      hp: 450, speed: 58, vision: 820, range: 680, damage: 17,
      ringCount: 26, ringWaves: 4, ringSpeed: 370, slamCount: 3, slamRadius: 104,
      signature: { type: 'lava', label: '熔核喷发' },
    },
    {
      id: 'omega', name: '虚空终端·Ω', color: '#58a6ff',
      hp: 510, speed: 70, vision: 860, range: 720, damage: 18,
      ringCount: 30, ringWaves: 4, ringSpeed: 390, slamCount: 3, slamRadius: 112,
      signature: { type: 'gravity', label: '引力坍缩' },
    },
    {
      id: 'wraith', name: '相位猎手·诺克斯', color: '#7ee8d2',
      hp: 550, speed: 78, vision: 880, range: 730, damage: 18,
      ringCount: 28, ringWaves: 4, ringSpeed: 410, slamCount: 3, slamRadius: 108,
      signature: { type: 'blink', label: '相位突袭' },
    },
    {
      id: 'architect', name: '终焉构装·阿基拉', color: '#d6ff4d',
      hp: 600, speed: 62, vision: 900, range: 750, damage: 20,
      ringCount: 32, ringWaves: 4, ringSpeed: 400, slamCount: 3, slamRadius: 118,
      signature: { type: 'array', label: '终焉阵列' }
    }
  ];

  // Each boss drops its own legendary weapon plus a collectible material.
  const BOSS_DROPS = {
    titan: { weapon: 'w_quake', material: 'mat_titan' },
    prism: { weapon: 'w_prism', material: 'mat_prism' },
    tyrant: { weapon: 'w_flame', material: 'mat_magma' },
    omega: { weapon: 'w_gravity', material: 'mat_void' },
    wraith: { weapon: 'w_phase', material: 'mat_phase' },
    architect: { weapon: 'w_array', material: 'mat_arch' }
  };

  const ELITE_AFFIX_DEFS = [
    { id: 'swift', name: '迅捷', color: '#7ee8d2', desc: '移动速度 +30%' },
    { id: 'armored', name: '重甲', color: '#8fc8ff', desc: '伤害减免 +15%' },
    { id: 'frenzied', name: '狂化', color: '#ff7585', desc: '攻击更快、伤害更高' },
    { id: 'volatile', name: '爆裂', color: '#ffad45', desc: '死亡时引发爆炸' },
    { id: 'regenerating', name: '再生', color: '#85e89d', desc: '持续恢复生命' }
  ];

  function applyEliteAffix(enemy, forcedId = null) {
    if (!enemy || enemy.isBoss) return;
    const def = ELITE_AFFIX_DEFS.find((entry) => entry.id === forcedId)
      || pick(ELITE_AFFIX_DEFS.filter((entry) => entry.id !== enemy.eliteAffix));
    enemy.elite = true;
    enemy.eliteAffix = def.id;
    enemy.eliteLabel = def.name;
    enemy.name = `${def.name}·${enemy.name}`;
    enemy.color = def.color;
    enemy.xp = Math.round(enemy.xp * 1.35);
    enemy.scrap = Math.round(enemy.scrap * 1.35);
    if (def.id === 'swift') {
      enemy.speed *= 1.3;
    } else if (def.id === 'armored') {
      enemy.defense = Math.min(0.6, (enemy.defense || 0) + 0.15);
      enemy.speed *= 0.9;
    } else if (def.id === 'frenzied') {
      enemy.speed *= 1.1;
      enemy.damage *= 1.1;
      enemy.cooldown *= 0.7;
    } else if (def.id === 'volatile') {
      enemy.maxHp = Math.round(enemy.maxHp * 1.1);
      enemy.hp = enemy.maxHp;
    } else if (def.id === 'regenerating') {
      enemy.maxHp = Math.round(enemy.maxHp * 1.15);
      enemy.hp = enemy.maxHp;
    }
    return enemy;
  }

  const OBJECTIVE_DEFS = {
    terminal: {
      label: '数据终端', icon: '▣', color: '#55d9ff', duration: 14, quality: 'rare', waves: 3,
      idleText: '靠近终端上传数据，敌人会被警报吸引。',
      activeText: '上传中：留在终端范围内，击退增援！',
      rewardScrap: [28, 44], rewardParts: 2
    },
    generator: {
      label: '断电核心', icon: 'ϟ', color: '#ffad45', duration: 10, quality: 'rare', waves: 2,
      idleText: '靠近核心执行断电序列，完成后可获得补给。',
      activeText: '断电中：守住核心，增援正在赶来！',
      rewardScrap: [22, 36], rewardParts: 1
    },
    vault: {
      label: '风险保险库', icon: '◆', color: '#d6ff4d', duration: 18, quality: 'epic', waves: 4,
      idleText: '高风险目标：破解保险库会触发精英追兵。',
      activeText: '破解中：精英已锁定你的位置，坚持住！',
      rewardScrap: [46, 72], rewardParts: 3
    }
  };

  function createRoomObjective(rooms, tiles) {
    const candidates = rooms.slice(1, -1).filter((room) => room.w > 3 && room.h > 3);
    if (!candidates.length) return null;
    for (let attempt = 0; attempt < 18; attempt++) {
      const room = pick(candidates);
      const spot = roomSpot(room);
      if (!canStandOnTiles(tiles, spot.x, spot.y, 18)) continue;
      const type = pick(Object.keys(OBJECTIVE_DEFS));
      const def = OBJECTIVE_DEFS[type];
      return {
        type,
        label: def.label,
        icon: def.icon,
        color: def.color,
        x: spot.x,
        y: spot.y,
        r: 50,
        room,
        duration: def.duration,
        progress: 0,
        state: 'idle',
        pulse: rand(0, TAU),
        spawnTimer: 1.2,
        wavesSpawned: 0,
        waves: def.waves,
        completeTimer: 0
      };
    }
    return null;
  }

  function stageForFloor(floor) {
    const idx = Math.floor(Math.max(1, floor) / 5) % STAGE_DEFS.length;
    return STAGE_DEFS[idx];
  }

  function bossVariantForFloor(floor) {
    const idx = Math.floor(Math.max(1, floor) / 5 - 1) % BOSS_VARIANTS.length;
    return BOSS_VARIANTS[Math.max(0, idx)];
  }

  const PERK_DEFS = {
    vitality: { name: '强化体质', icon: 'HP', max: 5, color: '#ff7585', desc: '最大生命 +10' },
    runner: { name: '轻装疾行', icon: 'SP', max: 5, color: '#7ee8d2', desc: '移动速度 +4%' },
    quickhands: { name: '快速换弹', icon: 'RL', max: 4, color: '#55d9ff', desc: '换弹时间 -7%' },
    scavenger: { name: '扩容背包', icon: 'BP', max: 3, color: '#d6ff4d', desc: '背包容量 +1' },
    bulwark: { name: '复合防护', icon: 'AR', max: 5, color: '#ffbd63', desc: '受到伤害 -3%' },
    ammo: { name: '弹药储备', icon: 'AM', max: 3, color: '#c49cff', desc: '备弹量 +10%' },
    medic: { name: '战地急救', icon: 'MD', max: 3, color: '#79f0a3', desc: '每次行动医疗包 +1' },
    fortune: { name: '战术嗅觉', icon: 'XP', max: 4, color: '#ffd15c', desc: '获得的经验 +8%' }
  };
  const PERK_KEYS = Object.keys(PERK_DEFS);

  function riskDef() {
    return RISK_DEFS[save.settings.raidRisk] || RISK_DEFS.normal;
  }

  function sortItemList(list) {
    return list.slice().sort((a, b) => {
      const da = defOf(a);
      const db = defOf(b);
      const kindOrder = { weapon: 0, armor: 1, pack: 2, stone: 3, loot: 4 };
      const kindDiff = (kindOrder[da.kind] ?? 3) - (kindOrder[db.kind] ?? 3);
      if (kindDiff) return kindDiff;
      const rarityDiff = (RARITY_ORDER[db.rarity] || 0) - (RARITY_ORDER[da.rarity] || 0);
      if (rarityDiff) return rarityDiff;
      const plusDiff = enhanceLevel(b) - enhanceLevel(a);
      if (plusDiff) return plusDiff;
      const valueDiff = (db.sell || 0) - (da.sell || 0);
      if (valueDiff) return valueDiff;
      return da.name.localeCompare(db.name, 'zh-CN');
    });
  }

  function emptyGearBonus() {
    return {
      damage: 0, fireRate: 0, crit: 0, pierce: 0, antiBoss: 0, lifesteal: 0,
      defense: 0, moveSpeed: 0, dashCd: 0, capacity: 0, scrap: 0, maxHp: 0
    };
  }

  function addGearStats(target, source = {}) {
    for (const key of Object.keys(source)) {
      if (key in target) target[key] += Number(source[key]) || 0;
    }
    return target;
  }

  function rollItemMods(item) {
    const def = defOf(item);
    if (!['weapon', 'armor', 'pack'].includes(def.kind)) return;
    const rarity = RARITY_ORDER[def.rarity] || 1;
    const affixCount = rarity <= 1 ? 0 : rarity === 2 ? 1 : rarity === 3 ? 1 : rarity === 4 ? 2 : rarity === 5 ? 2 : 3;
    const pool = AFFIX_KEYS.filter((key) => AFFIX_DEFS[key].slot === def.kind);
    const chosen = [];
    while (chosen.length < affixCount && pool.length) {
      const key = pool.splice(randInt(0, pool.length - 1), 1)[0];
      const defAffix = AFFIX_DEFS[key];
      const value = defAffix.fixed != null
        ? defAffix.fixed
        : Math.round(rand(defAffix.min, defAffix.max) * 1000) / 1000;
      chosen.push({ key, value });
    }
    if (chosen.length) item.affixes = chosen;
    const setChance = { uncommon: 0.12, rare: 0.22, epic: 0.32, legendary: 0.42, mythic: 0.55 }[def.rarity] || 0;
    if (Math.random() < setChance) item.setId = pick(SET_IDS);
  }

  function createItem(type, qty = 1, plus = 0, options = {}) {
    const item = { id: uid(), type, qty };
    if (plus > 0) item.plus = plus;
    if (options.roll !== false) rollItemMods(item);
    return item;
  }

  function defOf(itemOrType) {
    const type = typeof itemOrType === 'string' ? itemOrType : itemOrType?.type;
    return ITEM_DEFS[type] || ITEM_DEFS.scrap;
  }

  function enhanceLevel(item) {
    const def = defOf(item);
    if (!item || !['weapon', 'armor', 'pack'].includes(def.kind)) return 0;
    return clamp(Math.floor(Number(item.plus) || 0), 0, MAX_ENHANCE);
  }

  function enhanceLuck(item) {
    return clamp(Math.floor(Number(item?.luck) || 0), 0, 100);
  }

  function enhanceGateLevel(targetLevel) {
    return ENHANCE_MIN_STONE[targetLevel] || 5;
  }

  function enhanceSuccessRate(stoneDef, targetLevel, item) {
    if (!stoneDef) return 0;
    if (stoneDef.stoneLevel >= 6) return 1;
    if (enhanceLuck(item) >= 100) return 1;
    return Math.max(0.05, stoneDef.success - targetLevel * ENHANCE_DECAY);
  }

  function normalizeItemInstance(item) {
    if (!item || !ITEM_DEFS[item.type]) return null;
    const def = ITEM_DEFS[item.type];
    const normalized = { ...item, id: item.id || uid(), qty: item.qty || 1 };
    if (item.locked === true && ['weapon', 'armor', 'pack'].includes(def.kind)) normalized.locked = true;
    else delete normalized.locked;
    if (['weapon', 'armor', 'pack'].includes(def.kind)) {
      normalized.plus = enhanceLevel(item);
      if (Array.isArray(item.affixes)) {
        normalized.affixes = item.affixes
          .filter((affix) => affix && AFFIX_DEFS[affix.key] && AFFIX_DEFS[affix.key].slot === def.kind)
          .slice(0, 3)
          .map((affix) => ({ key: affix.key, value: Number(affix.value) || 0 }));
        if (!normalized.affixes.length) delete normalized.affixes;
      } else {
        delete normalized.affixes;
      }
      if (item.setId && SET_DEFS[item.setId]) normalized.setId = item.setId;
      else delete normalized.setId;
      if (def.kind === 'weapon' && item.mods && typeof item.mods === 'object') {
        const mods = {};
        for (const slot of ['optic', 'mag', 'barrel']) {
          const type = item.mods[slot];
          if (type && ITEM_DEFS[type] && ITEM_DEFS[type].kind === 'mod' && ITEM_DEFS[type].modSlot === slot) mods[slot] = type;
        }
        if (Object.keys(mods).length) normalized.mods = mods;
        else delete normalized.mods;
      } else {
        delete normalized.mods;
      }
    } else {
      delete normalized.plus;
      delete normalized.affixes;
      delete normalized.setId;
    }
    return normalized;
  }

  function itemName(item) {
    const def = defOf(item);
    const plus = enhanceLevel(item);
    return `${def.name}${plus ? ` +${plus}` : ''}${item?.setId ? ' ★' : ''}`;
  }

  function itemSellValue(item) {
    const def = defOf(item);
    const plus = enhanceLevel(item);
    const modMult = 1 + (item?.affixes?.length || 0) * 0.12 + (item?.setId ? 0.3 : 0);
    return Math.round(def.sell * (item.qty || 1) * (1 + plus * 0.12) * modMult);
  }

  function affixValue(item, key) {
    if (!item?.affixes) return 0;
    return item.affixes.reduce((sum, affix) => sum + (affix.key === key ? Number(affix.value) || 0 : 0), 0);
  }

  function itemAffixText(item) {
    if (!item?.affixes?.length && !item?.setId) return '';
    const parts = (item.affixes || []).map((affix) => {
      const def = AFFIX_DEFS[affix.key];
      return def ? def.format(Number(affix.value) || 0) : '';
    }).filter(Boolean);
    if (item.setId && SET_DEFS[item.setId]) parts.push(`套装 · ${SET_DEFS[item.setId].name}`);
    return parts.join(' · ');
  }

  function countSetsForEquipment(equipment) {
    const counts = {};
    for (const slot of ['weapon', 'armor', 'pack']) {
      const item = equipment?.[slot];
      if (item?.setId && SET_DEFS[item.setId]) counts[item.setId] = (counts[item.setId] || 0) + 1;
    }
    return counts;
  }

  function countEquippedSets() {
    return countSetsForEquipment(save.equipped);
  }

  function bonusesForEquipment(equipment) {
    const bonus = emptyGearBonus();
    for (const slot of ['weapon', 'armor', 'pack']) {
      const item = equipment?.[slot];
      if (!item?.affixes) continue;
      for (const affix of item.affixes) {
        if (affix.key in bonus) bonus[affix.key] += Number(affix.value) || 0;
      }
    }
    const counts = countSetsForEquipment(equipment);
    for (const [setId, count] of Object.entries(counts)) {
      const set = SET_DEFS[setId];
      if (!set) continue;
      for (const threshold of [2, 3]) {
        if (count >= threshold) addGearStats(bonus, set.bonuses[threshold] || {});
      }
    }
    return bonus;
  }

  function loadoutBonuses() {
    return bonusesForEquipment(save.equipped);
  }

  function setTransitionText(beforeCounts, afterCounts) {
    const ids = new Set([...Object.keys(beforeCounts), ...Object.keys(afterCounts)]);
    for (const setId of ids) {
      const before = beforeCounts[setId] || 0;
      const after = afterCounts[setId] || 0;
      if (before === after) continue;
      const set = SET_DEFS[setId];
      if (!set) continue;
      if (before >= 2 && after < 2) return { text: `${set.name} ${before}/3 → ${after}/3，失去套装效果`, tone: 'down' };
      if (after >= 2 && before < 2) return { text: `${set.name} ${before}/3 → ${after}/3，激活套装效果`, tone: 'up' };
      if (before >= 3 || after >= 3) {
        return { text: `${set.name} ${before}/3 → ${after}/3`, tone: after > before ? 'up' : 'down' };
      }
      return { text: `${set.name} ${before}/3 → ${after}/3`, tone: after > before ? 'up' : 'down' };
    }
    return null;
  }

  function weaponExpectedDps(item, bonus, boss = false) {
    const def = defOf(item);
    if (!def || def.kind !== 'weapon') return 0;
    const w = WEAPON_DEFS[def.weapon];
    const damage = w.damage * (1 + enhanceLevel(item) * ENHANCE_RULES.weapon.perLevel + bonus.damage) * (1 + bonus.crit) * (boss ? 1 + bonus.antiBoss : 1);
    return damage * (w.pellets || 1) / w.cooldown * (1 + bonus.fireRate);
  }

  function effectiveHpForEquipment(equipment) {
    const bonus = bonusesForEquipment(equipment);
    const armorItem = equipment?.armor;
    const armorBase = ARMOR_DEFS[armorItem ? defOf(armorItem).armor : 'none'];
    const reduction = Math.min(0.75, armorBase.reduction + enhanceLevel(armorItem) * ENHANCE_RULES.armor.perLevel + transcendStats().reduction + bonus.defense);
    return { hp: 100 + transcendStats().hp + bonus.maxHp, reduction, effective: (100 + transcendStats().hp + bonus.maxHp) / Math.max(0.01, 1 - reduction) };
  }

  function equippedSetSummary() {
    const counts = countEquippedSets();
    return Object.entries(counts).map(([setId, count]) => {
      const set = SET_DEFS[setId];
      if (!set) return null;
      const active = [];
      for (const threshold of [2, 3]) {
        if (count >= threshold && set.bonuses[threshold]) {
          active.push(set.bonuses[threshold]);
        }
      }
      const stats = emptyGearBonus();
      for (const group of active) addGearStats(stats, group);
      const details = [];
      if (stats.damage) details.push(`伤害+${Math.round(stats.damage * 100)}%`);
      if (stats.crit) details.push(`暴击+${Math.round(stats.crit * 100)}%`);
      if (stats.defense) details.push(`减伤+${Math.round(stats.defense * 100)}%`);
      if (stats.maxHp) details.push(`生命+${stats.maxHp}`);
      if (stats.moveSpeed) details.push(`移速+${Math.round(stats.moveSpeed * 100)}%`);
      if (stats.dashCd) details.push(`冲刺CD-${stats.dashCd.toFixed(1)}s`);
      return `${set.name} ${count}/3${details.length ? ` · ${details.join(' ')}` : ''}`;
    }).filter(Boolean).join(' ｜ ');
  }

  function addItemToArray(list, item) {
    const def = defOf(item);
    if (def.stack) {
      const found = list.find((x) => x.type === item.type);
      if (found) { found.qty += item.qty || 1; return true; }
    }
    list.push({ ...item, id: item.id || uid(), qty: item.qty || 1 });
    return true;
  }

  function countSlots(list) {
    return list.reduce((n, item) => n + (defOf(item).stack ? 1 : 1), 0);
  }

  // ---------------------------------------------------------------------------
  // Save data
  // ---------------------------------------------------------------------------
  const DEFAULT_SETTINGS = {
    sound: true,
    screenShake: true,
    floatText: true,
    damageFlash: true,
    killSlowmo: true,
    autoLock: true,
    performanceMode: false,
    raidRisk: 'normal',
    moveStickMode: 'floating',
    moveStickSize: 100,
    moveZoneWidth: 50,
    moveSensitivity: 1,
    aimPadSize: 100,
    aimSensitivity: 1,
    tutorialDone: false
  };

  function defaultSave() {
    return {
      version: 10,
      character: 'pioneer',
      scrap: 80,
      modParts: 0,
      stash: [],
      equipped: {
        weapon: createItem('w_pistol', 1, 0, { roll: false }),
        armor: null,
        pack: createItem('p_white', 1, 0, { roll: false })
      },
      transcend: { level: 0, progress: 0 },
      upgrades: { medkits: 0, ammo: 0 },
      settings: { ...DEFAULT_SETTINGS },
      stats: { raids: 0, extracts: 0, kills: 0, deaths: 0, loot: 0 },
      daily: normalizeDaily(null),
      collector: { level: 0 }
    };
  }

  function normalizeSave(raw) {
    const base = defaultSave();
    if (!raw || typeof raw !== 'object') return base;
    const merged = {
      ...base,
      ...raw,
      character: CHARACTER_DEFS[raw.character] ? raw.character : 'pioneer',
      upgrades: { ...base.upgrades, ...(raw.upgrades || {}) },
      settings: { ...base.settings, ...(raw.settings || {}) },
      stats: { ...base.stats, ...(raw.stats || {}) },
      daily: normalizeDaily(raw.daily),
      collector: { level: clamp(Math.floor(Number(raw.collector?.level) || 0), 0, COLLECTOR_TIERS.length) },
      transcend: {
        level: clamp(Math.floor(Number(raw.transcend?.level) || 0), 0, 9999),
        progress: Math.max(0, Math.floor(Number(raw.transcend?.progress) || 0))
      },
      stash: Array.isArray(raw.stash) ? raw.stash.map(normalizeItemInstance).filter(Boolean) : []
    };
    if (!raw.equipped || !ITEM_DEFS[raw.equipped.weapon?.type]) {
      merged.equipped.weapon = createItem('w_pistol', 1, 0, { roll: false });
    } else {
      merged.equipped.weapon = { ...normalizeItemInstance(raw.equipped.weapon), qty: 1 };
    }
    if (raw.equipped && ITEM_DEFS[raw.equipped.armor?.type]) {
      merged.equipped.armor = { ...normalizeItemInstance(raw.equipped.armor), qty: 1 };
    } else {
      merged.equipped.armor = null;
    }
    if (raw.equipped && raw.equipped.pack === null) {
      merged.equipped.pack = null;
    } else if (raw.equipped && defOf(raw.equipped.pack).kind === 'pack' && ITEM_DEFS[raw.equipped.pack?.type]) {
      merged.equipped.pack = { ...normalizeItemInstance(raw.equipped.pack), qty: 1 };
    } else {
      merged.equipped.pack = createItem('p_white', 1, 0, { roll: false });
    }
    // Level and perks are run-only now. Old saves are upgraded by dropping those fields.
    delete merged.level;
    delete merged.xp;
    delete merged.perks;
    delete merged.pendingPerks;
    merged.version = 10;
    merged.scrap = Math.max(0, Number(merged.scrap) || 0);
    merged.modParts = Math.max(0, Math.floor(Number(merged.modParts) || 0));
    const touchSettings = merged.settings;
    touchSettings.moveStickMode = touchSettings.moveStickMode === 'fixed' ? 'fixed' : 'floating';
    touchSettings.moveStickSize = clamp(Number(touchSettings.moveStickSize) || 100, 70, 150);
    touchSettings.moveZoneWidth = clamp(Number(touchSettings.moveZoneWidth) || 50, 30, 70);
    touchSettings.moveSensitivity = clamp(Number(touchSettings.moveSensitivity) || 1, 0.6, 1.6);
    touchSettings.aimPadSize = clamp(Number(touchSettings.aimPadSize) || 100, 70, 120);
    touchSettings.aimSensitivity = clamp(Number(touchSettings.aimSensitivity) || 1, 0.6, 1.6);
    touchSettings.raidRisk = RISK_DEFS[touchSettings.raidRisk] ? touchSettings.raidRisk : 'normal';
    touchSettings.tutorialDone = touchSettings.tutorialDone === true;
    touchSettings.killSlowmo = touchSettings.killSlowmo !== false;
    return merged;
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? normalizeSave(JSON.parse(raw)) : defaultSave();
    } catch (err) {
      console.warn('Save load failed, using memory save.', err);
      return defaultSave();
    }
  }

  let save = loadSave();

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (err) {
      console.warn('Save write failed.', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Daily contracts
  // ---------------------------------------------------------------------------
  function dailyDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function dailySeedOf(key) {
    let h = 2166136261;
    for (let i = 0; i < key.length; i += 1) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function dailyRng(seed) {
    let a = seed >>> 0;
    return function next() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dailyDef(id) {
    return DAILY_DEFS.find((def) => def.id === id) || null;
  }

  function rollDailyList(key) {
    const rng = dailyRng(dailySeedOf(key));
    const pool = DAILY_DEFS.slice();
    const list = [];
    while (list.length < 3 && pool.length) {
      const def = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      const tier = Math.min(def.targets.length - 1, Math.floor(rng() * def.targets.length));
      list.push({ id: def.id, target: def.targets[tier], value: 0, claimed: false });
    }
    return list;
  }

  function normalizeDaily(rawDaily) {
    const key = dailyDateKey();
    const fresh = () => ({ date: key, list: rollDailyList(key), bonusClaimed: false });
    if (!rawDaily || rawDaily.date !== key || !Array.isArray(rawDaily.list)) return fresh();
    const list = [];
    const seen = new Set();
    for (const entry of rawDaily.list) {
      const def = entry && dailyDef(entry.id);
      if (!def || seen.has(def.id)) continue;
      seen.add(def.id);
      const target = Math.max(1, Math.floor(Number(entry.target) || def.targets[0]));
      const value = clamp(Math.floor(Number(entry.value) || 0), 0, target);
      list.push({ id: def.id, target, value, claimed: entry.claimed === true });
    }
    if (list.length !== 3) return fresh();
    return { date: key, list, bonusClaimed: rawDaily.bonusClaimed === true };
  }

  function ensureDaily() {
    const key = dailyDateKey();
    if (!save.daily || save.daily.date !== key) {
      save.daily = normalizeDaily(null);
      persist();
    }
    return save.daily;
  }

  function dailyDoneCount(data = ensureDaily()) {
    return data.list.filter((entry) => entry.value >= entry.target).length;
  }

  function dailyClaimableCount(data = ensureDaily()) {
    return data.list.filter((entry) => entry.value >= entry.target && !entry.claimed).length;
  }

  function dailyRewardText(def) {
    return `+${def.reward.scrap} 废料 · +${def.reward.parts} 零件`;
  }

  // run: kills / containers / extracts / objectives / elites / bosses / depth / damage
  function recordDailyProgress(run) {
    const data = ensureDaily();
    let changed = false;
    for (const entry of data.list) {
      if (entry.claimed) continue;
      const def = dailyDef(entry.id);
      if (!def) continue;
      const source = Math.max(0, Math.floor(Number(run[entry.id]) || 0));
      if (!source) continue;
      const next = def.mode === 'max' ? Math.max(entry.value, source) : entry.value + source;
      const capped = Math.min(entry.target, next);
      if (capped !== entry.value) {
        entry.value = capped;
        changed = true;
      }
    }
    if (changed) persist();
    return data;
  }

  function renderDaily() {
    const data = ensureDaily();
    const done = dailyDoneCount(data);
    const claimable = dailyClaimableCount(data);
    if (el.statDaily) el.statDaily.textContent = `${done}/3`;
    if (el.openDailyBtn) el.openDailyBtn.classList.toggle('ready', claimable > 0);
    if (!el.dailyList) return;
    if (el.dailyDate) el.dailyDate.textContent = `${data.date} · DAILY CONTRACTS`;
    if (el.dailyProgressTag) el.dailyProgressTag.textContent = `${done} / 3`;
    if (el.dailyRewardHint) {
      el.dailyRewardHint.textContent = claimable > 0
        ? `可领取 ${claimable} 条合约奖励`
        : done >= 3
          ? '今日合约奖励已全部领取'
          : '行动结算时记录进度';
    }
    if (el.claimDailyBtn) {
      el.claimDailyBtn.disabled = claimable <= 0;
      el.claimDailyBtn.textContent = claimable > 0 ? `领取奖励 (${claimable})` : '暂无奖励';
    }
    el.dailyList.innerHTML = '';
    for (const entry of data.list) {
      const def = dailyDef(entry.id);
      if (!def) continue;
      const complete = entry.value >= entry.target;
      const item = document.createElement('div');
      item.className = `daily-item${complete ? ' done' : ''}${entry.claimed ? ' claimed' : ''}`;
      item.innerHTML = `
        <div class="daily-item-head">
          <span class="daily-tag">${def.label}</span>
          <span class="daily-item-name">${def.text(entry.target)}</span>
          <span class="daily-item-value">${entry.value}/${entry.target}</span>
        </div>
        <div class="daily-bar"><i style="width:${Math.round((entry.value / entry.target) * 100)}%"></i></div>
        <div class="daily-item-foot">
          <span>${dailyRewardText(def)}</span>
          <b>${entry.claimed ? '已领取' : complete ? '可领取' : '进行中'}</b>
        </div>`;
      el.dailyList.appendChild(item);
    }
  }

  function renderStageSelect() {
    if (!el.stageBossList) return;
    el.stageBossList.innerHTML = '';
    for (const variant of BOSS_VARIANTS) {
      const card = document.createElement('div');
      card.className = 'stage-boss';
      card.innerHTML = `
        <div class="stage-boss-head">
          <span class="stage-boss-dot" style="background:${variant.color}"></span>
          <span class="stage-boss-name" style="color:${variant.color}">${variant.name}</span>
        </div>
        <div class="stage-boss-diff"></div>`;
      const diffWrap = card.querySelector('.stage-boss-diff');
      for (let d = 1; d <= 6; d += 1) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = `${d}`;
        btn.title = `难度 ${d} · 等同 F${d * 5} 强度`;
        btn.addEventListener('click', () => {
          el.stageOverlay.classList.add('hidden');
          startRaid({ bossId: variant.id, difficulty: d });
        });
        diffWrap.appendChild(btn);
      }
      el.stageBossList.appendChild(card);
    }
  }

  function renderCollector() {
    const level = collectorLevel();
    const have = collectibleCount();
    const next = nextCollectorTier();
    if (el.statCollector) el.statCollector.textContent = `${level}/${COLLECTOR_TIERS.length}`;
    if (el.openCollectorBtn) el.openCollectorBtn.classList.toggle('ready', !!next && have >= next.need);
    if (!el.collectorTiers) return;
    if (el.collectorLevel) el.collectorLevel.textContent = `${level}`;
    if (el.collectorHave) el.collectorHave.textContent = `${have}`;
    if (el.collectorHint) {
      el.collectorHint.textContent = next
        ? `下一档：${next.label}（需要 ${next.need} 件收藏品）`
        : '收藏室已满级';
    }
    if (el.donateCollectorBtn) {
      el.donateCollectorBtn.disabled = !next || have < next.need;
      el.donateCollectorBtn.textContent = next ? `捐赠 ${next.need} 件` : '已满级';
    }
    el.collectorTiers.innerHTML = '';
    COLLECTOR_TIERS.forEach((tier, index) => {
      const state = index < level ? 'done' : index === level ? 'next' : 'locked';
      const row = document.createElement('div');
      row.className = `collector-tier ${state}`;
      row.innerHTML = `
        <span class="collector-tier-index">${index + 1}</span>
        <span class="collector-tier-label">${tier.label}</span>
        <span class="collector-tier-need">需 ${tier.need} 件</span>
        <b>${state === 'done' ? '已激活' : state === 'next' ? '下一档' : '未解锁'}</b>`;
      el.collectorTiers.appendChild(row);
    });
  }

  function donateCollector() {
    const tier = nextCollectorTier();
    if (!tier) {
      toast('收藏室已经满级。');
      return;
    }
    if (collectibleCount() < tier.need) {
      toast(`需要 ${tier.need} 件收藏品（首领材料）。`);
      return;
    }
    let need = tier.need;
    for (let i = save.stash.length - 1; i >= 0 && need > 0; i -= 1) {
      const item = save.stash[i];
      if (defOf(item).kind !== 'collectible') continue;
      const qty = item.qty || 1;
      const take = Math.min(qty, need);
      item.qty = qty - take;
      need -= take;
      if (item.qty <= 0) save.stash.splice(i, 1);
    }
    save.collector.level = collectorLevel() + 1;
    persist();
    renderAllBase();
    renderCollector();
    toast(`收藏室升级：${tier.label}（永久，下一局生效）`);
  }

  function claimDailyRewards() {
    const data = ensureDaily();
    let scrap = 0;
    let parts = 0;
    let count = 0;
    for (const entry of data.list) {
      if (entry.claimed || entry.value < entry.target) continue;
      const def = dailyDef(entry.id);
      if (!def) continue;
      entry.claimed = true;
      count += 1;
      scrap += def.reward.scrap;
      parts += def.reward.parts;
    }
    if (!count) {
      renderDaily();
      return;
    }
    let bonus = false;
    if (data.list.every((entry) => entry.claimed) && !data.bonusClaimed) {
      data.bonusClaimed = true;
      bonus = true;
      scrap += DAILY_BONUS.scrap;
      parts += DAILY_BONUS.parts;
    }
    save.scrap += scrap;
    save.modParts += parts;
    persist();
    renderAllBase();
    renderDaily();
    toast(`合约奖励：+${scrap} 废料 · +${parts} 零件${bonus ? '（含全清奖励）' : ''}`);
  }

  function raidXpToNext(level) { return 80 + (level - 1) * 50; }
  function perkRank(key) {
    const def = PERK_DEFS[key];
    if (!def) return 0;
    return clamp(Math.floor(Number(raid?.perks?.[key]) || 0), 0, def.max);
  }
  // Mod parts with the collector part-drop bonus applied per unit.
  function gainModParts(amount) {
    const count = Math.max(0, Math.floor(Number(amount) || 0));
    if (!raid || count <= 0) return;
    const bonus = player?.collectorBonus?.partDrop || 0;
    let total = count;
    if (bonus > 0) {
      for (let i = 0; i < count; i += 1) {
        if (Math.random() < bonus) total += 1;
      }
    }
    raid.parts = (raid.parts || 0) + total;
  }

  function collectorLevel() {
    return clamp(Math.floor(Number(save?.collector?.level) || 0), 0, COLLECTOR_TIERS.length);
  }

  function collectorBonuses() {
    const out = { searchSpeed: 0, flatDamage: 0, damage: 0, maxHp: 0, moveSpeed: 0, crit: 0, scrap: 0, partDrop: 0 };
    const level = collectorLevel();
    for (let i = 0; i < level; i += 1) {
      const tier = COLLECTOR_TIERS[i];
      out[tier.key] += tier.value;
    }
    return out;
  }

  function collectibleCount() {
    return save.stash.reduce((n, item) => n + (defOf(item).kind === 'collectible' ? (item.qty || 1) : 0), 0);
  }

  function nextCollectorTier() {
    const level = collectorLevel();
    return level < COLLECTOR_TIERS.length ? COLLECTOR_TIERS[level] : null;
  }

  function getTranscendLevel() {
    return Math.max(0, Math.floor(Number(save?.transcend?.level) || 0));
  }

  function getTranscendProgress() {
    return Math.max(0, Math.floor(Number(save?.transcend?.progress) || 0));
  }

  function transcendCostForLevel(level = getTranscendLevel()) {
    return Math.ceil(TRANSCEND_BASE_COST * Math.pow(TRANSCEND_COST_MULT, Math.max(0, level)));
  }

  function transcendStats(level = getTranscendLevel()) {
    return {
      hp: level * TRANSCEND_RULES.hp,
      damage: level * TRANSCEND_RULES.damage,
      reduction: level * TRANSCEND_RULES.reduction,
      speed: level * TRANSCEND_RULES.speed
    };
  }

  function transcendBonusText(level = getTranscendLevel()) {
    const bonus = transcendStats(level);
    return `最大生命 +${bonus.hp} · 伤害 +${Math.round(bonus.damage * 100)}% · 减伤 +${Math.round(bonus.reduction * 100)}% · 移速 +${Math.round(bonus.speed * 100)}%`;
  }

  function packCapacityBonus(item) {
    if (!item) return 0;
    const quality = PACK_QUALITIES[defOf(item).pack];
    return (quality?.bonus || 0) + enhanceLevel(item);
  }

  function equippedPackDef() {
    const pack = save.equipped?.pack;
    return pack ? PACK_QUALITIES[defOf(pack).pack] || null : null;
  }

  function backpackCapacity() {
    return 8 + packCapacityBonus(save.equipped?.pack) + perkRank('scavenger');
  }
  function startingMedkits() { return 2 + save.upgrades.medkits; }

  function gainRaidXP(amount, silent = false) {
    if (!raid || raid.ended || amount <= 0) return 0;
    const multiplier = 1 + perkRank('fortune') * 0.08;
    const gained = Math.max(0, Math.floor(amount * multiplier));
    raid.xp += gained;
    let levelsGained = 0;
    while (raid.xp >= raidXpToNext(raid.level)) {
      raid.xp -= raidXpToNext(raid.level);
      raid.level += 1;
      levelsGained += 1;
    }
    if (levelsGained > 0) {
      raid.pendingPerks = (raid.pendingPerks || 0) + levelsGained;
      if (!silent) {
        addLootFeed(`本局等级提升 → LV.${raid.level}，获得 ${levelsGained} 次成长选择。`, false);
        toast(`等级提升！选择一项本局成长。`);
        playSound('level');
      }
    }
    return levelsGained;
  }

  function addToStash(item) {
    addItemToArray(save.stash, item);
    save.stash = sortItemList(save.stash);
  }

  function stashSlotCount() { return save.stash.length; }

  // ---------------------------------------------------------------------------
  // Audio: tiny procedural sound engine, no external assets required
  // ---------------------------------------------------------------------------
  const Sound = {
    ctx: null,
    master: null,
    noiseBuffer: null,
    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.16;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.35;
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      } catch (err) {
        console.warn('Audio unavailable', err);
      }
    },
    tone(freq, dur, type = 'square', vol = 0.2, slide = 0, delay = 0) {
      if (!this.ctx || !this.master) return;
      const t = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },
    noise(dur, vol = 0.2, freq = 1300, delay = 0) {
      if (!this.ctx || !this.master || !this.noiseBuffer) return;
      const t = this.ctx.currentTime + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);
      src.stop(t + dur);
    }
  };

  function playSound(name, arg) {
    if (!Sound.ctx || save.settings.sound === false) return;
    if (name === 'shoot') {
      if (arg === 'shotgun') {
        Sound.noise(0.18, 0.52, 720);
        Sound.tone(82, 0.13, 'sawtooth', 0.24, -42);
      } else if (arg === 'lmg') {
        Sound.noise(0.07, 0.3, 1150);
        Sound.tone(125, 0.055, 'square', 0.12, -55);
      } else if (arg === 'rail') {
        Sound.tone(920, 0.14, 'sawtooth', 0.16, -740);
        Sound.noise(0.1, 0.18, 2200);
      } else if (arg === 'rifle' || arg === 'dmr') {
        Sound.noise(0.11, 0.38, 900);
        Sound.tone(110, 0.09, 'sawtooth', 0.18, -55);
      } else if (arg === 'smg') {
        Sound.noise(0.055, 0.23, 1500);
        Sound.tone(170, 0.045, 'square', 0.09, -60);
      } else {
        Sound.noise(0.075, 0.28, 1100);
        Sound.tone(145, 0.06, 'square', 0.1, -65);
      }
    } else if (name === 'enemyShoot') {
      Sound.noise(0.045, 0.12, 1800);
    } else if (name === 'hit') {
      Sound.tone(90, 0.045, 'square', 0.12, -25);
    } else if (name === 'hurt') {
      Sound.tone(65, 0.14, 'sawtooth', 0.22, -30);
      Sound.noise(0.08, 0.11, 600);
    } else if (name === 'pickup') {
      Sound.tone(620, 0.07, 'square', 0.13, 160);
      Sound.tone(920, 0.09, 'square', 0.1, 40, 0.06);
    } else if (name === 'reload') {
      Sound.tone(280, 0.04, 'square', 0.08);
      Sound.tone(170, 0.06, 'square', 0.07, -30, 0.12);
    } else if (name === 'empty') {
      Sound.tone(150, 0.035, 'square', 0.08);
    } else if (name === 'extract') {
      Sound.tone(420, 0.18, 'triangle', 0.14, 200);
      Sound.tone(720, 0.24, 'triangle', 0.1, 260, 0.15);
    } else if (name === 'level') {
      Sound.tone(440, 0.1, 'square', 0.12);
      Sound.tone(660, 0.12, 'square', 0.12, 0, 0.09);
      Sound.tone(880, 0.2, 'square', 0.12, 0, 0.18);
    } else if (name === 'open') {
      Sound.noise(0.16, 0.11, 900);
      Sound.tone(220, 0.1, 'triangle', 0.08, 80);
    }
  }

  // ---------------------------------------------------------------------------
  // DOM references / base screen
  // ---------------------------------------------------------------------------
  const el = {
    baseScreen: $('#baseScreen'),
    gameScreen: $('#gameScreen'),
    gameFrame: $('#gameFrame'),
    canvas: $('#gameCanvas'),
    minimap: $('#minimap'),
    bossHud: $('#bossHud'),
    bossName: $('#bossName'),
    bossFill: $('#bossFill'),
    bossSkill: $('#bossSkill'),
    statScrap: $('#statScrap'),
    statRaids: $('#statRaids'),
    statExtracts: $('#statExtracts'),
    loadoutWeapon: $('#loadoutWeapon'),
    loadoutArmor: $('#loadoutArmor'),
    loadoutMeds: $('#loadoutMeds'),
    loadoutSlots: $('#loadoutSlots'),
    loadoutPack: $('#loadoutPack'),
    loadoutSetBonus: $('#loadoutSetBonus'),
    startRaidBtn: $('#startRaidBtn'),
    stageOverlay: $('#stageOverlay'),
    stageBossList: $('#stageBossList'),
    closeStageBtn: $('#closeStageBtn'),
    startNormalBtn: $('#startNormalBtn'),
    riskPicker: $('#riskPicker'),
    riskHint: $('#riskHint'),
    stashRarityFilter: $('#stashRarityFilter'),
    stashSetFilter: $('#stashSetFilter'),
    stashAffixFilter: $('#stashAffixFilter'),
    stashModParts: $('#stashModParts'),
    sellLowBtn: $('#sellLowBtn'),
    stashGrid: $('#stashGrid'),
    stashEmpty: $('#stashEmpty'),
    stashCount: $('#stashCount'),
    itemActions: $('#itemActions'),
    selectedIcon: $('#selectedIcon'),
    selectedName: $('#selectedName'),
    selectedDesc: $('#selectedDesc'),
    selectedValue: $('#selectedValue'),
    equipBtn: $('#equipBtn'),
    sellBtn: $('#sellBtn'),
    lockItemBtn: $('#lockItemBtn'),
    rerollItemBtn: $('#rerollItemBtn'),
    salvageItemBtn: $('#salvageItemBtn'),
    shopList: $('#shopList'),
    resetSaveBtn: $('#resetSaveBtn'),
    fullscreenBtn: $('#fullscreenBtn'),
    settingsBtn: $('#settingsBtn'),
    pauseFullscreenBtn: $('#pauseFullscreenBtn'),
    pauseSettingsBtn: $('#pauseSettingsBtn'),
    settingsOverlay: $('#settingsOverlay'),
    closeSettingsBtn: $('#closeSettingsBtn'),
    settingsFullscreenBtn: $('#settingsFullscreenBtn'),
    resetSettingsBtn: $('#resetSettingsBtn'),
    settingSound: $('#settingSound'),
    settingScreenShake: $('#settingScreenShake'),
    settingFloatText: $('#settingFloatText'),
    settingDamageFlash: $('#settingDamageFlash'),
    settingPerformanceMode: $('#settingPerformanceMode'),
    settingKillSlowmo: $('#settingKillSlowmo'),
    settingAutoLock: $('#settingAutoLock'),
    settingAimPadSize: $('#settingAimPadSize'),
    aimPadSizeValue: $('#aimPadSizeValue'),
    settingAimSensitivity: $('#settingAimSensitivity'),
    aimSensitivityValue: $('#aimSensitivityValue'),
    exportSaveBtn: $('#exportSaveBtn'),
    importSaveBtn: $('#importSaveBtn'),
    settingsTabGeneral: $('#settingsTabGeneral'),
    settingsTabTouch: $('#settingsTabTouch'),
    settingsGeneralPanel: $('#settingsGeneralPanel'),
    settingsTouchPanel: $('#settingsTouchPanel'),
    moveStickModeControl: $('#moveStickModeControl'),
    settingMoveStickSize: $('#settingMoveStickSize'),
    moveStickSizeValue: $('#moveStickSizeValue'),
    settingMoveZoneWidth: $('#settingMoveZoneWidth'),
    moveZoneWidthValue: $('#moveZoneWidthValue'),
    settingMoveSensitivity: $('#settingMoveSensitivity'),
    moveSensitivityValue: $('#moveSensitivityValue'),
    hpFill: $('#hpFill'),
    hpText: $('#hpText'),
    armorText: $('#armorText'),
    hudMeds: $('#hudMeds'),
    hudKeys: $('#hudKeys'),
    hudScrap: $('#hudScrap'),
    hudWeapon: $('#hudWeapon'),
    hudWeaponIcon: $('#hudWeaponIcon'),
    hudAmmo: $('#hudAmmo'),
    hudCharacterName: $('#hudCharacterName'),
    hudDashCd: $('#hudDashCd'),
    hudSkillCd: $('#hudSkillCd'),
    hudShield: $('#hudShield'),
    statusEffects: $('#statusEffects'),
    hudLevel: $('#hudLevel'),
    hudFloor: $('#hudFloor'),
    hudLockState: $('#hudLockState'),
    hudXpFill: $('#hudXpFill'),
    hudXpText: $('#hudXpText'),
    raidTimer: $('#raidTimer'),
    raidObjective: $('#raidObjective'),
    objectiveTracker: $('#objectiveTracker'),
    objectiveTrackerName: $('#objectiveTrackerName'),
    objectiveTrackerPct: $('#objectiveTrackerPct'),
    objectiveTrackerFill: $('#objectiveTrackerFill'),
    objectiveTrackerHint: $('#objectiveTrackerHint'),
    mapIntel: $('#mapIntel'),
    interactPrompt: $('#interactPrompt'),
    promptText: $('#promptText'),
    promptBarFill: $('#promptBarFill'),
    lootFeed: $('#lootFeed'),
    backpackHud: $('#backpackHud'),
    backpackCount: $('#backpackCount'),
    damageFlash: $('#damageFlash'),
    lowHpVignette: $('#lowHpVignette'),
    damageDirection: $('#damageDirection'),
    hitMarker: $('#hitMarker'),
    raidTutorial: $('#raidTutorial'),
    tutorialTitle: $('#tutorialTitle'),
    tutorialStep: $('#tutorialStep'),
    tutorialText: $('#tutorialText'),
    tutorialSkipBtn: $('#tutorialSkipBtn'),
    inventoryOverlay: $('#inventoryOverlay'),
    inventoryGrid: $('#inventoryGrid'),
    inventoryLoadout: $('#inventoryLoadout'),
    inventoryDetail: $('#inventoryDetail'),
    secureGrid: $('#secureGrid'),
    lootBackpackCount: $('#lootBackpackCount'),
    lootSecureCount: $('#lootSecureCount'),
    tidyBackpackBtn: $('#tidyBackpackBtn'),
    hudInventoryBtn: $('#hudInventoryBtn'),
    hudMapBtn: $('#hudMapBtn'),
    mapOverlay: $('#mapOverlay'),
    closeMapBtn: $('#closeMapBtn'),
    fullMapCanvas: $('#fullMapCanvas'),
    closeInventoryBtn: $('#closeInventoryBtn'),
    discardInventoryBtn: $('#discardInventoryBtn'),
    pauseOverlay: $('#pauseOverlay'),
    resumeBtn: $('#resumeBtn'),
    abandonBtn: $('#abandonBtn'),
    extractChoiceOverlay: $('#extractChoiceOverlay'),
    extractChoiceSub: $('#extractChoiceSub'),
    extractChoiceStats: $('#extractChoiceStats'),
    extractReturnBtn: $('#extractReturnBtn'),
    extractDeeperBtn: $('#extractDeeperBtn'),
    debriefOverlay: $('#debriefOverlay'),
    debriefTag: $('#debriefTag'),
    debriefTitle: $('#debriefTitle'),
    debriefSub: $('#debriefSub'),
    debriefStats: $('#debriefStats'),
    debriefLoot: $('#debriefLoot'),
    debriefCloseBtn: $('#debriefCloseBtn'),
    statDaily: $('#statDaily'),
    openDailyBtn: $('#openDailyBtn'),
    dailyOverlay: $('#dailyOverlay'),
    dailyDate: $('#dailyDate'),
    dailyProgressTag: $('#dailyProgressTag'),
    dailyList: $('#dailyList'),
    dailyRewardHint: $('#dailyRewardHint'),
    claimDailyBtn: $('#claimDailyBtn'),
    closeDailyBtn: $('#closeDailyBtn'),
    statCollector: $('#statCollector'),
    openCollectorBtn: $('#openCollectorBtn'),
    collectorOverlay: $('#collectorOverlay'),
    collectorLevel: $('#collectorLevel'),
    collectorHave: $('#collectorHave'),
    collectorTiers: $('#collectorTiers'),
    collectorHint: $('#collectorHint'),
    donateCollectorBtn: $('#donateCollectorBtn'),
    closeCollectorBtn: $('#closeCollectorBtn'),
    perkOverlay: $('#perkOverlay'),
    perkChoiceGrid: $('#perkChoiceGrid'),
    perkPending: $('#perkPending'),
    toast: $('#toast'),
    openEquipBtn: $('#openEquipBtn'),
    openStashBtn: $('#openStashBtn'),
    openShopBtn: $('#openShopBtn'),
    openEnhanceBtn: $('#openEnhanceBtn'),
    openTranscendBtn: $('#openTranscendBtn'),
    openCharacterBtn: $('#openCharacterBtn'),
    baseCharacterSummary: $('#baseCharacterSummary'),
    manageCharacterPanel: $('#manageCharacterPanel'),
    characterList: $('#characterList'),
    characterDetail: $('#characterDetail'),
    characterCurrentTag: $('#characterCurrentTag'),
    equipOverlay: $('#equipOverlay'),
    closeEquipBtn: $('#closeEquipBtn'),
    equipWindowTitle: $('#equipWindowTitle'),
    manageNote: $('#manageNote'),
    equippedSummary: $('#equippedSummary'),
    setCollection: $('#setCollection'),
    setCollectionParts: $('#setCollectionParts'),
    weaponChoices: $('#weaponChoices'),
    armorChoices: $('#armorChoices'),
    packChoices: $('#packChoices'),
    weaponMods: $('#weaponMods'),
    manageEquipPanel: $('#manageEquipPanel'),
    manageStashPanel: $('#manageStashPanel'),
    manageShopPanel: $('#manageShopPanel'),
    manageTranscendPanel: $('#manageTranscendPanel'),
    transcendLevelTag: $('#transcendLevelTag'),
    transcendLevel: $('#transcendLevel'),
    transcendProgressText: $('#transcendProgressText'),
    transcendBarFill: $('#transcendBarFill'),
    transcendBonus: $('#transcendBonus'),
    transcendBtn: $('#transcendBtn'),
    transcendBulkBtn: $('#transcendBulkBtn'),
    transcendStashValue: $('#transcendStashValue'),
    transcendItemList: $('#transcendItemList'),
    manageEnhancePanel: $('#manageEnhancePanel'),
    enhanceTargets: $('#enhanceTargets'),
    enhanceTargetSummary: $('#enhanceTargetSummary'),
    enhanceStoneList: $('#enhanceStoneList'),
    enhanceFuseList: $('#enhanceFuseList'),
    enhanceChanceHint: $('#enhanceChanceHint'),
    enhanceStoneCount: $('#enhanceStoneCount'),
    shopScrap: $('#shopScrap'),
    baseStashCount: $('#baseStashCount'),
    baseScrap: $('#baseScrap'),
    baseEnhanceSummary: $('#baseEnhanceSummary'),
    baseTranscendSummary: $('#baseTranscendSummary'),
    baseEquipSummary: $('#baseEquipSummary'),
    touchControls: $('#touchControls'),
    moveZone: $('#moveZone'),
    movePad: $('#movePad'),
    moveKnob: $('#moveKnob'),
    aimPad: $('#aimPad'),
    aimKnob: $('#aimKnob'),
    touchReload: $('#touchReload'),
    touchMed: $('#touchMed'),
    touchDash: $('#touchDash'),
    touchSkill: $('#touchSkill'),
    touchInventory: $('#touchInventory'),
    touchPause: $('#touchPause'),
    touchHint: $('#touchHint')
  };

  let activeSettingsTab = 'general';

  function switchSettingsTab(tab) {
    activeSettingsTab = tab === 'touch' ? 'touch' : 'general';
    const isTouch = activeSettingsTab === 'touch';
    el.settingsTabGeneral.classList.toggle('active', !isTouch);
    el.settingsTabTouch.classList.toggle('active', isTouch);
    el.settingsTabGeneral.setAttribute('aria-selected', String(!isTouch));
    el.settingsTabTouch.setAttribute('aria-selected', String(isTouch));
    el.settingsGeneralPanel.classList.toggle('hidden', isTouch);
    el.settingsTouchPanel.classList.toggle('hidden', !isTouch);
  }

  function sensitivityLabel(value) {
    const v = Number(value);
    if (v < 0.9) return '低';
    if (v > 1.1) return '高';
    return '标准';
  }

  function applyTouchSettings() {
    const mode = save.settings.moveStickMode === 'fixed' ? 'fixed' : 'floating';
    document.body.classList.toggle('move-stick-fixed', mode === 'fixed');
    document.documentElement.style.setProperty('--move-pad-scale', (save.settings.moveStickSize || 100) / 100);
    document.documentElement.style.setProperty('--move-zone-width', `${save.settings.moveZoneWidth || 50}%`);
    document.documentElement.style.setProperty('--aim-pad-scale', (save.settings.aimPadSize || 100) / 100);
    if (el.touchHint) {
      el.touchHint.textContent = mode === 'fixed'
        ? '左下摇杆移动 · 右侧轻触瞄准/长按开火 · 靠近补给箱站2秒搜索'
        : '左侧按住移动 · 右侧轻触瞄准/长按开火 · 靠近补给箱站2秒搜索';
    }
    el.movePad.classList.remove('active');
    el.moveKnob.style.transform = 'translate(-50%, -50%)';
    if (mode === 'floating') {
      el.movePad.style.left = '';
      el.movePad.style.top = '';
    } else {
      el.movePad.style.left = '';
      el.movePad.style.top = '';
    }
    touch.moveX = 0;
    touch.moveY = 0;
    touch.moveMag = 0;
    touch.moveTargetMag = 0;
  }

  function syncSettingsUI() {
    el.settingSound.checked = save.settings.sound !== false;
    el.settingScreenShake.checked = save.settings.screenShake !== false;
    el.settingFloatText.checked = save.settings.floatText !== false;
    el.settingDamageFlash.checked = save.settings.damageFlash !== false;
    el.settingKillSlowmo.checked = save.settings.killSlowmo !== false;
    el.settingPerformanceMode.checked = save.settings.performanceMode === true;
    el.settingAutoLock.checked = save.settings.autoLock !== false;
    el.settingAimPadSize.value = save.settings.aimPadSize;
    el.aimPadSizeValue.textContent = `${save.settings.aimPadSize}%`;
    el.settingAimSensitivity.value = save.settings.aimSensitivity;
    el.aimSensitivityValue.textContent = `${sensitivityLabel(save.settings.aimSensitivity)} ${Number(save.settings.aimSensitivity).toFixed(1)}x`;
    el.moveStickModeControl.querySelectorAll('button[data-value]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.value === save.settings.moveStickMode);
    });
    el.settingMoveStickSize.value = save.settings.moveStickSize;
    el.moveStickSizeValue.textContent = `${save.settings.moveStickSize}%`;
    el.settingMoveZoneWidth.value = save.settings.moveZoneWidth;
    el.moveZoneWidthValue.textContent = `${save.settings.moveZoneWidth}%`;
    el.settingMoveSensitivity.value = save.settings.moveSensitivity;
    el.moveSensitivityValue.textContent = `${sensitivityLabel(save.settings.moveSensitivity)} ${Number(save.settings.moveSensitivity).toFixed(1)}x`;
    applyTouchSettings();
  }

  function openSettings() {
    syncSettingsUI();
    el.settingsOverlay.classList.remove('hidden');
  }

  function closeSettings() {
    el.settingsOverlay.classList.add('hidden');
  }

  function exportSaveCode() {
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(save))));
    const done = () => toast('存档码已复制。请保存到备忘录或发给自己。');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(code).then(done).catch(() => {
        window.prompt('复制下面的存档码：', code);
      });
    } else {
      window.prompt('复制下面的存档码：', code);
    }
  }

  function importSaveCode() {
    const code = window.prompt('粘贴存档码（导入会覆盖当前存档）：');
    if (!code || !code.trim()) return;
    try {
      const json = decodeURIComponent(escape(atob(code.trim())));
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object') throw new Error('invalid');
      save = normalizeSave(parsed);
      selectedStashId = null;
      selectedInventoryItemId = null;
      persist();
      renderAllBase();
      syncSettingsUI();
      toast('存档已导入。');
    } catch (err) {
      toast('存档码无效，未导入任何内容。');
    }
  }

  function updateFullscreenLabels() {
    const label = document.fullscreenElement ? '退出全屏' : '横屏全屏';
    [el.fullscreenBtn, el.pauseFullscreenBtn, el.settingsFullscreenBtn].forEach((btn) => {
      if (btn) btn.textContent = label;
    });
  }

  async function enterLandscapeFullscreen() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch (err) { /* ignore */ }
      try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (err) { /* ignore */ }
      updateFullscreenLabels();
      toast('已退出全屏。');
      return;
    }

    let entered = false;
    try {
      const target = document.documentElement;
      if (target.requestFullscreen) {
        await target.requestFullscreen({ navigationUI: 'hide' });
        entered = true;
      } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
        entered = true;
      }
    } catch (err) { /* ignore */ }

    let locked = false;
    try {
      if (screen.orientation && typeof screen.orientation.lock === 'function') {
        await screen.orientation.lock('landscape');
        locked = true;
      }
    } catch (err) { /* ignore */ }

    updateFullscreenLabels();
    if (locked && window.innerWidth > window.innerHeight) {
      toast('已进入横屏全屏。');
    } else if (entered) {
      toast('已进入全屏；请横握手机并开启系统自动旋转。');
    } else if (isIOS) {
      toast('iPhone 请用 Safari「分享 → 添加到主屏幕」启动，并关闭竖屏锁定。');
    } else {
      toast('浏览器未允许强制横屏，请开启手机自动旋转后横握手机。');
    }
  }

  function resetSettings() {
    save.settings = { ...DEFAULT_SETTINGS };
    persist();
    syncSettingsUI();
    toast('设置已恢复默认。');
  }

  document.addEventListener('fullscreenchange', updateFullscreenLabels);

  const SHOP = [
    { key: 'w_smg', type: 'w_smg', price: 140, desc: '全自动冲锋枪，弹匣 30 发。' },
    { key: 'w_shotgun', type: 'w_shotgun', price: 260, desc: '近距离 6 弹丸爆发，适合冲脸。' },
    { key: 'w_rifle', type: 'w_rifle', price: 320, desc: '高伤害自动步枪，中远距离。' },
    { key: 'w_lmg', type: 'w_lmg', price: 480, desc: '60 发弹链轻机枪，持续压制。' },
    { key: 'w_dmr', type: 'w_dmr', price: 560, desc: '精准半自动，远距离两枪放倒。' },
    { key: 'w_rail', type: 'w_rail', price: 760, desc: '磁轨手枪，单发 72 伤害。' },
    { key: 'a_scout', type: 'a_scout', price: 80, desc: '减伤 8%，移动速度 +12%。' },
    { key: 'a_light', type: 'a_light', price: 90, desc: '减少 12% 受到的伤害。' },
    { key: 'a_medic', type: 'a_medic', price: 210, desc: '减伤 16%，多带 1 个医疗包。' },
    { key: 'a_heavy', type: 'a_heavy', price: 280, desc: '减少 26% 受到的伤害。' },
    { key: 'a_ghost', type: 'a_ghost', price: 520, desc: '减伤 22%，敌人视野降低 28%。' },
    { key: 'a_riot', type: 'a_riot', price: 620, desc: '减少 38% 受到的伤害。' },
    { key: 'up_med', type: 'up_med', price: 120, desc: '每次行动额外携带 1 个医疗包。', max: 2 },
    { key: 'up_ammo', type: 'up_ammo', price: 110, desc: '每把武器的备弹量 +45。', max: 2 }
  ];

  let selectedStashId = null;
  let selectedInventoryItemId = null;
  let characterViewId = save.character || 'pioneer';
  let stashRarityFilter = 'all';
  let enhanceTargetSlot = 'weapon';
  let toastTimer = 0;

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2600);
  }

  let pendingPerkChoices = [];

  function rollPerkChoices() {
    const available = PERK_KEYS.filter((key) => perkRank(key) < PERK_DEFS[key].max);
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    return available.slice(0, 3);
  }

  function renderPerkChoices() {
    if (!el.perkChoiceGrid || !raid) return;
    el.perkPending.textContent = `剩余 ${raid.pendingPerks} 次`;
    el.perkChoiceGrid.innerHTML = '';
    for (const key of pendingPerkChoices) {
      const def = PERK_DEFS[key];
      const rank = perkRank(key);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'perk-choice';
      btn.style.setProperty('--perk-color', def.color);
      btn.innerHTML = `
        <span class="perk-choice-icon">${def.icon}</span>
        <span class="perk-choice-name">${def.name}</span>
        <span class="perk-choice-desc">${def.desc}</span>
        <span class="perk-choice-rank">${rank} / ${def.max}</span>`;
      btn.addEventListener('click', () => choosePerk(key));
      el.perkChoiceGrid.appendChild(btn);
    }
  }

  function showPerkChoices() {
    if (!el.perkOverlay) return;
    if (mode !== 'raid' || !raid || raid.ended || !raid.pendingPerks || raid.pendingPerks <= 0) {
      el.perkOverlay.classList.add('hidden');
      if (raid) raid.perkChoiceOpen = false;
      return;
    }
    pendingPerkChoices = rollPerkChoices();
    if (pendingPerkChoices.length === 0) {
      const overflow = raid.pendingPerks;
      raid.pendingPerks = 0;
      raid.perkChoiceOpen = false;
      if (player) {
        player.maxHp += overflow * 5;
        player.hp = Math.min(player.maxHp, player.hp + overflow * 5);
      }
      el.perkOverlay.classList.add('hidden');
      raid.paused = false;
      addLootFeed(`所有成长已满级，额外获得最大生命 +${overflow * 5}。`, false);
      updateHUD();
      return;
    }
    raid.perkChoiceOpen = true;
    raid.paused = true;
    mouse.down = false;
    mouse.semiQueued = false;
    touch.firing = false;
    touch.aiming = false;
    el.interactPrompt.classList.add('hidden');
    renderPerkChoices();
    el.perkOverlay.classList.remove('hidden');
  }

  function applyRunPerk(key) {
    if (!player) return;
    if (key === 'vitality') {
      player.maxHp += 10;
      player.hp = Math.min(player.maxHp, player.hp + 10);
    } else if (key === 'runner') {
      player.speed = 155 * (1 + (player.armor.speedBonus || 0) + perkRank('runner') * 0.04 + transcendStats().speed + (player.gearBonus?.moveSpeed || 0));
    } else if (key === 'scavenger') {
      player.capacity += 1;
    } else if (key === 'ammo') {
      player.reserve += Math.max(1, Math.round(player.weapon.reserve * 0.1));
    } else if (key === 'medic') {
      player.medkits = Math.min(8, player.medkits + 1);
    }
  }

  function choosePerk(key) {
    const def = PERK_DEFS[key];
    if (mode !== 'raid' || !raid || raid.ended || !def || !pendingPerkChoices.includes(key) || raid.pendingPerks <= 0) return;
    const rank = perkRank(key);
    if (rank >= def.max) return;
    raid.perks[key] = rank + 1;
    raid.pendingPerks = Math.max(0, (raid.pendingPerks || 0) - 1);
    applyRunPerk(key);
    playSound('level');
    toast(`${def.name}提升至 ${rank + 1} 级：${def.desc}`);
    addLootFeed(`成长选择：${def.name} ${rank + 1} 级`, false);
    updateHUD();
    updateBackpackHud();
    if (raid.pendingPerks > 0) {
      pendingPerkChoices = [];
      showPerkChoices();
    } else {
      pendingPerkChoices = [];
      el.perkOverlay.classList.add('hidden');
      raid.perkChoiceOpen = false;
      raid.paused = false;
      lastTime = performance.now();
    }
  }

  function renderLoadout() {
    const loadout = loadoutBonuses();
    const weaponItem = save.equipped.weapon;
    const weaponDef = weaponItem ? WEAPON_DEFS[defOf(weaponItem).weapon] : null;
    if (weaponDef) {
      const rpm = Math.round(60 / weaponDef.cooldown);
      const plus = enhanceLevel(weaponItem);
      const tr = transcendStats();
      const damage = Math.round(weaponDef.damage * (1 + plus * ENHANCE_RULES.weapon.perLevel + tr.damage + loadout.damage));
      el.loadoutWeapon.className = 'equip-card';
      el.loadoutWeapon.innerHTML = `
        <div class="equip-top">
          <div><div class="equip-name">${itemName(weaponItem)}</div><div class="equip-type">主武器 · ${weaponDef.code}${plus ? ` · 强化 +${plus}` : ''}</div></div>
          <div class="equip-icon" style="color:${weaponDef.color}">${weaponItem ? defOf(weaponItem).icon : '▰'}</div>
        </div>
        <div class="equip-stats"><span>伤害 ${damage}${plus ? ` (${weaponDef.damage}+${plus * 5}%)` : ''}</span><span>射速 ${rpm}/min</span><span>弹匣 ${weaponDef.mag}</span><span>${weaponDef.auto || likelyTouch ? '全自动' : '半自动'}</span>${weaponDef.pellets > 1 ? `<span>弹丸 ${weaponDef.pellets}</span>` : ''}${tr.damage > 0 ? `<span>蜕变 +${Math.round(tr.damage * 100)}%</span>` : ''}${itemAffixText(weaponItem) ? `<span class="equip-mod">${itemAffixText(weaponItem)}</span>` : ''}</div>`;
    } else {
      el.loadoutWeapon.className = 'equip-card empty';
      el.loadoutWeapon.innerHTML = '<div class="equip-name">未装备武器</div><div class="equip-desc">去仓库装备一把武器。</div>';
    }

    const armorItem = save.equipped.armor;
    const armorDef = ARMOR_DEFS[armorItem ? defOf(armorItem).armor : 'none'];
    const armorPlus = enhanceLevel(armorItem);
    const armorTr = transcendStats();
    const armorReduction = Math.min(0.75, armorDef.reduction + armorPlus * ENHANCE_RULES.armor.perLevel + armorTr.reduction + loadout.defense);
    const armorDesc = !armorItem && armorTr.reduction > 0
      ? `基础护甲；蜕变提供 ${Math.round(armorTr.reduction * 100)}% 减伤。`
      : armorDef.desc;
    el.loadoutArmor.className = 'equip-card';
    el.loadoutArmor.innerHTML = `
      <div class="equip-top">
        <div><div class="equip-name">${armorItem ? itemName(armorItem) : armorDef.name}</div><div class="equip-type">护甲 · ${armorItem ? RARITY_LABEL[defOf(armorItem).rarity] : '基础'}${armorPlus ? ` · 强化 +${armorPlus}` : ''}</div></div>
        <div class="equip-icon" style="color:${armorDef.color}">${armorItem ? defOf(armorItem).icon : '▤'}</div>
      </div>
      <div class="equip-stats"><span>伤害减免 ${Math.round(armorReduction * 100)}%</span><span>${armorDesc}</span>${armorTr.reduction > 0 ? `<span>蜕变 +${Math.round(armorTr.reduction * 100)}%</span>` : ''}${armorItem && itemAffixText(armorItem) ? `<span class="equip-mod">${itemAffixText(armorItem)}</span>` : ''}</div>`;

    const packItem = save.equipped.pack;
    const packDef = packItem ? PACK_QUALITIES[defOf(packItem).pack] : null;
    const packPlus = enhanceLevel(packItem);
    if (el.loadoutPack) {
      el.loadoutPack.textContent = packDef ? `${packDef.label} +${packDef.bonus + packPlus}` : '未装备';
      el.loadoutPack.style.color = packDef ? packDef.color : 'var(--dim)';
      el.loadoutPack.classList.toggle('rainbow-text', !!packItem && defOf(packItem).pack === 'rainbow');
      el.loadoutPack.title = packDef ? `${packDef.name}${packPlus ? ` · 强化 +${packPlus}` : ''}${itemAffixText(packItem) ? ` · ${itemAffixText(packItem)}` : ''}` : '';
    }
    el.loadoutMeds.textContent = startingMedkits() + (armorDef.medkitBonus || 0);
    el.loadoutSlots.textContent = backpackCapacity() + loadout.capacity;
    if (el.loadoutSetBonus) {
      const setText = equippedSetSummary();
      el.loadoutSetBonus.textContent = setText || '套装效果：收集同套装 2 / 3 件激活';
      el.loadoutSetBonus.classList.toggle('active', !!setText);
    }
    if (el.baseEquipSummary) {
      const packText = packDef ? ` · 背包 +${packDef.bonus + packPlus}` : '';
      const trText = getTranscendLevel() > 0 ? ` · 蜕变Lv.${getTranscendLevel()}` : '';
      el.baseEquipSummary.textContent = weaponDef ? `武器 · ${itemName(weaponItem)}${packText}${trText}` : `未装备武器${packText}${trText}`;
    }
  }

  function renderStash() {
    el.stashCount.textContent = `${stashSlotCount()} / ∞`;
    if (el.baseStashCount) el.baseStashCount.textContent = `${stashSlotCount()} 件`;
    if (el.stashModParts) el.stashModParts.textContent = `零件 ${save.modParts}`;
    el.stashGrid.innerHTML = '';
    if (el.stashRarityFilter) {
      el.stashRarityFilter.querySelectorAll('button[data-rarity]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.rarity === stashRarityFilter);
      });
    }
    if (el.stashAffixFilter && el.stashAffixFilter.options.length <= 1) {
      for (const key of AFFIX_KEYS) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = AFFIX_DEFS[key].name;
        el.stashAffixFilter.appendChild(opt);
      }
    }
    const setFilter = el.stashSetFilter?.value || 'all';
    const affixFilter = el.stashAffixFilter?.value || 'all';
    const filtered = sortItemList(save.stash).filter((item) => {
      const def = defOf(item);
      if (stashRarityFilter !== 'all' && def.rarity !== stashRarityFilter) return false;
      if (setFilter === 'none' && item.setId) return false;
      if (setFilter !== 'all' && setFilter !== 'none' && item.setId !== setFilter) return false;
      if (affixFilter !== 'all' && !item.affixes?.some((affix) => affix.key === affixFilter)) return false;
      return true;
    });
    el.stashEmpty.classList.toggle('hidden', filtered.length > 0);
    el.stashEmpty.textContent = save.stash.length === 0
      ? '仓库是空的。带战利品撤离，或去黑市进货。'
      : '没有符合当前筛选条件的物资。';
    if (selectedStashId && !filtered.some((i) => i.id === selectedStashId)) selectedStashId = null;

    for (const item of filtered) {
      const def = defOf(item);
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = `stash-slot rarity-${def.rarity} ${selectedStashId === item.id ? 'selected' : ''} ${item.locked ? 'locked' : ''}`;
      slot.dataset.id = item.id;
      slot.title = `${itemName(item)} · ${def.desc}`;
      slot.innerHTML = `
        <span class="slot-icon ${def.rarity === 'mythic' ? 'mythic-icon' : ''}" style="color:${choiceIconColor(def)}">${def.icon}</span>
        <span class="slot-name">${itemName(item)}</span>
        ${item.locked ? '<span class="slot-lock">锁</span>' : ''}
        ${item.qty > 1 ? `<span class="slot-qty">×${item.qty}</span>` : ''}`;
      slot.addEventListener('click', () => {
        selectedStashId = item.id;
        renderStash();
      });
      el.stashGrid.appendChild(slot);
    }

    const selected = filtered.find((i) => i.id === selectedStashId);
    if (!selected) {
      el.itemActions.classList.add('hidden');
      return;
    }
    const def = defOf(selected);
    const isGear = ['weapon', 'armor', 'pack'].includes(def.kind);
    const hasAffixes = isGear && !!selected.affixes?.length;
    el.itemActions.classList.remove('hidden');
    el.selectedIcon.textContent = def.icon;
    el.selectedIcon.style.color = choiceIconColor(def);
    el.selectedName.textContent = `${itemName(selected)}${selected.qty > 1 ? ` ×${selected.qty}` : ''}`;
    el.selectedDesc.textContent = `${selected.locked ? '已锁定 · ' : ''}${def.desc} · ${RARITY_LABEL[def.rarity]}${itemAffixText(selected) ? ` · ${itemAffixText(selected)}` : ''}`;
    el.selectedValue.textContent = `出售 +${itemSellValue(selected)}`;
    el.equipBtn.classList.toggle('hidden', !isGear);
    el.sellBtn.textContent = selected.locked ? '已锁定' : `出售 ×${selected.qty || 1}`;
    el.sellBtn.disabled = !!selected.locked;
    if (el.lockItemBtn) {
      el.lockItemBtn.classList.toggle('hidden', !isGear);
      el.lockItemBtn.textContent = selected.locked ? '解锁' : '锁定';
    }
    if (el.rerollItemBtn) {
      el.rerollItemBtn.classList.toggle('hidden', !hasAffixes);
      el.rerollItemBtn.textContent = '重铸 5零件';
      el.rerollItemBtn.disabled = selected.locked || save.modParts < 5;
    }
    if (el.salvageItemBtn) {
      el.salvageItemBtn.classList.toggle('hidden', !isGear);
      el.salvageItemBtn.disabled = !!selected.locked;
    }
  }

  function sellLowValue() {
    const lowValue = save.stash.filter((item) => !item.locked && defOf(item).rarity === 'common' && defOf(item).kind !== 'stone');
    if (!lowValue.length) {
      toast('仓库里没有普通品质物资。');
      return;
    }
    const total = lowValue.reduce((sum, item) => sum + itemSellValue(item), 0);
    const count = lowValue.reduce((sum, item) => sum + (item.qty || 1), 0);
    if (!confirm(`确定出售全部 ${count} 件普通品质物资，获得 ${total} 废料吗？`)) return;
    const soldIds = new Set(lowValue.map((item) => item.id));
    save.stash = save.stash.filter((item) => !soldIds.has(item.id));
    save.scrap += total;
    selectedStashId = null;
    persist();
    renderAllBase();
    playSound('pickup');
    toast(`已出售 ${count} 件普通物资，获得 ${total} 废料。`);
  }

  function renderShop() {
    if (el.shopScrap) el.shopScrap.textContent = `废料 ${save.scrap}`;
    el.shopList.innerHTML = '';
    for (const entry of SHOP) {
      let level = 0;
      if (entry.type === 'up_med') level = save.upgrades.medkits;
      if (entry.type === 'up_ammo') level = save.upgrades.ammo;
      const maxed = entry.max !== undefined && level >= entry.max;
      const price = entry.price;
      const row = document.createElement('div');
      row.className = 'shop-item';
      row.innerHTML = `
        <div class="shop-icon">${entry.type.startsWith('w_') || entry.type.startsWith('a_') ? defOf(entry.type).icon : '✚'}</div>
        <div class="shop-mid">
          <div class="shop-name">${entry.type === 'up_med' ? `医疗腰带 ${level}/${entry.max}` : entry.type === 'up_ammo' ? `弹药挂袋 ${level}/${entry.max}` : defOf(entry.type).name}</div>
          <div class="shop-desc">${entry.desc}</div>
        </div>
        <button class="shop-buy" ${maxed || save.scrap < price ? 'disabled' : ''}>${maxed ? '已满级' : `${price} 废料`}</button>`;
      const btn = row.querySelector('button');
      btn.addEventListener('click', () => buyShop(entry));
      el.shopList.appendChild(row);
    }
  }

  function buyShop(entry) {
    if (entry.type === 'up_med' && save.upgrades.medkits >= entry.max) return;
    if (entry.type === 'up_ammo' && save.upgrades.ammo >= entry.max) return;
    if (save.scrap < entry.price) { toast('废料不足。'); return; }
    save.scrap -= entry.price;
    if (entry.type === 'up_med') save.upgrades.medkits += 1;
    else if (entry.type === 'up_ammo') save.upgrades.ammo += 1;
    else addToStash(createItem(entry.type));
    playSound('pickup');
    persist();
    renderAllBase();
    toast(`已购入：${entry.type.startsWith('up_') ? entry.desc.split('，')[0] : defOf(entry.type).name}`);
  }

  function gearStatsText(item) {
    const def = defOf(item);
    const plus = enhanceLevel(item);
    const mods = itemAffixText(item);
    if (def.kind === 'weapon') {
      const w = WEAPON_DEFS[def.weapon];
      const damage = Math.round(w.damage * (1 + plus * ENHANCE_RULES.weapon.perLevel + affixValue(item, 'damage')));
      const pelletText = w.pellets > 1 ? ` · 弹丸 ${w.pellets}` : '';
      return `伤害 ${damage}${plus ? ` (强化 +${plus})` : ''}${pelletText} · 弹匣 ${w.mag} · ${w.auto || likelyTouch ? '全自动' : '半自动'} · 射速 ${Math.round(60 / w.cooldown)}/min${mods ? ` · ${mods}` : ''}`;
    }
    if (def.kind === 'armor') {
      const a = ARMOR_DEFS[def.armor];
      const reduction = Math.min(0.75, a.reduction + plus * ENHANCE_RULES.armor.perLevel + affixValue(item, 'defense'));
      const extras = [];
      if (a.speedBonus) extras.push(`移速 +${Math.round(a.speedBonus * 100)}%`);
      if (a.medkitBonus) extras.push(`医疗包 +${a.medkitBonus}`);
      if (a.stealth) extras.push(`敌人视野 -${Math.round((1 - a.stealth) * 100)}%`);
      return `伤害减免 ${Math.round(reduction * 100)}%${plus ? ` (强化 +${plus})` : ''}${extras.length ? ` · ${extras.join(' · ')}` : ''} · ${RARITY_LABEL[def.rarity]}${mods ? ` · ${mods}` : ''}`;
    }
    if (def.kind === 'pack') {
      const pack = PACK_QUALITIES[def.pack];
      return `背包装备 · ${pack.label}品质 · 容量 +${pack.bonus + plus + affixValue(item, 'capacity')}${plus ? ` (强化 +${plus})` : ''}${mods ? ` · ${mods}` : ''}`;
    }
    if (def.kind === 'stone') {
      return `强化石 Lv.${def.stoneLevel} · 成功率 ${Math.round(def.success * 100)}% · ${RARITY_LABEL[def.rarity]}`;
    }
    return def.desc;
  }

  function gearCompareText(item) {
    const def = defOf(item);
    const beforeEquip = save.equipped;
    const afterEquip = { ...save.equipped, [def.kind]: item };
    const beforeBonus = loadoutBonuses();
    const afterBonus = bonusesForEquipment(afterEquip);
    const setChange = setTransitionText(countEquippedSets(), countSetsForEquipment(afterEquip));
    const appendSet = (parts) => {
      if (setChange) parts.push(`<span class="${setChange.tone === 'up' ? 'up' : 'down'}">${setChange.text}</span>`);
      return parts.join(' · ');
    };
    if (def.kind === 'weapon') {
      if (!save.equipped.weapon) return '<span class="compare up">当前武器槽为空 · 可直接装备</span>';
      const nextDps = weaponExpectedDps(item, afterBonus, false);
      const currentDps = weaponExpectedDps(save.equipped.weapon, beforeBonus, false);
      const nextBossDps = weaponExpectedDps(item, afterBonus, true);
      const currentBossDps = weaponExpectedDps(save.equipped.weapon, beforeBonus, true);
      const pct = Math.round((nextDps / Math.max(1, currentDps) - 1) * 100);
      const bossPct = Math.round((nextBossDps / Math.max(1, currentBossDps) - 1) * 100);
      const parts = [
        Math.abs(pct) <= 2 ? '<span class="up">DPS 基本持平</span>' : `<span class="${pct > 0 ? 'up' : 'down'}">DPS ${pct > 0 ? '+' : ''}${pct}%</span>`
      ];
      if (Math.abs(bossPct) > 2) parts.push(`<span class="${bossPct > 0 ? 'up' : 'down'}">对首领 ${bossPct > 0 ? '+' : ''}${bossPct}%</span>`);
      return `<span class="compare ${pct > 0 ? 'up' : pct < 0 ? 'down' : ''}">${appendSet(parts)}</span>`;
    }
    if (def.kind === 'armor') {
      if (!save.equipped.armor) return '<span class="compare up">当前没有护甲 · 可直接装备</span>';
      const before = effectiveHpForEquipment(beforeEquip);
      const after = effectiveHpForEquipment(afterEquip);
      const hpDiff = Math.round((after.effective / Math.max(1, before.effective) - 1) * 100);
      const parts = [
        `<span class="${hpDiff > 0 ? 'up' : hpDiff < 0 ? 'down' : ''}">有效生命 ${hpDiff > 0 ? '+' : ''}${hpDiff}%</span>`,
        `减伤 ${Math.round(after.reduction * 100)}%`
      ];
      return `<span class="compare ${hpDiff > 0 ? 'up' : hpDiff < 0 ? 'down' : ''}">${appendSet(parts)}</span>`;
    }
    if (def.kind === 'pack') {
      if (!save.equipped.pack) return '<span class="compare up">当前没有背包装备 · 可直接装备</span>';
      const next = PACK_QUALITIES[def.pack];
      const current = PACK_QUALITIES[defOf(save.equipped.pack).pack];
      const diff = (next.bonus + enhanceLevel(item) + affixValue(item, 'capacity') + afterBonus.capacity - beforeBonus.capacity)
        - (current.bonus + enhanceLevel(save.equipped.pack) + affixValue(save.equipped.pack, 'capacity'));
      const parts = [diff === 0 ? '<span>容量不变</span>' : `<span class="${diff > 0 ? 'up' : 'down'}">容量 ${diff > 0 ? '+' : ''}${diff}</span>`];
      return `<span class="compare ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">${appendSet(parts)}</span>`;
    }
    return '';
  }

  function equipStashItem(itemId) {
    const idx = save.stash.findIndex((i) => i.id === itemId);
    if (idx < 0) return;
    const item = save.stash[idx];
    const def = defOf(item);
    if (!['weapon', 'armor', 'pack'].includes(def.kind)) return;
    save.stash.splice(idx, 1);
    if (save.equipped[def.kind]) addToStash(save.equipped[def.kind]);
    save.equipped[def.kind] = item;
    selectedStashId = null;
    persist();
    renderAllBase();
    renderEquipModal();
    playSound('reload');
    toast(`已装备：${itemName(item)}`);
  }

  function equipSelected() {
    if (selectedStashId) equipStashItem(selectedStashId);
  }

  function unequipEquipment(kind) {
    if (!save.equipped[kind]) return;
    addToStash(save.equipped[kind]);
    save.equipped[kind] = null;
    persist();
    renderAllBase();
    renderEquipModal();
    playSound('reload');
    toast(kind === 'armor' ? '已卸下护甲。' : '已卸下背包装备。');
  }

  function unequipArmor() { unequipEquipment('armor'); }
  function unequipPack() { unequipEquipment('pack'); }

  function choiceIconColor(def) {
    if (def.boss) return '#ffd15c';
    return RARITY_COLOR[def.rarity] || RARITY_COLOR.common;
  }

  const WEAPON_MOD_SLOTS = [
    { id: 'optic', label: '瞄准镜' },
    { id: 'mag', label: '弹匣' },
    { id: 'barrel', label: '枪管' }
  ];
  const MOD_TYPES = [
    'mod_optic_1', 'mod_optic_2', 'mod_optic_3',
    'mod_mag_1', 'mod_mag_2', 'mod_mag_3',
    'mod_barrel_1', 'mod_barrel_2', 'mod_barrel_3'
  ];

  function renderWeaponMods() {
    if (!el.weaponMods) return;
    const weapon = save.equipped.weapon;
    el.weaponMods.innerHTML = '';
    if (!weapon) {
      el.weaponMods.innerHTML = '<div class="weapon-mod-empty">先装备一把武器才能改装。</div>';
      return;
    }
    const mods = weapon.mods || {};
    for (const slot of WEAPON_MOD_SLOTS) {
      const currentType = mods[slot.id] || '';
      const options = save.stash.filter((item) => {
        const def = defOf(item);
        return def.kind === 'mod' && def.modSlot === slot.id;
      });
      const row = document.createElement('div');
      row.className = 'weapon-mod-row';
      const label = document.createElement('span');
      label.className = 'weapon-mod-slot';
      label.textContent = slot.label;
      const select = document.createElement('select');
      select.className = 'weapon-mod-select';
      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '— 空槽 —';
      select.appendChild(emptyOpt);
      for (const item of options) {
        const opt = document.createElement('option');
        opt.value = item.type;
        opt.textContent = `${defOf(item).name}（${RARITY_LABEL[defOf(item).rarity]}）`;
        select.appendChild(opt);
      }
      if (currentType && !options.some((item) => item.type === currentType)) {
        const opt = document.createElement('option');
        opt.value = currentType;
        opt.textContent = `${ITEM_DEFS[currentType].name}（已装）`;
        select.appendChild(opt);
      }
      select.value = currentType;
      select.addEventListener('change', () => installWeaponMod(slot.id, select.value));
      row.appendChild(label);
      row.appendChild(select);
      el.weaponMods.appendChild(row);
    }
  }

  function installWeaponMod(slot, type) {
    const weapon = save.equipped.weapon;
    if (!weapon) return;
    weapon.mods = weapon.mods || {};
    const previous = weapon.mods[slot] || null;
    if (previous) {
      const existing = save.stash.find((item) => item.type === previous);
      if (existing) existing.qty = (existing.qty || 1) + 1;
      else save.stash.push(createItem(previous));
      delete weapon.mods[slot];
    }
    let installed = null;
    if (type) {
      const def = ITEM_DEFS[type];
      const idx = save.stash.findIndex((item) => item.type === type);
      if (idx >= 0 && def && def.kind === 'mod' && def.modSlot === slot) {
        const item = save.stash[idx];
        item.qty = (item.qty || 1) - 1;
        if (item.qty <= 0) save.stash.splice(idx, 1);
        weapon.mods[slot] = type;
        installed = def.name;
      }
    }
    if (!Object.keys(weapon.mods).length) delete weapon.mods;
    if (installed) toast(`已安装：${installed}`);
    else if (previous) toast('已拆下配件，放回仓库。');
    persist();
    renderAllBase();
    renderEquipModal();
  }

  function renderEquipChoices(kind, target) {    target.innerHTML = '';
    const items = sortItemList(save.stash.filter((item) => defOf(item).kind === kind));
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'equip-empty';
      empty.textContent = kind === 'weapon'
        ? '仓库里没有其他武器。去黑市购买或从行动中带回来。'
        : kind === 'armor'
          ? '仓库里没有护甲。去黑市购买或从行动中带回来。'
          : '仓库里没有背包装备。搜索补给箱有概率发现不同品质的背包。';
      target.appendChild(empty);
      return;
    }
    for (const item of items) {
      const def = defOf(item);
      const row = document.createElement('div');
      row.className = 'equip-choice';
      row.innerHTML = `
        <div class="equip-choice-icon ${def.rarity === 'mythic' ? 'mythic-icon' : ''}" style="color:${choiceIconColor(def)}">${def.icon}</div>
        <div class="equip-choice-mid">
          <div class="equip-choice-name">${itemName(item)}</div>
          <div class="equip-choice-stats">${gearStatsText(item)}</div>
          <div class="gear-compare-row">${gearCompareText(item)}</div>
        </div>
        <button class="equip-choice-btn" type="button">装备</button>`;
      row.querySelector('button').addEventListener('click', () => equipStashItem(item.id));
      target.appendChild(row);
    }
  }

  function renderEquipModal() {
    const weapon = save.equipped.weapon;
    const armor = save.equipped.armor;
    const pack = save.equipped.pack;
    const weaponDef = weapon ? defOf(weapon) : null;
    const armorDef = armor ? defOf(armor) : null;
    const packDef = pack ? defOf(pack) : null;
    const packQuality = packDef ? PACK_QUALITIES[packDef.pack] : null;
    el.equippedSummary.innerHTML = `
      <div class="equipped-slot">
        <div class="equipped-slot-top">
          <span class="equipped-slot-label">当前武器</span>
        </div>
        <div class="equipped-slot-name">${weaponDef ? itemName(weapon) : '未装备'}</div>
        <div class="equipped-slot-stats">${weapon ? gearStatsText(weapon) : '没有武器装备。'}</div>
      </div>
      <div class="equipped-slot">
        <div class="equipped-slot-top">
          <span class="equipped-slot-label">当前护甲</span>
          ${armor ? '<button class="mini-ghost" type="button" data-unequip="armor">卸下</button>' : ''}
        </div>
        <div class="equipped-slot-name">${armorDef ? itemName(armor) : '无护甲'}</div>
        <div class="equipped-slot-stats">${armor ? gearStatsText(armor) : (getTranscendLevel() > 0 ? `没有护甲；蜕变提供 ${Math.round(transcendStats().reduction * 100)}% 减伤。` : '没有护甲，受到完整伤害。')}</div>
      </div>
      <div class="equipped-slot">
        <div class="equipped-slot-top">
          <span class="equipped-slot-label">背包装备</span>
          ${pack ? '<button class="mini-ghost" type="button" data-unequip="pack">卸下</button>' : ''}
        </div>
        <div class="equipped-slot-name" style="${packQuality ? `color:${packQuality.color}` : ''}">${packDef ? itemName(pack) : '未装备背包'}</div>
        <div class="equipped-slot-stats">${pack ? gearStatsText(pack) : '没有背包装备，仅保留基础容量。'}</div>
      </div>`;
    el.equippedSummary.querySelectorAll('[data-unequip]').forEach((btn) => {
      btn.addEventListener('click', () => btn.dataset.unequip === 'pack' ? unequipPack() : unequipArmor());
    });
    renderEquipChoices('weapon', el.weaponChoices);
    renderEquipChoices('armor', el.armorChoices);
    renderEquipChoices('pack', el.packChoices);
    renderWeaponMods();
    renderSetCollection();
  }

  function stoneItemsInStash() {
    return sortItemList(save.stash.filter((item) => defOf(item).kind === 'stone'));
  }

  function totalStoneCount() {
    return save.stash.reduce((sum, item) => sum + (defOf(item).kind === 'stone' ? (item.qty || 1) : 0), 0);
  }

  function enhanceEffectText(item, level) {
    const def = defOf(item);
    if (def.kind === 'weapon') {
      const w = WEAPON_DEFS[def.weapon];
      const damage = Math.round(w.damage * (1 + level * ENHANCE_RULES.weapon.perLevel));
      return `伤害 ${damage}`;
    }
    if (def.kind === 'armor') {
      const a = ARMOR_DEFS[def.armor];
      const reduction = Math.min(0.75, a.reduction + level * ENHANCE_RULES.armor.perLevel);
      return `减伤 ${Math.round(reduction * 100)}%`;
    }
    if (def.kind === 'pack') {
      const pack = PACK_QUALITIES[def.pack];
      return `容量 +${pack.bonus + level * ENHANCE_RULES.pack.perLevel}`;
    }
    return '';
  }

  function renderEnhance() {
    if (!el.enhanceTargets || !el.enhanceTargetSummary || !el.enhanceStoneList) return;
    const slots = [
      ['weapon', '武器'],
      ['armor', '护甲'],
      ['pack', '背包']
    ];
    el.enhanceTargets.innerHTML = '';
    for (const [slot, label] of slots) {
      const item = save.equipped[slot];
      const def = item ? defOf(item) : null;
      const plus = item ? enhanceLevel(item) : 0;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `enhance-target ${enhanceTargetSlot === slot ? 'selected' : ''} ${item ? '' : 'empty'}`;
      button.dataset.slot = slot;
      button.innerHTML = `
        <span class="enhance-target-icon" style="color:${def ? choiceIconColor(def) : 'var(--dim)'}">${def ? def.icon : '—'}</span>
        <span class="enhance-target-mid">
          <span class="enhance-target-slot">${label}</span>
          <strong>${item ? itemName(item) : '未装备'}</strong>
          <span>${item ? enhanceEffectText(item, plus) : '先去装备窗口装备'}</span>
        </span>
        <span class="enhance-target-plus">${item ? `+${plus}` : ''}</span>`;
      button.addEventListener('click', () => {
        if (!item) return;
        enhanceTargetSlot = slot;
        renderEnhance();
      });
      el.enhanceTargets.appendChild(button);
    }

    const target = save.equipped[enhanceTargetSlot];
    const targetPlus = target ? enhanceLevel(target) : 0;
    const maxed = targetPlus >= MAX_ENHANCE;
    if (el.enhanceChanceHint) {
      el.enhanceChanceHint.textContent = target ? `已强化 +${targetPlus} / +${MAX_ENHANCE}` : '选择一件已装备物品';
    }
    if (el.enhanceTargetSummary) {
      if (!target) {
        el.enhanceTargetSummary.innerHTML = '<div class="enhance-summary-empty">当前槽位没有装备，无法强化。</div>';
      } else if (maxed) {
        el.enhanceTargetSummary.innerHTML = `<div class="enhance-summary-name">${itemName(target)}</div><div class="enhance-summary-effect">已达到最高强化等级 +${MAX_ENHANCE}</div>`;
      } else {
        el.enhanceTargetSummary.innerHTML = `
          <div class="enhance-summary-name">${itemName(target)}</div>
          <div class="enhance-summary-effect">${enhanceEffectText(target, targetPlus)} <span>→</span> <b>${enhanceEffectText(target, targetPlus + 1)}</b></div>
          <div class="enhance-summary-hint">成功率 = 石头基础 − 等级×3%（彩石固定 100%）；失败只消耗石头并累积幸运，幸运满 100% 必成。</div>`;
      }
    }

    const stones = stoneItemsInStash();
    if (el.enhanceStoneCount) el.enhanceStoneCount.textContent = `强化石 ${totalStoneCount()} 颗`;
    const targetLevel = targetPlus + 1;
    const gate = target ? enhanceGateLevel(targetLevel) : 1;
    if (el.enhanceChanceHint && target && !maxed) {
      el.enhanceChanceHint.textContent = `下一级 +${targetLevel} · 需${STONE_TIER_LABEL[gate]}起 · 幸运 ${enhanceLuck(target)}%`;
    }
    el.enhanceStoneList.innerHTML = '';
    if (stones.length === 0) {
      el.enhanceStoneList.innerHTML = '<div class="enhance-empty">击杀敌人有概率掉落强化石。品质越高，强化成功率越高。</div>';
    } else {
      for (const stone of stones) {
        const def = defOf(stone);
        const allowed = !!target && !maxed && def.stoneLevel >= gate;
        const rate = target && !maxed ? enhanceSuccessRate(def, targetLevel, target) : 0;
        const row = document.createElement('div');
        row.className = `enhance-stone-row rarity-${def.rarity}`;
        row.innerHTML = `
          <span class="enhance-stone-icon ${def.rarity === 'mythic' ? 'mythic-icon' : ''}" style="color:${choiceIconColor(def)}">${def.icon}</span>
          <span class="enhance-stone-mid">
            <strong>${def.name}</strong>
            <span>${maxed ? '已满级' : allowed ? `成功率 ${Math.round(rate * 100)}%` : `需要${STONE_TIER_LABEL[gate]}起`}</span>
          </span>
          <span class="enhance-stone-qty">×${stone.qty || 1}</span>
          <button class="enhance-use-btn" type="button" ${allowed ? '' : 'disabled'}>使用</button>`;
        row.querySelector('button').addEventListener('click', () => useEnhanceStone(stone.type));
        el.enhanceStoneList.appendChild(row);
      }
    }

    // Stone fusion: 3 of a tier -> 1 of the next tier (rainbow is the top tier).
    if (el.enhanceFuseList) {
      el.enhanceFuseList.innerHTML = '';
      for (const type of Object.keys(STONE_CHAIN)) {
        const def = ITEM_DEFS[type];
        const nextDef = ITEM_DEFS[STONE_CHAIN[type]];
        const count = save.stash.reduce((n, item) => n + (item.type === type ? (item.qty || 1) : 0), 0);
        const row = document.createElement('div');
        row.className = 'enhance-fuse-row';
        row.innerHTML = `
          <span class="enhance-fuse-name" style="color:${RARITY_COLOR[def.rarity]}">${def.name} ×${count}</span>
          <span class="enhance-fuse-arrow">→ ${nextDef.name}</span>
          <button class="enhance-fuse-btn" type="button" ${count >= 3 ? '' : 'disabled'}>合成</button>`;
        row.querySelector('button').addEventListener('click', () => fuseEnhanceStones(type));
        el.enhanceFuseList.appendChild(row);
      }
    }
  }

  function useEnhanceStone(type) {
    const target = save.equipped[enhanceTargetSlot];
    const stoneIdx = save.stash.findIndex((item) => item.type === type && (item.qty || 1) > 0);
    if (!target || stoneIdx < 0) return;
    const plus = enhanceLevel(target);
    if (plus >= MAX_ENHANCE) {
      toast('该装备已达到最高强化等级。');
      return;
    }
    const stone = save.stash[stoneIdx];
    const stoneDef = defOf(stone);
    const targetLevel = plus + 1;
    const gate = enhanceGateLevel(targetLevel);
    if (stoneDef.stoneLevel < gate) {
      toast(`+${targetLevel} 需要 ${STONE_TIER_LABEL[gate]} 或更高品质的强化石。`);
      return;
    }
    stone.qty = (stone.qty || 1) - 1;
    if (stone.qty <= 0) save.stash.splice(stoneIdx, 1);
    const rate = enhanceSuccessRate(stoneDef, targetLevel, target);
    const success = Math.random() < rate;
    if (success) {
      target.plus = plus + 1;
      target.luck = 0;
      toast(`强化成功！${itemName(target)} 提升至 +${target.plus}。`);
      playSound('level');
    } else {
      target.luck = Math.min(100, enhanceLuck(target) + ENHANCE_LUCK_STEP);
      toast(`强化失败（成功率 ${Math.round(rate * 100)}%），${stoneDef.name}已消耗，幸运 +${ENHANCE_LUCK_STEP}%。`);
      playSound('hurt');
    }
    selectedStashId = null;
    persist();
    renderAllBase();
    renderEnhance();
  }

  function fuseEnhanceStones(fromType) {
    const nextType = STONE_CHAIN[fromType];
    if (!nextType) {
      toast('彩色强化石已经是最高品质。');
      return;
    }
    const idx = save.stash.findIndex((item) => item.type === fromType && (item.qty || 1) >= 3);
    if (idx < 0) {
      toast('至少需要 3 颗同品质强化石。');
      return;
    }
    const stone = save.stash[idx];
    const fromName = defOf(stone).name;
    stone.qty -= 3;
    if (stone.qty <= 0) save.stash.splice(idx, 1);
    const existing = save.stash.find((item) => item.type === nextType);
    if (existing) existing.qty = (existing.qty || 1) + 1;
    else save.stash.push(createItem(nextType));
    toast(`合成成功：3 × ${fromName} → 1 × ${ITEM_DEFS[nextType].name}`);
    playSound('pickup');
    selectedStashId = null;
    persist();
    renderAllBase();
    renderEnhance();
  }

  function renderTranscend() {
    if (!el.transcendItemList) return;
    const level = getTranscendLevel();
    const progress = getTranscendProgress();
    const cost = transcendCostForLevel(level);
    if (el.transcendLevelTag) el.transcendLevelTag.textContent = `蜕变 Lv.${level}`;
    if (el.transcendLevel) el.transcendLevel.textContent = `Lv.${level}`;
    if (el.transcendProgressText) el.transcendProgressText.textContent = `${progress} / ${cost}`;
    if (el.transcendBarFill) el.transcendBarFill.style.width = `${clamp(progress / cost * 100, 0, 100)}%`;
    if (el.transcendBonus) el.transcendBonus.textContent = `永久加成：${transcendBonusText(level)}`;
    if (el.transcendBtn) {
      el.transcendBtn.disabled = progress < cost;
      el.transcendBtn.textContent = progress >= cost ? '蜕变' : `还差 ${cost - progress} 价值`;
    }

    const stashValue = save.stash.reduce((sum, item) => sum + itemSellValue(item), 0);
    if (el.transcendStashValue) el.transcendStashValue.textContent = `总价值 ${stashValue}`;
    const bulkItems = save.stash.filter((item) => {
      const def = defOf(item);
      return def.kind === 'loot' && ['common', 'uncommon'].includes(def.rarity) && itemSellValue(item) > 0;
    });
    if (el.transcendBulkBtn) el.transcendBulkBtn.disabled = bulkItems.length === 0;

    const items = sortItemList(save.stash).slice().sort((a, b) => itemSellValue(b) - itemSellValue(a));
    el.transcendItemList.innerHTML = '';
    if (items.length === 0) {
      el.transcendItemList.innerHTML = '<div class="transcend-empty">仓库里没有可转化的物品。带战利品撤离后再来。</div>';
      return;
    }
    for (const item of items) {
      const def = defOf(item);
      const value = itemSellValue(item);
      const row = document.createElement('div');
      row.className = `transcend-item rarity-${def.rarity}`;
      row.innerHTML = `
        <span class="transcend-item-icon ${def.rarity === 'mythic' ? 'mythic-icon' : ''}" style="color:${choiceIconColor(def)}">${def.icon}</span>
        <span class="transcend-item-mid">
          <strong>${itemName(item)}${item.qty > 1 ? ` ×${item.qty}` : ''}</strong>
          <span>${RARITY_LABEL[def.rarity]} · 价值 +${value}</span>
        </span>
        <button class="transcend-use-btn" type="button">转化 +${value}</button>`;
      row.querySelector('button').addEventListener('click', () => convertStashItemToTranscend(item.id));
      el.transcendItemList.appendChild(row);
    }
  }

  function convertStashItemToTranscend(itemId) {
    const idx = save.stash.findIndex((item) => item.id === itemId);
    if (idx < 0) return;
    const item = save.stash[idx];
    const value = itemSellValue(item);
    if (value <= 0) return;
    save.stash.splice(idx, 1);
    save.transcend.progress = getTranscendProgress() + value;
    selectedStashId = null;
    persist();
    renderAllBase();
    renderTranscend();
    playSound('pickup');
    toast(`已将 ${itemName(item)} 转化为 ${value} 蜕变价值。`);
  }

  function bulkConvertTranscendCommon() {
    const items = save.stash.filter((item) => {
      const def = defOf(item);
      return def.kind === 'loot' && ['common', 'uncommon'].includes(def.rarity) && itemSellValue(item) > 0;
    });
    if (items.length === 0) {
      toast('仓库里没有可转化的普通物资。');
      return;
    }
    const total = items.reduce((sum, item) => sum + itemSellValue(item), 0);
    const count = items.reduce((sum, item) => sum + (item.qty || 1), 0);
    if (!confirm(`确定转化 ${count} 件普通物资，获得 ${total} 蜕变价值吗？`)) return;
    const ids = new Set(items.map((item) => item.id));
    save.stash = save.stash.filter((item) => !ids.has(item.id));
    save.transcend.progress = getTranscendProgress() + total;
    selectedStashId = null;
    persist();
    renderAllBase();
    renderTranscend();
    playSound('pickup');
    toast(`已转化 ${count} 件普通物资，获得 ${total} 蜕变价值。`);
  }

  function performTranscend() {
    const level = getTranscendLevel();
    const cost = transcendCostForLevel(level);
    const progress = getTranscendProgress();
    if (progress < cost) {
      toast(`蜕变进度不足，还需要 ${cost - progress} 价值。`);
      return;
    }
    save.transcend.level = level + 1;
    save.transcend.progress = progress - cost;
    persist();
    renderAllBase();
    renderTranscend();
    playSound('level');
    toast(`蜕变成功！当前 Lv.${save.transcend.level}：${transcendBonusText(save.transcend.level)}`);
  }

  const MANAGE_VIEWS = {
    equip: { title: '装备', note: '装备会立即更新作战准备；进入行动后不能更换。' },
    stash: { title: '仓库', note: '仓库物资会即时保存；出售物品可以获得废料。' },
    shop: { title: '黑市', note: '使用废料购买武器、护甲和永久补给。' },
    enhance: { title: '强化台', note: '强化石由敌人掉落；强化失败会消耗 1 颗强化石，装备等级不会下降。' },
    transcend: { title: '蜕变熔炉', note: '投入仓库物品会按出售价值增加蜕变进度；蜕变会永久提升角色属性。' },
    character: { title: '角色', note: '选择出战角色；主动技能、被动和通用冲刺会在下一次行动中生效。' }
  };

  function openEquipModal(view = 'equip') {
    if (mode !== 'base') return;
    const selected = MANAGE_VIEWS[view] ? view : 'equip';
    renderEquipModal();
    renderStash();
    renderShop();
    renderEnhance();
    renderTranscend();
    renderCharacterPanel();
    if (el.equipWindowTitle) el.equipWindowTitle.textContent = MANAGE_VIEWS[selected].title;
    if (el.manageNote) el.manageNote.textContent = MANAGE_VIEWS[selected].note;
    if (el.manageEquipPanel) el.manageEquipPanel.classList.toggle('hidden', selected !== 'equip');
    if (el.manageStashPanel) el.manageStashPanel.classList.toggle('hidden', selected !== 'stash');
    if (el.manageShopPanel) el.manageShopPanel.classList.toggle('hidden', selected !== 'shop');
    if (el.manageEnhancePanel) el.manageEnhancePanel.classList.toggle('hidden', selected !== 'enhance');
    if (el.manageTranscendPanel) el.manageTranscendPanel.classList.toggle('hidden', selected !== 'transcend');
    if (el.manageCharacterPanel) el.manageCharacterPanel.classList.toggle('hidden', selected !== 'character');
    el.equipOverlay.classList.remove('hidden');
  }

  function closeEquipModal() {
    el.equipOverlay.classList.add('hidden');
  }

  function sellSelected() {
    const idx = save.stash.findIndex((i) => i.id === selectedStashId);
    if (idx < 0) return;
    const item = save.stash[idx];
    if (item.locked) { toast('该装备已锁定，先解锁才能出售。'); return; }
    const value = itemSellValue(item);
    save.stash.splice(idx, 1);
    save.scrap += value;
    selectedStashId = null;
    persist();
    renderAllBase();
    playSound('pickup');
    toast(`出售 ${itemName(item)}，获得 ${value} 废料。`);
  }

  function toggleSelectedLock() {
    const item = save.stash.find((i) => i.id === selectedStashId);
    if (!item) return;
    item.locked = !item.locked;
    persist();
    renderStash();
    playSound('reload');
    toast(item.locked ? `已锁定 ${itemName(item)}` : `已解锁 ${itemName(item)}`);
  }

  function salvageSelected() {
    const idx = save.stash.findIndex((i) => i.id === selectedStashId);
    if (idx < 0) return;
    const item = save.stash[idx];
    const def = defOf(item);
    if (!['weapon', 'armor', 'pack'].includes(def.kind) || item.locked) return;
    const value = Math.round(itemSellValue(item) * 0.45);
    const parts = 1 + (item.affixes?.length || 0) + (item.setId ? 1 : 0);
    save.stash.splice(idx, 1);
    save.scrap += value;
    save.modParts += parts;
    selectedStashId = null;
    persist();
    renderAllBase();
    playSound('pickup');
    toast(`分解 ${itemName(item)}：+${value} 废料，+${parts} 改装零件。`);
  }

  function rerollSelectedAffix() {
    const item = save.stash.find((i) => i.id === selectedStashId);
    if (!item || item.locked) return;
    const def = defOf(item);
    if (!['weapon', 'armor', 'pack'].includes(def.kind) || !item.affixes?.length) return;
    const cost = 5;
    if (save.modParts < cost) { toast(`改装零件不足，需要 ${cost} 个。`); return; }
    const currentKeys = new Set(item.affixes.map((a) => a.key));
    const pool = AFFIX_KEYS.filter((key) => AFFIX_DEFS[key].slot === def.kind && !currentKeys.has(key));
    const key = pool.length ? pick(pool) : pick(item.affixes).key;
    const affixDef = AFFIX_DEFS[key];
    const value = affixDef.fixed != null
      ? affixDef.fixed
      : Math.round(rand(affixDef.min, affixDef.max) * 1000) / 1000;
    const index = Math.floor(Math.random() * item.affixes.length);
    item.affixes[index] = { key, value };
    save.modParts -= cost;
    persist();
    renderAllBase();
    playSound('level');
    toast(`重铸成功：${affixDef.format(value)}（消耗 ${cost} 零件）`);
  }

  function setThresholdText(setId, threshold) {
    const set = SET_DEFS[setId];
    const stats = set?.bonuses?.[threshold];
    if (!stats) return '';
    const bits = [];
    if (stats.damage) bits.push(`伤害+${Math.round(stats.damage * 100)}%`);
    if (stats.crit) bits.push(`暴击+${Math.round(stats.crit * 100)}%`);
    if (stats.defense) bits.push(`减伤+${Math.round(stats.defense * 100)}%`);
    if (stats.maxHp) bits.push(`生命+${stats.maxHp}`);
    if (stats.moveSpeed) bits.push(`移速+${Math.round(stats.moveSpeed * 100)}%`);
    if (stats.dashCd) bits.push(`冲刺CD-${stats.dashCd.toFixed(1)}s`);
    return bits.join(' ');
  }

  function renderSetCollection() {
    if (!el.setCollection) return;
    const counts = countEquippedSets();
    el.setCollection.innerHTML = SET_IDS.map((setId) => {
      const set = SET_DEFS[setId];
      const equipped = counts[setId] || 0;
      const stashCount = save.stash.filter((item) => item.setId === setId).length;
      const active = equipped >= 2;
      const pieces = [2, 3].map((threshold) => {
        const text = setThresholdText(setId, threshold);
        return text ? `${threshold}件：${text}` : '';
      }).filter(Boolean).join(' ｜ ');
      return `<div class="set-row ${active ? 'active' : ''}">
        <div class="set-row-top"><strong style="color:${set.color}">${set.name}</strong><span>装备 ${equipped}/3 · 仓库 ${stashCount}</span></div>
        <div class="set-row-bonus">${pieces}</div>
      </div>`;
    }).join('');
    if (el.setCollectionParts) el.setCollectionParts.textContent = `改装零件 ${save.modParts}`;
  }

  function renderProgress() {
    el.statScrap.textContent = save.scrap;
    el.statRaids.textContent = save.stats.raids;
    el.statExtracts.textContent = save.stats.extracts;
  }

  function syncRiskPicker() {
    if (!el.riskPicker) return;
    const key = save.settings.raidRisk || 'normal';
    const risk = RISK_DEFS[key] || RISK_DEFS.normal;
    el.riskPicker.querySelectorAll('button[data-risk]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.risk === key);
    });
    if (el.riskHint) el.riskHint.textContent = risk.hint;
  }

  function renderCharacterPanel() {
    if (!el.characterList || !el.characterDetail) return;
    const current = currentCharacterDef();
    characterViewId = CHARACTER_DEFS[characterViewId] ? characterViewId : current.id;
    if (el.characterCurrentTag) el.characterCurrentTag.textContent = `当前：${current.name}`;
    if (el.baseCharacterSummary) el.baseCharacterSummary.textContent = current.name;
    el.characterList.innerHTML = '';
    for (const id of CHARACTER_IDS) {
      const def = CHARACTER_DEFS[id];
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `character-row${id === characterViewId ? ' active' : ''}${id === current.id ? ' current' : ''}`;
      row.innerHTML = `<strong style="color:${def.color}">${def.name}</strong><span>${def.role}</span><span>${def.skill.name} · ${def.skill.cd}s</span>${id === current.id ? '<em>出战中</em>' : ''}`;
      row.addEventListener('click', () => {
        characterViewId = id;
        renderCharacterPanel();
      });
      el.characterList.appendChild(row);
    }
    const def = CHARACTER_DEFS[characterViewId] || current;
    const isCurrent = def.id === current.id;
    el.characterDetail.innerHTML = `
      <div class="character-detail-head">
        <div><h4 style="color:${def.color}">${def.name}</h4><span>${def.code} · ${def.role}</span></div>
        <span>${isCurrent ? '当前出战角色' : '点击下方按钮切换'}</span>
      </div>
      <div class="character-skill-block">
        <b>主动技能 · ${def.skill.name} <em>CD ${def.skill.cd}s</em></b>
        <p>${def.skill.desc}</p>
      </div>
      <div class="character-skill-block character-passive">
        <b>被动 · ${def.passive.name}</b>
        <p>${def.passive.desc}</p>
      </div>
      <div class="character-skill-block">
        <b>通用技能 · 战术冲刺 <em>CD 4s</em></b>
        <p>向方向键/移动摇杆方向快速位移一小段距离，并获得短暂无敌，可闪避子弹、冲撞和范围重击。</p>
      </div>
      ${isCurrent
        ? '<div class="character-selected-note">该角色已在行动中出战。</div>'
        : '<button id="characterSelectBtn" class="primary-btn compact character-select-btn" type="button">设为当前角色</button>'}`;
    const selectBtn = $('#characterSelectBtn');
    if (selectBtn) selectBtn.addEventListener('click', () => selectCharacter(def.id));
  }

  function selectCharacter(id) {
    if (!CHARACTER_DEFS[id]) return;
    save.character = id;
    characterViewId = id;
    persist();
    renderAllBase();
    renderCharacterPanel();
    playSound('pickup');
    toast(`已选择角色：${CHARACTER_DEFS[id].name}`);
  }

  function renderAllBase() {
    syncRiskPicker();
    renderLoadout();
    renderStash();
    renderSetCollection();
    renderShop();
    renderEnhance();
    renderTranscend();
    renderCharacterPanel();
    renderProgress();
    renderDaily();
    renderCollector();
    if (el.baseScrap) el.baseScrap.textContent = save.scrap;
    if (el.baseEnhanceSummary) el.baseEnhanceSummary.textContent = `${totalStoneCount()} 颗强化石 · 零件 ${save.modParts}`;
    if (el.stashModParts) el.stashModParts.textContent = `零件 ${save.modParts}`;
    if (el.baseTranscendSummary) el.baseTranscendSummary.textContent = `Lv.${getTranscendLevel()} · ${getTranscendProgress()}/${transcendCostForLevel()}`;
  }

  el.equipBtn.addEventListener('click', equipSelected);
  el.sellBtn.addEventListener('click', sellSelected);
  if (el.lockItemBtn) el.lockItemBtn.addEventListener('click', toggleSelectedLock);
  if (el.rerollItemBtn) el.rerollItemBtn.addEventListener('click', rerollSelectedAffix);
  if (el.salvageItemBtn) el.salvageItemBtn.addEventListener('click', salvageSelected);
  if (el.stashSetFilter) el.stashSetFilter.addEventListener('change', () => renderStash());
  if (el.stashAffixFilter) el.stashAffixFilter.addEventListener('change', () => renderStash());
  el.openEquipBtn.addEventListener('click', () => openEquipModal('equip'));
  el.openStashBtn.addEventListener('click', () => openEquipModal('stash'));
  el.openShopBtn.addEventListener('click', () => openEquipModal('shop'));
  el.openEnhanceBtn.addEventListener('click', () => openEquipModal('enhance'));
  el.openTranscendBtn.addEventListener('click', () => openEquipModal('transcend'));
  if (el.openCharacterBtn) el.openCharacterBtn.addEventListener('click', () => openEquipModal('character'));
  if (el.openDailyBtn) {
    el.openDailyBtn.addEventListener('click', () => {
      renderDaily();
      el.dailyOverlay.classList.remove('hidden');
    });
  }
  if (el.closeDailyBtn) el.closeDailyBtn.addEventListener('click', () => el.dailyOverlay.classList.add('hidden'));
  if (el.openCollectorBtn) {
    el.openCollectorBtn.addEventListener('click', () => {
      renderCollector();
      el.collectorOverlay.classList.remove('hidden');
    });
  }
  if (el.closeCollectorBtn) el.closeCollectorBtn.addEventListener('click', () => el.collectorOverlay.classList.add('hidden'));
  if (el.donateCollectorBtn) el.donateCollectorBtn.addEventListener('click', donateCollector);
  if (el.collectorOverlay) {
    el.collectorOverlay.addEventListener('click', (event) => {
      if (event.target === el.collectorOverlay) el.collectorOverlay.classList.add('hidden');
    });
  }
  if (el.tidyBackpackBtn) el.tidyBackpackBtn.addEventListener('click', tidyBackpack);
  if (el.claimDailyBtn) el.claimDailyBtn.addEventListener('click', claimDailyRewards);
  if (el.dailyOverlay) {
    el.dailyOverlay.addEventListener('click', (event) => {
      if (event.target === el.dailyOverlay) el.dailyOverlay.classList.add('hidden');
    });
  }
  if (el.transcendBtn) el.transcendBtn.addEventListener('click', performTranscend);
  if (el.transcendBulkBtn) el.transcendBulkBtn.addEventListener('click', bulkConvertTranscendCommon);
  el.closeEquipBtn.addEventListener('click', closeEquipModal);
  if (el.tutorialSkipBtn) {
    el.tutorialSkipBtn.addEventListener('click', () => {
      completeRaidTutorial();
      toast('已跳过首次行动教学。');
    });
  }
  if (el.loadoutWeapon) el.loadoutWeapon.addEventListener('click', () => openEquipModal('equip'));
  if (el.loadoutArmor) el.loadoutArmor.addEventListener('click', () => openEquipModal('equip'));
  if (el.equipOverlay) {
    el.equipOverlay.addEventListener('click', (event) => {
      if (event.target === el.equipOverlay) closeEquipModal();
    });
  }
  el.resetSaveBtn.addEventListener('click', () => {
    if (confirm('确定要清空全部仓库、等级和统计吗？')) {
      save = defaultSave();
      selectedStashId = null;
      persist();
      renderAllBase();
      toast('存档已重置。');
    }
  });

  // ---------------------------------------------------------------------------
  // Global game state
  // ---------------------------------------------------------------------------
  const canvas = el.canvas;
  const ctx = canvas.getContext('2d');
  const miniCtx = el.minimap.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  miniCtx.imageSmoothingEnabled = false;

  let mode = 'base'; // base | raid | debrief
  let world = null;
  let player = null;
  let raid = null;
  let camera = { x: 0, y: 0, shake: 0 };
  let lastTime = performance.now();
  let cameraInitialized = false;
  let hudAccumulator = 0;
  let lastMinimapDraw = -1;
  let raidVignetteGradient = null;
  let scanlinePattern = null;
  const slowmo = { timer: 0, duration: 0.16, scale: 0.4, zoom: 0 };

  function triggerKillSlowmo(isBoss = false) {
    if (save.settings.killSlowmo === false) return;
    slowmo.duration = isBoss ? 0.34 : 0.16;
    slowmo.scale = isBoss ? 0.28 : 0.42;
    slowmo.timer = slowmo.duration;
  }

  const keys = Object.create(null);
  const mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false, semiQueued: false, inside: false };
  const touch = {
    ui: false,
    moveX: 0,
    moveY: 0,
    moveMag: 0,
    aimAngle: 0,
    aimMag: 0,
    aiming: false,
    hasAim: false,
    aimPressAt: 0,
    aimTargetAngle: 0,
    firing: false,
    moveTargetMag: 0
  };

  const TUTORIAL_STEPS = [
    {
      title: '移动',
      touchText: '按住左侧摇杆拖动，移动角色。',
      desktopText: '使用 WASD 或方向键移动。'
    },
    {
      title: '搜索',
      touchText: '靠近补给箱，站定 2 秒自动搜索；移动会打断。',
      desktopText: '靠近补给箱，站定 2 秒自动搜索；移动会打断。'
    },
    {
      title: '战斗',
      touchText: '轻触右侧瞄准区转向，长按开火；开火会自动锁定前方敌人。',
      desktopText: '鼠标瞄准，左键射击；R 换弹，F 使用医疗包。'
    },
    {
      title: '战术技能',
      touchText: '按住并拖动左侧摇杆时点冲刺按钮；点击右侧技能按钮释放角色主动技能。冲刺有无敌帧，技能有独立冷却。',
      desktopText: '按 Space 冲刺闪避，按 Q 释放角色主动技能。冲刺和技能是两个独立冷却。'
    },
    {
      title: '撤离点',
      touchText: '跟着小地图的绿色标记，进入撤离点停留 3 秒，然后选择继续下一层或返回基地。',
      desktopText: '跟着小地图的绿色标记，进入撤离点停留 3 秒，然后选择继续下一层或返回基地。'
    }
  ];

  let raidTutorialState = { active: false, step: 0, startX: 0, startY: 0 };
  let hitMarkerTimer = 0;
  let damageDirectionTimer = 0;

  function showHitMarker(kill = false) {
    if (!el.hitMarker) return;
    el.hitMarker.classList.toggle('kill', !!kill);
    el.hitMarker.classList.remove('active');
    void el.hitMarker.offsetWidth;
    el.hitMarker.classList.add('active');
    clearTimeout(hitMarkerTimer);
    hitMarkerTimer = setTimeout(() => el.hitMarker.classList.remove('active'), 190);
  }

  function showDamageDirection(sourceAngle) {
    if (!el.damageDirection || !Number.isFinite(sourceAngle)) return;
    const cssAngle = sourceAngle + Math.PI / 2;
    el.damageDirection.style.setProperty('--hit-rot', `${cssAngle}rad`);
    el.damageDirection.classList.remove('active');
    void el.damageDirection.offsetWidth;
    el.damageDirection.classList.add('active');
    clearTimeout(damageDirectionTimer);
    damageDirectionTimer = setTimeout(() => el.damageDirection.classList.remove('active'), 760);
  }

  function setRaidTutorialStep(step) {
    if (!raidTutorialState.active || !el.raidTutorial) return;
    if (step >= TUTORIAL_STEPS.length) {
      completeRaidTutorial();
      return;
    }
    raidTutorialState.step = step;
    const info = TUTORIAL_STEPS[step];
    if (el.tutorialTitle) el.tutorialTitle.textContent = info.title;
    if (el.tutorialStep) el.tutorialStep.textContent = `${step + 1} / ${TUTORIAL_STEPS.length}`;
    if (el.tutorialText) el.tutorialText.textContent = touch.ui ? info.touchText : info.desktopText;
    el.raidTutorial.classList.remove('hidden');
  }

  function advanceRaidTutorial(step) {
    if (!raidTutorialState.active || raidTutorialState.step !== step) return;
    setRaidTutorialStep(step + 1);
  }

  function completeRaidTutorial() {
    raidTutorialState.active = false;
    if (el.raidTutorial) el.raidTutorial.classList.add('hidden');
    if (!save.settings.tutorialDone) {
      save.settings.tutorialDone = true;
      persist();
    }
  }

  function startRaidTutorial() {
    if (save.settings.tutorialDone) {
      if (el.raidTutorial) el.raidTutorial.classList.add('hidden');
      raidTutorialState.active = false;
      return;
    }
    raidTutorialState = { active: true, step: 0, startX: player.x, startY: player.y };
    setRaidTutorialStep(0);
  }

  function enableTouchUI() {
    if (touch.ui) return;
    touch.ui = true;
    document.body.classList.add('touch-device');
    el.touchControls.classList.remove('hidden');
    const hint = document.querySelector('.control-hint');
    if (hint) {
      hint.innerHTML = '<div>左摇杆移动 · 按住右侧瞄准区开火 · 拖动瞄准</div><div>冲刺按钮闪避 · 技能按钮释放角色主动技能</div><div>靠近补给箱站 2 秒自动搜索 · 换弹/医疗/背包按钮</div>';
    }
  }

  const likelyTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  if (likelyTouch) enableTouchUI();
  window.addEventListener('touchstart', () => enableTouchUI(), { passive: true, once: true });

  // ---------------------------------------------------------------------------
  // Map generation and spatial helpers
  // ---------------------------------------------------------------------------
  function tileAt(tx, ty) {
    if (!world || tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 0;
    return world.tiles[ty][tx];
  }

  function isSolidAt(x, y) {
    return tileAt(Math.floor(x / TILE), Math.floor(y / TILE)) !== 1;
  }

  function canStandAt(x, y, r) {
    if (x - r < 0 || y - r < 0 || x + r >= MAP_PW || y + r >= MAP_PH) return false;
    return !isSolidAt(x - r, y - r) &&
      !isSolidAt(x + r, y - r) &&
      !isSolidAt(x - r, y + r) &&
      !isSolidAt(x + r, y + r) &&
      !isSolidAt(x, y - r) &&
      !isSolidAt(x, y + r) &&
      !isSolidAt(x - r, y) &&
      !isSolidAt(x + r, y);
  }

  function canStandOnTiles(tiles, x, y, r) {
    if (x - r < 0 || y - r < 0 || x + r >= MAP_PW || y + r >= MAP_PH) return false;
    const solid = (px, py) => {
      const tx = Math.floor(px / TILE);
      const ty = Math.floor(py / TILE);
      return tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || tiles[ty][tx] !== 1;
    };
    return !solid(x - r, y - r) && !solid(x + r, y - r) && !solid(x - r, y + r) && !solid(x + r, y + r) &&
      !solid(x, y - r) && !solid(x, y + r) && !solid(x - r, y) && !solid(x + r, y);
  }

  function moveWithCollision(entity, dx, dy) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 7));
    const sx = dx / steps;
    const sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (canStandAt(entity.x + sx, entity.y, entity.r)) entity.x += sx;
      if (canStandAt(entity.x, entity.y + sy, entity.r)) entity.y += sy;
    }
  }

  function hash2(x, y) {
    let n = x * 374761393 + y * 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    return (n ^ (n >> 16)) >>> 0;
  }

  function lineOfSight(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const d = Math.hypot(dx, dy);
    const steps = Math.ceil(d / 7);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (isSolidAt(x1 + dx * t, y1 + dy * t)) return false;
    }
    return true;
  }

  function isPointVisible(x, y, radius = VISION_RADIUS) {
    if (!world || !player) return false;
    return dist2(x, y, player.x, player.y) <= radius * radius && lineOfSight(player.x, player.y, x, y);
  }

  function isExploredPoint(x, y) {
    if (!world || !world.explored) return false;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
    return world.explored[ty * MAP_W + tx] === 1;
  }

  function revealTile(tx, ty) {
    if (!world || !world.explored || tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return;
    const idx = ty * MAP_W + tx;
    if (world.explored[idx]) return;
    world.explored[idx] = 1;
    if (world.fogMini) {
      const fg = world.fogMini.getContext('2d');
      fg.clearRect(tx * 4, ty * 4, 4, 4);
    }
  }

  function revealExplored() {
    if (!world || !player) return;
    const ptx = Math.floor(player.x / TILE);
    const pty = Math.floor(player.y / TILE);
    const r = REVEAL_RADIUS_TILES;
    for (let ty = pty - r; ty <= pty + r; ty++) {
      for (let tx = ptx - r; tx <= ptx + r; tx++) {
        if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
        const cx = tx * TILE + TILE / 2;
        const cy = ty * TILE + TILE / 2;
        if (dist2(cx, cy, player.x, player.y) > (r * TILE) ** 2) continue;
        if (!lineOfSight(player.x, player.y, cx, cy)) continue;
        revealTile(tx, ty);
      }
    }
  }

  function updateExploration(dt) {
    if (!world || !player) return;
    world.revealTimer = Math.max(0, (world.revealTimer || 0) - dt);
    if (world.revealTimer <= 0) {
      world.revealTimer = 0.12;
      revealExplored();
    }
    const last = world.trail[world.trail.length - 1];
    if (!last || dist2(last.x, last.y, player.x, player.y) > 26 * 26) {
      world.trail.push({ x: player.x, y: player.y });
    }
  }

  function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return dist2(x1, y1, cx, cy) <= r * r;
    let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
    t = clamp(t, 0, 1);
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    return dist2(px, py, cx, cy) <= r * r;
  }

  function roomSpot(room, margin = 12) {
    return {
      x: (room.x + rand(0.7, room.w - 1.3)) * TILE + rand(-margin, margin),
      y: (room.y + rand(0.7, room.h - 1.3)) * TILE + rand(-margin, margin)
    };
  }

  function generateWorld() {
    let data = null;

    for (let attempt = 0; attempt < 80 && !data; attempt++) {
      const rooms = [];
      const tries = 90;
      for (let i = 0; i < tries && rooms.length < 18; i++) {
        const w = randInt(6, 11);
        const h = randInt(5, 9);
        const x = randInt(2, MAP_W - w - 3);
        const y = randInt(2, MAP_H - h - 3);
        const candidate = { x, y, w, h };
        let overlaps = false;
        for (const other of rooms) {
          if (x - 2 < other.x + other.w && x + w + 2 > other.x && y - 2 < other.y + other.h && y + h + 2 > other.y) {
            overlaps = true;
            break;
          }
        }
        if (!overlaps) rooms.push(candidate);
      }
      if (rooms.length < 12) continue;

      rooms.sort((a, b) => (a.x + a.w / 2) - (b.x + b.w / 2));
      const tiles = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(0));

      const setFloor = (tx, ty) => {
        if (tx > 0 && ty > 0 && tx < MAP_W - 1 && ty < MAP_H - 1) tiles[ty][tx] = 1;
      };

      for (const r of rooms) {
        for (let y = r.y; y < r.y + r.h; y++) {
          for (let x = r.x; x < r.x + r.w; x++) setFloor(x, y);
        }
      }

      const carve = (ax, ay, bx, by) => {
        let x = ax;
        let y = ay;
        while (x !== bx) {
          setFloor(x, y);
          setFloor(x, y + 1);
          x += x < bx ? 1 : -1;
        }
        while (y !== by) {
          setFloor(x, y);
          setFloor(x + 1, y);
          y += y < by ? 1 : -1;
        }
      };

      const centerOf = (r) => ({ x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) });
      for (let i = 1; i < rooms.length; i++) {
        const a = centerOf(rooms[i - 1]);
        const b = centerOf(rooms[i]);
        if (Math.random() < 0.5) {
          carve(a.x, a.y, a.x, b.y);
          carve(a.x, b.y, b.x, b.y);
        } else {
          carve(a.x, a.y, b.x, a.y);
          carve(b.x, a.y, b.x, b.y);
        }
      }

      // Extra loops make the larger map less linear.
      for (let i = 0; i < 4; i++) {
        const a = centerOf(pick(rooms));
        const b = centerOf(pick(rooms));
        if (a.x !== b.x && a.y !== b.y) {
          if (Math.random() < 0.5) {
            carve(a.x, a.y, a.x, b.y);
            carve(a.x, b.y, b.x, b.y);
          } else {
            carve(a.x, a.y, b.x, a.y);
            carve(b.x, a.y, b.x, b.y);
          }
        }
      }

      data = { rooms, tiles };
    }

    if (!data) {
      // Extremely unlikely fallback: one big open arena.
      const tiles = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(0));
      for (let y = 3; y < MAP_H - 3; y++) {
        for (let x = 3; x < MAP_W - 3; x++) tiles[y][x] = 1;
      }
      data = { rooms: [{ x: 3, y: 3, w: MAP_W - 6, h: MAP_H - 6 }], tiles };
    }

    const { rooms, tiles } = data;
    const spawnRoom = rooms[0];
    const exitRoom = rooms[rooms.length - 1];
    const spawn = centerOfRoom(spawnRoom);
    const extraction = {
      x: (exitRoom.x + exitRoom.w / 2) * TILE,
      y: (exitRoom.y + exitRoom.h / 2) * TILE,
      r: 50,
      pulse: 0
    };

    // Make sure the spawn and exit centers are walkable.
    const ensureFloor = (wx, wy) => {
      const tx = Math.floor(wx / TILE);
      const ty = Math.floor(wy / TILE);
      if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) tiles[ty][tx] = 1;
    };
    ensureFloor(spawn.x, spawn.y);
    ensureFloor(extraction.x, extraction.y);

    const risk = riskDef();
    const floor = Math.max(1, raid?.floor || 1);
    const stage = stageForFloor(floor);
    const rareChance = clamp(risk.rareChance + (floor - 1) * 0.06, 0, 0.9);
    const containers = [];
    for (let i = 1; i < rooms.length; i++) {
      const room = rooms[i];
      const count = randInt(2, 3) + (i === rooms.length - 1 && Math.random() < 0.45 ? 1 : 0);
      for (let j = 0; j < count; j++) {
        const spot = roomSpot(room);
        if (!canStandOnTiles(tiles, spot.x, spot.y, 13)) continue;
        containers.push({
          x: spot.x,
          y: spot.y,
          w: 30,
          h: 24,
          rarity: Math.random() < rareChance ? 'rare' : 'common',
          searched: false,
          progress: 0,
          pulse: rand(0, TAU)
        });
      }
    }

    const enemyCount = Math.round((8 + Math.min(16, (floor - 1) * 2)) * risk.enemyCount);
    const enemies = [];
    const kinds = stage.enemyPool;
    for (let i = 0; i < enemyCount; i++) {
      let room = pick(rooms.slice(1));
      let spot = roomSpot(room);
      let guard = 0;
      while ((!canStandOnTiles(tiles, spot.x, spot.y, 12) || dist2(spot.x, spot.y, spawn.x, spawn.y) < 330 * 330) && guard < 30) {
        room = pick(rooms.slice(1));
        spot = roomSpot(room);
        guard++;
      }
      if (guard >= 30) continue;
      const kind = pick(kinds);
      enemies.push(new Enemy(spot.x, spot.y, kind, room));
    }

    if (enemies.length && Math.random() < 0.2 + Math.min(0.2, floor * 0.015)) {
      applyEliteAffix(pick(enemies));
    }

    // High-risk bounty: one per floor, guards a legendary drop and alerts the map when killed.
    if (rooms.length > 2) {
      const bountyRoom = pick(rooms.slice(1));
      let spot = roomSpot(bountyRoom);
      let guard = 0;
      while ((!canStandOnTiles(tiles, spot.x, spot.y, 12) || dist2(spot.x, spot.y, spawn.x, spawn.y) < 420 * 420) && guard < 30) {
        spot = roomSpot(bountyRoom);
        guard++;
      }
      if (guard < 30) {
        const bounty = new Enemy(spot.x, spot.y, pick(kinds), bountyRoom);
        bounty.maxHp = Math.round(bounty.maxHp * 3.2);
        bounty.hp = bounty.maxHp;
        bounty.damage = Math.round(bounty.damage * 1.35);
        bounty.xp = Math.round(bounty.xp * 4);
        bounty.scrap = Math.round(bounty.scrap * 4);
        bounty.isBounty = true;
        bounty.color = '#ffd15c';
        applyEliteAffix(bounty);
        enemies.push(bounty);
      }
    }

    // Small squad coordination: the room leader buffs nearby squadmates.
    const squadRooms = new Map();
    for (const enemy of enemies) {
      if (enemy.elite) continue;
      if (!squadRooms.has(enemy.room)) squadRooms.set(enemy.room, []);
      squadRooms.get(enemy.room).push(enemy);
    }
    for (const group of squadRooms.values()) {
      if (group.length < 2) continue;
      const leader = group[0];
      leader.squadLeader = true;
      leader.name = `队长·${leader.name}`;
      leader.maxHp = Math.round(leader.maxHp * 1.15);
      leader.hp = leader.maxHp;
      leader.damage *= 1.08;
      leader.xp = Math.round(leader.xp * 1.08);
      for (let i = 1; i < group.length; i++) {
        group[i].squadMember = true;
        group[i].damage *= 1.05;
        group[i].speed *= 1.03;
      }
    }

    const bossFloor = floor % 5 === 0;
    let bossRoom = null;
    let bossEnemy = null;
    if (bossFloor) {
      const bossRooms = rooms.slice(1, -1);
      bossRoom = bossRooms.length
        ? bossRooms.reduce((best, room) => (room.w * room.h > best.w * best.h ? room : best), bossRooms[0])
        : rooms[Math.max(1, rooms.length - 2)];
      let bossSpot = centerOfRoom(bossRoom);
      if (!canStandOnTiles(tiles, bossSpot.x, bossSpot.y, 16)) bossSpot = roomSpot(bossRoom);
      bossEnemy = new Enemy(bossSpot.x, bossSpot.y, 'boss', bossRoom);
      enemies.push(bossEnemy);
    }

    // One locked key room per floor. Its guardian always drops the key.
    const keyRooms = rooms.slice(1, -1).filter((room) => room !== bossRoom);
    const keyRoom = keyRooms.length ? pick(keyRooms) : rooms[Math.max(1, rooms.length - 2)];
    let keySpot = centerOfRoom(keyRoom);
    if (!canStandOnTiles(tiles, keySpot.x, keySpot.y, 20)) keySpot = roomSpot(keyRoom);
    const keyChest = {
      x: keySpot.x,
      y: keySpot.y,
      w: 38,
      h: 28,
      rarity: 'rare',
      searched: false,
      progress: 0,
      pulse: rand(0, TAU),
      vault: true,
      locked: true
    };
    containers.push(keyChest);

    let guardSpot = roomSpot(keyRoom);
    let guardTries = 0;
    while ((!canStandOnTiles(tiles, guardSpot.x, guardSpot.y, 12) || dist2(guardSpot.x, guardSpot.y, keySpot.x, keySpot.y) < 55 * 55) && guardTries < 30) {
      guardSpot = roomSpot(keyRoom);
      guardTries++;
    }
    const keyGuard = new Enemy(guardSpot.x, guardSpot.y, 'heavy', keyRoom);
    keyGuard.elite = true;
    keyGuard.carriesKey = true;
    keyGuard.maxHp = Math.round(keyGuard.maxHp * 1.55);
    keyGuard.hp = keyGuard.maxHp;
    keyGuard.damage *= 1.15;
    keyGuard.xp = Math.round(keyGuard.xp * 2);
    keyGuard.scrap = Math.round(keyGuard.scrap * 2);
    keyGuard.color = '#ffd15c';
    applyEliteAffix(keyGuard);
    enemies.push(keyGuard);

    const worldObj = {
      tiles,
      rooms,
      stage,
      spawn,
      extraction,
      containers,
      enemies,
      boss: bossEnemy,
      keyRoom: { x: keyRoom.x * TILE, y: keyRoom.y * TILE, w: keyRoom.w * TILE, h: keyRoom.h * TILE },
      keyChest,
      objective: createRoomObjective(rooms, tiles),
      explored: new Uint8Array(MAP_W * MAP_H),
      fogMini: buildFogCanvas(),
      trail: [],
      revealTimer: 0,
      pickups: [],
      bullets: [],
      hazards: [],
      beams: [],
      particles: [],
      floatTexts: [],
      mapCanvas: buildMapCanvas(tiles, stage, rooms),
      mini: buildMinimap(tiles, stage),
      flow: { dist: null, timer: 0 },
      time: 0,
      shake: 0,
      noise: 0
    };

    return worldObj;
  }

  function centerOfRoom(r) {
    return {
      x: (r.x + r.w / 2) * TILE,
      y: (r.y + r.h / 2) * TILE
    };
  }

  function drawCrateProp(g, x, y, seed) {
    const s = 16 + (seed % 6);
    g.fillStyle = 'rgba(0,0,0,.38)';
    g.beginPath();
    g.ellipse(x + 1, y + s / 2, s * 0.6, 4, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#4a3826';
    g.fillRect(x - s / 2, y - s / 2, s, s);
    g.fillStyle = '#5c4630';
    g.fillRect(x - s / 2 + 1, y - s / 2 + 1, s - 2, s - 2);
    g.fillStyle = 'rgba(30,20,12,.55)';
    g.fillRect(x - s / 2 + 2, y - 1, s - 4, 1);
    g.fillRect(x - 1, y - s / 2 + 2, 1, s - 4);
    g.fillStyle = 'rgba(160,180,200,.5)';
    g.fillRect(x - s / 2 + 2, y - s / 2 + 2, 2, 2);
    g.fillRect(x + s / 2 - 4, y - s / 2 + 2, 2, 2);
    g.strokeStyle = 'rgba(18,12,7,.85)';
    g.lineWidth = 1;
    g.strokeRect(x - s / 2 + 0.5, y - s / 2 + 0.5, s - 1, s - 1);
  }

  function drawBarrelProp(g, x, y, seed) {
    const tint = seed % 2 ? '#3d4d33' : '#4a3a2a';
    g.fillStyle = 'rgba(0,0,0,.38)';
    g.beginPath();
    g.ellipse(x + 1, y + 9, 10, 4, 0, 0, TAU);
    g.fill();
    g.fillStyle = tint;
    g.fillRect(x - 8, y - 9, 16, 18);
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.fillRect(x - 8, y - 4, 16, 2);
    g.fillRect(x - 8, y + 3, 16, 2);
    g.fillStyle = 'rgba(255,255,255,.13)';
    g.fillRect(x - 6, y - 9, 3, 18);
    g.fillStyle = 'rgba(190,200,210,.4)';
    g.beginPath();
    g.ellipse(x, y - 9, 8, 3, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(10,8,6,.8)';
    g.lineWidth = 1;
    g.strokeRect(x - 8.5, y - 9.5, 17, 19);
  }

  function drawPipeProp(g, x, y, seed) {
    const horiz = seed % 2 === 0;
    const len = 24 + (seed % 12);
    const w = 8;
    g.fillStyle = 'rgba(0,0,0,.32)';
    if (horiz) g.fillRect(x - len / 2, y + w / 2, len, 3);
    else g.fillRect(x + w / 2, y - len / 2, 3, len);
    g.fillStyle = '#3a4654';
    if (horiz) g.fillRect(x - len / 2, y - w / 2, len, w);
    else g.fillRect(x - w / 2, y - len / 2, w, len);
    g.fillStyle = 'rgba(255,255,255,.12)';
    if (horiz) g.fillRect(x - len / 2, y - w / 2 + 1, len, 2);
    else g.fillRect(x - w / 2 + 1, y - len / 2, 2, len);
    g.fillStyle = '#56657a';
    if (horiz) {
      g.fillRect(x - len / 2 + 4, y - w / 2 - 1, 3, w + 2);
      g.fillRect(x + len / 2 - 8, y - w / 2 - 1, 3, w + 2);
    } else {
      g.fillRect(x - w / 2 - 1, y - len / 2 + 4, w + 2, 3);
      g.fillRect(x - w / 2 - 1, y + len / 2 - 8, w + 2, 3);
    }
  }

  function buildMapCanvas(tiles, stage = STAGE_DEFS[0], rooms = null) {
    const c = document.createElement('canvas');
    c.width = MAP_PW;
    c.height = MAP_PH;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;

    const floorPalette = stage.floorPalette;
    const edgePalette = stage.edgePalette;
    const wallColor = stage.wallColor || '#0a0e14';
    const accent = stage.accent || 'rgba(85,217,255,.055)';

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const px = x * TILE;
        const py = y * TILE;
        if (tiles[y][x] === 1) {
          const h = hash2(x, y);
          g.fillStyle = floorPalette[h % floorPalette.length];
          g.fillRect(px, py, TILE, TILE);
          // Raised tile edge: top highlight, bottom/right grout.
          g.fillStyle = 'rgba(255,255,255,.065)';
          g.fillRect(px + 1, py + 1, TILE - 2, 1);
          g.fillStyle = 'rgba(0,0,0,.22)';
          g.fillRect(px, py + TILE - 1, TILE, 1);
          g.fillRect(px + TILE - 1, py, 1, TILE);
          // Surface noise.
          for (let n = 0; n < 3; n += 1) {
            const nx = px + 3 + ((h >> (n * 5)) % (TILE - 6));
            const ny = py + 3 + ((h >> (n * 3 + 2)) % (TILE - 6));
            g.fillStyle = n % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.2)';
            g.fillRect(nx, ny, 2, 2);
          }
          // Occasional crack or panel seam.
          if (h % 11 === 0) {
            g.strokeStyle = 'rgba(0,0,0,.3)';
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(px + 5 + (h % 7), py + 4);
            g.lineTo(px + 13 + (h % 6), py + 14 + (h % 5));
            g.lineTo(px + 9 + (h % 8), py + TILE - 5);
            g.stroke();
          }
          if (h % 19 === 0) {
            g.fillStyle = 'rgba(0,0,0,.24)';
            g.fillRect(px + 4, py + 12 + (h % 6), TILE - 8, 1);
          }
          if (h % 9 === 0) {
            g.fillStyle = accent;
            g.fillRect(px + 8 + (h % 13), py + 9 + (h % 7), 3, 2);
          }
          if (h % 17 === 0) {
            g.fillStyle = 'rgba(0,0,0,.16)';
            g.fillRect(px + 5, py + 21, 13, 2);
          }
          // Grime, dried blood and shallow water decals.
          if (h % 37 === 0) {
            const rx = px + 6 + (h % 12);
            const ry = py + 8 + (h % 10);
            const rad = 7 + (h % 9);
            const stain = g.createRadialGradient(rx, ry, 1, rx, ry, rad);
            stain.addColorStop(0, 'rgba(0,0,0,.3)');
            stain.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = stain;
            g.beginPath();
            g.ellipse(rx, ry, rad, rad * 0.62, 0, 0, TAU);
            g.fill();
          } else if (h % 53 === 0) {
            g.fillStyle = 'rgba(122,26,34,.3)';
            g.beginPath();
            g.ellipse(px + 12 + (h % 9), py + 15 + (h % 7), 6, 3.4, (h % 3) * 0.7, 0, TAU);
            g.fill();
            g.fillStyle = 'rgba(122,26,34,.2)';
            g.fillRect(px + 6 + (h % 5), py + 21 + (h % 5), 3, 2);
          } else if (h % 71 === 0) {
            const wx = px + 16;
            const wy = py + 15;
            const wet = g.createRadialGradient(wx, wy, 1, wx, wy, 13);
            wet.addColorStop(0, 'rgba(85,217,255,.15)');
            wet.addColorStop(0.7, 'rgba(85,217,255,.05)');
            wet.addColorStop(1, 'rgba(85,217,255,0)');
            g.fillStyle = wet;
            g.beginPath();
            g.ellipse(wx, wy, 13, 8, 0, 0, TAU);
            g.fill();
          }
          // Emissive floor specks (the reference has tiny glowing dots everywhere).
          if (h % 5 === 0) {
            const gx = px + 2 + (h % 28);
            const gy = py + 2 + ((h >> 3) % 28);
            g.fillStyle = 'rgba(255,226,255,.18)';
            g.fillRect(gx, gy, 2, 2);
            g.fillStyle = 'rgba(255,255,255,.3)';
            g.fillRect(gx, gy, 1, 1);
          }
          if (h % 41 === 0) {
            const gx = px + 12 + (h % 10);
            const gy = py + 12 + ((h >> 2) % 10);
            g.fillStyle = 'rgba(255,255,255,.14)';
            g.fillRect(gx - 2, gy, 5, 1);
            g.fillRect(gx, gy - 2, 1, 5);
          }
          // Contact shadow cast by adjacent walls.
          if (y > 0 && tiles[y - 1][x] === 0) {
            const sh = g.createLinearGradient(px, py, px, py + 11);
            sh.addColorStop(0, 'rgba(0,0,0,.34)');
            sh.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = sh;
            g.fillRect(px, py, TILE, 11);
          }
          if (x > 0 && tiles[y][x - 1] === 0) {
            const sh = g.createLinearGradient(px, py, px + 11, py);
            sh.addColorStop(0, 'rgba(0,0,0,.28)');
            sh.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = sh;
            g.fillRect(px, py, 11, TILE);
          }
        } else {
          g.fillStyle = wallColor;
          g.fillRect(px, py, TILE, TILE);
          const wh = hash2(x + 91, y + 37);
          // Brick courses: two rows per tile, vertical joints offset each row.
          g.fillStyle = 'rgba(0,0,0,.32)';
          g.fillRect(px, py + 15, TILE, 1);
          g.fillRect(px, py + 31, TILE, 1);
          const shift = y % 2 ? 6 : 0;
          g.fillRect(px + ((10 + shift) % 32), py, 1, 15);
          g.fillRect(px + ((24 + shift) % 32), py, 1, 15);
          g.fillRect(px + ((4 + shift) % 32), py + 16, 1, 15);
          g.fillRect(px + ((18 + shift) % 32), py + 16, 1, 15);
          // Brick face highlight so each course reads as raised masonry.
          g.fillStyle = 'rgba(255,255,255,.045)';
          g.fillRect(px, py + 1, TILE, 2);
          g.fillRect(px, py + 17, TILE, 2);
          if (wh % 7 === 0) {
            g.fillStyle = 'rgba(255,255,255,.07)';
            g.fillRect(px + 6 + (wh % 13), py + 8 + (wh % 9), 2, 2);
          }
          if (wh % 13 === 0) {
            g.fillStyle = 'rgba(0,0,0,.26)';
            g.fillRect(px + 4, py + 22, TILE - 8, 2);
          }
          const belowFloor = y + 1 < MAP_H && tiles[y + 1][x] === 1;
          const rightFloor = x + 1 < MAP_W && tiles[y][x + 1] === 1;
          const leftFloor = x - 1 >= 0 && tiles[y][x - 1] === 1;
          const aboveFloor = y - 1 >= 0 && tiles[y - 1][x] === 1;
          if (belowFloor) {
            g.fillStyle = edgePalette[0];
            g.fillRect(px, py + TILE - 5, TILE, 5);
            g.fillStyle = '#1f2b3a';
            g.fillRect(px, py + TILE - 8, TILE, 3);
          }
          if (rightFloor) {
            g.fillStyle = edgePalette[1];
            g.fillRect(px + TILE - 4, py, 4, TILE);
          }
          if (leftFloor) {
            g.fillStyle = edgePalette[1];
            g.fillRect(px, py, 4, TILE);
          }
          if (aboveFloor) {
            g.fillStyle = edgePalette[0];
            g.fillRect(px, py, TILE, 4);
            g.fillStyle = 'rgba(255,255,255,.06)';
            g.fillRect(px, py + 4, TILE, 1);
          }
          if ((x + y) % 3 === 0) {
            g.fillStyle = accent;
            g.fillRect(px + 10, py + 10, 2, 2);
          }
        }
      }
    }

    // A subtle grid over the entire map.
    g.strokeStyle = 'rgba(0,0,0,.065)';
    g.lineWidth = 1;
    for (let x = 0; x <= MAP_W; x++) {
      g.beginPath();
      g.moveTo(x * TILE + 0.5, 0);
      g.lineTo(x * TILE + 0.5, MAP_PH);
      g.stroke();
    }
    for (let y = 0; y <= MAP_H; y++) {
      g.beginPath();
      g.moveTo(0, y * TILE + 0.5);
      g.lineTo(MAP_PW, y * TILE + 0.5);
      g.stroke();
    }

    // Overhead light pools and floor props give each room a readable shape.
    if (Array.isArray(rooms)) {
      for (const room of rooms) {
        const cx = (room.x + room.w / 2) * TILE;
        const cy = (room.y + room.h / 2) * TILE;
        const radius = Math.min(room.w, room.h) * TILE * 0.62;
        if (radius < 12) continue;
        const light = g.createRadialGradient(cx, cy, 4, cx, cy, radius);
        light.addColorStop(0, 'rgba(196,226,255,.085)');
        light.addColorStop(0.55, 'rgba(150,192,235,.035)');
        light.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = light;
        g.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      }
      for (const room of rooms) {
        const seed = hash2(room.x + 11, room.y + 7);
        const count = 2 + (seed % 4);
        const roomCx = (room.x + room.w / 2) * TILE;
        const roomCy = (room.y + room.h / 2) * TILE;
        for (let i = 0; i < count; i += 1) {
          const hs = hash2(room.x * 3 + i * 7, room.y * 5 + i * 13);
          const tx = room.x + 1 + (hs % Math.max(1, room.w - 2));
          const ty = room.y + 1 + ((hs >> 5) % Math.max(1, room.h - 2));
          if (!tiles[ty] || tiles[ty][tx] !== 1) continue;
          const px = tx * TILE + 16;
          const py = ty * TILE + 16;
          // Keep the room centre clear for spawns, objectives and containers.
          if (Math.abs(px - roomCx) < 52 && Math.abs(py - roomCy) < 52) continue;
          const kind = hs % 3;
          if (kind === 0) drawCrateProp(g, px, py, hs);
          else if (kind === 1) drawBarrelProp(g, px, py, hs);
          else drawPipeProp(g, px, py, hs);
        }
      }
    }

    return c;
  }

  function buildMinimap(tiles, stage = STAGE_DEFS[0]) {
    const scale = 4;
    const c = document.createElement('canvas');
    c.width = MAP_W * scale;
    c.height = MAP_H * scale;
    const g = c.getContext('2d');
    g.fillStyle = '#080d13';
    g.fillRect(0, 0, c.width, c.height);
    const palette = stage.miniPalette || ['#304052', '#293747'];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (tiles[y][x] === 1) {
          g.fillStyle = (x + y) % 2 ? palette[0] : palette[1];
          g.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
    return c;
  }

  function buildFogCanvas() {
    const scale = 4;
    const c = document.createElement('canvas');
    c.width = MAP_W * scale;
    c.height = MAP_H * scale;
    const g = c.getContext('2d');
    g.fillStyle = '#03070b';
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function buildFlowField() {
    if (!world || !player) return;
    const size = MAP_W * MAP_H;
    const dist = new Int16Array(size);
    dist.fill(-1);
    const startX = clamp(Math.floor(player.x / TILE), 0, MAP_W - 1);
    const startY = clamp(Math.floor(player.y / TILE), 0, MAP_H - 1);
    const start = startY * MAP_W + startX;
    const queue = new Int32Array(size);
    let head = 0;
    let tail = 0;
    dist[start] = 0;
    queue[tail++] = start;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (head < tail) {
      const idx = queue[head++];
      const x = idx % MAP_W;
      const y = (idx / MAP_W) | 0;
      const nd = dist[idx] + 1;
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        if (world.tiles[ny][nx] !== 1) continue;
        const nidx = ny * MAP_W + nx;
        if (dist[nidx] === -1) {
          dist[nidx] = nd;
          queue[tail++] = nidx;
        }
      }
    }
    world.flow.dist = dist;
    world.flow.timer = 0.3;
  }

  function flowDirection(entity) {
    if (!world.flow.dist) return { x: player.x - entity.x, y: player.y - entity.y };
    const tx = clamp(Math.floor(entity.x / TILE), 0, MAP_W - 1);
    const ty = clamp(Math.floor(entity.y / TILE), 0, MAP_H - 1);
    const idx = ty * MAP_W + tx;
    const current = world.flow.dist[idx];
    if (current < 0) return { x: player.x - entity.x, y: player.y - entity.y };
    let best = null;
    let bestD = current;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      if (world.tiles[ny][nx] !== 1) continue;
      const nd = world.flow.dist[ny * MAP_W + nx];
      if (nd >= 0 && nd < bestD) {
        bestD = nd;
        best = { x: (nx + 0.5) * TILE - entity.x, y: (ny + 0.5) * TILE - entity.y };
      }
    }
    return best || { x: player.x - entity.x, y: player.y - entity.y };
  }

  function addParticle(x, y, color, count = 5, speed = 80, size = 3, life = 0.45) {
    if (save.settings.performanceMode) {
      if (world.particles.length > 90) return;
      count = Math.min(count, 1);
    } else if (world.particles.length > 220) {
      return;
    }
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const s = rand(speed * 0.25, speed);
      world.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        color, size: rand(1, size + 1), life: rand(life * 0.5, life), maxLife: life
      });
    }
  }

  function addFloatText(x, y, text, color = '#d6ff4d') {
    if (save.settings.floatText === false) return;
    if (world.floatTexts.length > 60) world.floatTexts.shift();
    world.floatTexts.push({ x, y, text, color, life: 0.8, maxLife: 0.8 });
  }

  function showDamageFlash() {
    if (save.settings.damageFlash === false) return;
    el.damageFlash.style.transition = 'none';
    el.damageFlash.style.opacity = '0.8';
    requestAnimationFrame(() => {
      el.damageFlash.style.transition = 'opacity .38s ease-out';
      el.damageFlash.style.opacity = '0';
    });
  }

  function findPlayerLockTarget(maxRange, aimAngle = player ? player.angle : 0, nearestOnly = false) {
    if (!world || !player) return null;
    const valid = (enemy) => enemy && !enemy.dead &&
      dist2(enemy.x, enemy.y, player.x, player.y) <= maxRange * maxRange &&
      isPointVisible(enemy.x, enemy.y);
    const angleDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    if (!nearestOnly && valid(player.lockTarget)) {
      const currentAngle = Math.atan2(player.lockTarget.y - player.y, player.lockTarget.x - player.x);
      if (angleDiff(currentAngle, aimAngle) < 0.58) return player.lockTarget;
    }
    let best = null;
    let bestScore = Infinity;
    for (const enemy of world.enemies) {
      if (!valid(enemy)) continue;
      const d = Math.sqrt(dist2(enemy.x, enemy.y, player.x, player.y));
      const enemyAngle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
      const diff = angleDiff(enemyAngle, aimAngle);
      if (!nearestOnly && diff > AUTO_LOCK_CONE) continue;
      let score = nearestOnly ? d : d * (1 + diff * 1.85);
      if (!nearestOnly) {
        if (diff < Math.PI / 3) score *= 0.72;
        if (enemy.isBoss) score *= 0.82;
        if (enemy.state === 'chase') score *= 0.8;
      }
      if (score < bestScore) {
        bestScore = score;
        best = enemy;
      }
    }
    return best;
  }

  function findSniperTarget(maxRange = 1000) {
    if (!player || !world) return null;
    const aimed = touch.ui && touch.hasAim
      ? touch.aimAngle
      : player.angle;
    return findPlayerLockTarget(maxRange, aimed, false) || findNearestVisibleEnemy(maxRange);
  }

  function findNearestVisibleEnemy(maxRange = 1000) {
    if (!world || !player) return null;
    let best = null;
    let bestD = maxRange * maxRange;
    for (const enemy of world.enemies) {
      if (!enemy || enemy.dead || !isPointVisible(enemy.x, enemy.y)) continue;
      const d = dist2(enemy.x, enemy.y, player.x, player.y);
      if (d < bestD) {
        bestD = d;
        best = enemy;
      }
    }
    return best;
  }

  function spawnBeam(x1, y1, x2, y2, color = '#8bd3ff', width = 3, life = 0.24) {
    if (!world) return;
    world.beams.push({ x1, y1, x2, y2, color, width, life, maxLife: life });
  }

  // ---------------------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------------------
  class Player {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.r = 10;
      this.transcendLevel = getTranscendLevel();
      this.transcendStats = transcendStats(this.transcendLevel);
      this.gearBonus = loadoutBonuses();
      this.collectorBonus = collectorBonuses();
      this.maxHp = 100 + perkRank('vitality') * 10 + this.transcendStats.hp + this.gearBonus.maxHp + this.collectorBonus.maxHp;
      this.hp = this.maxHp;
      this.angle = 0;
      this.speed = 155;
      this.walkPhase = 0;
      this.moving = false;
      this.fireCd = 0;
      this.reloading = false;
      this.reloadTimer = 0;
      this.hurtCd = 0;
      this.stepCd = 0;
      this.medCd = 0;
      this.lockTarget = null;
      this.char = currentCharacterDef();
      this.charId = this.char.id;
      this.activeCd = 0;
      this.activeCdMax = this.char.skill.cd;
      this.dashCdMax = Math.max(2.2, 4 - this.gearBonus.dashCd);
      this.dashCd = 0;
      this.dashTimer = 0;
      this.dashInvuln = 0;
      this.dashAngle = 0;
      this.overdriveTimer = 0;
      this.shield = 0;
      this.shieldTimer = 0;
      this.sniperLock = null;

      const weaponItem = save.equipped.weapon;
      const weaponType = defOf(weaponItem).weapon || 'pistol';
      this.weaponKey = weaponType;
      const weaponBase = WEAPON_DEFS[weaponType] || WEAPON_DEFS.pistol;
      this.weapon = { ...weaponBase };
      // Weapon mods: optic (spread/range), magazine (mag/reload), barrel (damage).
      const weaponMods = weaponItem?.mods || {};
      this.modStats = { spread: 0, range: 0, mag: 0, reload: 0, damage: 0 };
      for (const slot of ['optic', 'mag', 'barrel']) {
        const modType = weaponMods[slot];
        const modDef = modType ? ITEM_DEFS[modType] : null;
        if (!modDef || !modDef.stat) continue;
        for (const key of Object.keys(modDef.stat)) {
          if (key in this.modStats) this.modStats[key] += modDef.stat[key];
        }
      }
      this.weapon.spread = Math.max(0.001, this.weapon.spread * (1 + this.modStats.spread));
      this.weapon.range *= 1 + this.modStats.range;
      this.weapon.mag = Math.max(1, Math.round(this.weapon.mag * (1 + this.modStats.mag)));
      this.weapon.reload *= Math.max(0.5, 1 + this.modStats.reload);
      this.weapon.damage *= 1 + this.modStats.damage;
      this.weaponPlus = enhanceLevel(weaponItem);
      this.mag = this.weapon.mag;
      this.reserve = Math.round((this.weapon.reserve + save.upgrades.ammo * 45) * (1 + perkRank('ammo') * 0.1));
      const armorItem = save.equipped.armor;
      this.armorKey = armorItem ? defOf(armorItem).armor : 'none';
      this.armorPlus = enhanceLevel(armorItem);
      const armorBase = ARMOR_DEFS[this.armorKey] || ARMOR_DEFS.none;
      this.armor = {
        ...armorBase,
        reduction: Math.min(0.75, armorBase.reduction + this.armorPlus * ENHANCE_RULES.armor.perLevel + this.transcendStats.reduction + this.gearBonus.defense)
      };
      this.packItem = save.equipped.pack || null;
      this.packKey = this.packItem ? defOf(this.packItem).pack : null;
      this.packPlus = enhanceLevel(this.packItem);
      this.pack = this.packKey ? {
        ...PACK_QUALITIES[this.packKey],
        bonus: PACK_QUALITIES[this.packKey].bonus + this.packPlus
      } : null;
      this.speed *= 1 + (this.armor.speedBonus || 0) + perkRank('runner') * 0.04 + this.transcendStats.speed + this.gearBonus.moveSpeed + this.collectorBonus.moveSpeed;
      this.medkits = startingMedkits() + (this.armor.medkitBonus || 0);
      this.stealth = this.armor.stealth || 1;
      this.capacity = backpackCapacity() + this.gearBonus.capacity;
      this.backpack = [];
      this.damageMultiplier = 1 + this.weaponPlus * ENHANCE_RULES.weapon.perLevel + this.transcendStats.damage + this.gearBonus.damage + this.collectorBonus.damage;
      this.flatDamage = this.collectorBonus.flatDamage;
      this.critChance = this.gearBonus.crit + this.collectorBonus.crit;
      this.lifesteal = this.gearBonus.lifesteal;
      this.antiBoss = this.gearBonus.antiBoss;
      this.bulletPierce = this.charId === 'sniper' || this.gearBonus.pierce > 0;
    }

    update(dt) {
      this.dashCd = Math.max(0, this.dashCd - dt);
      this.activeCd = Math.max(0, this.activeCd - dt);
      this.overdriveTimer = Math.max(0, this.overdriveTimer - dt);
      this.dashInvuln = Math.max(0, this.dashInvuln - dt);
      if (this.shieldTimer > 0) {
        this.shieldTimer = Math.max(0, this.shieldTimer - dt);
        if (this.shieldTimer <= 0) this.shield = 0;
      }
      let dx = 0;
      let dy = 0;
      if (keys['w'] || keys['arrowup']) dy -= 1;
      if (keys['s'] || keys['arrowdown']) dy += 1;
      if (keys['a'] || keys['arrowleft']) dx -= 1;
      if (keys['d'] || keys['arrowright']) dx += 1;

      if (touch.ui) {
        const inputSmooth = 1 - Math.exp(-dt * 30);
        touch.moveMag += (touch.moveTargetMag - touch.moveMag) * inputSmooth;
        if (touch.moveMag > 0.004) {
          const moveCurve = 1 / (save.settings.moveSensitivity || 1);
          const touchMag = Math.min(1, Math.pow(touch.moveMag, moveCurve));
          dx += touch.moveX * touchMag;
          dy += touch.moveY * touchMag;
        }
      }

      const len = Math.hypot(dx, dy);
      const moveStrength = Math.min(1, len);
      this.moving = len > 0.04 || this.dashTimer > 0;
      if (this.dashTimer > 0) {
        // Universal dash: fixed short displacement with a brief dodge window.
        this.dashTimer = Math.max(0, this.dashTimer - dt);
        const dashSpeed = 760;
        moveWithCollision(this, Math.cos(this.dashAngle) * dashSpeed * dt, Math.sin(this.dashAngle) * dashSpeed * dt);
        this.dashInvuln = Math.max(this.dashInvuln, 0.08);
        this.walkPhase += dt * 22;
        if (Math.random() < 0.65) {
          addParticle(this.x - Math.cos(this.dashAngle) * 10, this.y - Math.sin(this.dashAngle) * 10,
            this.char.color || '#d6ff4d', 1, 30, 2, 0.28);
        }
      } else if (len > 0.04) {
        const nx = dx / len;
        const ny = dy / len;
        const sprint = keys['shift'] ? 1.4 : 1;
        const sp = this.speed * sprint;
        moveWithCollision(this, nx * sp * dt * moveStrength, ny * sp * dt * moveStrength);
        this.walkPhase += dt * (keys['shift'] ? 13 : 9);
        this.stepCd -= dt;
        if (this.stepCd <= 0) {
          this.stepCd = keys['shift'] ? 0.24 : 0.35;
          addParticle(this.x, this.y + 9, 'rgba(145,160,184,.25)', 1, 20, 2, 0.25);
        }
      }

      if (touch.ui && touch.hasAim) {
        const sens = save.settings.aimSensitivity || 1;
        const smooth = Math.min(1, dt * 22 * sens);
        const diff = Math.atan2(Math.sin(touch.aimTargetAngle - touch.aimAngle), Math.cos(touch.aimTargetAngle - touch.aimAngle));
        touch.aimAngle += diff * smooth;
        this.angle = touch.aimAngle;
      } else if (touch.ui && this.moving) {
        this.angle = Math.atan2(dy, dx);
      } else {
        const mx = mouse.x + camera.x;
        const my = mouse.y + camera.y;
        this.angle = Math.atan2(my - this.y, mx - this.x);
      }

      this.fireCd = Math.max(0, this.fireCd - dt);
      this.hurtCd = Math.max(0, this.hurtCd - dt);
      this.medCd = Math.max(0, this.medCd - dt);

      if (this.reloading) {
        this.reloadTimer -= dt;
        if (this.reloadTimer <= 0) this.finishReload();
      }

      const lockAimAngle = touch.ui && touch.hasAim ? touch.aimAngle : this.angle;
      const mobileNearestLock = touch.ui;
      const wantsLock = save.settings.autoLock !== false && (touch.ui ? touch.aiming : (mouse.down || mouse.semiQueued));
      this.lockTarget = wantsLock ? findPlayerLockTarget(this.weapon.range + 60, lockAimAngle, mobileNearestLock) : null;
      if (this.lockTarget) {
        this.angle = Math.atan2(this.lockTarget.y - this.y, this.lockTarget.x - this.x);
      }
      if (this.sniperLock) {
        const target = this.sniperLock.target;
        if (!target || target.dead) {
          this.sniperLock = null;
          addLootFeed('猎杀目标已消失，狙击取消。', false);
        } else {
          this.sniperLock.timer -= dt;
          this.lockTarget = target;
          this.angle = Math.atan2(target.y - this.y, target.x - this.x);
          if (this.sniperLock.timer <= 0) this.fireSniperShot();
        }
      }
      const holdSeconds = touch.aiming && touch.aimPressAt ? (performance.now() - touch.aimPressAt) / 1000 : 0;
      const touchWantsShoot = touch.ui && touch.aiming && holdSeconds >= 0.15;
      touch.firing = touchWantsShoot && !this.reloading;
      const wantsShoot = touchWantsShoot || (this.weapon.auto ? mouse.down : mouse.semiQueued);
      if (wantsShoot && !this.reloading) {
        if (this.tryShoot()) {
          if (!this.weapon.auto && !touch.ui) mouse.semiQueued = false;
        }
      }

      if (keys['r']) this.startReload();
    }

    tryShoot() {
      if (this.reloading || this.fireCd > 0) return false;
      if (this.mag <= 0) {
        this.startReload();
        playSound('empty');
        return false;
      }
      const pellets = this.weapon.pellets || 1;
      let muzzleX = this.x + Math.cos(this.angle) * 20;
      let muzzleY = this.y + Math.sin(this.angle) * 20;
      for (let i = 0; i < pellets; i++) {
        const angle = this.angle + rand(-this.weapon.spread, this.weapon.spread);
        const isCrit = Math.random() < this.critChance;
        muzzleX = this.x + Math.cos(angle) * 20;
        muzzleY = this.y + Math.sin(angle) * 20;
        world.bullets.push({
          x: muzzleX,
          y: muzzleY,
          prevX: muzzleX,
          prevY: muzzleY,
          vx: Math.cos(angle) * this.weapon.speed,
          vy: Math.sin(angle) * this.weapon.speed,
          damage: this.weapon.damage * this.damageMultiplier * (isCrit ? 2 : 1) + this.flatDamage,
          owner: 'player',
          color: isCrit ? '#ffd15c' : this.weapon.color,
          life: this.weapon.range / this.weapon.speed,
          maxLife: this.weapon.range / this.weapon.speed,
          pierce: this.bulletPierce,
          crit: isCrit,
          hitEnemies: []
        });
      }
      this.mag -= 1;
      this.fireCd = this.weapon.cooldown * (this.overdriveTimer > 0 ? 0.69 : 1) * Math.max(0.55, 1 - this.gearBonus.fireRate);
      world.shake = Math.max(world.shake, this.weapon.shake || 2.1);
      addParticle(muzzleX, muzzleY, '#ffd875', pellets > 1 ? 6 : 3, 90, 2, 0.16);
      addParticle(muzzleX, muzzleY, this.weapon.color, 2, 45, 2, 0.12);
      playSound('shoot', this.weaponKey);

      // Gunfire alerts nearby enemies.
      for (const enemy of world.enemies) {
        if (enemy.dead) continue;
        if (dist2(enemy.x, enemy.y, this.x, this.y) < 520 * 520) {
          enemy.lastSeen = { x: this.x, y: this.y };
          enemy.alertTimer = Math.max(enemy.alertTimer, 2.8);
        }
      }
      advanceRaidTutorial(2);
      updateHUD();
      return true;
    }

    startReload() {
      if (this.reloading || this.mag >= this.weapon.mag || this.reserve <= 0) return;
      this.reloading = true;
      const charReload = this.charId === 'assault' ? 0.8 : 1;
      this.reloadTimer = this.weapon.reload * charReload * Math.max(0.55, 1 - perkRank('quickhands') * 0.07);
      playSound('reload');
      updateHUD();
    }

    finishReload() {
      const need = this.weapon.mag - this.mag;
      const loaded = Math.min(need, this.reserve);
      this.mag += loaded;
      this.reserve -= loaded;
      this.reloading = false;
      this.reloadTimer = 0;
      playSound('reload');
      updateHUD();
    }

    useMedkit() {
      if (this.medCd > 0) return;
      if (this.medkits <= 0) { toast('没有医疗包了。'); return; }
      if (this.hp >= this.maxHp) { toast('生命值已满。'); return; }
      this.medkits -= 1;
      this.hp = Math.min(this.maxHp, this.hp + 48);
      this.medCd = 0.8;
      addParticle(this.x, this.y, '#7bf5a8', 7, 55, 3, 0.55);
      playSound('pickup');
      addLootFeed('使用医疗包，生命 +48', false);
      updateHUD();
    }

    takeDamage(amount, sourceAngle = null) {
      if (this.hurtCd > 0 || mode !== 'raid' || raid.ended) return;
      if (this.dashInvuln > 0) {
        if (raid.stats) raid.stats.dodges += 1;
        addFloatText(this.x, this.y - 26, '闪避', '#7ee8d2');
        return;
      }
      this.hurtCd = 0.075;
      let finalDamage = Math.max(1, amount * (1 - this.armor.reduction) * (1 - perkRank('bulwark') * 0.03));
      if (this.charId === 'pioneer' && this.hp / this.maxHp <= 0.35) finalDamage *= 0.8;
      if (this.charId === 'juggernaut') finalDamage *= 0.88;
      let shieldAbsorb = 0;
      if (this.shield > 0) {
        shieldAbsorb = Math.min(this.shield, finalDamage);
        this.shield -= shieldAbsorb;
        finalDamage -= shieldAbsorb;
        addFloatText(this.x, this.y - 28, `护盾 -${Math.round(shieldAbsorb)}`, '#8bd3ff');
      }
      world.shake = Math.max(world.shake, shieldAbsorb > 0 ? 4 : 6);
      showDamageFlash();
      if (Number.isFinite(sourceAngle)) showDamageDirection(sourceAngle);
      playSound('hurt');
      addParticle(this.x, this.y, shieldAbsorb > 0 ? '#58a6ff' : '#ff5b6e', 5, 60, 2, 0.4);
      if (raid && raid.interactionType === 'search' && raid.progress > 0.05) {
        raid.searchInterruptTimer = 0.9;
        addFloatText(this.x, this.y - 24, '搜索被打断', '#ffad45');
      }
      if (raid.stats) raid.stats.damageTaken += finalDamage + shieldAbsorb;
      if (finalDamage > 0) this.hp -= finalDamage;
      updateHUD();
      if (this.hp <= 0) {
        this.hp = 0;
        endRaid(false, '你被击倒了，携带的物资全部丢失。');
      }
    }

    tryDash() {
      if (!raid || raid.ended || raid.paused || this.dashCd > 0) return false;
      let dx = 0;
      let dy = 0;
      if (keys['w'] || keys['arrowup']) dy -= 1;
      if (keys['s'] || keys['arrowdown']) dy += 1;
      if (keys['a'] || keys['arrowleft']) dx -= 1;
      if (keys['d'] || keys['arrowright']) dx += 1;
      if (touch.ui && touch.moveMag > 0.12) {
        dx += touch.moveX;
        dy += touch.moveY;
      }
      const len = Math.hypot(dx, dy);
      this.dashAngle = len > 0.05 ? Math.atan2(dy, dx) : this.angle;
      this.dashTimer = 0.18;
      this.dashInvuln = 0.34;
      this.dashCd = this.dashCdMax;
      this.lockTarget = null;
      addParticle(this.x, this.y, this.char.color || '#d6ff4d', 9, 90, 2, 0.4);
      playSound('reload');
      addLootFeed('冲刺 · 短暂无敌', false);
      advanceRaidTutorial(3);
      updateHUD();
      return true;
    }

    useCharacterSkill() {
      if (!raid || raid.ended || raid.paused || this.activeCd > 0) return false;
      const skill = this.char.skill;
      if (skill.type === 'heal') {
        if (this.hp >= this.maxHp - 0.5) {
          toast('生命值已满，应急治疗未消耗冷却。');
          return false;
        }
        const amount = this.maxHp * 0.1;
        this.hp = Math.min(this.maxHp, this.hp + amount);
        this.activeCd = skill.cd;
        addParticle(this.x, this.y, '#7bf5a8', 12, 75, 3, 0.65);
        addFloatText(this.x, this.y - 32, `+${Math.round(amount)} HP`, '#7bf5a8');
        addLootFeed(`应急治疗：生命 +${Math.round(amount)}`, false);
        playSound('pickup');
      } else if (skill.type === 'snipe') {
        const target = findSniperTarget(1000);
        if (!target) {
          toast('没有可见的锁定目标。');
          return false;
        }
        this.activeCd = skill.cd;
        this.sniperLock = { target, timer: 1.5, total: 1.5 };
        this.lockTarget = target;
        addLootFeed(`猎杀协议锁定：${target.name || target.kind}`, true);
        playSound('reload');
      } else if (skill.type === 'overdrive') {
        this.activeCd = skill.cd;
        this.overdriveTimer = 4;
        addParticle(this.x, this.y, '#ffad45', 10, 80, 3, 0.5);
        addLootFeed('火力过载：4 秒射速 +45%', false);
        playSound('reload');
      } else if (skill.type === 'shield') {
        this.activeCd = skill.cd;
        this.shield = 60;
        this.shieldTimer = 8;
        addParticle(this.x, this.y, '#58a6ff', 12, 70, 3, 0.6);
        addLootFeed('应急护盾：60 点护盾 / 8 秒', false);
        playSound('pickup');
      }
      advanceRaidTutorial(3);
      updateHUD();
      return true;
    }

    fireSniperShot() {
      const lock = this.sniperLock;
      this.sniperLock = null;
      if (!lock || !lock.target || lock.target.dead) return;
      const target = lock.target;
      const angle = Math.atan2(target.y - this.y, target.x - this.x);
      const damage = this.weapon.damage * this.damageMultiplier * 7 * (target.isBoss ? 1 + (this.antiBoss || 0) : 1);
      spawnBeam(this.x, this.y, target.x, target.y, '#58c7ff', 4, 0.32);
      addParticle(this.x + Math.cos(angle) * 20, this.y + Math.sin(angle) * 20, '#8bd3ff', 8, 120, 2, 0.35);
      addParticle(target.x, target.y, '#bfeaff', 14, 110, 3, 0.65);
      target.takeDamage(damage, angle, { ignoreDefense: true, characterSkill: true });
      if (raid.stats) raid.stats.skillHits += 1;
      addFloatText(target.x, target.y - 38, '猎杀 · 7×', '#8bd3ff');
      world.shake = Math.max(world.shake, 6);
      playSound('shoot', 'dmr');
      updateHUD();
    }

    heal(amount) {
      this.hp = Math.min(this.maxHp, this.hp + amount);
    }
  }

  // ---------------------------------------------------------------------------
  // Enemy AI
  // ---------------------------------------------------------------------------
  class Enemy {
    constructor(x, y, kind, room) {
      this.x = x;
      this.y = y;
      this.kind = kind;
      this.room = room;
      this.isBoss = kind === 'boss';
      this.r = this.isBoss ? 16 : 9;
      this.defense = this.isBoss ? 0.18 : kind === 'heavy' ? 0.22 : 0;
      this.dead = false;
      this.angle = rand(0, TAU);
      this.walkPhase = 0;
      this.state = 'patrol';
      this.alertTimer = 0;
      this.lastSeen = null;
      this.patrolTarget = roomSpot(room);
      this.patrolWait = rand(0.4, 1.8);
      this.stuckTimer = 0;
      this.fireCd = rand(0.2, 0.9);
      this.hitFlash = 0;
      this.muzzleFlash = 0;
      this.shotWindup = 0;
      this.shotWindupMax = 0;
      this.winding = false;
      this.elite = false;
      this.eliteAffix = null;
      this.eliteLabel = '';
      this.squadLeader = false;
      this.squadMember = false;
      this.carriesKey = false;
      this.attackType = 'burst';
      this.attackAimAngle = this.angle;
      this.chargePhase = null;
      this.chargeTimer = 0;
      this.chargeAngle = 0;
      this.chargeHit = false;
      this.castType = null;
      this.castTimer = 0;
      this.castMax = 0;
      this.castLabel = '';
      this.casting = false;
      this.attackCd = 0;
      this.bossCycle = 0;
      this.barrageWaves = 0;
      this.barrageTimer = 0;
      this.barrageAngle = 0;
      this.bossVariant = null;
      this.bossPhase = 1;
      this.weakPointTimer = 0;
      this.weakPointMax = 0;
      this.phaseFlash = 0;

      const risk = riskDef();
      const floor = Math.max(1, raid?.floor || 1);
      if (this.isBoss) {
        const challengeVariant = raid?.challenge
          ? BOSS_VARIANTS.find((variant) => variant.id === raid.challenge.bossId)
          : null;
        const variant = challengeVariant || bossVariantForFloor(floor);
        this.bossVariant = variant;
        this.name = variant.name;
        this.color = variant.color;
        this.maxHp = Math.round(variant.hp * (1 + (floor - 1) * 0.2) * risk.enemyHp);
        this.hp = this.maxHp;
        this.speed = variant.speed;
        this.vision = variant.vision;
        this.range = variant.range;
        this.damage = variant.damage * (1 + (floor - 1) * 0.1) * risk.enemyDamage;
        this.cooldown = 2.4;
        this.xp = Math.round((180 + Math.floor(floor / 5) * 55) * (1 + (floor - 1) * 0.12) * (1 + (risk.enemyDamage - 1) * 0.75));
        this.scrap = Math.round((45 + Math.floor(floor / 5) * 12) * (1 + (floor - 1) * 0.12) * (1 + (risk.enemyDamage - 1) * 0.75));
        this.attackType = 'boss';
        this.attackCd = rand(1.4, 2.2);
      } else {
        const statTable = {
          grunt: { hp: 46, speed: 78, vision: 340, range: 340, damage: 8, cooldown: 1.35, xp: 18, scrap: 3, color: '#d65b64', attack: 'burst', name: '突击兵' },
          scout: { hp: 34, speed: 116, vision: 385, range: 320, damage: 7, cooldown: 1.9, xp: 17, scrap: 2, color: '#df8b45', attack: 'charge', name: '猎犬突袭者' },
          heavy: { hp: 102, speed: 48, vision: 325, range: 370, damage: 13, cooldown: 1.75, xp: 34, scrap: 6, color: '#a84a69', attack: 'fan', name: '重装守卫' },
          sniper: { hp: 38, speed: 60, vision: 540, range: 540, damage: 17, cooldown: 2.15, xp: 25, scrap: 4, color: '#8a6bd8', attack: 'sniper', name: '线列狙击手' },
          bomber: { hp: 62, speed: 65, vision: 405, range: 430, damage: 12, cooldown: 2.4, xp: 27, scrap: 5, color: '#d88b3f', attack: 'mortar', name: '迫击投弹手' },
          orbiter: { hp: 52, speed: 74, vision: 395, range: 405, damage: 6, cooldown: 2.2, xp: 29, scrap: 5, color: '#58a6ff', attack: 'radial', name: '浮游炮台' }
        };
        const s = statTable[kind] || statTable.grunt;
        this.name = s.name;
        this.maxHp = Math.round(s.hp * (1 + (floor - 1) * 0.24) * risk.enemyHp);
        this.hp = this.maxHp;
        this.speed = s.speed * (1 + Math.min(0.25, (floor - 1) * 0.015));
        this.vision = s.vision;
        this.range = s.range;
        this.damage = s.damage * (1 + (floor - 1) * 0.12) * risk.enemyDamage;
        this.cooldown = s.cooldown;
        this.xp = Math.round(s.xp * (1 + (floor - 1) * 0.16) * (1 + (risk.enemyDamage - 1) * 0.75));
        this.scrap = Math.round(s.scrap * (1 + (floor - 1) * 0.16) * (1 + (risk.enemyDamage - 1) * 0.75));
        this.color = s.color;
        this.attackType = s.attack;
      }
    }

    update(dt) {
      if (this.dead) return;
      this.fireCd = Math.max(0, this.fireCd - dt);
      this.attackCd = Math.max(0, this.attackCd - dt);
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);
      this.weakPointTimer = Math.max(0, this.weakPointTimer - dt);
      this.phaseFlash = Math.max(0, this.phaseFlash - dt);
      if (this.eliteAffix === 'regenerating' && this.hp > 0 && this.hp < this.maxHp) {
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.012 * dt);
      }

      const dxToPlayer = player.x - this.x;
      const dyToPlayer = player.y - this.y;
      const distToPlayer = Math.hypot(dxToPlayer, dyToPlayer);
      const canSee = distToPlayer < this.vision * (player.stealth || 1) && lineOfSight(this.x, this.y, player.x, player.y);

      if (canSee) {
        if (this.state !== 'chase') {
          this.alertTimer = 3.5;
          this.patrolWait = 0;
          addFloatText(this.x, this.y - 26, '!', '#ff9c47');
        }
        this.state = 'chase';
        this.lastSeen = { x: player.x, y: player.y };
        this.alertTimer = 3.2;
      } else if (this.state === 'chase') {
        this.alertTimer -= dt;
        if (this.alertTimer <= 0) {
          this.state = 'patrol';
          this.lastSeen = null;
          this.patrolWait = rand(0.3, 1.1);
          this.patrolTarget = roomSpot(this.room || pick(world.rooms));
        }
      }

      // Chargers enter a dedicated windup/dash/recover cycle.
      if (!this.isBoss && this.chargePhase) {
        this.updateCharge(dt);
        this.separateFromOthers();
        return;
      }

      let moveX = 0;
      let moveY = 0;
      const holdingAttack = this.castType || this.barrageWaves > 0;

      if (this.state === 'chase') {
        if (!holdingAttack && canSee && distToPlayer < 105) {
          moveX = -dxToPlayer / Math.max(1, distToPlayer);
          moveY = -dyToPlayer / Math.max(1, distToPlayer);
        } else if (!holdingAttack && canSee && distToPlayer < 200) {
          const strafe = Math.sin(world.time * 1.7 + this.walkPhase) * 0.8;
          moveX = (-dyToPlayer / Math.max(1, distToPlayer)) * strafe;
          moveY = (dxToPlayer / Math.max(1, distToPlayer)) * strafe;
        } else if (!holdingAttack) {
          const d = flowDirection(this);
          const l = Math.hypot(d.x, d.y) || 1;
          moveX = d.x / l;
          moveY = d.y / l;
        }
        this.angle = Math.atan2(dyToPlayer, dxToPlayer);
      } else if (!holdingAttack) {
        if (!this.patrolTarget || dist2(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y) < 16 * 16) {
          this.patrolWait -= dt;
          if (this.patrolWait <= 0) {
            this.patrolTarget = roomSpot(this.room || pick(world.rooms));
            this.patrolWait = rand(0.5, 2.2);
          }
        } else {
          const tx = this.patrolTarget.x - this.x;
          const ty = this.patrolTarget.y - this.y;
          const l = Math.hypot(tx, ty) || 1;
          moveX = tx / l;
          moveY = ty / l;
          this.angle = Math.atan2(ty, tx);
        }
      }

      if (moveX || moveY) {
        const oldX = this.x;
        const oldY = this.y;
        const moveSpeed = this.speed * (this.isBoss && this.weakPointTimer > 0 ? 0.6 : 1);
        moveWithCollision(this, moveX * moveSpeed * dt, moveY * moveSpeed * dt);
        this.walkPhase += dt * 8;
        if (dist2(oldX, oldY, this.x, this.y) < 0.02) {
          this.stuckTimer += dt;
          if (this.stuckTimer > 0.5) {
            this.stuckTimer = 0;
            if (this.state === 'patrol') this.patrolTarget = roomSpot(this.room || pick(world.rooms));
            else this.lastSeen = { x: player.x + rand(-80, 80), y: player.y + rand(-80, 80) };
          }
        } else {
          this.stuckTimer = 0;
        }
      }

      this.separateFromOthers();

      if (this.isBoss) {
        this.updateBossCombat(dt, canSee, distToPlayer);
      } else if (this.attackType === 'charge') {
        this.updateChargerCombat(dt, canSee, distToPlayer);
      } else {
        this.updateRangedCombat(dt, canSee, distToPlayer);
      }
    }

    separateFromOthers() {
      for (const other of world.enemies) {
        if (other === this || other.dead) continue;
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < 24 * 24) {
          const d = Math.sqrt(d2);
          const overlap = (24 - d) * 0.5;
          moveWithCollision(this, (dx / d) * overlap, (dy / d) * overlap);
        }
      }
    }

    updateChargerCombat(dt, canSee, distToPlayer) {
      if (this.chargePhase) return;
      if (canSee && distToPlayer < 360 && this.fireCd <= 0) {
        this.chargePhase = 'windup';
        this.chargeTimer = 0.55;
        this.chargeAngle = Math.atan2(player.y - this.y, player.x - this.x);
        this.attackAimAngle = this.chargeAngle;
        this.shotWindupMax = 0.55;
        this.shotWindup = 0.55;
        this.fireCd = 999;
        addFloatText(this.x, this.y - 30, '蓄力冲撞', '#ffad45');
      }
    }

    updateCharge(dt) {
      if (this.chargePhase === 'windup') {
        this.chargeTimer -= dt;
        this.angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.chargeAngle = this.angle;
        this.shotWindup = Math.max(0, this.chargeTimer);
        if (this.chargeTimer <= 0) {
          this.chargePhase = 'dash';
          this.chargeTimer = 0.34;
          this.chargeHit = false;
          this.shotWindup = 0;
          addFloatText(this.x, this.y - 28, '冲撞!', '#ff5b6e');
          playSound('enemyShoot');
        }
      } else if (this.chargePhase === 'dash') {
        const step = this.speed * 3.8 * dt;
        moveWithCollision(this, Math.cos(this.chargeAngle) * step, Math.sin(this.chargeAngle) * step);
        this.walkPhase += dt * 20;
        this.chargeTimer -= dt;
        if (!this.chargeHit && dist2(this.x, this.y, player.x, player.y) < (this.r + player.r + 5) ** 2) {
          this.chargeHit = true;
          player.takeDamage(this.damage * 1.9, this.chargeAngle);
          world.shake = Math.max(world.shake, 7);
          addParticle(player.x, player.y, '#ff9c47', 9, 80, 3, 0.4);
        }
        if (this.chargeTimer <= 0) {
          this.chargePhase = 'recover';
          this.chargeTimer = 0.45;
        }
      } else if (this.chargePhase === 'recover') {
        this.chargeTimer -= dt;
        if (this.chargeTimer <= 0) {
          this.chargePhase = null;
          this.fireCd = this.cooldown;
        }
      }
    }

    updateRangedCombat(dt, canSee, distToPlayer) {
      if (this.winding) {
        if (!canSee || distToPlayer > this.range * 1.25) {
          this.winding = false;
          this.shotWindup = 0;
          return;
        }
        if (this.attackType !== 'sniper') this.attackAimAngle = Math.atan2(player.y - this.y, player.x - this.x);
        this.shotWindup = Math.max(0, this.shotWindup - dt);
        if (this.shotWindup <= 0) {
          this.winding = false;
          this.shoot();
        }
      } else if (canSee && distToPlayer < this.range && this.fireCd <= 0) {
        this.winding = true;
        this.shotWindupMax = this.attackType === 'sniper' ? 0.95
          : this.attackType === 'mortar' ? 0.8
          : this.attackType === 'radial' ? 0.5
          : this.attackType === 'fan' ? 0.4 : 0.3;
        this.shotWindup = this.shotWindupMax;
        this.attackAimAngle = Math.atan2(player.y - this.y, player.x - this.x);
      }
    }

    updateBossCombat(dt, canSee, distToPlayer) {
      if (this.castType) {
        this.castTimer -= dt;
        this.shotWindup = Math.max(0, this.castTimer);
        this.angle = Math.atan2(player.y - this.y, player.x - this.x);
        if (this.castTimer <= 0) {
          const type = this.castType;
          this.castType = null;
          this.casting = false;
          this.castLabel = '';
          this.shotWindup = 0;
          if (type === 'barrage') {
            this.barrageWaves = this.bossVariant.ringWaves;
            this.barrageTimer = 0;
            this.barrageAngle = Math.atan2(player.y - this.y, player.x - this.x);
            addLootFeed('首领发动全图弹幕：寻找墙体掩体！', true);
          } else if (type === 'slam') {
            this.spawnBossHazards();
            this.attackCd = this.bossAttackDelay(3.1);
          } else if (type === 'fan') {
            this.fireBossFan();
            this.attackCd = this.bossAttackDelay(2.35);
          } else if (type === 'signature') {
            this.fireBossSignature();
            this.attackCd = this.bossAttackDelay(4.4);
          }
        }
        return;
      }

      if (this.barrageWaves > 0) {
        this.barrageTimer -= dt;
        if (this.barrageTimer <= 0) {
          this.fireBossRing();
          this.barrageWaves -= 1;
          this.barrageTimer = 0.24;
          if (this.barrageWaves <= 0) {
            this.attackCd = this.bossAttackDelay(3.25);
            this.openBossWeakPoint(2.7);
          }
        }
        return;
      }

      // Exposed cores are a deliberate damage window: no new cast, slower movement.
      if (this.weakPointTimer > 0) return;
      if (!canSee && distToPlayer > 460) return;
      if (this.attackCd <= 0) {
        this.bossCycle += 1;
        if (this.bossCycle % 4 === 1) this.beginBossCast('barrage', 0.95, '全图弹幕');
        else if (this.bossCycle % 4 === 2) this.beginBossCast('slam', 1.0, '重击锁定');
        else if (this.bossCycle % 4 === 3) this.beginBossCast('fan', 0.55, '压制散射');
        else this.beginBossCast('signature', 1.15, this.bossVariant.signature?.label || '首领绝技');
      }
    }

    bossAttackDelay(base) {
      return base * (this.bossPhase === 3 ? 0.72 : this.bossPhase === 2 ? 0.86 : 1);
    }

    openBossWeakPoint(seconds) {
      this.weakPointTimer = Math.max(this.weakPointTimer, seconds);
      this.weakPointMax = this.weakPointTimer;
      this.phaseFlash = Math.max(this.phaseFlash, 0.45);
      addLootFeed('首领核心暴露：伤害 ×1.5，趁现在集火！', true);
      addFloatText(this.x, this.y - 48, '核心暴露 ×1.5', '#ffd15c');
      world.shake = Math.max(world.shake, 4);
      playSound('level');
    }

    enterBossPhase(phase) {
      this.bossPhase = phase;
      this.castType = null;
      this.barrageWaves = 0;
      this.casting = false;
      this.castLabel = '';
      this.shotWindup = 0;
      this.bossCycle = 0;
      this.attackCd = 1.0;
      this.speed *= phase === 2 ? 1.08 : 1.14;
      this.damage *= phase === 2 ? 1.06 : 1.12;
      this.phaseFlash = 1.2;
      this.openBossWeakPoint(phase === 3 ? 3.5 : 2.8);
      addLootFeed(`首领进入阶段 ${phase}/3：攻击密度提升！`, true);
      addFloatText(this.x, this.y - 54, `阶段 ${phase} / 3`, phase === 3 ? '#ff5b6e' : '#ffad45');
      world.shake = Math.max(world.shake, 9);
      playSound('level');
    }

    beginBossCast(type, duration, label) {
      this.castType = type;
      const phaseScale = this.bossPhase === 3 ? 0.78 : this.bossPhase === 2 ? 0.9 : 1;
      duration *= phaseScale;
      this.castTimer = duration;
      this.castMax = duration;
      this.castLabel = label;
      this.casting = true;
      this.shotWindupMax = duration;
      this.shotWindup = duration;
      this.angle = Math.atan2(player.y - this.y, player.x - this.x);
      addFloatText(this.x, this.y - 38, label, this.bossVariant.color);
      playSound('reload');
    }

    fireBossRing() {
      const variant = this.bossVariant;
      const count = variant.ringCount + (this.bossPhase - 1) * 4;
      const ringSpeed = variant.ringSpeed + (this.bossPhase - 1) * 18;
      for (let i = 0; i < count; i++) {
        const angle = this.barrageAngle + (i / count) * TAU;
        spawnEnemyBullet(this.x, this.y, angle, ringSpeed, this.damage * 0.58, {
          color: variant.color, life: 4.6, radius: 3, kind: 'bossRing'
        });
      }
      this.barrageAngle += 0.13;
      this.muzzleFlash = 0.12;
      world.shake = Math.max(world.shake, 5);
      addParticle(this.x, this.y, variant.color, 14, 95, 3, 0.35);
      playSound('enemyShoot');
    }

    fireBossFan() {
      const variant = this.bossVariant;
      const base = Math.atan2(player.y - this.y, player.x - this.x);
      const spreadCount = 5 + (this.bossPhase - 1) * 1;
      for (let i = -spreadCount; i <= spreadCount; i++) {
        spawnEnemyBullet(this.x, this.y, base + i * 0.1, 500 + (this.bossPhase - 1) * 25, this.damage * 0.85, {
          color: variant.color, life: 1.35, radius: 2.5, kind: 'bossFan'
        });
      }
      this.muzzleFlash = 0.12;
      world.shake = Math.max(world.shake, 3);
      playSound('enemyShoot');
    }

    spawnBossHazards() {
      const variant = this.bossVariant;
      const count = variant.slamCount + (this.bossPhase - 1);
      for (let i = 0; i < count; i++) {
        let hx = player.x;
        let hy = player.y;
        if (i > 0) {
          const angle = rand(0, TAU);
          const dist = rand(75, 160);
          hx += Math.cos(angle) * dist;
          hy += Math.sin(angle) * dist;
          if (isSolidAt(hx, hy)) {
            hx = player.x;
            hy = player.y;
          }
        }
        spawnHazard(hx, hy, variant.slamRadius + (this.bossPhase - 1) * 4, 1.55 + i * 0.12, this.damage * 3.1, variant.color, '重击');
      }
      addLootFeed('首领锁定区域，立刻离开红色警示圈！', true);
      playSound('enemyShoot');
    }

    fireBossSignature() {
      const variant = this.bossVariant;
      const sig = variant.signature?.type || 'array';
      const base = Math.atan2(player.y - this.y, player.x - this.x);
      addLootFeed(`首领绝技：${variant.signature?.label || '未知协议'}`, true);
      world.shake = Math.max(world.shake, 7);
      playSound('enemyShoot');
      if (sig === 'quake') {
        for (let i = 0; i < 5; i++) {
          const dist = 70 + i * 44;
          const hx = this.x + Math.cos(base) * dist;
          const hy = this.y + Math.sin(base) * dist;
          spawnHazard(hx, hy, 54 + this.bossPhase * 5, 1.0 + i * 0.1, this.damage * 2.5, variant.color, '裂地');
        }
        addParticle(this.x + Math.cos(base) * 150, this.y + Math.sin(base) * 150, variant.color, 20, 110, 4, 0.55);
      } else if (sig === 'prism') {
        const origins = [[-110, 0], [110, 0], [0, -110], [0, 110]];
        for (const [ox, oy] of origins) {
          const px = player.x + ox;
          const py = player.y + oy;
          if (isSolidAt(px, py)) continue;
          const a = Math.atan2(player.y - py, player.x - px);
          for (let i = -3; i <= 3; i++) {
            spawnEnemyBullet(px, py, a + i * 0.08, 350, this.damage * 0.62, { color: variant.color, life: 1.8, radius: 2.5, kind: 'bossPrism' });
          }
        }
        addParticle(player.x, player.y, variant.color, 24, 95, 3, 0.6);
      } else if (sig === 'lava') {
        for (let i = 0; i < 6; i++) {
          const angle = rand(0, TAU);
          const dist = rand(35, 170);
          const hx = player.x + Math.cos(angle) * dist;
          const hy = player.y + Math.sin(angle) * dist;
          spawnHazard(hx, hy, 48 + this.bossPhase * 4, 1.7 + i * 0.08, this.damage * 2.2, variant.color, '熔核');
        }
        addLootFeed('熔核正在喷发：远离橙色警示圈！', true);
      } else if (sig === 'gravity') {
        for (let i = 0; i < 20 + this.bossPhase * 4; i++) {
          const a = base + (i / (20 + this.bossPhase * 4)) * TAU;
          spawnEnemyBullet(this.x, this.y, a, 250 + this.bossPhase * 18, this.damage * 0.55, { color: variant.color, life: 5, radius: 3.2, kind: 'bossGravity' });
        }
        spawnHazard(player.x, player.y, 92, 1.9, this.damage * 3.2, '#c084ff', '引力井');
      } else if (sig === 'blink') {
        let tx = this.x;
        let ty = this.y;
        for (let i = 0; i < 12; i++) {
          const a = rand(0, TAU);
          const d = rand(135, 220);
          const nx = player.x + Math.cos(a) * d;
          const ny = player.y + Math.sin(a) * d;
          if (!isSolidAt(nx, ny)) { tx = nx; ty = ny; break; }
        }
        addParticle(this.x, this.y, variant.color, 20, 120, 3, 0.55);
        this.x = tx;
        this.y = ty;
        this.attackAimAngle = Math.atan2(player.y - this.y, player.x - this.x);
        addParticle(this.x, this.y, variant.color, 22, 120, 3, 0.55);
        this.fireBossFan();
        addLootFeed('相位猎手完成突袭，散射即将命中！', true);
      } else {
        const count = 8 + this.bossPhase * 2;
        for (let i = 0; i < count; i++) {
          const a = base + (i / count) * TAU;
          spawnEnemyBullet(this.x, this.y, a, 310, this.damage * 0.7, { color: variant.color, life: 4.2, radius: 3, kind: 'bossArray' });
        }
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          spawnHazard(this.x + ox * 120, this.y + oy * 120, 66, 1.25, this.damage * 2.6, variant.color, '阵列');
        }
        addLootFeed('终焉阵列展开：注意十字警示区！', true);
      }
    }

    shoot() {
      this.fireCd = this.cooldown + rand(-0.14, 0.2);
      const baseAngle = this.attackAimAngle || Math.atan2(player.y - this.y, player.x - this.x);
      const mx = this.x + Math.cos(baseAngle) * 18;
      const my = this.y + Math.sin(baseAngle) * 18;
      const floor = Math.max(1, raid?.floor || 1);

      if (this.attackType === 'burst') {
        for (const offset of [-0.085, 0, 0.085]) {
          spawnEnemyBullet(mx, my, baseAngle + offset, 760, this.damage, {
            color: '#ff7b68', life: 0.9, radius: 2, kind: 'burst'
          });
        }
      } else if (this.attackType === 'fan') {
        for (let i = -2; i <= 2; i++) {
          spawnEnemyBullet(mx, my, baseAngle + i * 0.13, 520, this.damage, {
            color: '#ff9c6b', life: 1.15, radius: 2.4, kind: 'fan'
          });
        }
      } else if (this.attackType === 'sniper') {
        spawnEnemyBullet(mx, my, baseAngle, 1550, this.damage * 1.5, {
          color: '#ff5b6e', life: 1.0, radius: 3, kind: 'sniper'
        });
      } else if (this.attackType === 'mortar') {
        spawnHazard(player.x, player.y, 70, 1.15, this.damage * 2.25, '#ffad45', '炮击');
      } else if (this.attackType === 'radial') {
        const count = 10 + Math.min(8, Math.floor(floor / 5));
        const offset = world.time * 0.9;
        for (let i = 0; i < count; i++) {
          spawnEnemyBullet(mx, my, offset + (i / count) * TAU, 315, this.damage * 0.72, {
            color: '#58a6ff', life: 1.45, radius: 2, kind: 'radial'
          });
        }
      } else {
        spawnEnemyBullet(mx, my, baseAngle, 640, this.damage, {
          color: '#ff7b68', life: 0.8, radius: 2, kind: 'shot'
        });
      }
      this.muzzleFlash = 0.09;
      addParticle(mx, my, this.color, 2, 55, 2, 0.13);
      playSound('enemyShoot');
    }

    takeDamage(amount, hitAngle, options = {}) {
      if (this.dead) return;
      let perHit = options.ignoreDefense ? amount : amount * (1 - (this.defense || 0));
      if (this.isBoss && this.weakPointTimer > 0) perHit *= 1.5;
      this.hp -= perHit;
      if (raid.stats) {
        raid.stats.damageDealt += perHit;
        raid.stats.highestHit = Math.max(raid.stats.highestHit, perHit);
      }
      this.hitFlash = 0.12;
      this.state = 'chase';
      this.alertTimer = 4;
      this.lastSeen = { x: player.x, y: player.y };
      addParticle(this.x, this.y, '#ff6d78', 5, 75, 2, 0.4);
      addFloatText(this.x + rand(-6, 6), this.y - 18, `${options.crit ? '暴击 ' : ''}-${Math.round(perHit)}`, options.crit ? '#ffd15c' : options.characterSkill ? '#8bd3ff' : '#ff9aa4');
      playSound('hit');
      showHitMarker(this.hp <= 0);
      if (this.hp <= 0) {
        this.die();
      } else if (this.isBoss) {
        const pct = this.hp / this.maxHp;
        if (this.bossPhase === 1 && pct <= 0.65) this.enterBossPhase(2);
        else if (this.bossPhase === 2 && pct <= 0.3) this.enterBossPhase(3);
      }
    }

    die() {
      if (this.dead) return;
      this.dead = true;
      this.hp = 0;
      raid.kills += 1;
      triggerKillSlowmo(!!this.isBoss);
      if (raid.stats) {
        if (this.isBoss) raid.stats.bossKills += 1;
        if (this.elite) raid.stats.eliteKills += 1;
      }
      gainRaidXP(this.xp, true);
      raid.scrap += Math.round(this.scrap * (1 + (player?.gearBonus?.scrap || 0) + (player?.collectorBonus?.scrap || 0)));
      addParticle(this.x, this.y, '#b83d52', 12, 110, 3, 0.8);
      addParticle(this.x, this.y, '#2e3645', 8, 65, 3, 0.6);
      addFloatText(this.x, this.y - 28, `+${this.xp} XP`, '#d6ff4d');
      addLootFeed(this.isBoss ? `BOSS 已击败！ +${this.xp} XP` : `击倒敌人 +${this.xp} XP`, this.isBoss);

      rollEnhanceStoneDrop(this);
      if (this.eliteAffix === 'volatile') {
        spawnHazard(this.x, this.y, 76, 0.8, this.damage * 2.2, '#ffad45', '爆裂');
        addLootFeed(`${this.eliteLabel || '精英'}爆炸：远离爆炸范围！`, true);
      }

      if (this.isBoss) {
        const drop = BOSS_DROPS[this.bossVariant?.id] || null;
        const weaponType = drop?.weapon || 'w_boss';
        world.pickups.push({
          x: this.x,
          y: this.y,
          type: 'item',
          item: createItem(weaponType),
          life: 999,
          bob: rand(0, TAU),
          bossDrop: true
        });
        if (drop?.material) {
          world.pickups.push({
            x: this.x + 26,
            y: this.y + 14,
            type: 'item',
            item: createItem(drop.material, randInt(1, 2)),
            life: 999,
            bob: rand(0, TAU),
            bossDrop: true
          });
        }
        const weaponName = ITEM_DEFS[weaponType]?.name || '首领武器';
        addFloatText(this.x, this.y - 48, `${weaponName} 已掉落`, '#ffd15c');
        addLootFeed(`专属武器「${weaponName}」已掉落${drop?.material ? ` + ${ITEM_DEFS[drop.material].name}` : ''}`, true);
        updateHUD();
        return;
      }

      if (this.isBounty) {
        // 1 in 4 bounties pay out a legendary; the rest drop epic gear plus scrap.
        const isLegendary = Math.random() < 0.25;
        const rewardType = isLegendary
          ? pick(LOOT_POOLS.legendary || ['w_plasma'])
          : pick(LOOT_POOLS.epic || ['w_dmr']);
        const bonusScrap = isLegendary ? 0 : Math.round(rand(80, 160));
        world.pickups.push({
          x: this.x,
          y: this.y,
          type: 'item',
          item: createItem(rewardType),
          life: 999,
          bob: rand(0, TAU),
          bossDrop: true
        });
        raid.scrap += bonusScrap;
        gainModParts(5);
        addFloatText(this.x, this.y - 48, isLegendary ? '传说掉落 + 5 零件' : `高价值物资 +${bonusScrap} 废料`, '#ffd15c');
        addLootFeed(isLegendary
          ? '高危目标击倒：传说掉落 + 5 改装零件'
          : `高危目标击倒：高价值物资 + ${bonusScrap} 废料 + 5 零件`, true);
        // The kill is loud: every living enemy converges on the player.
        for (const enemy of world.enemies) {
          if (enemy.dead) continue;
          enemy.state = 'chase';
          enemy.alertTimer = 30;
          enemy.lastSeen = { x: player.x, y: player.y };
        }
        addLootFeed('警报触发：全图敌人朝你靠过来。', true);
        updateHUD();
        return;
      }

      if (this.carriesKey) {
        world.pickups.push({
          x: this.x,
          y: this.y,
          type: 'key',
          amount: 1,
          life: 999,
          bob: rand(0, TAU)
        });
        addFloatText(this.x, this.y - 46, '钥匙已掉落', '#ffd15c');
        addLootFeed('钥匙守卫掉落了 🔑', true);
      }

      // Enemies sometimes drop field supplies or a piece of loot.
      const roll = Math.random();
      if (roll < 0.28) {
        world.pickups.push({ x: this.x, y: this.y, type: 'ammo', amount: randInt(18, 36), life: 28, bob: rand(0, TAU) });
      } else if (roll < 0.42) {
        world.pickups.push({ x: this.x, y: this.y, type: 'med', amount: 1, life: 28, bob: rand(0, TAU) });
      } else if (roll < 0.68) {
        const itemType = Math.random() < 0.5 ? 'scrap' : Math.random() < 0.7 ? 'chip' : 'relic';
        world.pickups.push({ x: this.x, y: this.y, type: 'item', item: createItem(itemType), life: 30, bob: rand(0, TAU) });
      }
      updateHUD();
    }
  }

  function spawnEnemyBullet(x, y, angle, speed, damage, options = {}) {
    if (!world) return null;
    const bullet = {
      x,
      y,
      prevX: x,
      prevY: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage,
      owner: 'enemy',
      color: options.color || '#ff7b68',
      life: options.life ?? 0.9,
      maxLife: options.life ?? 0.9,
      radius: options.radius || 2,
      kind: options.kind || 'shot'
    };
    world.bullets.push(bullet);
    return bullet;
  }

  function spawnHazard(x, y, radius, delay, damage, color, label = '重击') {
    if (!world) return null;
    const hazard = {
      x,
      y,
      radius,
      timer: delay,
      maxTimer: delay,
      damage,
      color,
      label,
      exploded: false,
      blast: 0
    };
    world.hazards.push(hazard);
    return hazard;
  }

  function updateHazards(dt) {
    if (!world || !player) return;
    for (let i = world.hazards.length - 1; i >= 0; i--) {
      const hazard = world.hazards[i];
      if (!hazard.exploded) {
        hazard.timer -= dt;
        if (hazard.timer <= 0) {
          hazard.exploded = true;
          hazard.timer = 0;
          hazard.blast = 0.36;
          world.shake = Math.max(world.shake, 12);
          addParticle(hazard.x, hazard.y, hazard.color, 22, 150, 4, 0.65);
          addParticle(hazard.x, hazard.y, '#ffd15c', 12, 95, 3, 0.5);
          addParticle(hazard.x, hazard.y, '#ffffff', 6, 60, 2, 0.3);
          playSound('hurt');
          if (dist2(player.x, player.y, hazard.x, hazard.y) <= hazard.radius * hazard.radius) {
            player.takeDamage(hazard.damage, Math.atan2(player.y - hazard.y, player.x - hazard.x));
            player.hurtCd = Math.max(player.hurtCd, 0.45);
            addFloatText(player.x, player.y - 34, '重击命中!', '#ff5b6e');
          } else {
            addFloatText(hazard.x, hazard.y - 18, '闪避成功', '#7ee8d2');
          }
        }
      } else {
        hazard.blast -= dt;
        if (hazard.blast <= 0) world.hazards.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Loot, backpack and interaction
  // ---------------------------------------------------------------------------
  function addItemToBackpack(item) {
    const def = defOf(item);
    if (def.stack) {
      const found = player.backpack.find((i) => i.type === item.type);
      if (found) {
        found.qty += item.qty || 1;
        player.backpack = sortItemList(player.backpack);
        updateBackpackHud();
        return true;
      }
    }
    if (player.backpack.length >= player.capacity) return false;
    player.backpack.push({ ...item, id: item.id || uid(), qty: item.qty || 1 });
    player.backpack = sortItemList(player.backpack);
    updateBackpackHud();
    return true;
  }

  function backpackItemCount() {
    return player && player.backpack ? player.backpack.reduce((n, i) => n + (i.qty || 1), 0) : 0;
  }

  function updateBackpackHud() {
    if (!player) return;
    el.backpackCount.textContent = `${player.backpack.length}/${player.capacity}`;
    if (el.touchInventory) el.touchInventory.textContent = `背包 ${player.backpack.length}/${player.capacity}`;
    el.backpackHud.innerHTML = '';
    const shown = Math.min(player.capacity, 12);
    for (let i = 0; i < shown; i++) {
      const item = player.backpack[i];
      const slot = document.createElement('div');
      slot.className = `bp-slot ${item ? '' : 'empty'}`;
      if (item) {
        const def = defOf(item);
        slot.textContent = def.icon;
        slot.title = `${def.name}${item.qty > 1 ? ` ×${item.qty}` : ''}`;
        slot.style.color = def.rarity === 'epic' ? '#c084ff' : def.rarity === 'rare' ? '#55d9ff' : def.rarity === 'uncommon' ? '#7ed7a0' : '#d6ff4d';
      } else {
        slot.textContent = '·';
      }
      el.backpackHud.appendChild(slot);
    }
    if (player.capacity > 12) {
      const more = document.createElement('div');
      more.className = 'bp-slot';
      more.textContent = `+${player.capacity - 12}`;
      el.backpackHud.appendChild(more);
    }
  }

  function addLootFeed(text, bad = false) {
    const line = document.createElement('div');
    line.className = `loot-line ${bad ? 'bad' : ''}`;
    line.textContent = text;
    el.lootFeed.appendChild(line);
    while (el.lootFeed.children.length > 6) el.lootFeed.firstElementChild.remove();
    setTimeout(() => line.remove(), 3800);
  }

  function weightedPick(weights) {
    let total = 0;
    for (const weight of Object.values(weights)) total += Math.max(0, weight);
    if (total <= 0) return 'common';
    let roll = Math.random() * total;
    for (const [key, weight] of Object.entries(weights)) {
      const safeWeight = Math.max(0, weight);
      if (safeWeight <= 0) continue;
      if (roll < safeWeight) return key;
      roll -= safeWeight;
    }
    return Object.keys(weights)[0];
  }

  function rollLootRarity(quality = 'common') {
    const profile = LOOT_RARITY_PROFILES[quality] || LOOT_RARITY_PROFILES.common;
    const weights = { ...profile };
    const floor = Math.max(1, raid?.floor || 1);
    const riskBonus = save.settings.raidRisk === 'extreme' ? 8 : save.settings.raidRisk === 'danger' ? 4 : 0;
    const depthBonus = Math.min(18, (floor - 1) * 1.1) + riskBonus;
    if (quality === 'vault') {
      const shift = Math.min(Math.max(0, weights.uncommon - 4), depthBonus * 0.35);
      weights.uncommon -= shift;
      weights.rare += shift * 0.55;
      weights.epic += shift * 0.45;
    } else {
      const shift = Math.min(Math.max(0, weights.common - 16), depthBonus);
      weights.common -= shift;
      weights.rare += shift * 0.62;
      weights.epic += shift * 0.38;
    }
    return weightedPick(weights);
  }

  function rollLootItem(quality = 'common', minRarity = 'common') {
    let rarity = rollLootRarity(quality);
    if ((RARITY_ORDER[rarity] || 0) < (RARITY_ORDER[minRarity] || 0)) rarity = minRarity;
    return pick(LOOT_POOLS[rarity] || LOOT_POOLS.common);
  }

  function rollPackDrop(quality = 'common') {
    const chance = quality === 'vault' ? 0.55 : quality === 'rare' ? 0.16 : 0.05;
    if (Math.random() >= chance) return null;
    const base = PACK_TIER_WEIGHTS[quality] || PACK_TIER_WEIGHTS.common;
    const weights = { ...base };
    const floor = Math.max(1, raid?.floor || 1);
    const riskBonus = save.settings.raidRisk === 'extreme' ? 8 : save.settings.raidRisk === 'danger' ? 4 : 0;
    const depth = Math.min(14, (floor - 1) * 0.8 + riskBonus * 0.6);
    weights.white = Math.max(0, weights.white - depth * 0.45);
    weights.green = Math.max(0, weights.green - depth * 0.2);
    weights.blue += depth * 0.3;
    weights.purple += depth * 0.2;
    weights.red += depth * 0.12;
    weights.rainbow += depth * 0.03;
    return `p_${weightedPick(weights)}`;
  }

  function rollEnhanceStoneDrop(enemy) {
    if (!enemy || !world) return null;
    const isBoss = !!enemy.isBoss;
    const isElite = !!enemy.elite || enemy.kind === 'heavy';
    let chance = isBoss ? 1 : isElite ? 0.28 : 0.10;
    if (save.settings.raidRisk === 'danger') chance *= 1.25;
    if (save.settings.raidRisk === 'extreme') chance *= 1.5;
    if (Math.random() >= Math.min(1, chance)) return null;

    const profile = isBoss ? 'boss' : isElite ? 'elite' : 'normal';
    const weights = { ...STONE_TIER_WEIGHTS[profile] };
    const floor = Math.max(1, raid?.floor || 1);
    const riskBonus = save.settings.raidRisk === 'extreme' ? 8 : save.settings.raidRisk === 'danger' ? 4 : 0;
    const depth = Math.min(18, (floor - 1) * 0.9 + riskBonus * 0.7);
    weights.white = Math.max(0, weights.white - depth * 0.55);
    weights.green = Math.max(0, weights.green - depth * 0.35);
    weights.blue += depth * 0.45;
    weights.purple += depth * 0.35;
    weights.red += depth * 0.16;
    weights.rainbow += depth * 0.04;
    const type = `stone_${weightedPick(weights)}`;
    const item = createItem(type);
    const def = defOf(item);
    world.pickups.push({
      x: enemy.x,
      y: enemy.y,
      type: 'item',
      item,
      life: 45,
      bob: rand(0, TAU)
    });
    addFloatText(enemy.x, enemy.y - 52, `${def.name}掉落`, choiceIconColor(def));
    addLootFeed(`敌人掉落 ${itemName(item)} · 强化成功率 ${Math.round(def.success * 100)}%`, false);
    return item;
  }

  function lootContainer(container) {
    if (container.locked) {
      if ((raid.keys || 0) <= 0) {
        addLootFeed('钥匙房宝箱需要 🔑 ×1', true);
        updateHUD();
        return;
      }
      raid.keys -= 1;
      container.locked = false;
      addLootFeed('已消耗 🔑 ×1，钥匙房宝箱开启。', false);
    }
    container.searched = true;
    raid.containersSearched = (raid.containersSearched || 0) + 1;
    playSound('open');
    const quality = container.vault ? 'vault' : container.rarity;
    const count = container.vault ? randInt(4, 5) : container.rarity === 'rare' ? randInt(2, 4) : randInt(1, 3);
    let got = 0;
    let bestRarity = 0;
    const names = [];
    for (let i = 0; i < count; i++) {
      const forceRare = container.vault && i === count - 1 && bestRarity < RARITY_ORDER.rare;
      const type = rollLootItem(quality, forceRare ? 'rare' : 'common');
      const def = defOf(type);
      const item = createItem(type, 1);
      if (addItemToBackpack(item)) {
        got++;
        names.push(def.name);
        bestRarity = Math.max(bestRarity, RARITY_ORDER[def.rarity] || 1);
        gainRaidXP({ common: 1, uncommon: 3, rare: 6, epic: 12 }[def.rarity] || 1, true);
      } else {
        addLootFeed('背包已满，部分物资无法带走。', true);
        break;
      }
    }
    const packType = rollPackDrop(quality);
    if (packType) {
      const packDef = defOf(packType);
      const packQuality = PACK_QUALITIES[packDef.pack];
      if (addItemToBackpack(createItem(packType))) {
        got++;
        names.push(`${packDef.name}（容量 +${packQuality.bonus}）`);
        gainRaidXP({ common: 4, uncommon: 8, rare: 15, epic: 25, legendary: 40, mythic: 60 }[packDef.rarity] || 4, true);
        addLootFeed(`发现背包装备：${packDef.name} · 容量 +${packQuality.bonus}`, false);
      } else {
        addLootFeed(`发现 ${packDef.name}，但背包已满。`, true);
      }
    }
    const modChance = container.vault ? 0.4 : container.rarity === 'rare' ? 0.22 : 0.1;
    if (Math.random() < modChance) {
      const modType = MOD_TYPES[Math.floor(Math.random() * MOD_TYPES.length)];
      if (addItemToBackpack(createItem(modType))) {
        addLootFeed(`发现武器配件：${defOf(modType).name}`, false);
      } else {
        addLootFeed('发现武器配件，但背包已满。', true);
      }
    }
    const ammoChance = container.vault ? 1 : container.rarity === 'rare' ? 0.5 : 0.32;
    if (Math.random() < ammoChance) {
      const ammo = randInt(container.vault ? 40 : container.rarity === 'rare' ? 26 : 18, container.vault ? 72 : container.rarity === 'rare' ? 48 : 34);
      player.reserve += ammo;
      addLootFeed(`获得弹药 +${ammo}`, false);
    }
    const medChance = container.vault ? 1 : container.rarity === 'rare' ? 0.3 : 0.18;
    if (Math.random() < medChance && player.medkits < 8) {
      player.medkits += 1;
      addLootFeed('获得医疗包 +1', false);
    }
    if (got > 0) {
      addLootFeed(`搜索完成：${names.join('、')}`, false);
      playSound('pickup');
    } else {
      addLootFeed('箱子是空的……', true);
    }
    advanceRaidTutorial(1);
    updateHUD();
  }

  function updateObjective(dt) {
    const obj = world?.objective;
    if (!obj || !player) return;
    obj.pulse += dt * 2;
    if (obj.state === 'complete') {
      obj.completeTimer = Math.max(0, obj.completeTimer - dt);
      return;
    }
    const inside = dist2(player.x, player.y, obj.x, obj.y) <= obj.r * obj.r;
    if (!inside) {
      if (obj.state === 'active') {
        obj.state = 'idle';
        addLootFeed(`已离开${obj.label}，进度保留。`, false);
      }
      return;
    }
    if (obj.state !== 'active') {
      obj.state = 'active';
      addLootFeed(`战术目标：${obj.label} · ${OBJECTIVE_DEFS[obj.type].activeText}`, true);
      playSound('reload');
    }
    obj.progress = Math.min(obj.duration, obj.progress + dt);
    obj.spawnTimer -= dt;
    if (obj.spawnTimer <= 0 && obj.wavesSpawned < obj.waves && obj.progress < obj.duration) {
      spawnObjectiveWave(obj);
      obj.wavesSpawned += 1;
      obj.spawnTimer = Math.max(2.2, obj.duration / (obj.waves + 1));
    }
    if (obj.progress >= obj.duration) completeObjective(obj);
  }

  function spawnObjectiveWave(obj) {
    if (!world || !player) return;
    const def = OBJECTIVE_DEFS[obj.type];
    const count = obj.type === 'vault' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      let spot = roomSpot(obj.room || pick(world.rooms.slice(1, -1)));
      for (let attempt = 0; attempt < 8 && canStandAt(spot.x, spot.y, 10) === false; attempt++) {
        spot = roomSpot(obj.room || pick(world.rooms.slice(1, -1)));
      }
      const enemy = new Enemy(spot.x, spot.y, pick(world.stage.enemyPool), obj.room);
      enemy.state = 'chase';
      enemy.alertTimer = 12;
      enemy.lastSeen = { x: player.x, y: player.y };
      if (obj.type === 'vault' && obj.wavesSpawned === 0 && i === 0) applyEliteAffix(enemy);
      world.enemies.push(enemy);
    }
    addLootFeed(`${def.label}警报：增援已进入区域！`, true);
    world.shake = Math.max(world.shake, 3);
  }

  function completeObjective(obj) {
    const def = OBJECTIVE_DEFS[obj.type];
    if (!def || obj.state === 'complete') return;
    obj.state = 'complete';
    obj.progress = obj.duration;
    obj.completeTimer = 7;
    const scrap = Math.round(rand(def.rewardScrap[0], def.rewardScrap[1]) * (1 + (player?.gearBonus?.scrap || 0) + (player?.collectorBonus?.scrap || 0)));
    raid.scrap += scrap;
    gainModParts(def.rewardParts);
    if (raid.stats) raid.stats.objectives += 1;
    const itemType = rollLootItem(def.quality, 'uncommon');
    const item = createItem(itemType);
    if (!addItemToBackpack(item)) {
      world.pickups.push({ x: obj.x, y: obj.y, type: 'item', item, life: 999, bob: rand(0, TAU) });
    }
    const packType = rollPackDrop(def.quality);
    if (packType) {
      const packItem = createItem(packType);
      if (!addItemToBackpack(packItem)) {
        world.pickups.push({ x: obj.x + 18, y: obj.y, type: 'item', item: packItem, life: 999, bob: rand(0, TAU) });
      }
    }
    addLootFeed(`战术目标完成：${obj.label} · +${scrap} 废料 · +${def.rewardParts} 零件`, true);
    addFloatText(obj.x, obj.y - 40, '目标完成', obj.color);
    toast(`战术目标完成：${obj.label}`);
    world.shake = Math.max(world.shake, 5);
    playSound('level');
    updateHUD();
  }

  function updatePickups(dt) {
    for (let i = world.pickups.length - 1; i >= 0; i--) {
      const p = world.pickups[i];
      p.life -= dt;
      p.bob += dt * 3;
      if (p.life <= 0) {
        world.pickups.splice(i, 1);
        continue;
      }
      if (p.pickupDelay > 0) {
        p.pickupDelay = Math.max(0, p.pickupDelay - dt);
        continue;
      }
      if (p.dropped && !p.dropArmed) {
        // Do not instantly vacuum the item back up while the player is
        // still standing on the drop spot; walking away arms it.
        if (dist2(p.dropX, p.dropY, player.x, player.y) > 34 * 34) p.dropArmed = true;
        continue;
      }
      if (dist2(p.x, p.y, player.x, player.y) > 24 * 24) continue;

      if (p.type === 'ammo') {
        player.reserve += p.amount;
        addLootFeed(`拾取弹药 +${p.amount}`, false);
        playSound('pickup');
        world.pickups.splice(i, 1);
      } else if (p.type === 'key') {
        raid.keys = (raid.keys || 0) + (p.amount || 1);
        addLootFeed(`拾取 🔑 ×${p.amount || 1}`, false);
        addFloatText(p.x, p.y - 24, '🔑 +1', '#ffd15c');
        playSound('pickup');
        world.pickups.splice(i, 1);
        updateHUD();
      } else if (p.type === 'med') {
        if (player.medkits >= 8) continue;
        player.medkits += p.amount;
        addLootFeed('拾取医疗包 +1', false);
        playSound('pickup');
        world.pickups.splice(i, 1);
      } else if (p.type === 'item') {
        if (addItemToBackpack(p.item)) {
          addLootFeed(`拾取 ${itemName(p.item)}`, false);
          playSound('pickup');
          world.pickups.splice(i, 1);
        } else if (world.time - (raid.lastFullWarning || -10) > 2) {
          raid.lastFullWarning = world.time;
          addLootFeed('背包已满，无法拾取。', true);
        }
      }
    }
  }

  function updateBullets(dt) {
    for (let i = world.bullets.length - 1; i >= 0; i--) {
      const b = world.bullets[i];
      b.life -= dt;
      if (b.life <= 0) {
        world.bullets.splice(i, 1);
        continue;
      }
      b.prevX = b.x;
      b.prevY = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (isSolidAt(b.x, b.y)) {
        addParticle(b.x, b.y, '#aab6c9', 3, 45, 2, 0.22);
        world.bullets.splice(i, 1);
        continue;
      }

      if (b.owner === 'player') {
        let hit = false;
        if (!b.hitEnemies) b.hitEnemies = [];
        for (const enemy of world.enemies) {
          if (enemy.dead) continue;
          if (b.pierce && b.hitEnemies.includes(enemy)) continue;
          if (segmentHitsCircle(b.prevX, b.prevY, b.x, b.y, enemy.x, enemy.y, enemy.r + 2)) {
            const hitDamage = b.damage * (enemy.isBoss ? 1 + (player.antiBoss || 0) : 1);
            enemy.takeDamage(hitDamage, Math.atan2(b.vy, b.vx), { crit: !!b.crit });
            if (player.lifesteal > 0) player.heal(hitDamage * player.lifesteal);
            world.shake = Math.max(world.shake, b.crit ? 3.4 : 2.4);
            if (b.pierce) {
              b.hitEnemies.push(enemy);
            } else {
              hit = true;
              break;
            }
          }
        }
        if (hit) {
          world.bullets.splice(i, 1);
        }
      } else {
        if (segmentHitsCircle(b.prevX, b.prevY, b.x, b.y, player.x, player.y, player.r + 2)) {
          player.takeDamage(b.damage, Math.atan2(-b.vy, -b.vx));
          world.bullets.splice(i, 1);
        }
      }
    }
  }

  function updateBeams(dt) {
    for (let i = world.beams.length - 1; i >= 0; i--) {
      const beam = world.beams[i];
      beam.life -= dt;
      if (beam.life <= 0) world.beams.splice(i, 1);
    }
  }

  function updateParticles(dt) {
    for (let i = world.particles.length - 1; i >= 0; i--) {
      const p = world.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        world.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    for (let i = world.floatTexts.length - 1; i >= 0; i--) {
      const t = world.floatTexts[i];
      t.life -= dt;
      t.y -= 24 * dt;
      if (t.life <= 0) world.floatTexts.splice(i, 1);
    }
  }

  function openExtractionChoice() {
    if (!raid || raid.ended || raid.extractionChoiceOpen) return;
    raid.extractionChoiceOpen = true;
    raid.paused = true;
    raid.progress = 0;
    raid.interactionType = null;
    mouse.down = false;
    mouse.semiQueued = false;
    touch.firing = false;
    touch.aiming = false;
    el.interactPrompt.classList.add('hidden');
    const perks = PERK_KEYS.filter((key) => perkRank(key) > 0)
      .map((key) => `${PERK_DEFS[key].name} ${perkRank(key)}`);
    if (el.extractDeeperBtn) el.extractDeeperBtn.classList.toggle('hidden', !!raid.challenge);
    if (el.extractChoiceSub) {
      el.extractChoiceSub.textContent = raid.challenge
        ? `首领挑战是单层战场。现在撤离会结算本局物资；继续待下去，增援只会越来越多。`
        : `你已到达第 ${raid.floor} 层撤离点。继续深入会保留本局等级、成长与背包，但敌人和掉落都会随层数提升。`;
    }
    if (el.extractChoiceStats) {
      el.extractChoiceStats.innerHTML = `
        <div><span>当前层数</span><strong>F${raid.floor}</strong></div>
        <div><span>本局等级</span><strong>LV.${raid.level}</strong></div>
        <div><span>背包物资</span><strong>${player.backpack.length}/${player.capacity}</strong></div>
        <div><span>本局成长</span><strong>${perks.length ? perks.join(' · ') : '暂无'}</strong></div>`;
    }
    el.extractChoiceOverlay.classList.remove('hidden');
    updateHUD();
  }

  function continueToNextFloor() {
    if (!raid || raid.ended || !raid.extractionChoiceOpen) return;
    el.extractChoiceOverlay.classList.add('hidden');
    raid.extractionChoiceOpen = false;
    raid.floor += 1;
    raid.timeLeft = 360;
    raid.progress = 0;
    raid.interactionType = null;
    raid.searchTarget = null;
    raid.searchInterruptTimer = 0;
    raid.bossEngaged = false;
    raid.event = null;
    raid.paused = false;
    beginFloor(false);
    lastTime = performance.now();
    toast(`进入第 ${raid.floor} 层：敌人更强，稀有物资概率提升。`);
    addLootFeed(`第 ${raid.floor} 层开始 · 保留本局等级与成长。`, false);
    if (raid.event) {
      addLootFeed(`随机事件：${raid.event.label}`, false);
      toast(`随机事件：${raid.event.label}`);
    }
  }

  function returnFromExtraction() {
    if (!raid || raid.ended || !raid.extractionChoiceOpen) return;
    el.extractChoiceOverlay.classList.add('hidden');
    raid.extractionChoiceOpen = false;
    endRaid(true, '你选择返回基地，本局物资已结算。');
  }

  function updateInteraction(dt) {
    if (!player || raid.ended || raid.paused) {
      el.interactPrompt.classList.add('hidden');
      return;
    }

    let nearest = null;
    let nearestD = Infinity;
    for (const c of world.containers) {
      if (c.searched) continue;
      const d = dist2(player.x, player.y, c.x, c.y);
      if (d < 58 * 58 && d < nearestD) {
        nearest = c;
        nearestD = d;
      }
    }
    const altActive = world.altExtraction && world.altExtraction.timeLeft > 0;
    const atExit = dist2(player.x, player.y, world.extraction.x, world.extraction.y) < world.extraction.r * world.extraction.r ||
      (altActive && dist2(player.x, player.y, world.altExtraction.x, world.altExtraction.y) < world.altExtraction.r * world.altExtraction.r);
    const type = atExit ? 'extract' : nearest ? 'search' : null;

    if (type === 'extract' && raidTutorialState.active) completeRaidTutorial();
    if (type !== raid.interactionType || (type === 'search' && nearest !== raid.searchTarget)) {
      raid.interactionType = type;
      raid.searchTarget = type === 'search' ? nearest : null;
      raid.progress = 0;
    }
    if (type !== 'search') {
      raid.searchTarget = null;
      for (const c of world.containers) {
        if (c.progress > 0 && c.progress < 1) c.progress = 0;
      }
    }

    if (!type) {
      el.interactPrompt.classList.add('hidden');
      return;
    }

    el.interactPrompt.classList.remove('hidden');
    const searchSpeedBonus = player.collectorBonus ? player.collectorBonus.searchSpeed : 0;
    const duration = type === 'search' ? 2.0 / (1 + searchSpeedBonus) : 3.0;
    if (type === 'search') {
      if (nearest.locked && (raid.keys || 0) <= 0) {
        raid.progress = 0;
        nearest.progress = 0;
        el.promptText.textContent = '🔑 钥匙房宝箱 · 需要 1 把钥匙';
        el.promptBarFill.style.width = '0%';
        return;
      }
      if (raid.searchInterruptTimer > 0) {
        raid.progress = 0;
        nearest.progress = 0;
        el.promptText.textContent = '搜索被打断 · 站定后继续';
      } else if (player.moving) {
        raid.progress = 0;
        nearest.progress = 0;
        el.promptText.textContent = '站定 2 秒搜索 · 移动会中断';
      } else if (player.reloading) {
        raid.progress = 0;
        nearest.progress = 0;
        el.promptText.textContent = '换弹中 · 搜索暂停';
      } else {
        const remaining = Math.max(0, duration - raid.progress);
        el.promptText.textContent = nearest.locked
          ? `正在解锁钥匙房宝箱 ${remaining.toFixed(1)} 秒 · 请留在旁边`
          : `正在搜索补给箱 ${remaining.toFixed(1)} 秒 · 请留在旁边`;
        raid.progress += dt;
        nearest.progress = clamp(raid.progress / duration, 0, 1);
      }
    } else {
      const remaining = Math.max(0, duration - raid.progress);
      el.promptText.textContent = `正在激活撤离点 ${remaining.toFixed(1)} 秒 · 请留在区域内`;
      raid.progress += dt;
    }
    if (raid.progress >= duration) {
      if (type === 'search') {
        lootContainer(nearest);
        nearest.progress = 1;
        raid.progress = 0;
        raid.interactionType = null;
      } else {
        openExtractionChoice();
        return;
      }
    }
    el.promptBarFill.style.width = `${clamp((raid.progress / duration) * 100, 0, 100)}%`;
  }

  function updateReinforcements(dt) {
    if (!world || !player) return;
    raid.reinforceTimer = Math.max(0, (raid.reinforceTimer || 0) - dt);
    if (raid.reinforceTimer > 0) return;
    const wave = (raid.wave || 0) + 1;
    raid.wave = wave;
    // First wave at 3:00, then one per minute; overtime shortens the gap.
    raid.reinforceTimer = Math.max(15, (raid.overtime ? 45 : 60) - wave * 4);
    spawnReinforcementWave(wave);
  }

  function spawnReinforcementWave(wave) {
    if (!world || !player) return;
    if (world.enemies.filter((enemy) => !enemy.dead).length >= 80) return;
    const pool = (world.stage && world.stage.enemyPool) || ['grunt'];
    const count = Math.min(14, 2 + wave);
    const far = world.rooms.filter((room) => {
      const cx = (room.x + room.w / 2) * TILE;
      const cy = (room.y + room.h / 2) * TILE;
      return dist2(cx, cy, player.x, player.y) > 520 * 520;
    });
    const rooms = far.length ? far : world.rooms;
    for (let i = 0; i < count; i += 1) {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const spot = roomSpot(room, 6);
      const kind = pool[Math.floor(Math.random() * pool.length)];
      const enemy = new Enemy(spot.x, spot.y, kind, room);
      const hpMult = 1 + wave * 0.15;
      enemy.maxHp = Math.round(enemy.maxHp * hpMult);
      enemy.hp = enemy.maxHp;
      enemy.damage = Math.round(enemy.damage * (1 + wave * 0.12));
      enemy.xp = Math.round(enemy.xp * (1 + wave * 0.1));
      if (Math.random() < Math.min(0.55, 0.1 + wave * 0.07)) applyEliteAffix(enemy);
      enemy.state = 'chase';
      enemy.alertTimer = 30;
      enemy.lastSeen = { x: player.x, y: player.y };
      world.enemies.push(enemy);
    }
    addLootFeed(`增援第 ${wave} 波：${count} 名敌人进入区域（强度 +${Math.round(wave * 15)}%）`, true);
    toast(`敌方增援：第 ${wave} 波`);
  }

  function updateRaid(dt) {
    if (!player || !raid || raid.ended) return;
    if (raid.paused) {
      updateHUD();
      return;
    }
    raid.timeLeft -= dt;
    raid.elapsed = (raid.elapsed || 0) + dt;
    raid.searchInterruptTimer = Math.max(0, raid.searchInterruptTimer - dt);
    updateRaidEvent(dt);
    if (raid.timeLeft <= 0) {
      raid.timeLeft = 0;
      if (!raid.overtime) {
        raid.overtime = true;
        addLootFeed('撤离通道还开着，但敌方增援不会再停。', true);
        toast('增援持续 · 越拖越危险');
      }
    }
    updateReinforcements(dt);

    world.time += dt;
    world.flow.timer -= dt;
    if (world.flow.timer <= 0) buildFlowField();
    world.shake = Math.max(0, world.shake - dt * 18);

    player.update(dt);
    updateExploration(dt);
    if (raidTutorialState.active && raidTutorialState.step === 0 &&
      dist2(player.x, player.y, raidTutorialState.startX, raidTutorialState.startY) > 48 * 48) {
      advanceRaidTutorial(0);
    }
    for (const enemy of world.enemies) enemy.update(dt);
    updateBullets(dt);
    updateHazards(dt);
    updateBeams(dt);
    if (raid.ended) return;
    updatePickups(dt);
    updateObjective(dt);
    updateParticles(dt);
    updateInteraction(dt);
    hudAccumulator += dt;
    if (hudAccumulator >= 0.08) {
      hudAccumulator = 0;
      updateHUD();
    }

    // Smooth camera follow.
    const targetX = clamp(player.x - VIEW_W / 2, 0, MAP_PW - VIEW_W);
    const targetY = clamp(player.y - VIEW_H / 2, 0, MAP_PH - VIEW_H);
    const follow = Math.min(1, dt * 8);
    if (!cameraInitialized) {
      camera.x = targetX;
      camera.y = targetY;
      cameraInitialized = true;
    } else {
      camera.x += (targetX - camera.x) * follow;
      camera.y += (targetY - camera.y) * follow;
    }
    if (raid.pendingPerks > 0 && !raid.paused) showPerkChoices();
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------
  function updateHUD() {
    if (!player) return;
    const hpPct = clamp((player.hp / player.maxHp) * 100, 0, 100);
    el.hpFill.style.width = `${hpPct}%`;
    el.hpText.textContent = `${Math.ceil(player.hp)}/${player.maxHp}`;
    if (el.lowHpVignette) el.lowHpVignette.classList.toggle('active', player.hp > 0 && hpPct <= 30);
    const hudTr = transcendStats(player.transcendLevel);
    el.armorText.textContent = `护甲：${save.equipped.armor ? itemName(save.equipped.armor) : player.armor.name}${hudTr.reduction > 0 ? ` · 蜕变+${Math.round(hudTr.reduction * 100)}%` : ''}`;
    el.hudMeds.textContent = `医疗包 ×${player.medkits}`;
    if (el.hudKeys) el.hudKeys.textContent = `🔑 ×${raid ? (raid.keys || 0) : 0}`;
    el.hudScrap.textContent = `废料 +${raid ? raid.scrap : 0}`;
    el.hudWeapon.textContent = save.equipped.weapon ? itemName(save.equipped.weapon) : player.weapon.name;
    const hudWeaponDef = defOf(save.equipped.weapon);
    el.hudWeaponIcon.textContent = hudWeaponDef.icon || '▰';
    el.hudWeaponIcon.style.color = player.weapon.color || '#d6ff4d';
    if (player.reloading) {
      el.hudAmmo.textContent = '换弹中…';
    } else {
      el.hudAmmo.textContent = `${player.mag} / ${player.reserve}`;
    }
    el.hudLevel.textContent = `LV.${raid ? raid.level : 1}`;
    if (el.hudFloor) el.hudFloor.textContent = `F${raid ? raid.floor : 1}`;
    if (el.hudLockState) {
      const autoLock = save.settings.autoLock !== false;
      const locked = !!(player.lockTarget && !player.lockTarget.dead);
      el.hudLockState.textContent = autoLock ? (locked ? '锁定' : '索敌 ON') : '索敌 OFF';
      el.hudLockState.classList.toggle('active', locked);
      el.hudLockState.classList.toggle('off', !autoLock);
    }
    if (el.hudCharacterName) {
      el.hudCharacterName.textContent = player.char.name;
      el.hudCharacterName.style.color = player.char.color;
    }
    const dashReady = player.dashCd <= 0;
    if (el.hudDashCd) {
      el.hudDashCd.textContent = dashReady ? '冲刺 就绪' : `冲刺 ${player.dashCd.toFixed(1)}s`;
      el.hudDashCd.classList.toggle('cooling', !dashReady);
    }
    const skill = player.char.skill;
    const skillLocked = player.sniperLock && player.sniperLock.target && !player.sniperLock.target.dead;
    const skillReady = player.activeCd <= 0;
    if (el.hudSkillCd) {
      el.hudSkillCd.textContent = skillLocked
        ? `${skill.short} ${Math.max(0, player.sniperLock.timer).toFixed(1)}s`
        : skillReady ? `${skill.short} 就绪` : `${skill.short} ${player.activeCd.toFixed(1)}s`;
      el.hudSkillCd.classList.toggle('cooling', !skillReady && !skillLocked);
    }
    if (el.hudShield) {
      el.hudShield.textContent = player.shield > 0 ? `护盾 ${Math.ceil(player.shield)}` : '';
      el.hudShield.classList.toggle('hidden', player.shield <= 0);
    }
    if (el.statusEffects) {
      const badges = [];
      if (player.shield > 0) badges.push({ cls: 'shield', text: `护盾 ${Math.ceil(player.shield)} · ${player.shieldTimer.toFixed(1)}s` });
      if (player.overdriveTimer > 0) badges.push({ cls: 'overdrive', text: `过载 ${player.overdriveTimer.toFixed(1)}s` });
      if (player.charId === 'pioneer' && player.hp / player.maxHp <= 0.35) badges.push({ cls: 'passive', text: '求生本能 · 减伤20%' });
      if (player.dashInvuln > 0) badges.push({ cls: 'dash', text: '冲刺无敌' });
      if (skillLocked) badges.push({ cls: 'lock', text: `猎杀锁定 ${Math.max(0, player.sniperLock.timer).toFixed(1)}s` });
      const setText = equippedSetSummary();
      if (setText) badges.push({ cls: 'set', text: setText });
      el.statusEffects.innerHTML = badges.map((b) => `<span class="status-badge ${b.cls}">${b.text}</span>`).join('');
      el.statusEffects.classList.toggle('hidden', badges.length === 0);
    }
    // Cooldown rings for touch actions (--cd is a conic-gradient stop).
    if (el.touchDash) {
      const pct = player.dashCdMax > 0 ? clamp(player.dashCd / player.dashCdMax, 0, 1) : 0;
      el.touchDash.style.setProperty('--cd', `${(pct * 360).toFixed(1)}deg`);
    }
    if (el.touchSkill) {
      const pct = player.activeCdMax > 0 ? clamp(player.activeCd / player.activeCdMax, 0, 1) : 0;
      el.touchSkill.style.setProperty('--cd', `${(pct * 360).toFixed(1)}deg`);
    }
    if (el.touchDash) {
      el.touchDash.textContent = dashReady ? '冲刺' : `冲刺 ${player.dashCd.toFixed(1)}`;
      el.touchDash.classList.toggle('cooling', !dashReady);
    }
    if (el.touchSkill) {
      el.touchSkill.textContent = skillLocked
        ? `${skill.short} ${Math.max(0, player.sniperLock.timer).toFixed(1)}`
        : skillReady ? skill.short : `${skill.short} ${player.activeCd.toFixed(1)}`;
      el.touchSkill.classList.toggle('cooling', !skillReady && !skillLocked);
    }
    if (el.hudXpFill && raid) {
      const need = raidXpToNext(raid.level);
      el.hudXpFill.style.width = `${clamp((raid.xp / need) * 100, 0, 100)}%`;
      if (el.hudXpText) el.hudXpText.textContent = `${raid.xp}/${need}`;
    }
    if (el.aimPad) {
      el.aimPad.classList.toggle('charging', !!(touch.ui && touch.aiming && !touch.firing));
      el.aimPad.classList.toggle('firing', !!(touch.ui && touch.aiming && touch.firing));
    }
    if (raid) {
      const bossFloor = raid.floor % 5 === 0;
      const nextBossFloor = raid.floor + (5 - (raid.floor % 5));
      const stageName = world?.stage?.name || stageForFloor(raid.floor).name;
      el.raidObjective.textContent = `${riskDef().label} · ${stageName} · F${raid.floor} · ${bossFloor ? '首领层' : `下个首领 F${nextBossFloor}`}`;
      if (el.objectiveTracker) {
        const obj = world?.objective;
        const show = obj && (obj.state !== 'complete' || obj.completeTimer > 0);
        el.objectiveTracker.classList.toggle('hidden', !show);
        if (show) {
          const def = OBJECTIVE_DEFS[obj.type];
          const pct = Math.round((obj.progress / obj.duration) * 100);
          el.objectiveTracker.classList.toggle('active', obj.state === 'active');
          el.objectiveTracker.classList.toggle('complete', obj.state === 'complete');
          el.objectiveTracker.style.setProperty('--objective-color', obj.color);
          el.objectiveTrackerName.textContent = `${def.icon} ${obj.label}${obj.state === 'complete' ? ' · 已完成' : ''}`;
          el.objectiveTrackerPct.textContent = obj.state === 'complete' ? '✔' : `${pct}%`;
          el.objectiveTrackerFill.style.width = `${pct}%`;
          el.objectiveTrackerHint.textContent = obj.state === 'complete'
            ? '奖励已发放，继续搜刮或前往撤离点。'
            : obj.state === 'active' ? def.activeText : def.idleText;
        }
      }
    }
    if (world && raid) {
      let nearestD = Infinity;
      let chasing = 0;
      for (const enemy of world.enemies) {
        if (enemy.dead || !isPointVisible(enemy.x, enemy.y)) continue;
        if (enemy.state === 'chase') chasing += 1;
        nearestD = Math.min(nearestD, Math.hypot(enemy.x - player.x, enemy.y - player.y));
      }
      let bossText;
      if (world.boss) {
        if (world.boss.dead) {
          bossText = '首领 已击倒';
        } else if (isPointVisible(world.boss.x, world.boss.y)) {
          const bossD = Math.hypot(world.boss.x - player.x, world.boss.y - player.y);
          const bossAngle = Math.atan2(world.boss.y - player.y, world.boss.x - player.x);
          const dirs = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
          const dir = dirs[(Math.round((bossAngle + Math.PI * 2) / (Math.PI / 4)) % 8)];
          bossText = `首领 ${dir} ${Math.round(bossD / TILE)}格`;
        } else {
          bossText = raid.bossEngaged ? '首领 交战中' : '首领 未定位';
        }
      } else {
        bossText = `下个首领 F${raid.floor + (5 - (raid.floor % 5))}`;
      }
      const nearText = nearestD === Infinity ? '--' : `${Math.round(nearestD / TILE)}格`;
      el.mapIntel.textContent = `${bossText} · 近敌 ${nearText} · 交火 ${chasing}`;
    }

    if (raid) {
      const t = Math.max(0, Math.ceil(raid.timeLeft));
      const mm = String(Math.floor(t / 60)).padStart(2, '0');
      const ss = String(t % 60).padStart(2, '0');
      el.raidTimer.textContent = raid.overtime ? '增援中' : `${mm}:${ss}`;
      el.raidTimer.classList.toggle('low', t <= 30 || raid.overtime);
    }

    const boss = mode === 'raid' && world ? world.boss : null;
    if (boss && !boss.dead && raid) {
      if (boss.state === 'chase' || dist2(player.x, player.y, boss.x, boss.y) < 520 * 520) {
        raid.bossEngaged = true;
      }
      if (raid.bossEngaged) {
        el.bossHud.classList.remove('hidden');
        el.bossName.textContent = boss.name;
        el.bossFill.style.width = `${clamp((boss.hp / boss.maxHp) * 100, 0, 100)}%`;
        if (el.bossSkill) {
          const casting = !!boss.castType;
          const barrage = boss.barrageWaves > 0;
          const hazardsActive = world.hazards.some((h) => !h.exploded);
          const weak = boss.weakPointTimer > 0;
          const seconds = boss.castType ? Math.max(0, boss.castTimer).toFixed(1) : '';
          const phaseTag = `P${boss.bossPhase || 1}/3`;
          el.bossSkill.textContent = weak
            ? `${phaseTag} · 核心暴露 ${boss.weakPointTimer.toFixed(1)}s · 伤害 ×1.5`
            : casting
              ? `${phaseTag} · ${boss.castLabel} · ${seconds}s`
              : barrage
                ? `${phaseTag} · 全图弹幕展开中 · 躲到墙后`
                : hazardsActive
                  ? `${phaseTag} · 重击锁定 · 离开红色警示圈`
                  : `${phaseTag} · 全图弹幕 · 重击锁定`;
          el.bossSkill.classList.toggle('warning', casting || barrage || hazardsActive || weak);
        }
      } else {
        el.bossHud.classList.add('hidden');
      }
    } else {
      el.bossHud.classList.add('hidden');
    }
  }

  function findDropSpot(x, y) {
    const baseAngle = player?.angle || 0;
    for (let i = 0; i < 16; i++) {
      const angle = baseAngle + (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * 0.35;
      const distance = 18 + Math.floor(i / 4) * 8;
      const px = x + Math.cos(angle) * distance;
      const py = y + Math.sin(angle) * distance;
      if (canStandAt(px, py, 9)) return { x: px, y: py };
    }
    return { x, y };
  }

  function discardInventoryItem(itemId) {
    if (!raid || !player || mode !== 'raid' || !itemId) return false;
    const index = player.backpack.findIndex((item) => item.id === itemId);
    if (index < 0) return false;
    const item = player.backpack.splice(index, 1)[0];
    const spot = findDropSpot(player.x, player.y);
    world.pickups.push({
      x: spot.x,
      y: spot.y,
      type: 'item',
      item,
      life: 300,
      bob: rand(0, TAU),
      pickupDelay: 2,
      dropped: true,
      dropX: spot.x,
      dropY: spot.y,
      dropArmed: false
    });
    if (selectedInventoryItemId === itemId) {
      selectedInventoryItemId = player.backpack[0]?.id || null;
    }
    updateBackpackHud();
    addLootFeed(`已丢弃 ${itemName(item)} · 走开 2 秒后可拾取`, false);
    addFloatText(spot.x, spot.y - 22, '已丢弃', '#ffad45');
    playSound('reload');
    buildInventoryOverlay();
    return true;
  }

  function lootCell(item) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'loot-cell';
    if (!item) {
      cell.classList.add('empty');
      return cell;
    }
    const def = defOf(item);
    cell.classList.add('filled', `rarity-${def.rarity}`);
    if (item.id === selectedInventoryItemId) cell.classList.add('selected');
    cell.title = `${itemName(item)}：${def.desc}`;
    cell.innerHTML = `<span style="color:${choiceIconColor(def)}">${def.icon}</span>${(item.qty || 1) > 1 ? `<span class="loot-qty">${item.qty}</span>` : ''}`;
    return cell;
  }

  function moveToSecure(id) {
    if (!raid || !player) return;
    raid.secureBox = Array.isArray(raid.secureBox) ? raid.secureBox : [];
    const idx = player.backpack.findIndex((item) => item.id === id);
    if (idx < 0) return;
    if (raid.secureBox.length >= 9) {
      toast('安全箱满了。');
      return;
    }
    const [item] = player.backpack.splice(idx, 1);
    raid.secureBox.push(item);
    selectedInventoryItemId = player.backpack[0]?.id || null;
    updateBackpackHud();
    buildInventoryOverlay();
  }

  function moveFromSecure(id) {
    if (!raid || !player) return;
    const box = Array.isArray(raid.secureBox) ? raid.secureBox : [];
    const idx = box.findIndex((item) => item.id === id);
    if (idx < 0) return;
    if (player.backpack.length >= player.capacity) {
      toast('背包已满。');
      return;
    }
    const [item] = box.splice(idx, 1);
    player.backpack.push(item);
    selectedInventoryItemId = item.id;
    updateBackpackHud();
    buildInventoryOverlay();
  }

  // Tidy the backpack: group by item kind, then rarity, then value.
  function tidyBackpack() {
    if (!player) return;
    const kindOrder = { weapon: 0, armor: 1, pack: 2, stone: 3 };
    const rarityRank = { mythic: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
    player.backpack.sort((a, b) => {
      const da = defOf(a);
      const db = defOf(b);
      const ka = kindOrder[da.kind] ?? 4;
      const kb = kindOrder[db.kind] ?? 4;
      if (ka !== kb) return ka - kb;
      const ra = rarityRank[da.rarity] || 0;
      const rb = rarityRank[db.rarity] || 0;
      if (ra !== rb) return rb - ra;
      return itemSellValue(b) - itemSellValue(a);
    });
    selectedInventoryItemId = player.backpack[0]?.id || null;
    updateBackpackHud();
    buildInventoryOverlay();
    toast('背包已整理。');
  }

  function buildInventoryOverlay() {
    if (!player) return;
    const selectedForDiscard = player.backpack.find((item) => item.id === selectedInventoryItemId)
      || player.backpack[0] || null;
    if (!selectedForDiscard) selectedInventoryItemId = null;
    if (el.discardInventoryBtn) {
      el.discardInventoryBtn.disabled = !selectedForDiscard;
      el.discardInventoryBtn.textContent = selectedForDiscard
        ? `丢弃${(selectedForDiscard.qty || 1) > 1 ? ` ×${selectedForDiscard.qty}` : ''}`
        : '丢弃';
    }
    const totalValue = player.backpack.reduce((sum, item) => sum + itemSellValue(item), 0);
    el.inventoryLoadout.innerHTML = `
      <div>角色<strong style="color:${player.char.color}">${player.char.name}</strong></div>
      <div>背包<strong>${player.backpack.length} / ${player.capacity}</strong></div>
      <div>弹药<strong>${player.mag} / ${player.reserve}</strong></div>
      <div>医疗包<strong>×${player.medkits}</strong></div>
      <div>钥匙<strong>×${raid ? (raid.keys || 0) : 0}</strong></div>
      <div>估值<strong>+${totalValue}</strong></div>`;
    const secureBox = raid && Array.isArray(raid.secureBox) ? raid.secureBox : [];
    if (el.lootBackpackCount) el.lootBackpackCount.textContent = `${player.backpack.length} / ${player.capacity}`;
    if (el.lootSecureCount) el.lootSecureCount.textContent = `${secureBox.length} / 9`;
    // Backpack grid: every capacity slot is drawn, empty slots included.
    el.inventoryGrid.innerHTML = '';
    if (!player.backpack.some((item) => item.id === selectedInventoryItemId)) {
      selectedInventoryItemId = null;
    }
    const sortedBackpack = player.backpack;
    for (let i = 0; i < player.capacity; i += 1) {
      const item = sortedBackpack[i] || null;
      const cell = lootCell(item);
      if (item) {
        cell.addEventListener('click', () => {
          selectedInventoryItemId = item.id;
          buildInventoryOverlay();
        });
      }
      el.inventoryGrid.appendChild(cell);
    }

    // Secure box grid: filled cells take items back, empty cells accept the selection.
    if (el.secureGrid) {
      el.secureGrid.innerHTML = '';
      for (let i = 0; i < 9; i += 1) {
        const item = secureBox[i] || null;
        const cell = lootCell(item);
        cell.addEventListener('click', () => {
          if (item) moveFromSecure(item.id);
          else if (selectedInventoryItemId) moveToSecure(selectedInventoryItemId);
        });
        el.secureGrid.appendChild(cell);
      }
    }

    const selectedItem = player.backpack.find((item) => item.id === selectedInventoryItemId);
    if (!selectedItem) {
      el.inventoryDetail.classList.add('hidden');
      return;
    }
    const def = defOf(selectedItem);
    const kindLabel = def.kind === 'weapon' ? '武器' : def.kind === 'armor' ? '护甲' : def.kind === 'pack' ? '背包' : def.kind === 'stone' ? '强化' : '物资';
    const stats = [];
    if (def.kind === 'weapon') {
      const w = WEAPON_DEFS[def.weapon];
      const plus = enhanceLevel(selectedItem);
      stats.push(`伤害 <b>${Math.round(w.damage * (1 + plus * ENHANCE_RULES.weapon.perLevel + affixValue(selectedItem, 'damage')))}</b>${plus ? ` · 强化 +${plus}` : ''}`);
      stats.push(`弹匣 <b>${w.mag}</b>`);
      stats.push(w.auto || likelyTouch ? '全自动' : '半自动');
      stats.push(`射速 <b>${Math.round(60 / w.cooldown)}/min</b>`);
      if (w.pellets > 1) stats.push(`弹丸 <b>${w.pellets}</b>`);
      stats.push(`备弹 <b>${w.reserve}</b>`);
    } else if (def.kind === 'armor') {
      const a = ARMOR_DEFS[def.armor];
      const plus = enhanceLevel(selectedItem);
      stats.push(`伤害减免 <b>${Math.round(Math.min(0.75, a.reduction + plus * ENHANCE_RULES.armor.perLevel + affixValue(selectedItem, 'defense')) * 100)}%</b>${plus ? ` · 强化 +${plus}` : ''}`);
      if (a.speedBonus) stats.push(`移速 <b>+${Math.round(a.speedBonus * 100)}%</b>`);
      if (a.medkitBonus) stats.push(`医疗包 <b>+${a.medkitBonus}</b>`);
      if (a.stealth) stats.push(`敌人视野 <b>-${Math.round((1 - a.stealth) * 100)}%</b>`);
    } else if (def.kind === 'pack') {
      const pack = PACK_QUALITIES[def.pack];
      const plus = enhanceLevel(selectedItem);
      stats.push(`品质 <b>${pack.label}</b>`);
      stats.push(`容量 <b>+${pack.bonus + plus + affixValue(selectedItem, 'capacity')}</b>${plus ? ` · 强化 +${plus}` : ''}`);
      stats.push('撤离后在仓库装备');
    } else if (def.kind === 'stone') {
      stats.push(`等级 <b>Lv.${def.stoneLevel}</b>`);
      stats.push(`强化成功率 <b>${Math.round(def.success * 100)}%</b>`);
      stats.push('回到基地强化台使用');
    } else {
      stats.push(`数量 <b>×${selectedItem.qty || 1}</b>`);
      stats.push(`单价 <b>+${def.sell}</b>`);
    }
    if (itemAffixText(selectedItem)) stats.push(`<span style="color:#ffd15c">${itemAffixText(selectedItem)}</span>`);
    const unitValue = Math.round(itemSellValue(selectedItem) / (selectedItem.qty || 1));
    el.inventoryDetail.classList.remove('hidden');
    el.inventoryDetail.innerHTML = `
      <div class="inventory-detail-head">
        <div class="inventory-detail-icon ${def.rarity === 'mythic' ? 'mythic-icon' : ''}" style="color:${choiceIconColor(def)}">${def.icon}</div>
        <div class="inventory-detail-title">
          <div class="inventory-detail-name">${itemName(selectedItem)}${selectedItem.qty > 1 ? ` ×${selectedItem.qty}` : ''}</div>
          <div class="inventory-detail-meta">${kindLabel} · ${RARITY_LABEL[def.rarity]} · 单件估值 +${unitValue}</div>
        </div>
        <div class="inventory-detail-value">总值<br>+${itemSellValue(selectedItem)}</div>
      </div>
      <div class="inventory-detail-desc">${def.desc}</div>
      <div class="inventory-detail-stats">${stats.map((s) => `<span>${s}</span>`).join('')}</div>
      ${['weapon', 'armor', 'pack'].includes(def.kind) ? `<div class="inventory-detail-compare">${gearCompareText(selectedItem)}</div>` : ''}
      <div class="inventory-discard-hint">右上角「丢弃」会把整组物品放到地上；走开约 2 秒后可再次拾取。</div>`;
  }

  function openInventory() {
    if (mode !== 'raid' || !raid || raid.ended || raid.inventoryOpen) return;
    raid.inventoryOpen = true;
    raid.paused = true;
    buildInventoryOverlay();
    el.inventoryOverlay.classList.remove('hidden');
    el.interactPrompt.classList.add('hidden');
  }

  function closeInventory() {
    if (!raid || !raid.inventoryOpen) return;
    raid.inventoryOpen = false;
    raid.paused = false;
    el.inventoryOverlay.classList.add('hidden');
  }

  function openMap() {
    if (mode !== 'raid' || !raid || raid.ended || raid.inventoryOpen || raid.mapOpen) return;
    if (raid.paused) return;
    raid.mapOpen = true;
    raid.paused = true;
    el.mapOverlay.classList.remove('hidden');
    el.interactPrompt.classList.add('hidden');
    drawFullMap();
  }

  function closeMap() {
    if (!raid || !raid.mapOpen) return;
    raid.mapOpen = false;
    raid.paused = false;
    el.mapOverlay.classList.add('hidden');
  }

  function toggleMap() {
    if (!raid) return;
    if (raid.mapOpen) closeMap();
    else openMap();
  }

  function togglePause() {
    if (mode !== 'raid' || !raid || raid.ended || raid.perkChoiceOpen || raid.extractionChoiceOpen) return;
    if (raid.inventoryOpen) {
      closeInventory();
      return;
    }
    if (raid.paused) {
      raid.paused = false;
      el.pauseOverlay.classList.add('hidden');
    } else {
      raid.paused = true;
      el.pauseOverlay.classList.remove('hidden');
      el.interactPrompt.classList.add('hidden');
    }
  }

  // ---------------------------------------------------------------------------
  // Raid lifecycle / random events
  // ---------------------------------------------------------------------------
  function applyRaidEvent(forcedType = null) {
    if (!world) return;
    const roll = Math.random();
    let type = forcedType;
    if (!type) {
      if (roll < 0.22) type = 'elite';
      else if (roll < 0.42) type = 'extract';
      else if (roll < 0.59) type = 'blackout';
    }

    if (!type) {
      raid.event = null;
      return;
    }

    if (type === 'elite') {
      const rooms = world.rooms.slice(1, -1);
      for (let i = 0; i < 2; i++) {
        const room = pick(rooms);
        const spot = roomSpot(room);
        const enemy = new Enemy(spot.x, spot.y, 'heavy', room);
        enemy.elite = true;
        enemy.maxHp = Math.round(enemy.maxHp * 1.45);
        enemy.hp = enemy.maxHp;
        enemy.damage *= 1.2;
        enemy.xp = Math.round(enemy.xp * 2);
        enemy.scrap = Math.round(enemy.scrap * 2);
        enemy.color = '#ffd15c';
        applyEliteAffix(enemy);
        world.enemies.push(enemy);
      }
      raid.event = { type, label: '精英巡逻队出现', timer: 0 };
    } else if (type === 'extract') {
      const room = pick(world.rooms.slice(1, -1));
      const spot = roomSpot(room);
      world.altExtraction = { x: spot.x, y: spot.y, r: 50, timeLeft: 75, pulse: 0 };
      raid.event = { type, label: '临时撤离点开启', timer: 75 };
    } else if (type === 'blackout') {
      world.blackoutTimer = 35;
      raid.event = { type, label: '区域断电', timer: 35 };
    }
  }

  function updateRaidEvent(dt) {
    if (!raid.event || raid.event.timer <= 0) return;
    raid.event.timer = Math.max(0, raid.event.timer - dt);
    if (raid.event.type === 'extract') {
      if (world.altExtraction) world.altExtraction.timeLeft = raid.event.timer;
      if (raid.event.timer <= 0) addLootFeed('临时撤离点已关闭。', true);
    } else if (raid.event.type === 'blackout') {
      world.blackoutTimer = raid.event.timer;
      if (raid.event.timer <= 0) addLootFeed('区域供电恢复。', false);
    }
  }

  function resetRaidInputs() {
    keys['r'] = false;
    mouse.down = false;
    mouse.semiQueued = false;
    touch.moveX = 0;
    touch.moveY = 0;
    touch.moveMag = 0;
    touch.moveTargetMag = 0;
    touch.aiming = false;
    touch.aimMag = 0;
    touch.aimPressAt = 0;
    touch.firing = false;
    touch.hasAim = false;
    touch.aimAngle = 0;
    touch.aimTargetAngle = 0;
  }

  function beginFloor(isFirstFloor = false) {
    world = generateWorld();
    raid.elapsed = 0;
    raid.wave = 0;
    raid.overtime = false;
    raid.reinforceTimer = 180;
    if (!player) {
      player = new Player(world.spawn.x, world.spawn.y);
    } else {
      player.x = world.spawn.x;
      player.y = world.spawn.y;
      player.lockTarget = null;
      player.sniperLock = null;
      player.dashTimer = 0;
      player.dashInvuln = 0;
      player.overdriveTimer = 0;
      player.reloading = false;
      player.reloadTimer = 0;
      player.fireCd = 0;
      player.hurtCd = 0;
      player.moving = false;
      player.stepCd = 0;
      player.walkPhase = 0;
    }
    camera = { x: clamp(player.x - VIEW_W / 2, 0, MAP_PW - VIEW_W), y: clamp(player.y - VIEW_H / 2, 0, MAP_PH - VIEW_H), shake: 0 };
    cameraInitialized = true;
    world.shake = 0;
    raid.paused = false;
    raid.inventoryOpen = false;
    raid.mapOpen = false;
    raid.progress = 0;
    raid.interactionType = null;
    raid.searchTarget = null;
    raid.searchInterruptTimer = 0;
    raid.bossEngaged = false;
    raid.perkChoiceOpen = false;
    raid.extractionChoiceOpen = false;
    raidTutorialState.active = false;
    applyRaidEvent();
    el.pauseOverlay.classList.add('hidden');
    el.inventoryOverlay.classList.add('hidden');
    el.mapOverlay.classList.add('hidden');
    el.extractChoiceOverlay.classList.add('hidden');
    el.perkOverlay.classList.add('hidden');
    el.bossHud.classList.add('hidden');
    el.interactPrompt.classList.add('hidden');
    if (el.raidTutorial) el.raidTutorial.classList.add('hidden');
    if (el.hitMarker) el.hitMarker.classList.remove('active', 'kill');
    if (el.damageDirection) el.damageDirection.classList.remove('active');
    if (el.lowHpVignette) el.lowHpVignette.classList.remove('active');
    resetRaidInputs();
    buildFlowField();
    updateExploration(0);
    hudAccumulator = 0;
    lastMinimapDraw = -1;
    const stage = world.stage || stageForFloor(raid.floor);
    raid.stage = stage.name;
    addLootFeed(`F${raid.floor} ${stage.name} · ${stage.tag}`, false);
    addLootFeed(world.boss
      ? `首领层：${world.boss.name} 已出现。`
      : `击倒金色钥匙守卫，获取 🔑 开启钥匙房宝箱。`, !!world.boss);
    if (world.enemies.some((enemy) => enemy.isBounty)) {
      addLootFeed('高危目标：击倒可拿传说掉落，但会惊动全图。', true);
    }
    updateHUD();
    updateBackpackHud();
    if (isFirstFloor) startRaidTutorial();
  }

  function startRaid(options = {}) {
    Sound.init();
    if (likelyTouch && window.innerHeight > window.innerWidth) enterLandscapeFullscreen();
    save.stats.raids += 1;
    persist();

    const challengeBoss = options.bossId ? BOSS_VARIANTS.find((variant) => variant.id === options.bossId) : null;
    const challengeDifficulty = challengeBoss
      ? clamp(Math.round(Number(options.difficulty) || 1), 1, 6)
      : 0;
    const challenge = challengeBoss ? { bossId: challengeBoss.id, name: challengeBoss.name, difficulty: challengeDifficulty } : null;

    world = null;
    player = null;
    raid = {
      timeLeft: 360,
      floor: challenge ? challengeDifficulty * 5 : 1,
      challenge,
      level: 1,
      xp: 0,
      pendingPerks: 0,
      perks: {},
      scrap: 0,
      parts: 0,
      keys: 0,
      kills: 0,
      containersSearched: 0,
      secureBox: [],
      paused: false,
      ended: false,
      inventoryOpen: false,
      mapOpen: false,
      perkChoiceOpen: false,
      extractionChoiceOpen: false,
      bossEngaged: false,
      risk: save.settings.raidRisk || 'normal',
      event: null,
      progress: 0,
      interactionType: null,
      searchTarget: null,
      searchInterruptTimer: 0,
      lastFullWarning: -10,
      stats: { damageDealt: 0, damageTaken: 0, highestHit: 0, dodges: 0, skillHits: 0, eliteKills: 0, bossKills: 0, objectives: 0 },
      startedAt: performance.now()
    };

    mode = 'raid';
    el.baseScreen.classList.add('hidden');
    el.gameScreen.classList.remove('hidden');
    el.debriefOverlay.classList.add('hidden');
    el.perkOverlay.classList.add('hidden');
    el.extractChoiceOverlay.classList.add('hidden');
    el.lootFeed.innerHTML = '';
    el.damageFlash.style.opacity = '0';
    beginFloor(true);
    const risk = riskDef();
    if (challenge) {
      addLootFeed(`首领挑战：${challenge.name} · 难度 ${challenge.difficulty}（等同 F${raid.floor} 强度）`, true);
      addLootFeed('撤离点一开始就在地图上，打不过随时可以撤。', false);
    } else {
      addLootFeed(`${risk.label}行动开始 · 第 1 层：搜刮物资，寻找钥匙房宝箱。`, false);
    }
    const dailyData = ensureDaily();
    addLootFeed(`今日合约 ${dailyDoneCount(dailyData)}/3 已完成 · 基地「合约」查看`, false);
    if (raid.event) {
      addLootFeed(`随机事件：${raid.event.label}${raid.event.timer > 0 ? `（${raid.event.timer}秒）` : ''}`, false);
      toast(`随机事件：${raid.event.label}`);
    }
    if (touch.ui) {
      toast('轻触右侧瞄准，长按开火自动锁定；冲刺可闪避，技能按钮释放角色主动技能。');
      el.touchHint.classList.remove('fade');
      setTimeout(() => el.touchHint.classList.add('fade'), 5000);
    } else {
      toast('行动开始：Space 冲刺闪避，Q 释放角色技能；每 5 层出现不同首领。');
    }
    lastTime = performance.now();
  }

  function endRaid(success, reason) {
    if (!raid || raid.ended || mode !== 'raid') return;
    raid.ended = true;
    raid.paused = true;
    raid.perkChoiceOpen = false;
    raid.extractionChoiceOpen = false;
    mode = 'debrief';

    el.pauseOverlay.classList.add('hidden');
    el.inventoryOverlay.classList.add('hidden');
    el.mapOverlay.classList.add('hidden');
    el.extractChoiceOverlay.classList.add('hidden');
    el.perkOverlay.classList.add('hidden');
    el.bossHud.classList.add('hidden');
    el.interactPrompt.classList.add('hidden');
    raidTutorialState.active = false;
    if (el.raidTutorial) el.raidTutorial.classList.add('hidden');
    if (el.hitMarker) el.hitMarker.classList.remove('active', 'kill');
    if (el.damageDirection) el.damageDirection.classList.remove('active');
    if (el.lowHpVignette) el.lowHpVignette.classList.remove('active');
    raid.inventoryOpen = false;
    raid.mapOpen = false;

    const carried = player.backpack.slice();
    const secureItems = Array.isArray(raid.secureBox) ? raid.secureBox.slice() : [];
    const itemUnits = carried.concat(secureItems).reduce((n, i) => n + (i.qty || 1), 0);
    let scrapGain = 0;

    if (success) {
      for (const item of carried) addToStash(item);
      for (const item of secureItems) addToStash(item);
      scrapGain = raid.scrap + Math.round((10 + raid.floor * 15 + Math.floor(Math.max(0, raid.timeLeft) / 90)) * (1 + (player?.collectorBonus?.scrap || 0)));
      save.scrap += scrapGain;
      save.modParts += raid.parts;
      save.stats.extracts += 1;
      save.stats.loot += itemUnits;
      playSound('extract');
    } else {
      // Items banked in the secure box survive a death.
      for (const item of secureItems) addToStash(item);
      save.stats.deaths += 1;
      playSound('hurt');
    }

    save.stats.kills += raid.kills;
    persist();
    const dailyStats = raid.stats || { damageDealt: 0, eliteKills: 0, bossKills: 0, objectives: 0 };
    recordDailyProgress({
      kills: raid.kills,
      containers: raid.containersSearched || 0,
      extracts: success ? 1 : 0,
      objectives: dailyStats.objectives || 0,
      elites: dailyStats.eliteKills || 0,
      bosses: dailyStats.bossKills || 0,
      depth: success ? raid.floor : 0,
      damage: Math.round(dailyStats.damageDealt || 0)
    });
    renderAllBase();

    el.debriefTag.textContent = success ? 'EXTRACTION COMPLETE // 返回基地' : 'SIGNAL LOST // 行动失败';
    el.debriefTitle.textContent = success ? '成功撤离' : '行动失败';
    el.debriefTitle.classList.toggle('fail', !success);
    el.debriefSub.textContent = reason + (success
      ? ` 行动用时 ${formatDuration((performance.now() - raid.startedAt) / 1000)}。本局等级与成长会在返回基地后重置。`
      : ' 本局等级、成长和携带物资全部丢失，再进入会从 LV.1 开始。');
    const stats = raid.stats || { damageDealt: 0, damageTaken: 0, highestHit: 0, dodges: 0, skillHits: 0, eliteKills: 0, bossKills: 0, objectives: 0 };
    const bestItem = success && carried.length
      ? carried.reduce((best, item) => (!best || itemSellValue(item) > itemSellValue(best) ? item : best), null)
      : null;
    el.debriefStats.innerHTML = `
      <div><span>击倒敌人</span><strong>${raid.kills}</strong></div>
      <div><span>造成伤害</span><strong>${Math.round(stats.damageDealt).toLocaleString()}</strong></div>
      <div><span>承受伤害</span><strong>${Math.round(stats.damageTaken).toLocaleString()}</strong></div>
      <div><span>最高单次</span><strong>${Math.round(stats.highestHit).toLocaleString()}</strong></div>
      <div><span>成功闪避</span><strong>${stats.dodges}</strong></div>
      <div><span>精英 / 首领</span><strong>${stats.eliteKills} / ${stats.bossKills}</strong></div>
      <div><span>完成目标</span><strong>${stats.objectives}</strong></div>
      <div><span>${success ? '获得废料' : '本局等级'}</span><strong>${success ? `+${scrapGain}` : `LV.${raid.level}`}</strong></div>
      <div><span>${success ? '带回物资' : '损失物资'}</span><strong>${itemUnits}</strong></div>
      <div><span>深入层数</span><strong>F${raid.floor}</strong></div>`;
    el.debriefLoot.innerHTML = '';
    if (success && carried.length) {
      const merged = [];
      for (const item of carried) {
        const found = merged.find((x) => x.type === item.type);
        if (found) found.qty += item.qty || 1;
        else merged.push({ ...item });
      }
      for (const item of merged) {
        const span = document.createElement('span');
        span.textContent = `${itemName(item)} ×${item.qty || 1}`;
        el.debriefLoot.appendChild(span);
      }
    } else {
      const span = document.createElement('span');
      span.textContent = success ? '空手而归' : '没有物资被带回';
      el.debriefLoot.appendChild(span);
    }
    const runSpan = document.createElement('span');
    runSpan.style.color = '#d6ff4d';
    const perkSummary = PERK_KEYS.filter((key) => perkRank(key) > 0)
      .map((key) => `${PERK_DEFS[key].name}${perkRank(key)}`).join(' · ');
    runSpan.textContent = `本局 LV.${raid.level} · F${raid.floor}${perkSummary ? ` · ${perkSummary}` : ''}${success && raid.parts > 0 ? ` · 零件 +${raid.parts}` : ''} · 撤出后重置`;
    el.debriefLoot.appendChild(runSpan);
    if (bestItem) {
      const bestSpan = document.createElement('span');
      bestSpan.style.color = '#ffd15c';
      bestSpan.textContent = `最佳掉落：${itemName(bestItem)}（价值 ${itemSellValue(bestItem)}）`;
      el.debriefLoot.appendChild(bestSpan);
    }

    el.debriefOverlay.classList.remove('hidden');
    updateHUD();
  }

  function formatDuration(seconds) {
    const s = Math.max(0, Math.round(seconds));
    return `${Math.floor(s / 60)}分${String(s % 60).padStart(2, '0')}秒`;
  }

  function returnToBase() {
    el.debriefOverlay.classList.add('hidden');
    el.perkOverlay.classList.add('hidden');
    el.extractChoiceOverlay.classList.add('hidden');
    el.bossHud.classList.add('hidden');
    if (el.raidTutorial) el.raidTutorial.classList.add('hidden');
    raidTutorialState.active = false;
    if (el.hitMarker) el.hitMarker.classList.remove('active', 'kill');
    if (el.damageDirection) el.damageDirection.classList.remove('active');
    if (el.lowHpVignette) el.lowHpVignette.classList.remove('active');
    el.gameScreen.classList.add('hidden');
    el.baseScreen.classList.remove('hidden');
    mode = 'base';
    world = null;
    player = null;
    raid = null;
    pendingPerkChoices = [];
    renderAllBase();
    lastTime = performance.now();
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  function drawDust() {
    if (save.settings.performanceMode) return;
    const t = world.time;
    const camX = camera.x;
    const camY = camera.y;
    ctx.fillStyle = 'rgba(186,214,242,.13)';
    for (let i = 0; i < 52; i += 1) {
      const bx = ((i * 127.3) % 100) / 100;
      const by = ((i * 311.7) % 100) / 100;
      const x = camX + bx * VIEW_W + Math.sin(t * 0.5 + i * 2.1) * 16;
      const y = camY + by * VIEW_H + Math.sin(t * 0.37 + i * 1.3) * 11;
      const s = i % 5 === 0 ? 2 : 1;
      ctx.fillRect(x, y, s, s);
    }
  }

  function getScanlinePattern() {
    if (scanlinePattern) return scanlinePattern;
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 4;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,.10)';
    g.fillRect(0, 0, 4, 1);
    g.fillStyle = 'rgba(255,255,255,.015)';
    g.fillRect(0, 1, 4, 1);
    scanlinePattern = ctx.createPattern(c, 'repeat');
    return scanlinePattern;
  }

  function drawRaid() {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    if (!world || !player) return;

    const shakeX = save.settings.screenShake === false ? 0 : (Math.random() - 0.5) * world.shake;
    const shakeY = save.settings.screenShake === false ? 0 : (Math.random() - 0.5) * world.shake;
    const camX = Math.round(camera.x + shakeX);
    const camY = Math.round(camera.y + shakeY);

    ctx.save();
    // Kill slow-mo: ease a small camera zoom around the view centre.
    if (slowmo.zoom > 0) {
      const zoomScale = 1 + slowmo.zoom * 0.045;
      ctx.translate(VIEW_W / 2, VIEW_H / 2);
      ctx.scale(zoomScale, zoomScale);
      ctx.translate(-VIEW_W / 2, -VIEW_H / 2);
    }
    ctx.translate(-camX, -camY);

    ctx.drawImage(world.mapCanvas, 0, 0);
    drawExtraction();
    drawAltExtraction();
    drawKeyRoom();
    drawObjective();
    // Main view is fog-free: draw every nearby object regardless of LOS.
    // The minimap/full map still use world.fogMini and exploration state.
    for (const c of world.containers) drawContainer(c);
    for (const p of world.pickups) drawPickup(p);
    drawHazards();
    drawEnemyTelegraphs();
    drawBeams();
    for (const bullet of world.bullets) drawBullet(bullet);
    for (const enemy of world.enemies) if (!enemy.dead) drawCharacter(enemy, false);
    drawCharacter(player, true);
    drawLockOn();
    drawSkillTarget();
    drawDust();
    for (const p of world.particles) drawParticle(p);
    for (const t of world.floatTexts) drawFloatText(t);

    ctx.restore();

    // Vignette / atmosphere. Cache the gradient instead of rebuilding it every frame.
    if (!save.settings.performanceMode) {
      if (!raidVignetteGradient) {
        raidVignetteGradient = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.82);
        raidVignetteGradient.addColorStop(0, 'rgba(0,0,0,0)');
        raidVignetteGradient.addColorStop(1, 'rgba(0,0,0,.38)');
      }
      ctx.fillStyle = raidVignetteGradient;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (world.blackoutTimer > 0) {
      const flicker = save.settings.performanceMode ? 0.42 : 0.36 + (Math.sin(world.time * 7) + 1) * 0.06;
      ctx.fillStyle = `rgba(0,0,0,${flicker})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    // Very light CRT scanlines; skipped in performance mode.
    if (!save.settings.performanceMode) {
      ctx.fillStyle = getScanlinePattern();
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    if (world.time - lastMinimapDraw >= 0.05) {
      lastMinimapDraw = world.time;
      drawMinimap();
    }
    drawCrosshair();
  }

  function drawKeyRoom() {
    const room = world.keyRoom;
    if (!room) return;
    const pulse = (Math.sin(world.time * 2.2) + 1) * 0.5;
    ctx.save();
    ctx.strokeStyle = `rgba(255,209,92,${0.12 + pulse * 0.08})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 9]);
    ctx.strokeRect(room.x + 8, room.y + 8, room.w - 16, room.h - 16);
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255,209,92,${0.18 + pulse * 0.08})`;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('KEY ROOM // 钥匙房', room.x + room.w / 2, room.y + 22);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function drawObjective() {
    const obj = world?.objective;
    if (!obj) return;
    const def = OBJECTIVE_DEFS[obj.type];
    const pulse = (Math.sin(obj.pulse) + 1) * 0.5;
    const radius = obj.r + pulse * 5;
    const progress = clamp(obj.progress / obj.duration, 0, 1);
    ctx.save();
    ctx.translate(obj.x, obj.y);
    const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, radius + 24);
    grad.addColorStop(0, `${obj.color}35`);
    grad.addColorStop(0.65, `${obj.color}10`);
    grad.addColorStop(1, `${obj.color}00`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 24, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = obj.state === 'complete' ? 'rgba(214,255,77,.85)' : `${obj.color}aa`;
    ctx.lineWidth = 2;
    ctx.setLineDash(obj.state === 'active' ? [] : [7, 6]);
    ctx.lineDashOffset = -obj.pulse * 10;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = obj.state === 'complete' ? '#d6ff4d' : obj.color;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 6, -Math.PI / 2, -Math.PI / 2 + TAU * progress);
    ctx.stroke();
    ctx.fillStyle = 'rgba(5,9,14,.75)';
    ctx.fillRect(-17, -17, 34, 34);
    ctx.strokeStyle = obj.color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-17, -17, 34, 34);
    ctx.fillStyle = obj.color;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(obj.state === 'complete' ? '✓' : obj.icon, 0, 1);
    ctx.font = 'bold 9px monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = obj.color;
    ctx.fillText(obj.label, 0, -radius - 12);
    if (obj.state === 'active') {
      ctx.fillStyle = 'rgba(5,9,14,.82)';
      ctx.fillRect(-30, radius + 8, 60, 13);
      ctx.fillStyle = obj.color;
      ctx.font = 'bold 8px monospace';
      ctx.fillText(`${Math.round(progress * 100)}%`, 0, radius + 18);
    }
    ctx.restore();
  }

  function drawExtraction() {
    const ex = world.extraction;
    const pulse = (Math.sin(world.time * 2.4) + 1) * 0.5;
    const radius = ex.r + pulse * 8;
    ctx.save();
    ctx.translate(ex.x, ex.y);

    const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, radius + 20);
    grad.addColorStop(0, 'rgba(214,255,77,.22)');
    grad.addColorStop(0.55, 'rgba(123,220,76,.08)');
    grad.addColorStop(1, 'rgba(123,220,76,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 20, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = `rgba(214,255,77,${0.45 + pulse * 0.35})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.lineDashOffset = -world.time * 22;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(214,255,77,.10)';
    ctx.fillRect(-25, -25, 50, 50);
    ctx.strokeStyle = 'rgba(214,255,77,.65)';
    ctx.strokeRect(-25, -25, 50, 50);
    ctx.fillStyle = '#d6ff4d';
    ctx.fillRect(-5, -5, 10, 10);

    // Little direction chevrons.
    ctx.fillStyle = `rgba(214,255,77,${0.45 + pulse * 0.35})`;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -radius + 8);
      ctx.lineTo(-5, -radius + 16);
      ctx.lineTo(5, -radius + 16);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d6ff4d';
    ctx.fillText('撤 离', 0, 4);
    ctx.restore();
  }

  function drawAltExtraction() {
    const ex = world.altExtraction;
    if (!ex || ex.timeLeft <= 0) return;
    const pulse = (Math.sin(world.time * 3.2) + 1) * 0.5;
    const radius = ex.r + pulse * 6;
    ctx.save();
    ctx.translate(ex.x, ex.y);
    ctx.fillStyle = 'rgba(85,217,255,.12)';
    ctx.beginPath();
    ctx.arc(0, 0, radius + 18, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(85,217,255,${0.5 + pulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.lineDashOffset = -world.time * 18;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(85,217,255,.12)';
    ctx.fillRect(-24, -24, 48, 48);
    ctx.strokeStyle = 'rgba(85,217,255,.8)';
    ctx.strokeRect(-24, -24, 48, 48);
    ctx.fillStyle = '#55d9ff';
    ctx.fillRect(-5, -5, 10, 10);
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8be8ff';
    ctx.fillText(`临时撤离 ${Math.ceil(ex.timeLeft)}s`, 0, -34);
    ctx.restore();
  }

  function drawContainer(c) {
    ctx.save();
    ctx.translate(Math.round(c.x), Math.round(c.y));
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(0, 12, c.vault ? 22 : 18, c.vault ? 7 : 6, 0, 0, TAU);
    ctx.fill();

    if (c.searched) {
      ctx.fillStyle = '#111822';
      ctx.fillRect(-15, -7, 30, 18);
      ctx.fillStyle = '#253246';
      ctx.fillRect(-15, -7, 30, 4);
      ctx.fillStyle = '#1a2432';
      ctx.fillRect(-11, -11, 22, 5);
      ctx.strokeStyle = c.vault ? 'rgba(255,209,92,.35)' : '#2f3d50';
      ctx.strokeRect(-15, -7, 30, 18);
    } else {
      const rareCache = !c.vault && c.rarity === 'rare';
      const accent = c.vault ? '#ffd15c' : rareCache ? '#55d9ff' : '#d6ff4d';
      const accentRgb = c.vault ? '255,209,92' : rareCache ? '85,217,255' : '214,255,77';
      const glow = 0.25 + (Math.sin(world.time * 2 + c.pulse) + 1) * 0.13;
      ctx.fillStyle = `rgba(${accentRgb},${glow * (c.vault ? 0.36 : rareCache ? 0.32 : 0.24)})`;
      ctx.fillRect(c.vault ? -21 : -18, c.vault ? -17 : -15, c.vault ? 42 : 36, c.vault ? 36 : 32);
      ctx.fillStyle = c.vault ? '#4a3b1d' : rareCache ? '#1d3342' : '#2c3b2b';
      ctx.fillRect(-15, -9, 30, 20);
      ctx.fillStyle = c.vault ? '#705a27' : rareCache ? '#34566b' : '#485b36';
      ctx.fillRect(-15, -9, 30, 5);
      ctx.fillStyle = accent;
      ctx.fillRect(-3, 1, 6, 3);
      ctx.strokeStyle = `rgba(${accentRgb},.9)`;
      ctx.strokeRect(-15, -9, 30, 20);
      ctx.fillStyle = c.vault ? '#c2a34b' : rareCache ? '#5f9ab3' : '#9ab52e';
      ctx.fillRect(-12, -7, 3, 16);
      ctx.fillRect(9, -7, 3, 16);
      if (rareCache) {
        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#55d9ff';
        ctx.textAlign = 'center';
        ctx.fillText('高级补给箱', 0, -14);
        ctx.textAlign = 'left';
      }
      if (c.vault) {
        ctx.strokeStyle = '#ffd15c';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, -1, 4, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = '#ffd15c';
        ctx.fillRect(-1, 2, 2, 5);
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(c.locked ? '🔑 钥匙箱' : '钥匙箱', 0, -15);
        ctx.textAlign = 'left';
      }
    }

    if (c.progress > 0 && c.progress < 1) {
      ctx.fillStyle = '#070b10';
      ctx.fillRect(-17, -22, 34, 4);
      ctx.fillStyle = c.vault ? '#ffd15c' : '#d6ff4d';
      ctx.fillRect(-17, -22, 34 * c.progress, 4);
    }
    ctx.restore();
  }

  function drawPickup(p) {
    const bounce = Math.sin(p.bob) * 3;
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y + bounce));
    const color = p.type === 'key' ? '#ffd15c' : p.bossDrop ? '#ffd15c' : p.type === 'ammo' ? '#d6c27a' : p.type === 'med' ? '#74f0a0' : p.type === 'item' ? choiceIconColor(defOf(p.item)) : '#9fb6d1';
    ctx.fillStyle = `${color}22`;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, TAU);
    ctx.fill();
    if (p.type === 'key') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-4, -2, 3.5, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillRect(-1, -1, 9, 2.5);
      ctx.fillRect(5, 0, 2.5, 4);
      ctx.fillRect(2, 0, 2.5, 3);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = '#0a1016';
      ctx.fillRect(-2, -2, 4, 4);
    }
    if (p.pickupDelay > 0) {
      ctx.fillStyle = '#ffad45';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(p.pickupDelay)}s`, 0, -22);
    }
    ctx.restore();
  }

  function drawHazards() {
    for (const h of world.hazards) {
      const pct = h.exploded ? clamp(h.blast / 0.36, 0, 1) : clamp(1 - h.timer / h.maxTimer, 0, 1);
      ctx.save();
      if (h.exploded) {
        ctx.globalAlpha = pct * 0.65;
        ctx.fillStyle = h.color;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius * (1.15 - pct * 0.2), 0, TAU);
        ctx.fill();
        ctx.globalAlpha = pct;
        ctx.strokeStyle = '#fff2c2';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius * (1.2 - pct * 0.25), 0, TAU);
        ctx.stroke();
      } else {
        const pulse = 0.5 + 0.5 * Math.sin(world.time * 11);
        ctx.globalAlpha = 0.11 + pulse * 0.07;
        ctx.fillStyle = h.color;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.88;
        ctx.strokeStyle = h.color;
        ctx.lineWidth = 2 + pulse;
        ctx.setLineDash([7, 5]);
        ctx.lineDashOffset = -world.time * 30;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = '#fff0b0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius * pct, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#ffd6a0';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${h.label} ${Math.max(0, h.timer).toFixed(1)}s`, h.x, h.y - h.radius - 8);
      }
      ctx.restore();
    }
  }

  function rayWallDistance(x, y, angle, maxDist = 900) {
    const step = 6;
    for (let d = 0; d <= maxDist; d += step) {
      if (isSolidAt(x + Math.cos(angle) * d, y + Math.sin(angle) * d)) return d;
    }
    return maxDist;
  }

  function drawEnemyTelegraphs() {
    for (const enemy of world.enemies) {
      if (enemy.dead) continue;
      if (enemy.chargePhase === 'windup') {
        const dist = 230;
        const ex = enemy.x + Math.cos(enemy.chargeAngle) * dist;
        const ey = enemy.y + Math.sin(enemy.chargeAngle) * dist;
        const pulse = 0.5 + 0.5 * Math.sin(world.time * 14);
        ctx.save();
        ctx.globalAlpha = 0.24 + pulse * 0.2;
        ctx.strokeStyle = '#ffad45';
        ctx.lineWidth = 3;
        ctx.setLineDash([9, 5]);
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.16 + pulse * 0.1;
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.restore();
      } else if (enemy.winding && enemy.attackType === 'sniper') {
        const dist = rayWallDistance(enemy.x, enemy.y, enemy.attackAimAngle, 650);
        const charge = 1 - enemy.shotWindup / Math.max(0.01, enemy.shotWindupMax);
        ctx.save();
        ctx.globalAlpha = 0.25 + charge * 0.5;
        ctx.strokeStyle = '#ff5b6e';
        ctx.lineWidth = 1 + charge * 1.8;
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y);
        ctx.lineTo(enemy.x + Math.cos(enemy.attackAimAngle) * dist, enemy.y + Math.sin(enemy.attackAimAngle) * dist);
        ctx.stroke();
        ctx.globalAlpha = 0.5 + charge * 0.4;
        ctx.fillStyle = '#ffb0ba';
        ctx.beginPath();
        ctx.arc(enemy.x + Math.cos(enemy.attackAimAngle) * dist, enemy.y + Math.sin(enemy.attackAimAngle) * dist, 4, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }

    const boss = world.boss;
    if (!boss || boss.dead || !boss.castType) return;
    const charge = 1 - boss.castTimer / Math.max(0.01, boss.castMax);
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.globalAlpha = 0.25 + charge * 0.55;
    ctx.strokeStyle = boss.bossVariant.color;
    ctx.lineWidth = 2;
    if (boss.castType === 'barrage') {
      const radius = 48 + charge * 36;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU + world.time * 0.35;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (radius + 4), Math.sin(a) * (radius + 4));
        ctx.lineTo(Math.cos(a) * (radius + 34), Math.sin(a) * (radius + 34));
        ctx.stroke();
      }
    } else if (boss.castType === 'fan') {
      const base = Math.atan2(player.y - boss.y, player.x - boss.x);
      ctx.globalAlpha = 0.2 + charge * 0.25;
      ctx.fillStyle = boss.bossVariant.color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 260, base - 0.58, base + 0.58);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBullet(b) {
    const tx = b.x - b.vx * 0.016;
    const ty = b.y - b.vy * 0.016;
    const enemyBullet = b.owner !== 'player';
    const radius = b.radius || (enemyBullet ? 1.5 : 2);
    ctx.strokeStyle = b.color;
    ctx.lineWidth = b.kind === 'bossRing' ? 2.4 : b.kind === 'sniper' ? 3 : enemyBullet ? 1.5 : 2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (enemyBullet) {
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, radius, 0, TAU);
      ctx.fill();
      if (b.kind === 'bossRing' || b.kind === 'sniper') {
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.arc(b.x, b.y, radius * 2.2, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawBeams() {
    if (!world || !world.beams.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const beam of world.beams) {
      const alpha = clamp(beam.life / beam.maxLife, 0, 1);
      ctx.strokeStyle = beam.color;
      ctx.globalAlpha = alpha * 0.9;
      ctx.lineWidth = beam.width * (0.6 + alpha * 0.7);
      ctx.beginPath();
      ctx.moveTo(beam.x1, beam.y1);
      ctx.lineTo(beam.x2, beam.y2);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.3;
      ctx.lineWidth = beam.width * 3;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCharacter(entity, isPlayer) {
    const bob = Math.sin(entity.walkPhase || 0) * 2;
    const isBoss = !isPlayer && entity.isBoss;
    ctx.save();
    ctx.translate(Math.round(entity.x), Math.round(entity.y));

    // Ground shadow.
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.beginPath();
    ctx.ellipse(0, isBoss ? 14 : 10, isBoss ? 20 : 13, isBoss ? 7 : 5, 0, 0, TAU);
    ctx.fill();

    // Overhead health bar. Drawn before the rotation so it always stays level.
    const playerColor = isPlayer ? (entity.char?.color || '#d6ff4d') : '#d6ff4d';
    const hpPct = clamp(entity.hp / entity.maxHp, 0, 1);
    const barW = isPlayer ? 40 : isBoss ? 64 : 32;
    const barH = isPlayer ? 5 : isBoss ? 6 : 4;
    const barY = isPlayer ? -30 : isBoss ? -44 : -28;
    let barColor;
    if (hpPct > 0.55) barColor = isPlayer ? playerColor : '#e45363';
    else if (hpPct > 0.28) barColor = '#ffad45';
    else barColor = Math.sin(world.time * 14) > 0 ? '#ff5b6e' : '#ff9aa4';

    ctx.fillStyle = 'rgba(2,5,8,.82)';
    ctx.fillRect(-barW / 2 - 2, barY - 2, barW + 4, barH + 4);
    ctx.fillStyle = '#1a2431';
    ctx.fillRect(-barW / 2, barY, barW, barH);
    ctx.fillStyle = barColor;
    ctx.fillRect(-barW / 2, barY, barW * hpPct, barH);
    ctx.strokeStyle = isPlayer
      ? (player.armorKey !== 'none' ? 'rgba(85,217,255,.8)' : 'rgba(214,255,77,.55)')
      : 'rgba(255,91,110,.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-barW / 2 - 0.5, barY - 0.5, barW + 1, barH + 1);
    if (isBoss) {
      ctx.fillStyle = 'rgba(255,255,255,.62)';
      ctx.fillRect(-barW / 2 + barW * 0.65, barY - 1, 1, barH + 2);
      ctx.fillRect(-barW / 2 + barW * 0.30, barY - 1, 1, barH + 2);
    }

    if (isPlayer) {
      // A faint player ring helps readability in corridors.
      ctx.strokeStyle = `${playerColor}55`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 23, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = `${playerColor}20`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, TAU);
      ctx.stroke();
      if (player.shield > 0) {
        ctx.strokeStyle = 'rgba(88,166,255,.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 20 + Math.sin(world.time * 8) * 1.5, 0, TAU);
        ctx.stroke();
      }
      if (player.dashInvuln > 0) {
        ctx.strokeStyle = 'rgba(126,232,210,.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 23, 0, TAU);
        ctx.stroke();
      }
    } else if (isBoss) {
      ctx.strokeStyle = 'rgba(255,62,108,.42)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, TAU);
      ctx.stroke();
      if (entity.phaseFlash > 0) {
        ctx.strokeStyle = `rgba(255,173,69,${clamp(entity.phaseFlash, 0, 1) * 0.75})`;
        ctx.lineWidth = 2 + entity.phaseFlash * 2;
        ctx.beginPath();
        ctx.arc(0, 0, 32 + (1.2 - entity.phaseFlash) * 16, 0, TAU);
        ctx.stroke();
      }
      if (entity.weakPointTimer > 0) {
        const pulse = 0.5 + 0.5 * Math.sin(world.time * 10);
        ctx.strokeStyle = `rgba(255,209,92,${0.55 + pulse * 0.35})`;
        ctx.lineWidth = 2 + pulse;
        ctx.beginPath();
        ctx.arc(0, 0, 29 + pulse * 5, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = '#ffd15c';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('核心 ×1.5', 0, barY - 20);
      }
      ctx.fillStyle = '#ff5b7f';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`BOSS · P${entity.bossPhase || 1}`, 0, barY - 7);
    } else if (entity.state === 'chase') {
      ctx.fillStyle = '#ff9c47';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, barY - 7);
    }

    if (!isPlayer && entity.squadLeader) {
      ctx.fillStyle = '#d6ff4d';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('队长', 0, barY - 17);
    }

    if (!isPlayer && !entity.isBounty && entity.elite) {
      ctx.strokeStyle = entity.carriesKey ? 'rgba(255,209,92,.95)' : 'rgba(255,209,92,.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, (isBoss ? 28 : 15) + Math.sin(world.time * 5) * 1.5, 0, TAU);
      ctx.stroke();
      if (entity.carriesKey) {
        ctx.fillStyle = '#ffd15c';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('KEY', 0, barY - (isBoss ? 20 : 18));
      } else if (entity.eliteLabel) {
        ctx.fillStyle = entity.color || '#ffd15c';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`精英 · ${entity.eliteLabel}`, 0, barY - 17);
      }
    }
    if (!isPlayer && entity.isBounty) {
      const bountyPulse = 0.5 + 0.5 * Math.sin(world.time * 4);
      ctx.strokeStyle = `rgba(255,209,92,${0.6 + bountyPulse * 0.35})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 30 + bountyPulse * 4, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#ffd15c';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('高危目标', 0, barY - 19);
    }
    if (!isPlayer && entity.shotWindup > 0) {
      const charge = 1 - entity.shotWindup / (entity.shotWindupMax || 1);
      ctx.strokeStyle = `rgba(255,91,110,${0.4 + charge * 0.55})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, (isBoss ? 30 : 17) + charge * 7, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#ff5b6e';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, barY - 18);
    }

    // Standing side-view: mirror the body left/right instead of rotating it,
    // so characters read like the reference's chibi sprites.
    if (Math.cos(entity.angle || 0) < 0) ctx.scale(-1, 1);
    // Chunkier sprites read better and match the reference silhouette scale.
    const spriteScale = isPlayer ? 1.5 : isBoss ? 1.45 : 1.4;
    ctx.scale(spriteScale, spriteScale);

    // Dark 1px outline keeps silhouettes readable against dark floors.
    const px = (x, y, w, h, color, outline = '#04070b') => {
      if (outline && !save.settings.performanceMode) {
        ctx.fillStyle = outline;
        ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      }
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };

    if (isPlayer) {
      const charId = player.char?.id || 'pioneer';
      const recoil = player.fireCd > player.weapon.cooldown - 0.05 ? -1 : 0;
      // Backpack.
      px(-12, -8, 7, 16, '#1f2a38');
      // Legs (bob gives them a two-frame step).
      px(-7 + bob * 0.5, -8, 6, 10, '#2a3545');
      px(-7 - bob * 0.5, 1, 6, 10, '#2a3545');
      // Torso with a lighter shoulder plate.
      px(-6, -9, 13, 18, '#41556e');
      ctx.fillStyle = playerColor;
      ctx.fillRect(-4, -7, 3, 12);
      ctx.fillStyle = '#5b7392';
      ctx.fillRect(-6, -9, 13, 2);
      px(-6, 5, 13, 4, '#28384a', null);
      // Character-specific silhouette pieces.
      if (charId === 'pioneer') {
        // Medic cross stitched on the pack.
        ctx.fillStyle = '#e8f4ff';
        ctx.fillRect(-10, -5, 3, 7);
        ctx.fillRect(-12, -2, 7, 3);
      } else if (charId === 'sniper') {
        // Cloak tail plus a scoped long rifle.
        ctx.fillStyle = 'rgba(60,90,95,.9)';
        ctx.fillRect(-11, -3, 5, 13);
        ctx.fillStyle = '#6b5a9a';
        ctx.fillRect(14, -2, 8, 3);
        ctx.fillStyle = '#9ad8ff';
        ctx.fillRect(17, -3, 2, 2);
      } else if (charId === 'assault') {
        // Twin magazines and a red shoulder flash.
        ctx.fillStyle = '#ffad45';
        ctx.fillRect(-5, 6, 3, 4);
        ctx.fillRect(1, 6, 3, 4);
        ctx.fillStyle = '#ff5b6e';
        ctx.fillRect(-6, -8, 4, 3);
      } else if (charId === 'juggernaut') {
        // Heavy pauldrons and a riot plate.
        px(-9, -10, 6, 7, '#3c4b60');
        px(1, -10, 6, 7, '#3c4b60');
        ctx.fillStyle = '#8ea3b8';
        ctx.fillRect(-8, -9, 3, 4);
        ctx.fillRect(2, -9, 3, 4);
      }
      // Head, visor and a specular glint.
      px(4, -7, 9, 9, '#b9c8d9');
      ctx.fillStyle = playerColor;
      ctx.fillRect(9, -5, 3, 3);
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.fillRect(5, -6, 2, 2);
      // Weapon (recoils one pixel back on the firing frame).
      px(8 + recoil, 1, 15, 4, '#111820', null);
      ctx.fillStyle = player.weapon.color;
      ctx.fillRect(20 + recoil, 1, 6, 3);
      ctx.fillStyle = '#303b4b';
      ctx.fillRect(10 + recoil, -1, 7, 3);
      // Muzzle flash with a short light spill.
      if (player.fireCd > player.weapon.cooldown - 0.045 && player.mag >= 0) {
        ctx.fillStyle = '#ffe08a';
        ctx.fillRect(26 + recoil, 1, 6, 4);
        if (!save.settings.performanceMode) {
          const flick = 0.75 + Math.random() * 0.25;
          const flashX = 28 + recoil;
          const flash = ctx.createRadialGradient(flashX, 3, 0, flashX, 3, 40 * flick);
          flash.addColorStop(0, 'rgba(255,224,138,.34)');
          flash.addColorStop(0.45, 'rgba(255,196,90,.12)');
          flash.addColorStop(1, 'rgba(255,196,90,0)');
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = flash;
          ctx.beginPath();
          ctx.arc(flashX, 3, 40 * flick, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      }
    } else {
      const kind = entity.kind;
      if (kind === 'orbiter') {
        ctx.strokeStyle = entity.color;
        ctx.globalAlpha = 0.65;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 2, 14, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(88,166,255,.22)';
        ctx.beginPath();
        ctx.arc(0, 2, 10, 0, TAU);
        ctx.fill();
      } else {
        // Enemy legs.
        px(-7 + bob * 0.5, -8, 6, 10, '#2b2229');
        px(-7 - bob * 0.5, 1, 6, 10, '#2b2229');
      }
      // Enemy torso. Heavies are broader, scouts are leaner.
      const torsoW = kind === 'heavy' ? 18 : kind === 'scout' ? 10 : 13;
      px(-torsoW / 2, -9, torsoW, 18, entity.hitFlash > 0 ? '#fff2f3' : entity.color);
      ctx.fillStyle = entity.hitFlash > 0 ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.14)';
      ctx.fillRect(-torsoW / 2, -9, torsoW, 2);
      ctx.fillStyle = '#3a2029';
      ctx.fillRect(-torsoW / 2, 4, torsoW, 5);
      if (kind === 'heavy') {
        ctx.fillStyle = '#313844';
        ctx.fillRect(-13, -5, 4, 14);
        ctx.fillStyle = '#8e9bad';
        ctx.fillRect(-12, -3, 2, 9);
      } else if (kind === 'bomber') {
        ctx.fillStyle = '#4a2a1d';
        ctx.fillRect(-12, -4, 5, 10);
        ctx.fillStyle = '#ffad45';
        ctx.fillRect(-11, -2, 3, 5);
      }
      // Per-archetype silhouette details.
      if (kind === 'scout') {
        // Head wrap and a light chest strap.
        ctx.fillStyle = '#a85a3c';
        ctx.fillRect(-5, -10, 9, 2);
        ctx.fillStyle = '#4a3a30';
        ctx.fillRect(-1, -4, 6, 2);
      } else if (kind === 'heavy') {
        // Face mask.
        ctx.fillStyle = '#1a212b';
        ctx.fillRect(4, -4, 8, 4);
        ctx.fillStyle = '#c2503f';
        ctx.fillRect(5, -3, 2, 2);
      } else if (kind === 'bomber') {
        // Blinking fuse light on the charge pack.
        const lit = ((world.time * 8) | 0) % 2 === 0;
        ctx.fillStyle = lit ? '#ffd15c' : '#7a3a1a';
        ctx.fillRect(-12, -6, 3, 3);
      }
      if (isBoss) {
        ctx.fillStyle = '#ffd15c';
        ctx.fillRect(-9, -14, 18, 4);
        ctx.fillRect(-12, -11, 4, 8);
        ctx.fillRect(8, -11, 4, 8);
      }
      // Head.
      px(4, -7, 9, 9, entity.hitFlash > 0 ? '#ffffff' : '#70313d');
      ctx.fillStyle = '#ffb58b';
      ctx.fillRect(9, -5, 3, 3);
      // Gun. Snipers carry a long scoped rifle.
      const gunLen = kind === 'sniper' ? 22 : 14;
      ctx.fillStyle = '#10151c';
      ctx.fillRect(8, 1, gunLen, 4);
      if (kind === 'sniper') {
        ctx.fillStyle = '#6b5a9a';
        ctx.fillRect(12, -2, 7, 3);
      }
      if (entity.muzzleFlash > 0) {
        ctx.fillStyle = isBoss ? '#ff5b8a' : '#ffce7a';
        ctx.fillRect(8 + gunLen, 0, 6, 5);
        if (!save.settings.performanceMode) {
          const gx = 10 + gunLen;
          const enemyFlash = ctx.createRadialGradient(gx, 2, 0, gx, 2, isBoss ? 30 : 20);
          enemyFlash.addColorStop(0, isBoss ? 'rgba(255,91,138,.3)' : 'rgba(255,206,122,.26)');
          enemyFlash.addColorStop(1, 'rgba(255,140,90,0)');
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = enemyFlash;
          ctx.beginPath();
          ctx.arc(gx, 2, isBoss ? 30 : 20, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }

  function drawParticle(p) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
    ctx.globalAlpha = 1;
  }

  function drawFloatText(t) {
    ctx.globalAlpha = clamp(t.life / t.maxLife, 0, 1);
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, Math.round(t.x), Math.round(t.y));
    ctx.globalAlpha = 1;
  }

  function drawSkillTarget() {
    if (!player || player.charId !== 'sniper' || player.activeCd > 0 || !world) return;
    const target = player.sniperLock?.target || findSniperTarget(1000);
    if (!target || target.dead || target === player.lockTarget) return;
    const pulse = 0.5 + 0.5 * Math.sin(world.time * 7);
    const radius = (target.isBoss ? 34 : 21) + pulse * 2;
    ctx.save();
    ctx.translate(Math.round(target.x), Math.round(target.y));
    ctx.strokeStyle = `rgba(88,199,255,${0.45 + pulse * 0.35})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#8bd3ff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(touch.ui ? '猎杀目标' : 'Q · 猎杀', 0, -radius - 6);
    ctx.restore();
  }

  function drawLockOn() {
    const target = player && player.lockTarget;
    if (!target || target.dead) return;
    const pulse = 0.5 + 0.5 * Math.sin(world.time * 9);
    const radius = (target.isBoss ? 30 : 18) + pulse * 3;
    ctx.save();
    ctx.translate(Math.round(target.x), Math.round(target.y));
    ctx.strokeStyle = `rgba(214,255,77,${0.58 + pulse * 0.35})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.stroke();
    const corner = 7;
    const r = radius + 5;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * r, sy * (r - corner));
        ctx.lineTo(sx * r, sy * r);
        ctx.lineTo(sx * (r - corner), sy * r);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#d6ff4d';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LOCK', 0, -r - 5);
    if (player.sniperLock && player.sniperLock.target === target) {
      const pct = clamp(1 - player.sniperLock.timer / player.sniperLock.total, 0, 1);
      ctx.strokeStyle = '#58c7ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 4, -Math.PI / 2, -Math.PI / 2 + TAU * pct);
      ctx.stroke();
      ctx.fillStyle = '#8bd3ff';
      ctx.fillText(`${Math.max(0, player.sniperLock.timer).toFixed(1)}s`, 0, r + 14);
    }
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function drawCrosshair() {
    if (!mouse.inside || mode !== 'raid' || !raid || raid.paused) return;
    const x = Math.round(mouse.x);
    const y = Math.round(mouse.y);
    ctx.strokeStyle = 'rgba(214,255,77,.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 9, y); ctx.lineTo(x - 3, y);
    ctx.moveTo(x + 3, y); ctx.lineTo(x + 9, y);
    ctx.moveTo(x, y - 9); ctx.lineTo(x, y - 3);
    ctx.moveTo(x, y + 3); ctx.lineTo(x, y + 9);
    ctx.stroke();
    ctx.fillStyle = '#d6ff4d';
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }

  function drawExplorationTrail(g, sx, sy, width) {
    const trail = world.trail || [];
    if (trail.length < 2) return;
    g.save();
    g.strokeStyle = 'rgba(85,217,255,.58)';
    g.lineWidth = width;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(trail[0].x * sx, trail[0].y * sy);
    for (let i = 1; i < trail.length; i++) g.lineTo(trail[i].x * sx, trail[i].y * sy);
    g.stroke();
    g.fillStyle = '#55d9ff';
    g.fillRect(trail[0].x * sx - 2, trail[0].y * sy - 2, 4, 4);
    g.restore();
  }

  function drawFullMap() {
    if (!world || !el.fullMapCanvas) return;
    const c = el.fullMapCanvas;
    const g = c.getContext('2d');
    const W = c.width;
    const H = c.height;
    const sx = W / MAP_PW;
    const sy = H / MAP_PH;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#060a0f';
    g.fillRect(0, 0, W, H);
    g.drawImage(world.mini, 0, 0, W, H);
    g.drawImage(world.fogMini, 0, 0, W, H);
    drawExplorationTrail(g, sx, sy, 2.5);

    for (const container of world.containers) {
      if (container.searched || !isExploredPoint(container.x, container.y)) continue;
      g.fillStyle = container.vault ? '#ffd15c' : container.rarity === 'rare' ? '#55d9ff' : '#ff9c47';
      const size = container.vault ? 8 : container.rarity === 'rare' ? 7 : 6;
      g.fillRect(container.x * sx - size / 2, container.y * sy - size / 2, size, size);
    }
    for (const pickup of world.pickups) {
      if (!isExploredPoint(pickup.x, pickup.y)) continue;
      g.fillStyle = pickup.type === 'key' || pickup.bossDrop ? '#ffd15c' : pickup.type === 'item' ? choiceIconColor(defOf(pickup.item)) : '#9fb6d1';
      g.fillRect(pickup.x * sx - 2, pickup.y * sy - 2, 4, 4);
    }
    for (const enemy of world.enemies) {
      if (enemy.dead || enemy.isBoss || !isPointVisible(enemy.x, enemy.y)) continue;
      g.fillStyle = '#ff5b6e';
      g.beginPath();
      g.arc(enemy.x * sx, enemy.y * sy, 4, 0, TAU);
      g.fill();
    }

    if (world.boss && !world.boss.dead && isPointVisible(world.boss.x, world.boss.y)) {
      const bx = world.boss.x * sx;
      const by = world.boss.y * sy;
      g.fillStyle = '#ff3e6c';
      g.beginPath();
      g.moveTo(bx, by - 9);
      g.lineTo(bx + 8, by);
      g.lineTo(bx, by + 9);
      g.lineTo(bx - 8, by);
      g.closePath();
      g.fill();
      g.font = 'bold 12px monospace';
      g.textBaseline = 'middle';
      g.fillStyle = '#ff9ab2';
      g.fillText('首领', bx + 12, by);
    }

    if (world.objective && world.objective.state !== 'complete' && isExploredPoint(world.objective.x, world.objective.y)) {
      const ox = world.objective.x * sx;
      const oy = world.objective.y * sy;
      g.fillStyle = world.objective.color;
      g.beginPath();
      g.moveTo(ox, oy - 7);
      g.lineTo(ox + 7, oy);
      g.lineTo(ox, oy + 7);
      g.lineTo(ox - 7, oy);
      g.closePath();
      g.fill();
      g.font = 'bold 10px monospace';
      g.textBaseline = 'middle';
      g.fillText(world.objective.label, ox + 11, oy);
    }

    const exX = world.extraction.x * sx;
    const exY = world.extraction.y * sy;
    g.fillStyle = 'rgba(214,255,77,.18)';
    g.beginPath();
    g.arc(exX, exY, 22, 0, TAU);
    g.fill();
    g.strokeStyle = '#d6ff4d';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(exX, exY, 15, 0, TAU);
    g.stroke();
    g.fillStyle = '#d6ff4d';
    g.fillRect(exX - 4, exY - 4, 8, 8);
    g.strokeStyle = 'rgba(214,255,77,.75)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(exX - 25, exY); g.lineTo(exX - 17, exY);
    g.moveTo(exX + 17, exY); g.lineTo(exX + 25, exY);
    g.moveTo(exX, exY - 25); g.lineTo(exX, exY - 17);
    g.moveTo(exX, exY + 17); g.lineTo(exX, exY + 25);
    g.stroke();

    g.font = 'bold 15px monospace';
    g.textBaseline = 'middle';
    const label = '撤离 / 下层';
    const labelW = g.measureText(label).width;
    const labelX = exX + 28 + labelW + 14 > W ? exX - labelW - 40 : exX + 28;
    g.fillStyle = 'rgba(5,9,14,.9)';
    g.fillRect(labelX - 6, exY - 13, labelW + 12, 26);
    g.fillStyle = '#d6ff4d';
    g.fillText(label, labelX, exY);

    if (world.objective && world.objective.state !== 'complete' && isExploredPoint(world.objective.x, world.objective.y)) {
      const ox = world.objective.x * sx;
      const oy = world.objective.y * sy;
      miniCtx.fillStyle = world.objective.color;
      miniCtx.beginPath();
      miniCtx.arc(ox, oy, 3, 0, TAU);
      miniCtx.fill();
    }

    if (world.altExtraction && world.altExtraction.timeLeft > 0 &&
      (isExploredPoint(world.altExtraction.x, world.altExtraction.y) || isPointVisible(world.altExtraction.x, world.altExtraction.y))) {
      const ax = world.altExtraction.x * sx;
      const ay = world.altExtraction.y * sy;
      g.strokeStyle = '#55d9ff';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(ax, ay, 13, 0, TAU);
      g.stroke();
      g.fillStyle = '#55d9ff';
      g.fillRect(ax - 3, ay - 3, 6, 6);
      g.font = 'bold 11px monospace';
      g.textBaseline = 'middle';
      g.fillStyle = '#8be8ff';
      g.fillText(`临时撤离 ${Math.ceil(world.altExtraction.timeLeft)}s`, ax + 18, ay);
    }

    g.save();
    g.translate(player.x * sx, player.y * sy);
    g.rotate(player.angle);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(9, 0);
    g.lineTo(-7, -5);
    g.lineTo(-7, 5);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawMinimap() {
    if (!world) return;
    const W = el.minimap.width;
    const H = el.minimap.height;
    miniCtx.fillStyle = '#060a0f';
    miniCtx.fillRect(0, 0, W, H);
    miniCtx.imageSmoothingEnabled = false;
    miniCtx.drawImage(world.mini, 0, 0, W, H);
    miniCtx.drawImage(world.fogMini, 0, 0, W, H);
    const sx = W / MAP_PW;
    const sy = H / MAP_PH;
    drawExplorationTrail(miniCtx, sx, sy, 1.2);

    const ex = world.extraction;
    const exX = ex.x * sx;
    const exY = ex.y * sy;
    const exitPulse = (Math.sin(world.time * 4) + 1) * 0.5;
    miniCtx.strokeStyle = `rgba(214,255,77,${0.45 + exitPulse * 0.5})`;
    miniCtx.lineWidth = 1;
    miniCtx.beginPath();
    miniCtx.arc(exX, exY, 5 + exitPulse * 2.5, 0, TAU);
    miniCtx.stroke();
    miniCtx.fillStyle = '#d6ff4d';
    miniCtx.fillRect(exX - 3, exY - 3, 6, 6);
    miniCtx.font = 'bold 8px monospace';
    miniCtx.textAlign = 'center';
    miniCtx.fillText('下层', exX, Math.max(8, exY - 8));
    miniCtx.textAlign = 'left';

    for (const c of world.containers) {
      if (c.searched || !isExploredPoint(c.x, c.y)) continue;
      miniCtx.fillStyle = c.vault ? '#ffd15c' : c.rarity === 'rare' ? '#55d9ff' : '#ff9c47';
      const size = c.vault ? 5 : c.rarity === 'rare' ? 4 : 3;
      miniCtx.fillRect(c.x * sx - 1, c.y * sy - 1, size, size);
    }
    for (const p of world.pickups) {
      if (!isExploredPoint(p.x, p.y)) continue;
      miniCtx.fillStyle = p.type === 'key' || p.bossDrop ? '#ffd15c' : p.type === 'item' ? choiceIconColor(defOf(p.item)) : '#9fb6d1';
      miniCtx.fillRect(p.x * sx - 1, p.y * sy - 1, 2, 2);
    }
    for (const e of world.enemies) {
      if (e.dead || e.isBoss || !isPointVisible(e.x, e.y)) continue;
      miniCtx.fillStyle = '#ff5b6e';
      miniCtx.fillRect(e.x * sx - 2, e.y * sy - 2, 4, 4);
    }

    if (world.altExtraction && world.altExtraction.timeLeft > 0 &&
      (isExploredPoint(world.altExtraction.x, world.altExtraction.y) || isPointVisible(world.altExtraction.x, world.altExtraction.y))) {
      const ax = world.altExtraction.x * sx;
      const ay = world.altExtraction.y * sy;
      miniCtx.strokeStyle = '#55d9ff';
      miniCtx.lineWidth = 1;
      miniCtx.beginPath();
      miniCtx.arc(ax, ay, 4, 0, TAU);
      miniCtx.stroke();
      miniCtx.fillStyle = '#55d9ff';
      miniCtx.fillRect(ax - 2, ay - 2, 4, 4);
    }

    if (world.boss && !world.boss.dead && isPointVisible(world.boss.x, world.boss.y)) {
      const bx = world.boss.x * sx;
      const by = world.boss.y * sy;
      miniCtx.fillStyle = '#ff3e6c';
      miniCtx.beginPath();
      miniCtx.moveTo(bx, by - 5);
      miniCtx.lineTo(bx + 4, by);
      miniCtx.lineTo(bx, by + 5);
      miniCtx.lineTo(bx - 4, by);
      miniCtx.closePath();
      miniCtx.fill();
    }

    miniCtx.save();
    miniCtx.translate(player.x * sx, player.y * sy);
    miniCtx.rotate(player.angle);
    miniCtx.fillStyle = '#ffffff';
    miniCtx.beginPath();
    miniCtx.moveTo(5, 0);
    miniCtx.lineTo(-4, -3.5);
    miniCtx.lineTo(-4, 3.5);
    miniCtx.closePath();
    miniCtx.fill();
    miniCtx.restore();

    miniCtx.strokeStyle = 'rgba(214,255,77,.16)';
    miniCtx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  // ---------------------------------------------------------------------------
  // Touch controls
  // ---------------------------------------------------------------------------
  function setupVirtualStick(pad, knob, onMove, onEnd, onStart) {
    let pointerId = null;
    let padRect = null;
    const measure = () => {
      const rect = pad.getBoundingClientRect();
      padRect = {
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        maxRadius: rect.width * 0.31
      };
    };
    window.addEventListener('resize', () => { padRect = null; });

    const move = (event) => {
      if (!padRect) measure();
      const dx = event.clientX - padRect.cx;
      const dy = event.clientY - padRect.cy;
      const distance = Math.hypot(dx, dy);
      const maxRadius = padRect.maxRadius;
      const clamped = Math.min(distance, maxRadius);
      const nx = distance > 0.001 ? dx / distance : 0;
      const ny = distance > 0.001 ? dy / distance : 0;
      const mag = maxRadius > 0 ? Math.min(1, distance / maxRadius) : 0;
      knob.style.transform = `translate(calc(-50% + ${nx * clamped}px), calc(-50% + ${ny * clamped}px))`;
      onMove(nx, ny, mag);
    };

    const end = (event) => {
      if (pointerId !== null && event && event.pointerId !== pointerId) return;
      pointerId = null;
      pad.classList.remove('active');
      knob.style.transform = 'translate(-50%, -50%)';
      onEnd();
    };

    pad.addEventListener('pointerdown', (event) => {
      if (pointerId !== null) return;
      pointerId = event.pointerId;
      enableTouchUI();
      Sound.init();
      pad.classList.add('active');
      padRect = null;
      measure();
      try { pad.setPointerCapture(pointerId); } catch (err) { /* ignore */ }
      if (onStart) onStart();
      move(event);
      event.preventDefault();
    });
    pad.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      move(event);
      event.preventDefault();
    });
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    pad.addEventListener('lostpointercapture', end);
  }

  function setupFloatingMoveStick() {
    let pointerId = null;
    let activeTarget = null;
    let padCenterX = 0;
    let padCenterY = 0;
    let padRadius = 28;
    const fixedMode = () => save.settings.moveStickMode === 'fixed';

    const measurePad = () => {
      const rect = el.movePad.getBoundingClientRect();
      padCenterX = rect.left + rect.width / 2;
      padCenterY = rect.top + rect.height / 2;
      padRadius = Math.max(28, rect.width * 0.31);
    };
    window.addEventListener('resize', () => {
      if (pointerId !== null) measurePad();
    });

    const move = (event) => {
      const dx = event.clientX - padCenterX;
      const dy = event.clientY - padCenterY;
      const distance = Math.hypot(dx, dy);
      const clamped = Math.min(distance, padRadius);
      let nx = distance > 0.001 ? dx / distance : 0;
      let ny = distance > 0.001 ? dy / distance : 0;
      const rawMag = padRadius > 0 ? Math.min(1, distance / padRadius) : 0;
      const deadZone = 0.06;
      const mag = rawMag > deadZone ? clamp((rawMag - deadZone) / (1 - deadZone), 0, 1) : 0;
      // Cardinal assist: a mostly horizontal/vertical drag should not drift
      // into a diagonal because of small thumb jitter.
      if (Math.abs(nx) >= 0.9) {
        nx = Math.sign(nx);
        ny = 0;
      } else if (Math.abs(ny) >= 0.9) {
        ny = Math.sign(ny);
        nx = 0;
      }
      el.moveKnob.style.transform = `translate(calc(-50% + ${nx * clamped}px), calc(-50% + ${ny * clamped}px))`;
      touch.moveX = nx;
      touch.moveY = ny;
      touch.moveTargetMag = mag;
    };

    const end = (event) => {
      if (pointerId !== null && event && event.pointerId !== pointerId) return;
      const id = pointerId;
      const target = activeTarget;
      pointerId = null;
      activeTarget = null;
      if (target && id !== null) {
        try { target.releasePointerCapture(id); } catch (err) { /* ignore */ }
      }
      el.movePad.classList.remove('active');
      el.moveKnob.style.transform = 'translate(-50%, -50%)';
      touch.moveX = 0;
      touch.moveY = 0;
      touch.moveMag = 0;
      touch.moveTargetMag = 0;
    };

    const begin = (event, target) => {
      if (pointerId !== null) return;
      if (mode !== 'raid' || !raid || raid.paused || raid.ended) return;
      pointerId = event.pointerId;
      activeTarget = target;
      enableTouchUI();
      Sound.init();

      if (!fixedMode()) {
        const zone = el.moveZone.getBoundingClientRect();
        const baseSize = Math.max(92, Math.min(122, window.innerWidth * 0.13));
        const padSize = baseSize * ((save.settings.moveStickSize || 100) / 100);
        const half = padSize / 2 + 6;
        const cx = clamp(event.clientX - zone.left, half, zone.width - half);
        const cy = clamp(event.clientY - zone.top, half, zone.height - half);
        el.movePad.style.left = `${cx}px`;
        el.movePad.style.top = `${cy}px`;
      }

      el.movePad.classList.add('active');
      el.moveKnob.style.transform = 'translate(-50%, -50%)';
      touch.moveX = 0;
      touch.moveY = 0;
      touch.moveMag = 0;
      touch.moveTargetMag = 0;
      measurePad();
      try { target.setPointerCapture(pointerId); } catch (err) { /* ignore */ }
      move(event);
      event.preventDefault();
    };

    const bindTarget = (target, isPad) => {
      target.addEventListener('pointerdown', (event) => {
        if (fixedMode() !== isPad) return;
        begin(event, target);
      });
      target.addEventListener('lostpointercapture', end);
    };

    // Track the active pointer on window, not only on the original target.
    // This keeps movement alive if a mobile browser loses capture or the thumb
    // slides outside the left move zone midway through a horizontal drag.
    window.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      move(event);
      event.preventDefault();
    }, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', () => end());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) end();
    });

    bindTarget(el.moveZone, false);
    bindTarget(el.movePad, true);
  }

  function setupTouchControls() {
    setupFloatingMoveStick();

    setupVirtualStick(el.aimPad, el.aimKnob, (x, y, mag) => {
      touch.aiming = true;
      touch.aimMag = mag;
      if (!touch.hasAim) {
        touch.aimAngle = player ? player.angle : 0;
        touch.aimTargetAngle = touch.aimAngle;
        touch.hasAim = true;
      }
      if (mag > 0.16) {
        touch.aimTargetAngle = Math.atan2(y, x);
      }
    }, () => {
      touch.aiming = false;
      touch.aimMag = 0;
      touch.aimPressAt = 0;
      touch.firing = false;
    }, () => {
      touch.aimPressAt = performance.now();
    });

    el.touchDash.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      Sound.init();
      if (player && raid && !raid.paused && !raid.ended) player.tryDash();
    });
    el.touchSkill.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      Sound.init();
      if (player && raid && !raid.paused && !raid.ended) player.useCharacterSkill();
    });
    el.touchReload.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      Sound.init();
      if (player && raid && !raid.paused && !raid.ended) player.startReload();
    });
    el.touchMed.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      Sound.init();
      if (player && raid && !raid.paused && !raid.ended) player.useMedkit();
    });
    el.touchInventory.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (mode !== 'raid' || !raid || raid.ended) return;
      if (raid.inventoryOpen) closeInventory();
      else if (!raid.paused) openInventory();
    });
    el.touchPause.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      togglePause();
    });
  }

  setupTouchControls();

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  function updateMousePosition(e) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    mouse.x = (e.clientX - rect.left) * (VIEW_W / rect.width);
    mouse.y = (e.clientY - rect.top) * (VIEW_H / rect.height);
    mouse.inside = mouse.x >= 0 && mouse.x <= VIEW_W && mouse.y >= 0 && mouse.y <= VIEW_H;
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'm' && mode === 'raid' && raid && !raid.ended) {
      e.preventDefault();
      toggleMap();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (mode === 'raid' && raid && !raid.ended) {
        if (raid.inventoryOpen) closeInventory();
        else if (!raid.paused) openInventory();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!el.settingsOverlay.classList.contains('hidden')) closeSettings();
      else if (mode === 'raid' && raid && raid.mapOpen) closeMap();
      else if (mode === 'raid') togglePause();
      else if (mode === 'base' && !el.equipOverlay.classList.contains('hidden')) closeEquipModal();
      return;
    }
    if (mode === 'raid') {
      if (['w', 'a', 's', 'd', 'e', 'r', 'f', 'q', ' ', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        e.preventDefault();
      }
      keys[k] = true;
      if (!e.repeat && player && raid && !raid.paused && !raid.ended) {
        if (k === 'f') player.useMedkit();
        if (k === 'r') player.startReload();
        if (k === ' ') player.tryDash();
        if (k === 'q') player.useCharacterSkill();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  canvas.addEventListener('mousemove', updateMousePosition);
  canvas.addEventListener('mouseenter', updateMousePosition);
  canvas.addEventListener('mouseleave', () => { mouse.inside = false; });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (document.body.classList.contains('touch-device')) return;
    updateMousePosition(e);
    Sound.init();
    if (mode === 'raid' && raid && !raid.paused && !raid.ended) {
      mouse.down = true;
      mouse.semiQueued = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('blur', () => {
    mouse.down = false;
    for (const k of Object.keys(keys)) keys[k] = false;
    if (mode === 'raid' && raid && !raid.ended && !raid.paused && !raid.perkChoiceOpen && !raid.extractionChoiceOpen) togglePause();
  });

  el.startRaidBtn.addEventListener('click', () => {
    renderStageSelect();
    el.stageOverlay.classList.remove('hidden');
  });
  if (el.startNormalBtn) {
    el.startNormalBtn.addEventListener('click', () => {
      el.stageOverlay.classList.add('hidden');
      startRaid();
    });
  }
  if (el.closeStageBtn) el.closeStageBtn.addEventListener('click', () => el.stageOverlay.classList.add('hidden'));
  if (el.stageOverlay) {
    el.stageOverlay.addEventListener('click', (event) => {
      if (event.target === el.stageOverlay) el.stageOverlay.classList.add('hidden');
    });
  }
  el.riskPicker.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-risk]');
    if (!btn) return;
    save.settings.raidRisk = RISK_DEFS[btn.dataset.risk] ? btn.dataset.risk : 'normal';
    persist();
    syncRiskPicker();
    toast(`行动风险：${riskDef().label} · ${riskDef().hint}`);
  });
  el.stashRarityFilter.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-rarity]');
    if (!btn) return;
    stashRarityFilter = btn.dataset.rarity;
    renderStash();
  });
  el.sellLowBtn.addEventListener('click', sellLowValue);
  el.fullscreenBtn.addEventListener('click', enterLandscapeFullscreen);
  el.pauseFullscreenBtn.addEventListener('click', enterLandscapeFullscreen);
  el.settingsFullscreenBtn.addEventListener('click', enterLandscapeFullscreen);
  el.settingsBtn.addEventListener('click', openSettings);
  el.pauseSettingsBtn.addEventListener('click', openSettings);
  el.closeSettingsBtn.addEventListener('click', closeSettings);
  el.resetSettingsBtn.addEventListener('click', resetSettings);
  el.settingsOverlay.addEventListener('click', (event) => {
    if (event.target === el.settingsOverlay) closeSettings();
  });
  el.settingSound.addEventListener('change', () => {
    save.settings.sound = el.settingSound.checked;
    persist();
    if (save.settings.sound) {
      Sound.init();
      if (Sound.master) Sound.master.gain.value = 0.16;
      playSound('pickup');
    } else if (Sound.master) {
      Sound.master.gain.value = 0;
    }
  });
  el.settingAutoLock.addEventListener('change', () => {
    save.settings.autoLock = el.settingAutoLock.checked;
    persist();
    toast(save.settings.autoLock ? '自动索敌已开启。' : '自动索敌已关闭。');
    if (player && !save.settings.autoLock) player.lockTarget = null;
  });
  el.settingPerformanceMode.addEventListener('change', () => {
    save.settings.performanceMode = el.settingPerformanceMode.checked;
    persist();
  });
  if (el.settingKillSlowmo) {
    el.settingKillSlowmo.addEventListener('change', () => {
      save.settings.killSlowmo = el.settingKillSlowmo.checked;
      persist();
    });
  }
  el.exportSaveBtn.addEventListener('click', exportSaveCode);
  el.importSaveBtn.addEventListener('click', importSaveCode);
  el.settingScreenShake.addEventListener('change', () => {
    save.settings.screenShake = el.settingScreenShake.checked;
    persist();
  });
  el.settingFloatText.addEventListener('change', () => {
    save.settings.floatText = el.settingFloatText.checked;
    persist();
  });
  el.settingDamageFlash.addEventListener('change', () => {
    save.settings.damageFlash = el.settingDamageFlash.checked;
    persist();
  });
  el.settingsTabGeneral.addEventListener('click', () => switchSettingsTab('general'));
  el.settingsTabTouch.addEventListener('click', () => switchSettingsTab('touch'));
  el.moveStickModeControl.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-value]');
    if (!btn) return;
    save.settings.moveStickMode = btn.dataset.value === 'fixed' ? 'fixed' : 'floating';
    persist();
    syncSettingsUI();
  });
  el.settingMoveStickSize.addEventListener('input', () => {
    save.settings.moveStickSize = clamp(Number(el.settingMoveStickSize.value) || 100, 70, 150);
    persist();
    syncSettingsUI();
  });
  el.settingMoveZoneWidth.addEventListener('input', () => {
    save.settings.moveZoneWidth = clamp(Number(el.settingMoveZoneWidth.value) || 50, 30, 70);
    persist();
    syncSettingsUI();
  });
  el.settingMoveSensitivity.addEventListener('input', () => {
    save.settings.moveSensitivity = clamp(Number(el.settingMoveSensitivity.value) || 1, 0.6, 1.6);
    persist();
    syncSettingsUI();
  });
  el.settingAimPadSize.addEventListener('input', () => {
    save.settings.aimPadSize = clamp(Number(el.settingAimPadSize.value) || 100, 70, 120);
    persist();
    syncSettingsUI();
  });
  el.settingAimSensitivity.addEventListener('input', () => {
    save.settings.aimSensitivity = clamp(Number(el.settingAimSensitivity.value) || 1, 0.6, 1.6);
    persist();
    syncSettingsUI();
  });
  syncSettingsUI();
  switchSettingsTab(activeSettingsTab);
  updateFullscreenLabels();
  el.hudInventoryBtn.addEventListener('click', () => {
    if (mode !== 'raid' || !raid || raid.ended) return;
    if (raid.inventoryOpen) closeInventory();
    else if (!raid.paused) openInventory();
  });
  el.hudMapBtn.addEventListener('click', toggleMap);
  el.closeMapBtn.addEventListener('click', closeMap);

  el.closeInventoryBtn.addEventListener('click', closeInventory);
  el.discardInventoryBtn.addEventListener('click', () => {
    const item = player?.backpack.find((entry) => entry.id === selectedInventoryItemId);
    if (item) discardInventoryItem(item.id);
  });
  el.resumeBtn.addEventListener('click', togglePause);
  el.abandonBtn.addEventListener('click', () => {
    if (confirm('放弃行动会丢失本次携带的物资，确定返回基地吗？')) {
      endRaid(false, '你放弃了行动，携带的物资全部丢失。');
    }
  });
  el.debriefCloseBtn.addEventListener('click', returnToBase);
  el.extractDeeperBtn.addEventListener('click', continueToNextFloor);
  el.extractReturnBtn.addEventListener('click', returnFromExtraction);

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------
  function frame(now) {
    const rawDt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    // Kill slow-motion: shrink simulation dt and ease the camera zoom back.
    let dt = rawDt;
    if (slowmo.timer > 0) {
      slowmo.timer = Math.max(0, slowmo.timer - rawDt);
      const t = slowmo.timer / slowmo.duration;
      dt = rawDt * (slowmo.scale + (1 - slowmo.scale) * (1 - t));
      slowmo.zoom = t;
    } else {
      slowmo.zoom = 0;
    }

    if (mode === 'raid' || mode === 'debrief') {
      if (mode === 'raid') updateRaid(dt);
      if (world && player) drawRaid();
    }
    requestAnimationFrame(frame);
  }

  // Small debug bridge used by the local smoke test. It does not affect play.
  window.__PX = {
    startRaid,
    startBossStage(bossId = 'titan', difficulty = 1) {
      startRaid({ bossId, difficulty });
      return this.snapshot();
    },
    endRaid,
    snapshot() {
      return {
        mode,
        save: JSON.parse(JSON.stringify(save)),
        transcend: { level: getTranscendLevel(), progress: getTranscendProgress(), cost: transcendCostForLevel(), bonus: transcendStats() },
        settings: JSON.parse(JSON.stringify(save.settings)),
        lockTarget: player && player.lockTarget ? { x: player.lockTarget.x, y: player.lockTarget.y, kind: player.lockTarget.kind, dead: player.lockTarget.dead } : null,
        player: player ? {
          x: player.x, y: player.y, hp: player.hp, maxHp: player.maxHp, speed: player.speed,
          mag: player.mag, reserve: player.reserve, medkits: player.medkits,
          backpack: JSON.parse(JSON.stringify(player.backpack)),
          charId: player.charId, charName: player.char.name, charSkill: player.char.skill.name, charPassive: player.char.passive.name,
          activeCd: player.activeCd, activeCdMax: player.activeCdMax, dashCd: player.dashCd, dashInvuln: player.dashInvuln,
          shield: player.shield, shieldTimer: player.shieldTimer, overdriveTimer: player.overdriveTimer,
          gearBonus: JSON.parse(JSON.stringify(player.gearBonus || {})), critChance: player.critChance || 0,
          lifesteal: player.lifesteal || 0, antiBoss: player.antiBoss || 0, dashCdMax: player.dashCdMax || 4,
          damageMultiplier: player.damageMultiplier, bulletPierce: !!player.bulletPierce, capacity: player.capacity,
          sniperLock: player.sniperLock && player.sniperLock.target && !player.sniperLock.target.dead
            ? { timer: player.sniperLock.timer, target: { x: player.sniperLock.target.x, y: player.sniperLock.target.y, kind: player.sniperLock.target.kind, name: player.sniperLock.target.name } }
            : null,
          weapon: player.weaponKey, armor: player.armorKey, pack: player.packKey, capacity: player.capacity,
          weaponPlus: player.weaponPlus, armorPlus: player.armorPlus, packPlus: player.packPlus,
          damageMultiplier: player.damageMultiplier, weaponDamage: player.weapon.damage * player.damageMultiplier,
          armorReduction: player.armor.reduction, packBonus: player.pack ? player.pack.bonus : 0,
          transcendLevel: player.transcendLevel, transcendStats: player.transcendStats
        } : null,
        raid: raid ? { ...raid, perkChoices: pendingPerkChoices.slice() } : null,
        touch: { ui: touch.ui, moveX: touch.moveX, moveY: touch.moveY, moveMag: touch.moveMag, aiming: touch.aiming, firing: touch.firing, angle: touch.aimAngle, aimPressAt: touch.aimPressAt },
        world: world ? {
          spawn: world.spawn,
          extraction: { x: world.extraction.x, y: world.extraction.y, r: world.extraction.r },
          altExtraction: world.altExtraction ? { x: world.altExtraction.x, y: world.altExtraction.y, r: world.altExtraction.r, timeLeft: world.altExtraction.timeLeft } : null,
          containers: world.containers.map((c) => ({ x: c.x, y: c.y, searched: c.searched, rarity: c.rarity, progress: c.progress || 0, locked: !!c.locked, vault: !!c.vault })),
          enemies: world.enemies.map((e) => ({ x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, state: e.state, dead: e.dead, kind: e.kind, name: e.name, attackType: e.attackType, chargePhase: e.chargePhase, castType: e.castType, defense: e.defense, carriesKey: !!e.carriesKey, elite: !!e.elite, isBounty: !!e.isBounty, eliteAffix: e.eliteAffix, eliteLabel: e.eliteLabel, squadLeader: !!e.squadLeader, squadMember: !!e.squadMember })),
          boss: world.boss ? { x: world.boss.x, y: world.boss.y, hp: world.boss.hp, maxHp: world.boss.maxHp, dead: world.boss.dead, state: world.boss.state, name: world.boss.name, variant: world.boss.bossVariant?.id || null, defense: world.boss.defense, bossPhase: world.boss.bossPhase, weakPointTimer: world.boss.weakPointTimer, phaseFlash: world.boss.phaseFlash, castType: world.boss.castType, castTimer: world.boss.castTimer, castLabel: world.boss.castLabel, barrageWaves: world.boss.barrageWaves } : null,
          stage: world.stage ? { id: world.stage.id, name: world.stage.name, tag: world.stage.tag } : null,
          hazards: world.hazards.map((h) => ({ x: h.x, y: h.y, radius: h.radius, timer: h.timer, damage: h.damage, label: h.label, exploded: h.exploded })),
          beams: world.beams.map((b) => ({ x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, life: b.life, color: b.color })),
          bulletCount: world.bullets.length,
          bulletTypes: world.bullets.reduce((acc, b) => { const key = b.kind || b.owner; acc[key] = (acc[key] || 0) + 1; return acc; }, {}),
          bossPresent: !!world.boss,
          keyChest: world.keyChest ? { x: world.keyChest.x, y: world.keyChest.y, locked: !!world.keyChest.locked, searched: !!world.keyChest.searched } : null,
          objective: world.objective ? { type: world.objective.type, label: world.objective.label, x: world.objective.x, y: world.objective.y, r: world.objective.r, progress: world.objective.progress, duration: world.objective.duration, state: world.objective.state, wavesSpawned: world.objective.wavesSpawned, completeTimer: world.objective.completeTimer } : null,
          roomCount: world.rooms.length,
          containerCount: world.containers.length,
          mapTiles: [MAP_W, MAP_H],
          exploredCount: world.explored ? world.explored.reduce((sum, v) => sum + v, 0) : 0,
          trailLength: world.trail ? world.trail.length : 0,
          visibleEnemies: world.enemies.filter((e) => !e.dead && isPointVisible(e.x, e.y)).length,
          pickups: world.pickups.map((p) => ({ x: p.x, y: p.y, type: p.type, amount: p.amount || 0, itemType: p.item?.type || null, itemName: p.item ? itemName(p.item) : null, pickupDelay: p.pickupDelay || 0, dropped: !!p.dropped, dropArmed: !!p.dropArmed }))
        } : null
      };
    },
    setKey(key, down) { keys[key.toLowerCase()] = !!down; },
    teleport(x, y) { if (player) { player.x = x; player.y = y; } },
    teleportToObjective() { if (player && world?.objective) { player.x = world.objective.x; player.y = world.objective.y; } return this.snapshot(); },
    setObjectiveProgress(value) { if (world?.objective) world.objective.progress = Math.max(0, Math.min(world.objective.duration, Number(value) || 0)); return this.snapshot(); },
    spawnEliteAt(kind = 'heavy', affix = null, dx = 80, dy = 0) { if (world && player) { const room = world.rooms[1] || world.rooms[0]; const e = new Enemy(player.x + Number(dx), player.y + Number(dy), kind, room); applyEliteAffix(e, affix); e.state = 'chase'; e.alertTimer = 12; e.lastSeen = { x: player.x, y: player.y }; world.enemies.push(e); return this.snapshot(); } },
    hurt(amount, sourceAngle = null) { if (player) player.takeDamage(amount, sourceAngle); },
    dash() { if (player) player.tryDash(); return this.snapshot(); },
    characterSkill() { if (player) player.useCharacterSkill(); return this.snapshot(); },
    chooseCharacter(id) { selectCharacter(id); return this.snapshot(); },
    enableTouch() { enableTouchUI(); },
    touchMove(x, y, mag) { touch.moveX = x; touch.moveY = y; touch.moveMag = mag; touch.moveTargetMag = mag; },
    discardBackpackItem(id) { return discardInventoryItem(id); },
    touchAim(x, y, mag) {
      touch.aimAngle = Math.atan2(y, x);
      touch.aimTargetAngle = touch.aimAngle;
      touch.aimMag = mag;
      touch.hasAim = true;
      touch.aiming = mag > 0.16;
      touch.aimPressAt = performance.now();
    },
    damageBoss(amount) { if (world && world.boss && !world.boss.dead) world.boss.takeDamage(amount, 0); },
    setBossHp(hp = 1000) { if (world && world.boss) { world.boss.maxHp = Math.max(1, Number(hp) || 1); world.boss.hp = world.boss.maxHp; } return this.snapshot(); },
    forceBossPhase(phase = 2) { if (world && world.boss && !world.boss.dead) { world.boss.enterBossPhase(clamp(Math.floor(Number(phase) || 2), 2, 3)); } return this.snapshot(); },
    gearSample(type = 'w_rifle', count = 200) {
      const total = Math.max(1, Math.min(5000, Math.floor(Number(count) || 1)));
      const affixes = {};
      const sets = {};
      let modded = 0;
      let setItems = 0;
      for (let i = 0; i < total; i++) {
        const item = createItem(type);
        if (item.affixes?.length) modded++;
        for (const affix of item.affixes || []) affixes[affix.key] = (affixes[affix.key] || 0) + 1;
        if (item.setId) { sets[item.setId] = (sets[item.setId] || 0) + 1; setItems++; }
      }
      return { type, total, modded, setItems, affixes, sets };
    },
    grantGear(type = 'w_rifle', setId = null, affixes = []) {
      if (!ITEM_DEFS[type]) return null;
      const item = createItem(type, 1, 0, { roll: false });
      if (setId && SET_DEFS[setId]) item.setId = setId;
      if (Array.isArray(affixes) && affixes.length) {
        item.affixes = affixes.filter((a) => AFFIX_DEFS[a.key] && AFFIX_DEFS[a.key].slot === defOf(item).kind)
          .map((a) => ({ key: a.key, value: Number(a.value) || 0 }));
      }
      addToStash(item);
      persist();
      renderAllBase();
      return JSON.parse(JSON.stringify(item));
    },
    equipById(id) { equipStashItem(id); return this.snapshot(); },
    jumpFloor(floor) { if (raid && !raid.ended) { raid.floor = Math.max(1, Math.floor(Number(floor) || 1)); beginFloor(false); return this.snapshot(); } },
    bossAttack(type = 'barrage') { if (world && world.boss && !world.boss.dead) { if (type === 'slam') { world.boss.spawnBossHazards(); } else if (type === 'fan') { world.boss.fireBossFan(); } else { world.boss.barrageWaves = world.boss.bossVariant.ringWaves; world.boss.barrageTimer = 0; } return this.snapshot(); } },
    spawnEnemy(kind = 'grunt') { if (world && player) { const room = world.rooms[1] || world.rooms[0]; const e = new Enemy(player.x + 70, player.y + 30, kind, room); e.state = 'chase'; e.alertTimer = 12; e.lastSeen = { x: player.x, y: player.y }; world.enemies.push(e); return this.snapshot(); } },
    spawnEnemyAt(kind = 'grunt', dx = 80, dy = 0) { if (world && player) { const room = world.rooms[1] || world.rooms[0]; const e = new Enemy(player.x + Number(dx), player.y + Number(dy), kind, room); e.state = 'chase'; e.alertTimer = 12; e.lastSeen = { x: player.x, y: player.y }; world.enemies.push(e); return this.snapshot(); } },
    clearEnemies() { if (world) { for (const e of world.enemies) { if (!e.isBoss) { e.dead = true; e.hp = 0; } } } return this.snapshot(); },
    setAim(angle = 0) { if (player) player.angle = Number(angle) || 0; return this.snapshot(); },
    setHp(hp = 1) { if (player) { player.hp = clamp(Number(hp) || 0, 0, player.maxHp); updateHUD(); } return this.snapshot(); },
    shoot() { if (player) player.tryShoot(); return this.snapshot(); },
    setEnemyHp(index, hp = 1000) { const e = world && world.enemies[index]; if (e && !e.dead) { e.maxHp = Math.max(e.maxHp, Number(hp) || 0); e.hp = clamp(Number(hp) || 0, 0, e.maxHp); } return this.snapshot(); },
    damageEnemy(index, amount = 9999) { const enemy = world && world.enemies[index]; if (enemy && !enemy.dead) enemy.takeDamage(amount, 0); },
    grantKeys(count = 1) { if (raid && !raid.ended) { raid.keys = (raid.keys || 0) + Math.max(0, Math.floor(count)); updateHUD(); } },
    grantStone(type = 'stone_white', count = 1) {
      addToStash(createItem(type, Math.max(1, Math.floor(count))));
      persist();
      renderAllBase();
      return this.snapshot();
    },
    grantTranscendProgress(value = 1000) {
      save.transcend.progress = getTranscendProgress() + Math.max(0, Math.floor(Number(value) || 0));
      persist();
      renderAllBase();
      return this.snapshot();
    },
    transcendNow() {
      performTranscend();
      return this.snapshot();
    },
    convertStashToTranscend(itemId) {
      convertStashItemToTranscend(itemId);
      return this.snapshot();
    },
    enhanceEquipped(slot = 'weapon', stoneType = 'stone_white') {
      enhanceTargetSlot = ['weapon', 'armor', 'pack'].includes(slot) ? slot : 'weapon';
      useEnhanceStone(stoneType);
      return this.snapshot();
    },
    enhanceInfo() {
      const target = save.equipped[enhanceTargetSlot];
      const next = target ? enhanceLevel(target) + 1 : 1;
      const rates = {};
      if (target) {
        for (const type of ['stone_white', 'stone_green', 'stone_blue', 'stone_purple', 'stone_red', 'stone_rainbow']) {
          rates[type] = Math.round(enhanceSuccessRate(ITEM_DEFS[type], next, target) * 100);
        }
      }
      return {
        slot: enhanceTargetSlot,
        plus: target ? enhanceLevel(target) : 0,
        luck: target ? enhanceLuck(target) : 0,
        nextLevel: next,
        gate: enhanceGateLevel(next),
        rates
      };
    },
    fuseStone(type = 'stone_white') {
      fuseEnhanceStones(type);
      return { stones: save.stash.filter((item) => item.type.startsWith('stone_')).map((item) => `${item.type}×${item.qty || 1}`) };
    },
    lootSample(quality = 'common', count = 1000) {
      const types = {};
      const rarities = {};
      const total = Math.max(1, Math.min(20000, Math.floor(count)));
      for (let i = 0; i < total; i++) {
        const type = rollLootItem(quality);
        types[type] = (types[type] || 0) + 1;
        const rarity = defOf(type).rarity;
        rarities[rarity] = (rarities[rarity] || 0) + 1;
      }
      return { quality, total, types, rarities };
    },
    packSample(quality = 'common', count = 1000) {
      const types = {};
      let drops = 0;
      const total = Math.max(1, Math.min(20000, Math.floor(count)));
      for (let i = 0; i < total; i++) {
        const type = rollPackDrop(quality);
        if (!type) continue;
        drops++;
        types[type] = (types[type] || 0) + 1;
      }
      return { quality, total, drops, types };
    },
    grantStashItem(type) {
      if (!ITEM_DEFS[type]) return null;
      const item = createItem(type);
      addToStash(item);
      renderAllBase();
      return item.id;
    },
    equipPack(type = 'p_white') {
      if (!ITEM_DEFS[type]) return null;
      const item = createItem(type);
      addToStash(item);
      equipStashItem(item.id);
      return { type, capacity: backpackCapacity() };
    },
    forceRaidEvent(type) {
      if (!world || !raid) return null;
      world.altExtraction = null;
      world.blackoutTimer = 0;
      raid.event = null;
      applyRaidEvent(type);
      updateHUD();
      return raid.event;
    },
    addBackpackItem(type) {
      if (player) addItemToBackpack(createItem(type));
      updateBackpackHud();
    },
    searchContainer(index = 0) {
      const container = world?.containers?.[index];
      if (!container || !player) return null;
      lootContainer(container);
      return { searched: !!container.searched, locked: !!container.locked, backpack: player.backpack.map((i) => i.type) };
    },
    grantModParts(amount = 5) { save.modParts = Math.max(0, save.modParts + Math.floor(Number(amount) || 0)); renderAllBase(); return save.modParts; },
    bossSignature() { if (world?.boss && !world.boss.dead) { world.boss.fireBossSignature(); } return this.snapshot(); },
    clearEnemies() {
      if (world) for (const enemy of world.enemies) enemy.dead = true;
    },
    touchAimHold(down) {
      touch.aiming = !!down;
      if (down) touch.aimPressAt = performance.now();
      else { touch.aimMag = 0; touch.aimPressAt = 0; touch.firing = false; }
    },
    tick() { updateHUD(); },
    grantPerkChoices(count = 1) {
      if (!raid || raid.ended) return 0;
      raid.pendingPerks = Math.max(0, (raid.pendingPerks || 0) + Math.floor(count || 1));
      showPerkChoices();
      return raid.pendingPerks;
    },
    grantXP(amount) {
      if (!raid || raid.ended) return 0;
      const levels = gainRaidXP(amount, true);
      if (levels > 0 && !raid.paused) showPerkChoices();
      return levels;
    },
    openExtractionChoice,
    continueToNextFloor,
    returnFromExtraction,
    perkChoices() { return pendingPerkChoices.slice(); },
    dailyState() {
      const data = ensureDaily();
      return {
        date: data.date,
        list: data.list.map((entry) => ({
          id: entry.id,
          label: dailyDef(entry.id)?.label || entry.id,
          text: dailyDef(entry.id)?.text(entry.target) || '',
          target: entry.target,
          value: entry.value,
          claimed: entry.claimed,
          mode: dailyDef(entry.id)?.mode || 'sum'
        })),
        done: dailyDoneCount(data),
        claimable: dailyClaimableCount(data),
        bonusClaimed: data.bonusClaimed
      };
    },
    setDailyValue(id, value) {
      const data = ensureDaily();
      const entry = data.list.find((item) => item.id === id);
      if (!entry) return null;
      entry.value = clamp(Math.floor(Number(value) || 0), 0, entry.target);
      persist();
      renderAllBase();
      return this.dailyState();
    },
    resetDaily() {
      save.daily = normalizeDaily(null);
      persist();
      renderAllBase();
      return this.dailyState();
    },
    claimDaily() { claimDailyRewards(); return this.dailyState(); },
    collectorState() {
      return {
        level: collectorLevel(),
        next: nextCollectorTier(),
        have: collectibleCount(),
        bonuses: collectorBonuses(),
        tiers: COLLECTOR_TIERS.map((tier, index) => ({ ...tier, active: index < collectorLevel() }))
      };
    },
    donateCollector() { donateCollector(); return this.collectorState(); },
    grantCollectible(type = 'mat_titan', count = 1) {
      addToStash(createItem(type, Math.max(1, Math.floor(count))));
      renderAllBase();
      return this.collectorState();
    },
    openLoot() {
      if (mode !== 'raid' || !raid) return null;
      openInventory();
      return this.secureState();
    },
    secureState() {
      const pack = (player ? player.backpack : []).map((item) => ({ id: item.id, type: item.type }));
      const secure = (raid && Array.isArray(raid.secureBox) ? raid.secureBox : []).map((item) => ({ id: item.id, type: item.type }));
      return {
        backpack: pack,
        secure,
        capacity: player ? player.capacity : 0,
        open: !!(raid && raid.inventoryOpen)
      };
    },
    moveToSecure(id) { moveToSecure(id); return this.secureState(); },
    moveFromSecure(id) { moveFromSecure(id); return this.secureState(); },
    tidyBackpack() { tidyBackpack(); return this.secureState(); },
    slowmoState() {
      return {
        timer: Number(slowmo.timer.toFixed(3)),
        zoom: Number(slowmo.zoom.toFixed(3)),
        enabled: save.settings.killSlowmo !== false
      };
    },
    weaponModState() {
      const weapon = save.equipped.weapon;
      return {
        type: weapon?.type || null,
        mods: weapon?.mods || {},
        stashMods: save.stash.filter((item) => defOf(item).kind === 'mod').map((item) => item.type)
      };
    },
    installMod(slot, type = '') { installWeaponMod(slot, type); return this.weaponModState(); },
    grantMod(type = 'mod_optic_1', count = 1) {
      addToStash(createItem(type, Math.max(1, Math.floor(count))));
      renderAllBase();
      return this.weaponModState();
    },
    setTimeLeft(value) {
      if (!raid) return null;
      raid.timeLeft = Math.max(0, Number(value) || 0);
      return { timeLeft: raid.timeLeft, overtime: !!raid.overtime };
    },
    triggerWave() {
      if (!raid || !world) return null;
      raid.wave = (raid.wave || 0) + 1;
      spawnReinforcementWave(raid.wave);
      return {
        wave: raid.wave,
        alive: world.enemies.filter((enemy) => !enemy.dead).length,
        reinforceTimer: Math.round(raid.reinforceTimer || 0)
      };
    },
    advanceRaid(seconds = 1) {      if (!raid || !world) return null;
      let left = Math.max(0, Number(seconds) || 0);
      while (left > 0) {
        const step = Math.min(0.1, left);
        updateRaid(step);
        left -= step;
        if (raid.ended) break;
      }
      return {
        timeLeft: Math.round(raid.timeLeft * 10) / 10,
        overtime: !!raid.overtime,
        wave: raid.wave || 0,
        reinforceTimer: Math.round(raid.reinforceTimer || 0),
        ended: !!raid.ended
      };
    },
    recordDailyRun(run = {}) {
      recordDailyProgress(run);
      renderAllBase();
      return this.dailyState();
    },
    forceDaily(list = []) {
      save.daily = {
        date: dailyDateKey(),
        bonusClaimed: false,
        list: list.map((entry) => {
          const def = dailyDef(entry.id);
          if (!def) return null;
          const target = Math.max(1, Math.floor(Number(entry.target) || def.targets[0]));
          return {
            id: def.id,
            target,
            value: clamp(Math.floor(Number(entry.value) || 0), 0, target),
            claimed: entry.claimed === true
          };
        }).filter(Boolean)
      };
      persist();
      renderAllBase();
      return this.dailyState();
    }
  };
  renderAllBase();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
  const autoStart = new URLSearchParams(location.search).get('autostart');
  if (autoStart === '1') setTimeout(startRaid, 120);
  requestAnimationFrame(frame);
})();
