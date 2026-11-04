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
    }
  };

  const ARMOR_DEFS = {
    none: { name: '无护甲', reduction: 0, color: '#778399', desc: '没有任何伤害减免。' },
    light: { name: '轻型护甲', reduction: 0.12, color: '#7ed7a0', desc: '减少 12% 受到的伤害。' },
    heavy: { name: '重型护甲', reduction: 0.26, color: '#ffbd63', desc: '减少 26% 受到的伤害，但比较笨重。' },
    riot: { name: '反应装甲', reduction: 0.38, color: '#c59cff', desc: '减少 38% 受到的伤害。' },
    scout: { name: '侦察背心', reduction: 0.08, speedBonus: 0.12, color: '#7ee8d2', desc: '减少 8% 伤害，移动速度 +12%。' },
    medic: { name: '战地医疗甲', reduction: 0.16, medkitBonus: 1, color: '#79f0a3', desc: '减少 16% 伤害，每次行动额外携带 1 个医疗包。' },
    ghost: { name: '幽灵纤维甲', reduction: 0.22, speedBonus: 0.04, stealth: 0.72, color: '#a98cff', desc: '减少 22% 伤害，移速 +4%，敌人视野降低 28%。' }
  };

  const MAX_ENHANCE = 10;
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

  const ITEM_DEFS = {
    w_pistol: { name: '旧式手枪', icon: '▰', kind: 'weapon', weapon: 'pistol', rarity: 'common', sell: 28, stack: false, desc: '标配副武器。伤害 24，弹匣 12 发。' },
    w_smg: { name: '蜂鸣冲锋枪', icon: '⌁', kind: 'weapon', weapon: 'smg', rarity: 'uncommon', sell: 95, stack: false, desc: '全自动冲锋枪。伤害 15，弹匣 30 发。' },
    w_rifle: { name: '荒原步枪', icon: '╾', kind: 'weapon', weapon: 'rifle', rarity: 'rare', sell: 220, stack: false, desc: '高伤害自动步枪。伤害 36，弹匣 20 发。' },
    w_dmr: { name: '长视者 DMR', icon: '⌖', kind: 'weapon', weapon: 'dmr', rarity: 'epic', sell: 390, stack: false, desc: '精准半自动步枪。伤害 58，弹匣 8 发。' },
    w_shotgun: { name: '破门霰弹枪', icon: '≋', kind: 'weapon', weapon: 'shotgun', rarity: 'rare', sell: 150, stack: false, desc: '近距离发射 6 枚弹丸，爆发极高。' },
    w_lmg: { name: '铁皮轻机枪', icon: '▦', kind: 'weapon', weapon: 'lmg', rarity: 'rare', sell: 270, stack: false, desc: '60 发弹链，持续压制力极强。' },
    w_rail: { name: '磁轨手枪', icon: 'ϟ', kind: 'weapon', weapon: 'rail', rarity: 'epic', sell: 460, stack: false, desc: '高伤害实验武器，备弹稀少。' },
    w_boss: { name: '终焉协议', icon: '✦', kind: 'weapon', weapon: 'boss', rarity: 'epic', sell: 900, stack: false, boss: true, desc: '首领专属双管能量步枪。每次发射 2 枚高能弹丸，无法从黑市购买。' },
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
    vault: { common: 0, uncommon: 18, rare: 52, epic: 30 }
  };
  const LOOT_POOLS = {
    common: ['scrap', 'fiber', 'circuit'],
    uncommon: ['chip', 'battery', 'w_smg', 'a_light', 'a_scout'],
    rare: ['relic', 'lens', 'drone_core', 'medal', 'w_rifle', 'w_shotgun', 'w_lmg', 'a_heavy', 'a_medic'],
    epic: ['core', 'quantum', 'phase', 'w_dmr', 'w_rail', 'a_riot', 'a_ghost']
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

  function createItem(type, qty = 1, plus = 0) {
    const item = { id: uid(), type, qty };
    if (plus > 0) item.plus = plus;
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

  function normalizeItemInstance(item) {
    if (!item || !ITEM_DEFS[item.type]) return null;
    const def = ITEM_DEFS[item.type];
    const normalized = { ...item, id: item.id || uid(), qty: item.qty || 1 };
    if (['weapon', 'armor', 'pack'].includes(def.kind)) {
      normalized.plus = enhanceLevel(item);
    } else {
      delete normalized.plus;
    }
    return normalized;
  }

  function itemName(item) {
    const def = defOf(item);
    const plus = enhanceLevel(item);
    return `${def.name}${plus ? ` +${plus}` : ''}`;
  }

  function itemSellValue(item) {
    const def = defOf(item);
    const plus = enhanceLevel(item);
    return Math.round(def.sell * (item.qty || 1) * (1 + plus * 0.12));
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
      version: 4,
      scrap: 80,
      stash: [],
      equipped: {
        weapon: createItem('w_pistol'),
        armor: null,
        pack: createItem('p_white')
      },
      upgrades: { medkits: 0, ammo: 0 },
      settings: { ...DEFAULT_SETTINGS },
      stats: { raids: 0, extracts: 0, kills: 0, deaths: 0, loot: 0 }
    };
  }

  function normalizeSave(raw) {
    const base = defaultSave();
    if (!raw || typeof raw !== 'object') return base;
    const merged = {
      ...base,
      ...raw,
      upgrades: { ...base.upgrades, ...(raw.upgrades || {}) },
      settings: { ...base.settings, ...(raw.settings || {}) },
      stats: { ...base.stats, ...(raw.stats || {}) },
      stash: Array.isArray(raw.stash) ? raw.stash.map(normalizeItemInstance).filter(Boolean) : []
    };
    if (!raw.equipped || !ITEM_DEFS[raw.equipped.weapon?.type]) {
      merged.equipped.weapon = createItem('w_pistol');
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
      merged.equipped.pack = createItem('p_white');
    }
    // Level and perks are run-only now. Old saves are upgraded by dropping those fields.
    delete merged.level;
    delete merged.xp;
    delete merged.perks;
    delete merged.pendingPerks;
    merged.version = 4;
    merged.scrap = Math.max(0, Number(merged.scrap) || 0);
    const touchSettings = merged.settings;
    touchSettings.moveStickMode = touchSettings.moveStickMode === 'fixed' ? 'fixed' : 'floating';
    touchSettings.moveStickSize = clamp(Number(touchSettings.moveStickSize) || 100, 70, 150);
    touchSettings.moveZoneWidth = clamp(Number(touchSettings.moveZoneWidth) || 50, 30, 70);
    touchSettings.moveSensitivity = clamp(Number(touchSettings.moveSensitivity) || 1, 0.6, 1.6);
    touchSettings.aimPadSize = clamp(Number(touchSettings.aimPadSize) || 100, 70, 120);
    touchSettings.aimSensitivity = clamp(Number(touchSettings.aimSensitivity) || 1, 0.6, 1.6);
    touchSettings.raidRisk = RISK_DEFS[touchSettings.raidRisk] ? touchSettings.raidRisk : 'normal';
    touchSettings.tutorialDone = touchSettings.tutorialDone === true;
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

  function raidXpToNext(level) { return 80 + (level - 1) * 50; }
  function perkRank(key) {
    const def = PERK_DEFS[key];
    if (!def) return 0;
    return clamp(Math.floor(Number(raid?.perks?.[key]) || 0), 0, def.max);
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
    statScrap: $('#statScrap'),
    statRaids: $('#statRaids'),
    statExtracts: $('#statExtracts'),
    loadoutWeapon: $('#loadoutWeapon'),
    loadoutArmor: $('#loadoutArmor'),
    loadoutMeds: $('#loadoutMeds'),
    loadoutSlots: $('#loadoutSlots'),
    loadoutPack: $('#loadoutPack'),
    startRaidBtn: $('#startRaidBtn'),
    riskPicker: $('#riskPicker'),
    riskHint: $('#riskHint'),
    stashRarityFilter: $('#stashRarityFilter'),
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
    hudLevel: $('#hudLevel'),
    hudFloor: $('#hudFloor'),
    hudLockState: $('#hudLockState'),
    hudXpFill: $('#hudXpFill'),
    hudXpText: $('#hudXpText'),
    raidTimer: $('#raidTimer'),
    raidObjective: $('#raidObjective'),
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
    hudInventoryBtn: $('#hudInventoryBtn'),
    hudMapBtn: $('#hudMapBtn'),
    mapOverlay: $('#mapOverlay'),
    closeMapBtn: $('#closeMapBtn'),
    fullMapCanvas: $('#fullMapCanvas'),
    closeInventoryBtn: $('#closeInventoryBtn'),
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
    perkOverlay: $('#perkOverlay'),
    perkChoiceGrid: $('#perkChoiceGrid'),
    perkPending: $('#perkPending'),
    toast: $('#toast'),
    openEquipBtn: $('#openEquipBtn'),
    openStashBtn: $('#openStashBtn'),
    openShopBtn: $('#openShopBtn'),
    openEnhanceBtn: $('#openEnhanceBtn'),
    equipOverlay: $('#equipOverlay'),
    closeEquipBtn: $('#closeEquipBtn'),
    equipWindowTitle: $('#equipWindowTitle'),
    manageNote: $('#manageNote'),
    equippedSummary: $('#equippedSummary'),
    weaponChoices: $('#weaponChoices'),
    armorChoices: $('#armorChoices'),
    packChoices: $('#packChoices'),
    manageEquipPanel: $('#manageEquipPanel'),
    manageStashPanel: $('#manageStashPanel'),
    manageShopPanel: $('#manageShopPanel'),
    manageEnhancePanel: $('#manageEnhancePanel'),
    enhanceTargets: $('#enhanceTargets'),
    enhanceTargetSummary: $('#enhanceTargetSummary'),
    enhanceStoneList: $('#enhanceStoneList'),
    enhanceChanceHint: $('#enhanceChanceHint'),
    enhanceStoneCount: $('#enhanceStoneCount'),
    shopScrap: $('#shopScrap'),
    baseStashCount: $('#baseStashCount'),
    baseScrap: $('#baseScrap'),
    baseEnhanceSummary: $('#baseEnhanceSummary'),
    baseEquipSummary: $('#baseEquipSummary'),
    touchControls: $('#touchControls'),
    moveZone: $('#moveZone'),
    movePad: $('#movePad'),
    moveKnob: $('#moveKnob'),
    aimPad: $('#aimPad'),
    aimKnob: $('#aimKnob'),
    touchReload: $('#touchReload'),
    touchMed: $('#touchMed'),
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
      player.speed = 155 * (1 + (player.armor.speedBonus || 0) + perkRank('runner') * 0.04);
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
    const weaponItem = save.equipped.weapon;
    const weaponDef = weaponItem ? WEAPON_DEFS[defOf(weaponItem).weapon] : null;
    if (weaponDef) {
      const rpm = Math.round(60 / weaponDef.cooldown);
      const plus = enhanceLevel(weaponItem);
      const damage = Math.round(weaponDef.damage * (1 + plus * ENHANCE_RULES.weapon.perLevel));
      el.loadoutWeapon.className = 'equip-card';
      el.loadoutWeapon.innerHTML = `
        <div class="equip-top">
          <div><div class="equip-name">${itemName(weaponItem)}</div><div class="equip-type">主武器 · ${weaponDef.code}${plus ? ` · 强化 +${plus}` : ''}</div></div>
          <div class="equip-icon" style="color:${weaponDef.color}">${weaponItem ? defOf(weaponItem).icon : '▰'}</div>
        </div>
        <div class="equip-stats"><span>伤害 ${damage}${plus ? ` (${weaponDef.damage}+${plus * 5}%)` : ''}</span><span>射速 ${rpm}/min</span><span>弹匣 ${weaponDef.mag}</span><span>${weaponDef.auto || likelyTouch ? '全自动' : '半自动'}</span>${weaponDef.pellets > 1 ? `<span>弹丸 ${weaponDef.pellets}</span>` : ''}</div>`;
    } else {
      el.loadoutWeapon.className = 'equip-card empty';
      el.loadoutWeapon.innerHTML = '<div class="equip-name">未装备武器</div><div class="equip-desc">去仓库装备一把武器。</div>';
    }

    const armorItem = save.equipped.armor;
    const armorDef = ARMOR_DEFS[armorItem ? defOf(armorItem).armor : 'none'];
    const armorPlus = enhanceLevel(armorItem);
    const armorReduction = Math.min(0.75, armorDef.reduction + armorPlus * ENHANCE_RULES.armor.perLevel);
    el.loadoutArmor.className = 'equip-card';
    el.loadoutArmor.innerHTML = `
      <div class="equip-top">
        <div><div class="equip-name">${armorItem ? itemName(armorItem) : armorDef.name}</div><div class="equip-type">护甲 · ${armorItem ? RARITY_LABEL[defOf(armorItem).rarity] : '基础'}${armorPlus ? ` · 强化 +${armorPlus}` : ''}</div></div>
        <div class="equip-icon" style="color:${armorDef.color}">${armorItem ? defOf(armorItem).icon : '▤'}</div>
      </div>
      <div class="equip-stats"><span>伤害减免 ${Math.round(armorReduction * 100)}%</span><span>${armorDef.desc}</span></div>`;

    const packItem = save.equipped.pack;
    const packDef = packItem ? PACK_QUALITIES[defOf(packItem).pack] : null;
    const packPlus = enhanceLevel(packItem);
    if (el.loadoutPack) {
      el.loadoutPack.textContent = packDef ? `${packDef.label} +${packDef.bonus + packPlus}` : '未装备';
      el.loadoutPack.style.color = packDef ? packDef.color : 'var(--dim)';
      el.loadoutPack.classList.toggle('rainbow-text', !!packItem && defOf(packItem).pack === 'rainbow');
      el.loadoutPack.title = packDef ? `${packDef.name}${packPlus ? ` · 强化 +${packPlus}` : ''}` : '';
    }
    el.loadoutMeds.textContent = startingMedkits() + (armorDef.medkitBonus || 0);
    el.loadoutSlots.textContent = backpackCapacity();
    if (el.baseEquipSummary) {
      const packText = packDef ? ` · 背包 +${packDef.bonus + packPlus}` : '';
      el.baseEquipSummary.textContent = weaponDef ? `武器 · ${itemName(weaponItem)}${packText}` : `未装备武器${packText}`;
    }
  }

  function renderStash() {
    el.stashCount.textContent = `${stashSlotCount()} / ∞`;
    if (el.baseStashCount) el.baseStashCount.textContent = `${stashSlotCount()} 件`;
    el.stashGrid.innerHTML = '';
    if (el.stashRarityFilter) {
      el.stashRarityFilter.querySelectorAll('button[data-rarity]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.rarity === stashRarityFilter);
      });
    }
    const filtered = sortItemList(save.stash).filter((item) => {
      return stashRarityFilter === 'all' || defOf(item).rarity === stashRarityFilter;
    });
    el.stashEmpty.classList.toggle('hidden', filtered.length > 0);
    el.stashEmpty.textContent = save.stash.length === 0
      ? '仓库是空的。带战利品撤离，或去黑市进货。'
      : '没有符合当前品质筛选的物资。';
    if (selectedStashId && !filtered.some((i) => i.id === selectedStashId)) selectedStashId = null;

    for (const item of filtered) {
      const def = defOf(item);
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = `stash-slot rarity-${def.rarity} ${selectedStashId === item.id ? 'selected' : ''}`;
      slot.dataset.id = item.id;
      slot.title = `${itemName(item)} · ${def.desc}`;
      slot.innerHTML = `
        <span class="slot-icon ${def.rarity === 'mythic' ? 'mythic-icon' : ''}" style="color:${choiceIconColor(def)}">${def.icon}</span>
        <span class="slot-name">${itemName(item)}</span>
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
    el.itemActions.classList.remove('hidden');
    el.selectedIcon.textContent = def.icon;
    el.selectedIcon.style.color = choiceIconColor(def);
    el.selectedName.textContent = `${itemName(selected)}${selected.qty > 1 ? ` ×${selected.qty}` : ''}`;
    el.selectedDesc.textContent = `${def.desc} · ${RARITY_LABEL[def.rarity]}`;
    el.selectedValue.textContent = `出售 +${itemSellValue(selected)}`;
    el.equipBtn.classList.toggle('hidden', !['weapon', 'armor', 'pack'].includes(def.kind));
    el.sellBtn.textContent = `出售 ×${selected.qty || 1}`;
  }

  function sellLowValue() {
    const lowValue = save.stash.filter((item) => defOf(item).rarity === 'common' && defOf(item).kind !== 'stone');
    if (!lowValue.length) {
      toast('仓库里没有普通品质物资。');
      return;
    }
    const total = lowValue.reduce((sum, item) => sum + itemSellValue(item), 0);
    const count = lowValue.reduce((sum, item) => sum + (item.qty || 1), 0);
    if (!confirm(`确定出售全部 ${count} 件普通品质物资，获得 ${total} 废料吗？`)) return;
    save.stash = save.stash.filter((item) => defOf(item).rarity !== 'common');
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
    if (def.kind === 'weapon') {
      const w = WEAPON_DEFS[def.weapon];
      const damage = Math.round(w.damage * (1 + plus * ENHANCE_RULES.weapon.perLevel));
      const pelletText = w.pellets > 1 ? ` · 弹丸 ${w.pellets}` : '';
      return `伤害 ${damage}${plus ? ` (强化 +${plus})` : ''}${pelletText} · 弹匣 ${w.mag} · ${w.auto || likelyTouch ? '全自动' : '半自动'} · 射速 ${Math.round(60 / w.cooldown)}/min`;
    }
    if (def.kind === 'armor') {
      const a = ARMOR_DEFS[def.armor];
      const reduction = Math.min(0.75, a.reduction + plus * ENHANCE_RULES.armor.perLevel);
      const extras = [];
      if (a.speedBonus) extras.push(`移速 +${Math.round(a.speedBonus * 100)}%`);
      if (a.medkitBonus) extras.push(`医疗包 +${a.medkitBonus}`);
      if (a.stealth) extras.push(`敌人视野 -${Math.round((1 - a.stealth) * 100)}%`);
      return `伤害减免 ${Math.round(reduction * 100)}%${plus ? ` (强化 +${plus})` : ''}${extras.length ? ` · ${extras.join(' · ')}` : ''} · ${RARITY_LABEL[def.rarity]}`;
    }
    if (def.kind === 'pack') {
      const pack = PACK_QUALITIES[def.pack];
      return `背包装备 · ${pack.label}品质 · 容量 +${pack.bonus + plus}${plus ? ` (强化 +${plus})` : ''}`;
    }
    if (def.kind === 'stone') {
      return `强化石 Lv.${def.stoneLevel} · 成功率 ${Math.round(def.success * 100)}% · ${RARITY_LABEL[def.rarity]}`;
    }
    return def.desc;
  }

  function gearCompareText(item) {
    const def = defOf(item);
    if (def.kind === 'weapon') {
      const next = WEAPON_DEFS[def.weapon];
      if (!save.equipped.weapon) return '<span class="compare up">当前武器槽为空 · 可直接装备</span>';
      const currentItem = save.equipped.weapon;
      const current = WEAPON_DEFS[defOf(currentItem).weapon];
      const nextDps = next.damage * (1 + enhanceLevel(item) * ENHANCE_RULES.weapon.perLevel) * (next.pellets || 1) / next.cooldown;
      const currentDps = current.damage * (1 + enhanceLevel(currentItem) * ENHANCE_RULES.weapon.perLevel) * (current.pellets || 1) / current.cooldown;
      const pct = Math.round((nextDps / currentDps - 1) * 100);
      if (Math.abs(pct) <= 2) return '<span class="compare">DPS 与当前武器基本持平</span>';
      return `<span class="compare ${pct > 0 ? 'up' : 'down'}">DPS ${pct > 0 ? '+' : ''}${pct}% · 对比当前武器</span>`;
    }
    if (def.kind === 'armor') {
      const next = ARMOR_DEFS[def.armor];
      if (!save.equipped.armor) return '<span class="compare up">当前没有护甲 · 可直接装备</span>';
      const currentItem = save.equipped.armor;
      const current = ARMOR_DEFS[defOf(currentItem).armor];
      const nextReduction = Math.min(0.75, next.reduction + enhanceLevel(item) * ENHANCE_RULES.armor.perLevel);
      const currentReduction = Math.min(0.75, current.reduction + enhanceLevel(currentItem) * ENHANCE_RULES.armor.perLevel);
      const diff = Math.round((nextReduction - currentReduction) * 100);
      const extras = [];
      if (next.speedBonus) extras.push(`移速 +${Math.round(next.speedBonus * 100)}%`);
      if (next.medkitBonus) extras.push(`医疗包 +${next.medkitBonus}`);
      if (next.stealth) extras.push(`匿踪 +${Math.round((1 - next.stealth) * 100)}%`);
      const extraText = extras.length ? ` · ${extras.join(' · ')}` : '';
      return `<span class="compare ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">减伤 ${diff > 0 ? '+' : ''}${diff}%${extraText}</span>`;
    }
    if (def.kind === 'pack') {
      const next = PACK_QUALITIES[def.pack];
      if (!save.equipped.pack) return '<span class="compare up">当前没有背包装备 · 可直接装备</span>';
      const currentItem = save.equipped.pack;
      const current = PACK_QUALITIES[defOf(currentItem).pack];
      const diff = (next.bonus + enhanceLevel(item)) - (current.bonus + enhanceLevel(currentItem));
      if (diff === 0) return '<span class="compare">容量与当前背包相同</span>';
      return `<span class="compare ${diff > 0 ? 'up' : 'down'}">容量 ${diff > 0 ? '+' : ''}${diff} · 对比当前背包</span>`;
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

  function renderEquipChoices(kind, target) {
    target.innerHTML = '';
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
        <div class="equipped-slot-stats">${armor ? gearStatsText(armor) : '没有护甲，受到完整伤害。'}</div>
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
          <div class="enhance-summary-hint">成功率由所选强化石决定；失败会消耗强化石，等级不会下降。</div>`;
      }
    }

    const stones = stoneItemsInStash();
    if (el.enhanceStoneCount) el.enhanceStoneCount.textContent = `强化石 ${totalStoneCount()} 颗`;
    el.enhanceStoneList.innerHTML = '';
    if (stones.length === 0) {
      el.enhanceStoneList.innerHTML = '<div class="enhance-empty">击杀敌人有概率掉落强化石。品质越高，强化成功率越高。</div>';
      return;
    }
    for (const stone of stones) {
      const def = defOf(stone);
      const row = document.createElement('div');
      row.className = `enhance-stone-row rarity-${def.rarity}`;
      row.innerHTML = `
        <span class="enhance-stone-icon ${def.rarity === 'mythic' ? 'mythic-icon' : ''}" style="color:${choiceIconColor(def)}">${def.icon}</span>
        <span class="enhance-stone-mid">
          <strong>${def.name}</strong>
          <span>Lv.${def.stoneLevel} · 成功率 ${Math.round(def.success * 100)}%</span>
        </span>
        <span class="enhance-stone-qty">×${stone.qty || 1}</span>
        <button class="enhance-use-btn" type="button" ${(!target || maxed) ? 'disabled' : ''}>使用</button>`;
      row.querySelector('button').addEventListener('click', () => useEnhanceStone(stone.type));
      el.enhanceStoneList.appendChild(row);
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
    stone.qty = (stone.qty || 1) - 1;
    if (stone.qty <= 0) save.stash.splice(stoneIdx, 1);
    const success = Math.random() < stoneDef.success;
    if (success) {
      target.plus = plus + 1;
      toast(`强化成功！${itemName(target)} 提升至 +${target.plus}。`);
      playSound('level');
    } else {
      toast(`强化失败，${stoneDef.name}已消耗。`);
      playSound('hurt');
    }
    selectedStashId = null;
    persist();
    renderAllBase();
    renderEnhance();
  }

  const MANAGE_VIEWS = {
    equip: { title: '装备', note: '装备会立即更新作战准备；进入行动后不能更换。' },
    stash: { title: '仓库', note: '仓库物资会即时保存；出售物品可以获得废料。' },
    shop: { title: '黑市', note: '使用废料购买武器、护甲和永久补给。' },
    enhance: { title: '强化台', note: '强化石由敌人掉落；强化失败会消耗 1 颗强化石，装备等级不会下降。' }
  };

  function openEquipModal(view = 'equip') {
    if (mode !== 'base') return;
    const selected = MANAGE_VIEWS[view] ? view : 'equip';
    renderEquipModal();
    renderStash();
    renderShop();
    renderEnhance();
    if (el.equipWindowTitle) el.equipWindowTitle.textContent = MANAGE_VIEWS[selected].title;
    if (el.manageNote) el.manageNote.textContent = MANAGE_VIEWS[selected].note;
    if (el.manageEquipPanel) el.manageEquipPanel.classList.toggle('hidden', selected !== 'equip');
    if (el.manageStashPanel) el.manageStashPanel.classList.toggle('hidden', selected !== 'stash');
    if (el.manageShopPanel) el.manageShopPanel.classList.toggle('hidden', selected !== 'shop');
    if (el.manageEnhancePanel) el.manageEnhancePanel.classList.toggle('hidden', selected !== 'enhance');
    el.equipOverlay.classList.remove('hidden');
  }

  function closeEquipModal() {
    el.equipOverlay.classList.add('hidden');
  }

  function sellSelected() {
    const idx = save.stash.findIndex((i) => i.id === selectedStashId);
    if (idx < 0) return;
    const item = save.stash[idx];
    const value = itemSellValue(item);
    save.stash.splice(idx, 1);
    save.scrap += value;
    selectedStashId = null;
    persist();
    renderAllBase();
    playSound('pickup');
    toast(`出售 ${itemName(item)}，获得 ${value} 废料。`);
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

  function renderAllBase() {
    syncRiskPicker();
    renderLoadout();
    renderStash();
    renderShop();
    renderEnhance();
    renderProgress();
    if (el.baseScrap) el.baseScrap.textContent = save.scrap;
    if (el.baseEnhanceSummary) el.baseEnhanceSummary.textContent = `${totalStoneCount()} 颗强化石`;
  }

  el.equipBtn.addEventListener('click', equipSelected);
  el.sellBtn.addEventListener('click', sellSelected);
  el.openEquipBtn.addEventListener('click', () => openEquipModal('equip'));
  el.openStashBtn.addEventListener('click', () => openEquipModal('stash'));
  el.openShopBtn.addEventListener('click', () => openEquipModal('shop'));
  el.openEnhanceBtn.addEventListener('click', () => openEquipModal('enhance'));
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
      hint.innerHTML = '<div>左摇杆移动 · 按住右侧瞄准区开火 · 拖动瞄准</div><div>靠近补给箱站 2 秒自动搜索 · 换弹/医疗/背包按钮</div><div>建议横屏游玩</div>';
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
    const kinds = ['grunt', 'grunt', 'scout', 'grunt', 'heavy'];
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
    enemies.push(keyGuard);

    const worldObj = {
      tiles,
      rooms,
      spawn,
      extraction,
      containers,
      enemies,
      boss: bossEnemy,
      keyRoom: { x: keyRoom.x * TILE, y: keyRoom.y * TILE, w: keyRoom.w * TILE, h: keyRoom.h * TILE },
      keyChest,
      explored: new Uint8Array(MAP_W * MAP_H),
      fogMini: buildFogCanvas(),
      trail: [],
      revealTimer: 0,
      pickups: [],
      bullets: [],
      particles: [],
      floatTexts: [],
      mapCanvas: buildMapCanvas(tiles),
      mini: buildMinimap(tiles),
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

  function buildMapCanvas(tiles) {
    const c = document.createElement('canvas');
    c.width = MAP_PW;
    c.height = MAP_PH;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;

    const floorPalette = ['#1b2531', '#1e2937', '#19232f', '#202b39'];
    const edgePalette = ['#34445c', '#2b394d'];

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const px = x * TILE;
        const py = y * TILE;
        if (tiles[y][x] === 1) {
          const h = hash2(x, y);
          g.fillStyle = floorPalette[h % floorPalette.length];
          g.fillRect(px, py, TILE, TILE);
          g.fillStyle = 'rgba(255,255,255,.025)';
          g.fillRect(px + 2, py + 2, TILE - 4, 1);
          g.fillStyle = 'rgba(0,0,0,.10)';
          g.fillRect(px, py + TILE - 2, TILE, 2);
          if (h % 9 === 0) {
            g.fillStyle = 'rgba(85,217,255,.055)';
            g.fillRect(px + 8 + (h % 13), py + 9 + (h % 7), 3, 2);
          }
          if (h % 17 === 0) {
            g.fillStyle = 'rgba(0,0,0,.16)';
            g.fillRect(px + 5, py + 21, 13, 2);
          }
        } else {
          g.fillStyle = '#0a0e14';
          g.fillRect(px, py, TILE, TILE);
          const belowFloor = y + 1 < MAP_H && tiles[y + 1][x] === 1;
          const rightFloor = x + 1 < MAP_W && tiles[y][x + 1] === 1;
          const leftFloor = x - 1 >= 0 && tiles[y][x - 1] === 1;
          const aboveFloor = y - 1 >= 0 && tiles[y - 1][x] === 1;
          if (belowFloor) {
            g.fillStyle = '#34455d';
            g.fillRect(px, py + TILE - 5, TILE, 5);
            g.fillStyle = '#1f2b3a';
            g.fillRect(px, py + TILE - 8, TILE, 3);
          }
          if (rightFloor) {
            g.fillStyle = '#28374b';
            g.fillRect(px + TILE - 4, py, 4, TILE);
          }
          if (leftFloor) {
            g.fillStyle = '#1e2a39';
            g.fillRect(px, py, 4, TILE);
          }
          if (aboveFloor) {
            g.fillStyle = '#1b2532';
            g.fillRect(px, py, TILE, 4);
          }
          if ((x + y) % 3 === 0) {
            g.fillStyle = 'rgba(85,217,255,.035)';
            g.fillRect(px + 10, py + 10, 2, 2);
          }
        }
      }
    }

    // A subtle grid over the entire map.
    g.strokeStyle = 'rgba(0,0,0,.09)';
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

    return c;
  }

  function buildMinimap(tiles) {
    const scale = 4;
    const c = document.createElement('canvas');
    c.width = MAP_W * scale;
    c.height = MAP_H * scale;
    const g = c.getContext('2d');
    g.fillStyle = '#080d13';
    g.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (tiles[y][x] === 1) {
          g.fillStyle = (x + y) % 2 ? '#304052' : '#293747';
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

  // ---------------------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------------------
  class Player {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.r = 10;
      this.maxHp = 100 + perkRank('vitality') * 10;
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

      const weaponItem = save.equipped.weapon;
      const weaponType = defOf(weaponItem).weapon || 'pistol';
      this.weaponKey = weaponType;
      this.weapon = WEAPON_DEFS[weaponType] || WEAPON_DEFS.pistol;
      this.weaponPlus = enhanceLevel(weaponItem);
      this.mag = this.weapon.mag;
      this.reserve = Math.round((this.weapon.reserve + save.upgrades.ammo * 45) * (1 + perkRank('ammo') * 0.1));
      const armorItem = save.equipped.armor;
      this.armorKey = armorItem ? defOf(armorItem).armor : 'none';
      this.armorPlus = enhanceLevel(armorItem);
      const armorBase = ARMOR_DEFS[this.armorKey] || ARMOR_DEFS.none;
      this.armor = {
        ...armorBase,
        reduction: Math.min(0.75, armorBase.reduction + this.armorPlus * ENHANCE_RULES.armor.perLevel)
      };
      this.packItem = save.equipped.pack || null;
      this.packKey = this.packItem ? defOf(this.packItem).pack : null;
      this.packPlus = enhanceLevel(this.packItem);
      this.pack = this.packKey ? {
        ...PACK_QUALITIES[this.packKey],
        bonus: PACK_QUALITIES[this.packKey].bonus + this.packPlus
      } : null;
      this.speed *= 1 + (this.armor.speedBonus || 0) + perkRank('runner') * 0.04;
      this.medkits = startingMedkits() + (this.armor.medkitBonus || 0);
      this.stealth = this.armor.stealth || 1;
      this.capacity = backpackCapacity();
      this.backpack = [];
      this.damageMultiplier = 1 + this.weaponPlus * ENHANCE_RULES.weapon.perLevel;
    }

    update(dt) {
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
      this.moving = len > 0.04;
      if (len > 0.04) {
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
        muzzleX = this.x + Math.cos(angle) * 20;
        muzzleY = this.y + Math.sin(angle) * 20;
        world.bullets.push({
          x: muzzleX,
          y: muzzleY,
          prevX: muzzleX,
          prevY: muzzleY,
          vx: Math.cos(angle) * this.weapon.speed,
          vy: Math.sin(angle) * this.weapon.speed,
          damage: this.weapon.damage * this.damageMultiplier,
          owner: 'player',
          color: this.weapon.color,
          life: this.weapon.range / this.weapon.speed,
          maxLife: this.weapon.range / this.weapon.speed
        });
      }
      this.mag -= 1;
      this.fireCd = this.weapon.cooldown;
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
      this.reloadTimer = this.weapon.reload * Math.max(0.55, 1 - perkRank('quickhands') * 0.07);
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
      this.hurtCd = 0.075;
      const finalDamage = Math.max(1, amount * (1 - this.armor.reduction) * (1 - perkRank('bulwark') * 0.03));
      this.hp -= finalDamage;
      world.shake = Math.max(world.shake, 6);
      showDamageFlash();
      if (Number.isFinite(sourceAngle)) showDamageDirection(sourceAngle);
      playSound('hurt');
      addParticle(this.x, this.y, '#ff5b6e', 5, 60, 2, 0.4);
      if (raid && raid.interactionType === 'search' && raid.progress > 0.05) {
        raid.searchInterruptTimer = 0.9;
        addFloatText(this.x, this.y - 24, '搜索被打断', '#ffad45');
      }
      updateHUD();
      if (this.hp <= 0) {
        this.hp = 0;
        endRaid(false, '你被击倒了，携带的物资全部丢失。');
      }
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
      this.r = this.isBoss ? 15 : 9;
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
      this.carriesKey = false;

      const statTable = {
        grunt: { hp: 46, speed: 73, vision: 335, range: 320, damage: 8, cooldown: 0.95, xp: 18, scrap: 3, color: '#d65b64' },
        scout: { hp: 30, speed: 108, vision: 370, range: 280, damage: 6, cooldown: 0.68, xp: 16, scrap: 2, color: '#df8b45' },
        heavy: { hp: 90, speed: 52, vision: 305, range: 345, damage: 14, cooldown: 1.2, xp: 32, scrap: 6, color: '#a84a69' },
        boss: { hp: 340, speed: 58, vision: 460, range: 460, damage: 17, cooldown: 1.05, xp: 180, scrap: 45, color: '#ff3e6c', name: '终焉守卫' }
      };
      const s = statTable[kind] || statTable.grunt;
      const risk = riskDef();
      const floor = Math.max(1, raid?.floor || 1);
      this.name = s.name || '敌人';
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
    }

    update(dt) {
      if (this.dead) return;
      this.fireCd = Math.max(0, this.fireCd - dt);
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);

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

      let moveX = 0;
      let moveY = 0;

      if (this.state === 'chase') {
        if (canSee && distToPlayer < 105) {
          moveX = -dxToPlayer / Math.max(1, distToPlayer);
          moveY = -dyToPlayer / Math.max(1, distToPlayer);
        } else if (canSee && distToPlayer < 200) {
          const strafe = Math.sin(world.time * 1.7 + this.walkPhase) * 0.8;
          moveX = (-dyToPlayer / Math.max(1, distToPlayer)) * strafe;
          moveY = (dxToPlayer / Math.max(1, distToPlayer)) * strafe;
        } else {
          const d = flowDirection(this);
          const l = Math.hypot(d.x, d.y) || 1;
          moveX = d.x / l;
          moveY = d.y / l;
        }
        this.angle = Math.atan2(dyToPlayer, dxToPlayer);
      } else {
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
        moveWithCollision(this, moveX * this.speed * dt, moveY * this.speed * dt);
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

      if (this.winding) {
        if (!canSee || distToPlayer > this.range * 1.22) {
          this.winding = false;
          this.shotWindup = 0;
        } else {
          this.shotWindup = Math.max(0, this.shotWindup - dt);
          if (this.shotWindup <= 0) {
            this.winding = false;
            this.shoot();
          }
        }
      } else if (canSee && distToPlayer < this.range && this.fireCd <= 0) {
        this.winding = true;
        this.shotWindupMax = this.isBoss ? 0.55 : this.kind === 'heavy' ? 0.4 : 0.3;
        this.shotWindup = this.shotWindupMax;
      }

      // Keep enemies from stacking on top of each other.
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

    shoot() {
      this.fireCd = this.cooldown + rand(-0.12, 0.18);
      const shots = this.isBoss ? 5 : 1;
      const spread = this.isBoss ? 0.17 : 0.09;
      const baseAngle = Math.atan2(player.y - this.y, player.x - this.x);
      const mx = this.x + Math.cos(baseAngle) * 18;
      const my = this.y + Math.sin(baseAngle) * 18;
      for (let i = 0; i < shots; i++) {
        const angle = baseAngle + rand(-spread, spread);
        world.bullets.push({
          x: mx,
          y: my,
          prevX: mx,
          prevY: my,
          vx: Math.cos(angle) * (this.isBoss ? 570 : 640),
          vy: Math.sin(angle) * (this.isBoss ? 570 : 640),
          damage: this.damage,
          owner: 'enemy',
          color: this.isBoss ? '#ff3e6c' : '#ff7b68',
          life: this.isBoss ? 1.0 : 0.8,
          maxLife: this.isBoss ? 1.0 : 0.8
        });
      }
      this.muzzleFlash = 0.08;
      addParticle(mx, my, this.isBoss ? '#ff5b8a' : '#ffb25f', this.isBoss ? 6 : 2, 55, 2, 0.13);
      playSound('enemyShoot');
    }

    takeDamage(amount, hitAngle) {
      if (this.dead) return;
      this.hp -= amount;
      this.hitFlash = 0.12;
      this.state = 'chase';
      this.alertTimer = 4;
      this.lastSeen = { x: player.x, y: player.y };
      addParticle(this.x, this.y, '#ff6d78', 5, 75, 2, 0.4);
      addFloatText(this.x + rand(-6, 6), this.y - 18, `-${Math.round(amount)}`, '#ff9aa4');
      playSound('hit');
      showHitMarker(this.hp <= 0);
      if (this.hp <= 0) this.die();
    }

    die() {
      if (this.dead) return;
      this.dead = true;
      this.hp = 0;
      raid.kills += 1;
      gainRaidXP(this.xp, true);
      raid.scrap += this.scrap;
      addParticle(this.x, this.y, '#b83d52', 12, 110, 3, 0.8);
      addParticle(this.x, this.y, '#2e3645', 8, 65, 3, 0.6);
      addFloatText(this.x, this.y - 28, `+${this.xp} XP`, '#d6ff4d');
      addLootFeed(this.isBoss ? `BOSS 已击败！ +${this.xp} XP` : `击倒敌人 +${this.xp} XP`, this.isBoss);

      rollEnhanceStoneDrop(this);

      if (this.isBoss) {
        world.pickups.push({
          x: this.x,
          y: this.y,
          type: 'item',
          item: createItem('w_boss'),
          life: 999,
          bob: rand(0, TAU),
          bossDrop: true
        });
        addFloatText(this.x, this.y - 48, '终焉协议已掉落', '#ffd15c');
        addLootFeed('专属武器「终焉协议」已掉落', true);
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

  function updatePickups(dt) {
    for (let i = world.pickups.length - 1; i >= 0; i--) {
      const p = world.pickups[i];
      p.life -= dt;
      p.bob += dt * 3;
      if (p.life <= 0) {
        world.pickups.splice(i, 1);
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
        for (const enemy of world.enemies) {
          if (enemy.dead) continue;
          if (segmentHitsCircle(b.prevX, b.prevY, b.x, b.y, enemy.x, enemy.y, enemy.r + 2)) {
            enemy.takeDamage(b.damage, Math.atan2(b.vy, b.vx));
            world.shake = Math.max(world.shake, 2.4);
            hit = true;
            break;
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
    if (el.extractChoiceSub) {
      el.extractChoiceSub.textContent = `你已到达第 ${raid.floor} 层撤离点。继续深入会保留本局等级、成长与背包，但敌人和掉落都会随层数提升。`;
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
    const duration = type === 'search' ? 2.0 : 3.0;
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

  function updateRaid(dt) {
    if (!player || !raid || raid.ended) return;
    if (raid.paused) {
      updateHUD();
      return;
    }
    raid.timeLeft -= dt;
    raid.searchInterruptTimer = Math.max(0, raid.searchInterruptTimer - dt);
    updateRaidEvent(dt);
    if (raid.timeLeft <= 0) {
      raid.timeLeft = 0;
      endRaid(false, '行动超时，撤离通道关闭。');
      return;
    }

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
    if (raid.ended) return;
    updatePickups(dt);
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
    el.armorText.textContent = `护甲：${save.equipped.armor ? itemName(save.equipped.armor) : player.armor.name}`;
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
      el.raidObjective.textContent = `${riskDef().label} · F${raid.floor} · ${bossFloor ? '首领层' : `下个首领 F${nextBossFloor}`} · 撤离/下层`;
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
      el.raidTimer.textContent = `${mm}:${ss}`;
      el.raidTimer.classList.toggle('low', t <= 30);
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
      } else {
        el.bossHud.classList.add('hidden');
      }
    } else {
      el.bossHud.classList.add('hidden');
    }
  }

  function buildInventoryOverlay() {
    if (!player) return;
    const totalValue = player.backpack.reduce((sum, item) => sum + itemSellValue(item), 0);
    el.inventoryLoadout.innerHTML = `
      <div>主武器<strong>${save.equipped.weapon ? itemName(save.equipped.weapon) : player.weapon.name}</strong></div>
      <div>护甲<strong>${save.equipped.armor ? itemName(save.equipped.armor) : player.armor.name}</strong></div>
      <div>背包装备<strong>${player.pack ? `${player.pack.label} +${player.pack.bonus}${player.packPlus ? ` · 强化+${player.packPlus}` : ''}` : '未装备'} · ${player.backpack.length}/${player.capacity}</strong></div>
      <div>弹药<strong>${player.mag} / ${player.reserve}</strong></div>
      <div>医疗包<strong>×${player.medkits}</strong></div>
      <div>钥匙<strong>×${raid ? (raid.keys || 0) : 0}</strong></div>
      <div>携带估值<strong>+${totalValue}</strong></div>`;
    el.inventoryGrid.innerHTML = '';
    if (player.backpack.length === 0) {
      el.inventoryGrid.innerHTML = '<div class="inventory-empty">背包里什么也没有。去搜几个箱子吧。</div>';
      el.inventoryDetail.classList.add('hidden');
      return;
    }

    if (!player.backpack.some((item) => item.id === selectedInventoryItemId)) {
      selectedInventoryItemId = player.backpack[0].id;
    }

    for (const item of sortItemList(player.backpack)) {
      const def = defOf(item);
      const kindLabel = def.kind === 'weapon' ? '武器' : def.kind === 'armor' ? '护甲' : def.kind === 'pack' ? '背包' : def.kind === 'stone' ? '强化' : '物资';
      const selected = item.id === selectedInventoryItemId;
      const div = document.createElement('button');
      div.type = 'button';
      div.className = `inventory-item rarity-${def.rarity} ${selected ? 'selected' : ''}`;
      div.title = `${itemName(item)}：${def.desc}`;
      div.innerHTML = `
        <div class="inv-item-top">
          <span class="inv-kind">${kindLabel}</span>
          <span class="inv-rarity ${def.rarity}">${RARITY_LABEL[def.rarity]}</span>
        </div>
        <span class="slot-icon ${def.rarity === 'mythic' ? 'mythic-icon' : ''}" style="color:${choiceIconColor(def)}">${def.icon}</span>
        <span class="slot-name">${itemName(item)}</span>
        <span class="inv-qty">×${item.qty || 1}</span>
        ${['weapon', 'armor', 'pack'].includes(def.kind) ? `<span class="inv-compare">${gearCompareText(item).replace(/<[^>]+>/g, '')}</span>` : ''}`;
      div.addEventListener('click', () => {
        selectedInventoryItemId = item.id;
        buildInventoryOverlay();
      });
      el.inventoryGrid.appendChild(div);
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
      stats.push(`伤害 <b>${Math.round(w.damage * (1 + plus * ENHANCE_RULES.weapon.perLevel))}</b>${plus ? ` · 强化 +${plus}` : ''}`);
      stats.push(`弹匣 <b>${w.mag}</b>`);
      stats.push(w.auto || likelyTouch ? '全自动' : '半自动');
      stats.push(`射速 <b>${Math.round(60 / w.cooldown)}/min</b>`);
      if (w.pellets > 1) stats.push(`弹丸 <b>${w.pellets}</b>`);
      stats.push(`备弹 <b>${w.reserve}</b>`);
    } else if (def.kind === 'armor') {
      const a = ARMOR_DEFS[def.armor];
      const plus = enhanceLevel(selectedItem);
      stats.push(`伤害减免 <b>${Math.round(Math.min(0.75, a.reduction + plus * ENHANCE_RULES.armor.perLevel) * 100)}%</b>${plus ? ` · 强化 +${plus}` : ''}`);
      if (a.speedBonus) stats.push(`移速 <b>+${Math.round(a.speedBonus * 100)}%</b>`);
      if (a.medkitBonus) stats.push(`医疗包 <b>+${a.medkitBonus}</b>`);
      if (a.stealth) stats.push(`敌人视野 <b>-${Math.round((1 - a.stealth) * 100)}%</b>`);
    } else if (def.kind === 'pack') {
      const pack = PACK_QUALITIES[def.pack];
      const plus = enhanceLevel(selectedItem);
      stats.push(`品质 <b>${pack.label}</b>`);
      stats.push(`容量 <b>+${pack.bonus + plus}</b>${plus ? ` · 强化 +${plus}` : ''}`);
      stats.push('撤离后在仓库装备');
    } else if (def.kind === 'stone') {
      stats.push(`等级 <b>Lv.${def.stoneLevel}</b>`);
      stats.push(`强化成功率 <b>${Math.round(def.success * 100)}%</b>`);
      stats.push('回到基地强化台使用');
    } else {
      stats.push(`数量 <b>×${selectedItem.qty || 1}</b>`);
      stats.push(`单价 <b>+${def.sell}</b>`);
    }
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
      ${['weapon', 'armor', 'pack'].includes(def.kind) ? `<div class="inventory-detail-compare">${gearCompareText(selectedItem)}</div>` : ''}`;
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
    if (!player) {
      player = new Player(world.spawn.x, world.spawn.y);
    } else {
      player.x = world.spawn.x;
      player.y = world.spawn.y;
      player.lockTarget = null;
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
    addLootFeed(world.boss
      ? `F${raid.floor} 首领层：${world.boss.name} 已出现。`
      : `F${raid.floor}：击倒金色钥匙守卫，获取 🔑 开启钥匙房宝箱。`, !!world.boss);
    updateHUD();
    updateBackpackHud();
    if (isFirstFloor) startRaidTutorial();
  }

  function startRaid() {
    Sound.init();
    if (likelyTouch && window.innerHeight > window.innerWidth) enterLandscapeFullscreen();
    save.stats.raids += 1;
    persist();

    world = null;
    player = null;
    raid = {
      timeLeft: 360,
      floor: 1,
      level: 1,
      xp: 0,
      pendingPerks: 0,
      perks: {},
      scrap: 0,
      keys: 0,
      kills: 0,
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
    addLootFeed(`${risk.label}行动开始 · 第 1 层：搜刮物资，寻找钥匙房宝箱。`, false);
    if (raid.event) {
      addLootFeed(`随机事件：${raid.event.label}${raid.event.timer > 0 ? `（${raid.event.timer}秒）` : ''}`, false);
      toast(`随机事件：${raid.event.label}`);
    }
    if (touch.ui) {
      toast('轻触右侧瞄准，长按开火自动锁定。击倒金色钥匙守卫，获取 🔑 开启钥匙房宝箱。');
      el.touchHint.classList.remove('fade');
      setTimeout(() => el.touchHint.classList.add('fade'), 5000);
    } else {
      toast('行动开始：本局从 LV.1 开始；首领每 5 层出现，金色守卫掉落钥匙。');
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
    const itemUnits = carried.reduce((n, i) => n + (i.qty || 1), 0);
    let scrapGain = 0;

    if (success) {
      for (const item of carried) addToStash(item);
      scrapGain = raid.scrap + 10 + raid.floor * 15 + Math.floor(Math.max(0, raid.timeLeft) / 90);
      save.scrap += scrapGain;
      save.stats.extracts += 1;
      save.stats.loot += itemUnits;
      playSound('extract');
    } else {
      save.stats.deaths += 1;
      playSound('hurt');
    }

    save.stats.kills += raid.kills;
    persist();
    renderAllBase();

    el.debriefTag.textContent = success ? 'EXTRACTION COMPLETE // 返回基地' : 'SIGNAL LOST // 行动失败';
    el.debriefTitle.textContent = success ? '成功撤离' : '行动失败';
    el.debriefTitle.classList.toggle('fail', !success);
    el.debriefSub.textContent = reason + (success
      ? ` 行动用时 ${formatDuration((performance.now() - raid.startedAt) / 1000)}。本局等级与成长会在返回基地后重置。`
      : ' 本局等级、成长和携带物资全部丢失，再进入会从 LV.1 开始。');
    el.debriefStats.innerHTML = `
      <div><span>击倒敌人</span><strong>${raid.kills}</strong></div>
      <div><span>${success ? '带回物资' : '损失物资'}</span><strong>${itemUnits}</strong></div>
      <div><span>${success ? '获得废料' : '本局等级'}</span><strong>${success ? `+${scrapGain}` : `LV.${raid.level}`}</strong></div>
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
    runSpan.textContent = `本局 LV.${raid.level} · F${raid.floor}${perkSummary ? ` · ${perkSummary}` : ''} · 撤出后重置`;
    el.debriefLoot.appendChild(runSpan);

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
  function drawRaid() {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    if (!world || !player) return;

    const shakeX = save.settings.screenShake === false ? 0 : (Math.random() - 0.5) * world.shake;
    const shakeY = save.settings.screenShake === false ? 0 : (Math.random() - 0.5) * world.shake;
    const camX = Math.round(camera.x + shakeX);
    const camY = Math.round(camera.y + shakeY);

    ctx.save();
    ctx.translate(-camX, -camY);

    ctx.drawImage(world.mapCanvas, 0, 0);
    drawExtraction();
    drawAltExtraction();
    drawKeyRoom();
    for (const c of world.containers) if (isPointVisible(c.x, c.y)) drawContainer(c);
    for (const p of world.pickups) if (isPointVisible(p.x, p.y)) drawPickup(p);
    for (const bullet of world.bullets) drawBullet(bullet);
    for (const enemy of world.enemies) if (!enemy.dead && isPointVisible(enemy.x, enemy.y)) drawCharacter(enemy, false);
    drawCharacter(player, true);
    drawLockOn();
    for (const p of world.particles) drawParticle(p);
    for (const t of world.floatTexts) drawFloatText(t);

    ctx.restore();

    drawFogOfWar(camX, camY);

    // Vignette / atmosphere. Cache the gradient instead of rebuilding it every frame.
    if (!save.settings.performanceMode) {
      if (!raidVignetteGradient) {
        raidVignetteGradient = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.82);
        raidVignetteGradient.addColorStop(0, 'rgba(0,0,0,0)');
        raidVignetteGradient.addColorStop(1, 'rgba(0,0,0,.56)');
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

    if (world.time - lastMinimapDraw >= 0.05) {
      lastMinimapDraw = world.time;
      drawMinimap();
    }
    drawCrosshair();
  }

  function drawFogOfWar(camX, camY) {
    const px = player.x - camX;
    const py = player.y - camY;
    const fog = ctx.createRadialGradient(px, py, VISION_RADIUS * 0.24, px, py, VISION_RADIUS);
    fog.addColorStop(0, 'rgba(3,7,11,0)');
    fog.addColorStop(0.62, 'rgba(3,7,11,.08)');
    fog.addColorStop(0.84, 'rgba(3,7,11,.55)');
    fog.addColorStop(1, 'rgba(3,7,11,.94)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
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
    ctx.restore();
  }

  function drawBullet(b) {
    const tx = b.x - b.vx * 0.016;
    const ty = b.y - b.vy * 0.016;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = b.owner === 'player' ? 2 : 1.5;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
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
    const hpPct = clamp(entity.hp / entity.maxHp, 0, 1);
    const barW = isPlayer ? 40 : isBoss ? 64 : 32;
    const barH = isPlayer ? 5 : isBoss ? 6 : 4;
    const barY = isPlayer ? -30 : isBoss ? -44 : -28;
    let barColor;
    if (hpPct > 0.55) barColor = isPlayer ? '#d6ff4d' : '#e45363';
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

    if (isPlayer) {
      // A faint player ring helps readability in corridors.
      ctx.strokeStyle = 'rgba(214,255,77,.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, TAU);
      ctx.stroke();
    } else if (isBoss) {
      ctx.strokeStyle = 'rgba(255,62,108,.42)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#ff5b7f';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BOSS', 0, barY - 7);
    } else if (entity.state === 'chase') {
      ctx.fillStyle = '#ff9c47';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, barY - 7);
    }

    if (!isPlayer && entity.elite) {
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
      }
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

    ctx.rotate(entity.angle || 0);

    if (isPlayer) {
      // Backpack.
      ctx.fillStyle = '#1f2a38';
      ctx.fillRect(-12, -8, 7, 16);
      // Legs.
      ctx.fillStyle = '#2a3545';
      ctx.fillRect(-7 + bob * 0.5, -8, 6, 10);
      ctx.fillRect(-7 - bob * 0.5, 1, 6, 10);
      // Torso.
      ctx.fillStyle = '#41556e';
      ctx.fillRect(-6, -9, 13, 18);
      ctx.fillStyle = '#d6ff4d';
      ctx.fillRect(-4, -7, 3, 12);
      ctx.fillStyle = '#28384a';
      ctx.fillRect(-6, 5, 13, 4);
      // Head.
      ctx.fillStyle = '#b9c8d9';
      ctx.fillRect(4, -7, 9, 9);
      ctx.fillStyle = '#d6ff4d';
      ctx.fillRect(9, -5, 3, 3);
      // Weapon.
      ctx.fillStyle = '#111820';
      ctx.fillRect(8, 1, 15, 4);
      ctx.fillStyle = player.weapon.color;
      ctx.fillRect(20, 1, 6, 3);
      ctx.fillStyle = '#303b4b';
      ctx.fillRect(10, -1, 7, 3);
      // Muzzle flash.
      if (player.fireCd > player.weapon.cooldown - 0.045 && player.mag >= 0) {
        ctx.fillStyle = '#ffe08a';
        ctx.fillRect(26, 1, 6, 4);
      }
    } else {
      if (isBoss) ctx.scale(1.45, 1.45);
      // Enemy legs.
      ctx.fillStyle = '#2b2229';
      ctx.fillRect(-7 + bob * 0.5, -8, 6, 10);
      ctx.fillRect(-7 - bob * 0.5, 1, 6, 10);
      // Enemy torso.
      ctx.fillStyle = entity.hitFlash > 0 ? '#fff2f3' : entity.color;
      ctx.fillRect(-6, -9, 13, 18);
      ctx.fillStyle = '#3a2029';
      ctx.fillRect(-6, 4, 13, 5);
      if (isBoss) {
        ctx.fillStyle = '#ffd15c';
        ctx.fillRect(-9, -14, 18, 4);
        ctx.fillRect(-12, -11, 4, 8);
        ctx.fillRect(8, -11, 4, 8);
      }
      // Head.
      ctx.fillStyle = entity.hitFlash > 0 ? '#ffffff' : '#70313d';
      ctx.fillRect(4, -7, 9, 9);
      ctx.fillStyle = '#ffb58b';
      ctx.fillRect(9, -5, 3, 3);
      // Gun.
      ctx.fillStyle = '#10151c';
      ctx.fillRect(8, 1, 14, 4);
      if (entity.muzzleFlash > 0) {
        ctx.fillStyle = isBoss ? '#ff5b8a' : '#ffce7a';
        ctx.fillRect(22, 0, 6, 5);
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
      const nx = distance > 0.001 ? dx / distance : 0;
      const ny = distance > 0.001 ? dy / distance : 0;
      const rawMag = padRadius > 0 ? Math.min(1, distance / padRadius) : 0;
      const deadZone = 0.06;
      const mag = rawMag > deadZone ? clamp((rawMag - deadZone) / (1 - deadZone), 0, 1) : 0;
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
      target.addEventListener('pointermove', (event) => {
        if (event.pointerId !== pointerId || target !== activeTarget) return;
        move(event);
        event.preventDefault();
      });
      target.addEventListener('pointerup', end);
      target.addEventListener('pointercancel', end);
      target.addEventListener('lostpointercapture', end);
    };

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
      if (['w', 'a', 's', 'd', 'e', 'r', 'f', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        e.preventDefault();
      }
      keys[k] = true;
      if (!e.repeat && player && raid && !raid.paused && !raid.ended) {
        if (k === 'f') player.useMedkit();
        if (k === 'r') player.startReload();
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

  el.startRaidBtn.addEventListener('click', startRaid);
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
    const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;

    if (mode === 'raid' || mode === 'debrief') {
      if (mode === 'raid') updateRaid(dt);
      if (world && player) drawRaid();
    }
    requestAnimationFrame(frame);
  }

  // Small debug bridge used by the local smoke test. It does not affect play.
  window.__PX = {
    startRaid,
    endRaid,
    snapshot() {
      return {
        mode,
        save: JSON.parse(JSON.stringify(save)),
        settings: JSON.parse(JSON.stringify(save.settings)),
        lockTarget: player && player.lockTarget ? { x: player.lockTarget.x, y: player.lockTarget.y, kind: player.lockTarget.kind, dead: player.lockTarget.dead } : null,
        player: player ? {
          x: player.x, y: player.y, hp: player.hp, maxHp: player.maxHp,
          mag: player.mag, reserve: player.reserve, medkits: player.medkits,
          backpack: JSON.parse(JSON.stringify(player.backpack)),
          weapon: player.weaponKey, armor: player.armorKey, pack: player.packKey, capacity: player.capacity,
          weaponPlus: player.weaponPlus, armorPlus: player.armorPlus, packPlus: player.packPlus,
          damageMultiplier: player.damageMultiplier, weaponDamage: player.weapon.damage * player.damageMultiplier,
          armorReduction: player.armor.reduction, packBonus: player.pack ? player.pack.bonus : 0
        } : null,
        raid: raid ? { ...raid, perkChoices: pendingPerkChoices.slice() } : null,
        touch: { ui: touch.ui, moveX: touch.moveX, moveY: touch.moveY, moveMag: touch.moveMag, aiming: touch.aiming, firing: touch.firing, angle: touch.aimAngle, aimPressAt: touch.aimPressAt },
        world: world ? {
          spawn: world.spawn,
          extraction: { x: world.extraction.x, y: world.extraction.y, r: world.extraction.r },
          altExtraction: world.altExtraction ? { x: world.altExtraction.x, y: world.altExtraction.y, r: world.altExtraction.r, timeLeft: world.altExtraction.timeLeft } : null,
          containers: world.containers.map((c) => ({ x: c.x, y: c.y, searched: c.searched, rarity: c.rarity, progress: c.progress || 0, locked: !!c.locked, vault: !!c.vault })),
          enemies: world.enemies.map((e) => ({ x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, state: e.state, dead: e.dead, kind: e.kind, name: e.name, carriesKey: !!e.carriesKey, elite: !!e.elite })),
          boss: world.boss ? { x: world.boss.x, y: world.boss.y, hp: world.boss.hp, maxHp: world.boss.maxHp, dead: world.boss.dead, state: world.boss.state, name: world.boss.name } : null,
          bossPresent: !!world.boss,
          keyChest: world.keyChest ? { x: world.keyChest.x, y: world.keyChest.y, locked: !!world.keyChest.locked, searched: !!world.keyChest.searched } : null,
          roomCount: world.rooms.length,
          containerCount: world.containers.length,
          mapTiles: [MAP_W, MAP_H],
          exploredCount: world.explored ? world.explored.reduce((sum, v) => sum + v, 0) : 0,
          trailLength: world.trail ? world.trail.length : 0,
          visibleEnemies: world.enemies.filter((e) => !e.dead && isPointVisible(e.x, e.y)).length,
          pickups: world.pickups.map((p) => ({ x: p.x, y: p.y, type: p.type, amount: p.amount || 0, itemType: p.item?.type || null, itemName: p.item ? itemName(p.item) : null }))
        } : null
      };
    },
    setKey(key, down) { keys[key.toLowerCase()] = !!down; },
    teleport(x, y) { if (player) { player.x = x; player.y = y; } },
    hurt(amount, sourceAngle = null) { if (player) player.takeDamage(amount, sourceAngle); },
    enableTouch() { enableTouchUI(); },
    touchMove(x, y, mag) { touch.moveX = x; touch.moveY = y; touch.moveMag = mag; touch.moveTargetMag = mag; },
    touchAim(x, y, mag) {
      touch.aimAngle = Math.atan2(y, x);
      touch.aimTargetAngle = touch.aimAngle;
      touch.aimMag = mag;
      touch.hasAim = true;
      touch.aiming = mag > 0.16;
      touch.aimPressAt = performance.now();
    },
    damageBoss(amount) { if (world && world.boss && !world.boss.dead) world.boss.takeDamage(amount, 0); },
    damageEnemy(index, amount = 9999) { const enemy = world && world.enemies[index]; if (enemy && !enemy.dead) enemy.takeDamage(amount, 0); },
    grantKeys(count = 1) { if (raid && !raid.ended) { raid.keys = (raid.keys || 0) + Math.max(0, Math.floor(count)); updateHUD(); } },
    grantStone(type = 'stone_white', count = 1) {
      addToStash(createItem(type, Math.max(1, Math.floor(count))));
      persist();
      renderAllBase();
      return this.snapshot();
    },
    enhanceEquipped(slot = 'weapon', stoneType = 'stone_white') {
      enhanceTargetSlot = ['weapon', 'armor', 'pack'].includes(slot) ? slot : 'weapon';
      useEnhanceStone(stoneType);
      return this.snapshot();
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
    perkChoices() { return pendingPerkChoices.slice(); }
  };
  renderAllBase();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
  const autoStart = new URLSearchParams(location.search).get('autostart');
  if (autoStart === '1') setTimeout(startRaid, 120);
  requestAnimationFrame(frame);
})();
