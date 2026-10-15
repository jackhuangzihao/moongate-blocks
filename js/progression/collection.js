// 庭院收藏：花木、陈设、纪念三条线并行。
// 花木跟着庭院累计消除生长（每消除一行、一列或一宫记一次，每局都算，不只看最高分）；
// 陈设用闯关星数添置。解锁的物件画进首页的月洞门插画里，不进棋盘。
const KEY = 'fangcunGardenCollectionV1';
const ITEMS = [
  { id: 'bamboo', track: 'clears', need: 1, name: '修竹', note: '墙外添了一丛竹' },
  { id: 'plum', track: 'clears', need: 20, name: '梅花', note: '院中老树开了花' },
  { id: 'lotus', track: 'clears', need: 80, name: '荷花缸', note: '门内摆上一缸荷' },
  { id: 'pine', track: 'clears', need: 200, name: '古松', note: '松枝探过了院墙' },
  { id: 'lamp', track: 'stars', need: 12, name: '石灯', note: '山石旁立一盏灯' },
  { id: 'lantern', track: 'stars', need: 36, name: '红灯笼', note: '月门挂起灯笼' },
  { id: 'swallows', track: 'stars', need: 72, name: '双燕', note: '两只燕子飞进院来' },
  { id: 'moon', track: 'stars', need: 108, name: '满月', note: '积满一百零八颗星' },
  { id: 'arbour', track: 'memorial', need: 12, name: '花架', note: '藤花垂落，记下满庭花开', requirement: '第四章基础 12 关通关' },
  { id: 'plaque', track: 'memorial', need: 48, name: '庭间匾额', note: '方寸之间，基础小径皆三星', requirement: '前四章基础 48 关全部三星' },
  { id: 'chime', track: 'memorial', need: 7, name: '风铃', note: '七次重逢，檐下一声清响', requirement: '每日精选累计完成 7 天' },
  { id: 'bridge', track: 'memorial', need: 21, name: '小桥', note: '二十一日相遇，院前添座小桥', requirement: '每日精选累计完成 21 天' },
  { id: 'keyCharm', track: 'memorial', need: 12, name: '钥匙挂饰', note: '启扉寻幽，一把金钥留在庭间', requirement: '第五章基础 12 关通关' }
];
const CHAPTER_ITEMS = ['arbour', 'plaque', 'keyCharm'];
const TRACKS = [
  { id: 'clears', title: '花木', source: '庭院累计消除', unit: '次' },
  { id: 'stars', title: '陈设', source: '闯关星数', unit: '颗星' },
  { id: 'memorial', title: '纪念', source: '章节成就与每日精选', unit: '' }
];

function normalize(stored) {
  const collection = { version: 1, clears: 0, seen: [], hidden: [] };
  if (!stored || stored.version !== 1) return collection;
  if (Number.isSafeInteger(stored.clears) && stored.clears >= 0) collection.clears = stored.clears;
  if (Array.isArray(stored.seen)) collection.seen = ITEMS.map(item => item.id).filter(id => stored.seen.includes(id));
  if (Array.isArray(stored.hidden)) collection.hidden = ITEMS.map(item => item.id).filter(id => stored.hidden.includes(id));
  if (ITEMS.some(item => item.id === stored.target)) collection.target = stored.target;
  if (Number.isSafeInteger(stored.dailyCompletions) && stored.dailyCompletions > 0) collection.dailyCompletions = stored.dailyCompletions;
  if (Array.isArray(stored.achievements)) {
    const earned = CHAPTER_ITEMS.filter(id => stored.achievements.includes(id));
    if (earned.length) collection.achievements = earned;
  }
  if (stored.chapterCounts && typeof stored.chapterCounts === 'object') {
    for (const id of CHAPTER_ITEMS) {
      const n = stored.chapterCounts[id], need = ITEMS.find(item => item.id === id).need;
      if (Number.isSafeInteger(n) && n >= 0 && n <= need) {
        if (!collection.chapterCounts) collection.chapterCounts = {};
        collection.chapterCounts[id] = n;
      }
    }
  }
  return collection;
}
// 新成就只追加，不因更新后的计数、漏一天或旧章节存档缺失而收回纪念品。
function syncProgress(collection, context = {}) {
  let changed = false;
  if (!context || typeof context !== 'object') return changed;
  for (const [key, id] of [['chapterFourComplete', 'arbour'], ['allStars', 'plaque'], ['chapterFiveComplete', 'keyCharm']]) {
    if (context[key] === true && !(collection.achievements || []).includes(id)) {
      collection.achievements = (collection.achievements || []).concat(id); changed = true;
    }
  }
  for (const id of CHAPTER_ITEMS) {
    const n = context.chapterCounts && context.chapterCounts[id], need = ITEMS.find(item => item.id === id).need;
    if (Number.isSafeInteger(n) && n >= 0 && n <= need && n !== (collection.chapterCounts || {})[id]) {
      collection.chapterCounts = { ...collection.chapterCounts, [id]: n }; changed = true;
    }
    if (n === need && !(collection.achievements || []).includes(id)) {
      collection.achievements = (collection.achievements || []).concat(id); changed = true;
    }
  }
  if (Number.isSafeInteger(context.dailyCompletions) && context.dailyCompletions > (collection.dailyCompletions || 0)) {
    collection.dailyCompletions = context.dailyCompletions; changed = true;
  }
  return changed;
}
function totalStars(progress) { return progress.stars.reduce((sum, n) => sum + n, 0); }
function amount(item, collection, stars) {
  if (item.track === 'clears') return collection.clears;
  if (item.track === 'stars') return stars;
  return CHAPTER_ITEMS.includes(item.id)
    ? ((collection.achievements || []).includes(item.id) ? item.need : (collection.chapterCounts || {})[item.id] || 0)
    : collection.dailyCompletions || 0;
}
function requirement(item, collection, stars) {
  const remaining = Math.max(0, item.need - amount(item, collection, stars));
  if (!remaining) return '已解锁';
  if (CHAPTER_ITEMS.includes(item.id)) return `${item.id === 'plaque' ? '前四章基础三星' : item.id === 'arbour' ? '第四章基础' : '第五章基础'} ${item.need - remaining}/${item.need} 关`;
  if (item.track === 'memorial') return `每日精选再完成 ${remaining} 天`;
  return `还差 ${remaining} ${item.track === 'clears' ? '次消除' : '颗星'}`;
}
function unlocked(collection, stars) {
  return ITEMS.filter(item => amount(item, collection, stars) >= item.need).map(item => item.id);
}
function displayed(collection, stars) {
  return unlocked(collection, stars).filter(id => !(collection.hidden || []).includes(id));
}
function fresh(collection, stars) {
  return unlocked(collection, stars).filter(id => !collection.seen.includes(id));
}
function named(id) { return ITEMS.find(item => item.id === id).name; }
// 某条线上下一件还没解锁的物件，以及还差多少；全部解锁时返回 null。
function next(collection, stars, track) {
  const item = ITEMS.find(entry => entry.track === track && amount(entry, collection, stars) < entry.need);
  return item ? { item, missing: item.need - amount(item, collection, stars) } : null;
}
// A completed target remains readable until the UI acknowledges the reward.
// Missing targets in pre-feature saves behave exactly like an unselected target.
function target(collection, stars) {
  const item = ITEMS.find(entry => entry.id === collection.target);
  if (!item) return null;
  const missing = Math.max(0, item.need - amount(item, collection, stars));
  return { item, missing, complete: missing === 0 };
}
function setTarget(collection, id, stars) {
  if (id === null) {
    if (!collection.target) return false;
    collection.target = null;
    return true;
  }
  const item = ITEMS.find(entry => entry.id === id);
  if (!item || amount(item, collection, stars) >= item.need) return false;
  collection.target = collection.target === id ? null : id;
  return true;
}
// 结算页、首页共用：优先自选目标；未选择时沿用新物件和下一件进度。
function progressLine(collection, stars, track) {
  const selected = target(collection, stars);
  if (selected) return selected.complete ? `目标达成 · 已获得「${selected.item.name}」`
    : `目标「${selected.item.name}」· ${requirement(selected.item, collection, stars)}`;
  const unseen = fresh(collection, stars).filter(id => ITEMS.find(item => item.id === id).track === track);
  if (unseen.length) return `庭院新添「${named(unseen[0])}」${unseen.length>1?`等 ${unseen.length} 件 `:''}· 回首页看看`;
  const upcoming = next(collection, stars, track);
  if (!upcoming) return track === 'clears' ? '庭院花木已齐 · 不限时，也不必赶进度' : track === 'stars' ? '庭院陈设已齐' : '庭间纪念已齐';
  return track === 'clears' ? `再消除 ${upcoming.missing} 次，庭院将添「${upcoming.item.name}」`
    : track === 'stars' ? `再得 ${upcoming.missing} 颗星，庭院将添「${upcoming.item.name}」`
    : `${requirement(upcoming.item, collection, stars)}，庭院将添「${upcoming.item.name}」`;
}

function focus(collection, stars, track) {
  const chosen = target(collection, stars);
  const dailyItem = track === 'memorial' && ITEMS.find(item => item.track === track
    && !CHAPTER_ITEMS.includes(item.id) && amount(item, collection, stars) < item.need);
  const upcoming = chosen || (track === 'memorial' ? dailyItem && {item:dailyItem} : next(collection, stars, track));
  if (!upcoming) return null;
  const item = upcoming.item, have = Math.min(item.need, amount(item, collection, stars));
  const unit = item.track === 'clears' ? '次消除' : item.track === 'stars' ? '颗星'
    : CHAPTER_ITEMS.includes(item.id) ? '关' : '天';
  return { item, have, progress: `${have}/${item.need} ${unit}`, complete: have >= item.need, text: `${have >= item.need ? '已添' : '想添'}「${item.name}」· ${have}/${item.need} ${unit}` };
}

// Growth is a view of existing progress, never a second reward balance.
function growth(collection, stars, track='clears') {
  const focusItem=focus(collection,stars,track);
  if(!focusItem)return null;
  const {item,have,complete}=focusItem;
  const ratio=Math.max(0,Math.min(1,have/item.need));
  const stage=complete?2:ratio>=.5?1:0;
  return {...focusItem,ratio,stage,label:['初见雏形','渐渐成形','已成庭景'][stage]};
}
function growthResult(collection, stars, sessionClears) {
  if(!Number.isSafeInteger(sessionClears) || sessionClears<=0)return null;
  const before={...collection,clears:Math.max(0,collection.clears-sessionClears)};
  const previous=growth(before,stars);
  if(!previous || previous.item.track!=='clears' || previous.complete)return null;
  const current=growth({...collection,target:previous.item.id},stars);
  return { ...current, before:previous.have,
    text:`${current.item.name} ${previous.have} → ${current.have}/${current.item.need} · ${current.label}` };
}

function focusForState(state) {
  if (!state.collection || !state.challengeProgress) return null;
  const run = state.screen === 'playing' ? state.challenge : null;
  return focus(state.collection,totalStars(state.challengeProgress),
    run && run.dailyDate ? 'memorial' : run || state.homeMode==='challenge' ? 'stars' : 'clears');
}

function growthForState(state) {
  return growth(state.collection,totalStars(state.challengeProgress));
}

module.exports = { focusForState, growthForState, KEY, ITEMS, TRACKS, normalize, syncProgress, totalStars, amount, requirement, unlocked, displayed, fresh, named, next, target, setTarget, progressLine, focus, growth, growthResult };
