/* ============================================================================
   DAPUR BARA — Wok Rush
   Original cooking game: take orders, cook at 4 stations, assemble, serve.
   All art is CSS + emoji glyphs; all sounds are synthesized WebAudio.
   No network requests. Keyboard + mouse. Single file, no dependencies.
   ============================================================================ */
"use strict";

/* ---------------- Data: ingredients, stations, recipes ---------------- */

const INGREDIENTS = [
  { id: "nasi",   name: "Nasi",   icon: "🍚", station: "wok",    cookMs: 4200, key: "1" },
  { id: "mie",    name: "Mie",    icon: "🍜", station: "wok",    cookMs: 3800, key: "2" },
  { id: "telur",  name: "Telur",  icon: "🥚", station: "wok",    cookMs: 3000, key: "3" },
  { id: "ayam",   name: "Ayam",   icon: "🍗", station: "grill",  cookMs: 6000, key: "4" },
  { id: "cabai",  name: "Cabai",  icon: "🌶️", station: "chop",   cookMs: 2200, key: "5" },
  { id: "sayur",  name: "Sayur",  icon: "🥬", station: "chop",   cookMs: 2200, key: "6" },
  { id: "teh",    name: "Teh",    icon: "🍵", station: "pot",    cookMs: 3500, key: "7" },
  { id: "es",     name: "Es",     icon: "🧊", station: "direct", cookMs: 0,    key: "8" },
];
const ING = {};
INGREDIENTS.forEach((g) => { ING[g.id] = g; });

const STATIONS = [
  { id: "chop",  name: "🔪 Talenan",  icon: "🔪", key: "Z", accepts: ["chop"],  hint: "Iris cabai & sayur" },
  { id: "wok",   name: "🍳 Wok Api",  icon: "🍳", key: "X", accepts: ["wok"],   hint: "Tumis nasi, mie, telur" },
  { id: "grill", name: "♨️ Grill Bara", icon: "♨️", key: "C", accepts: ["grill"], hint: "Bakar ayam sampai juicy" },
  { id: "pot",   name: "🍲 Panci Soto", icon: "🍲", key: "V", accepts: ["pot"],   hint: "Rebus teh & kuah" },
];
const STN = {};
STATIONS.forEach((s) => { STN[s.id] = s; });

/* A recipe step = one ingredient, cooked at its station (or direct). */
const RECIPES = [
  { id: "nasgor", name: "Nasi Goreng", icon: "🍚", price: 12,
    steps: ["nasi", "telur", "cabai"], blurb: "Wok + telur + cabai" },
  { id: "miegor", name: "Mie Goreng", icon: "🍜", price: 12,
    steps: ["mie", "telur", "sayur"], blurb: "Wok + telur + sayur" },
  { id: "sate",   name: "Sate Ayam", icon: "🍢", price: 14,
    steps: ["ayam", "cabai"], blurb: "Grill + cabai" },
  { id: "geprek", name: "Ayam Geprek", icon: "🍗", price: 15,
    steps: ["ayam", "cabai", "nasi"], blurb: "Grill + cabai + nasi" },
  { id: "soto",   name: "Soto Ayam", icon: "🍲", price: 16,
    steps: ["ayam", "teh", "sayur"], blurb: "Panci + teh kuah + sayur" },
  { id: "esteh",  name: "Es Teh Manis", icon: "🧋", price: 8,
    steps: ["teh", "es"], blurb: "Teh panas + es batu" },
];
const RECIPE = {};
RECIPES.forEach((r) => { RECIPE[r.id] = r; });

const SHIFT_SECONDS = 150;
const BURN_AFTER_MS = 6000;   /* cooked food burns if left this long */
const START_STOCK = 6;
const RESTOCK_COST = 5;
const RESTOCK_AMOUNT = 4;

/* ---------------- Audio: synthesized WebAudio, no assets ---------------- */

const AudioSys = {
  ctx: null, muted: false,
  ensure: function () {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === "suspended") { this.ctx.resume(); }
    return this.ctx;
  },
  tone: function (freq, dur, type, vol, when) {
    if (this.muted) { return; }
    const ctx = this.ensure();
    if (!ctx) { return; }
    const t0 = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol || 0.12, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  },
  noise: function (dur, vol) {
    if (this.muted) { return; }
    const ctx = this.ensure();
    if (!ctx) { return; }
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) { data[i] = (Math.random() * 2 - 1) * (1 - i / len); }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = vol || 0.08;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass"; filter.frequency.value = 3000;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  },
  click: function () { this.tone(700, 0.06, "triangle", 0.08); },
  chop: function () { this.noise(0.08, 0.14); this.tone(180, 0.07, "square", 0.06); },
  sizzle: function () { this.noise(0.35, 0.06); },
  ding: function () { this.tone(880, 0.18, "sine", 0.14); this.tone(1318, 0.25, "sine", 0.12, 0.12); },
  coin: function () { this.tone(988, 0.09, "square", 0.09); this.tone(1319, 0.16, "square", 0.09, 0.08); },
  alarm: function () { this.tone(220, 0.16, "sawtooth", 0.12); this.tone(220, 0.16, "sawtooth", 0.12, 0.2); },
  fail: function () { this.tone(311, 0.25, "sawtooth", 0.1); this.tone(233, 0.35, "sawtooth", 0.1, 0.18); },
  win: function () {
    const notes = [523, 659, 784, 1047];
    for (let i = 0; i < notes.length; i++) { this.tone(notes[i], 0.22, "triangle", 0.13, i * 0.13); }
  },
};

/* ---------------- State ---------------- */

function freshStock() {
  const stock = {};
  INGREDIENTS.forEach((g) => { stock[g.id] = START_STOCK; });
  return stock;
}

const Game = {
  running: false, paused: false, over: false,
  level: 1, shift: 1,
  timeLeftMs: SHIFT_SECONDS * 1000,
  coins: 0, earned: 0, best: 0,
  combo: 0, maxCombo: 0,
  served: 0, servedTotal: 0, lost: 0, burned: 0,
  hearts: 3,
  stock: freshStock(),
  hand: null,              /* {kind:'raw'|'cooked', id} */
  selectedBin: null,
  selectedOrderId: null,
  plate: [],               /* cooked ingredient ids on the plate */
  orders: [],              /* {id, recipeId, patienceMs, maxPatienceMs, bornAt} */
  stations: {},            /* stationId -> {ingId, startedAt, cookMs, state:'cooking'|'done'|'burning', doneAt} */
  orderSeq: 0,
  spawnMs: 12000,
  lastSpawnAt: 0,
  startedAt: 0,
  tickTimer: null,
  demo: false,
};

try { Game.best = parseInt(localStorage.getItem("dapurBaraBest") || "0", 10) || 0; } catch (e) { Game.best = 0; }

function saveBest() {
  try { localStorage.setItem("dapurBaraBest", String(Game.best)); } catch (e) { /* private mode */ }
}

/* DOM helpers */
function $(id) { return document.getElementById(id); }
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) { n.className = cls; }
  if (text !== undefined && text !== null) { n.textContent = text; }
  return n;
}
function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return "0" + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
function fmtClock(ms) { return "⏱ " + fmtTime(ms); }

/* ---------------- Toast + floating scores ---------------- */

let toastTimer = null;
function toast(msg, ms) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove("show"); }, ms || 2200);
}
function floatScore(text, x, y) {
  const layer = $("float-layer");
  const n = el("div", "float-score", text);
  const stage = $("stage").getBoundingClientRect();
  n.style.left = (x - stage.left - 20) + "px";
  n.style.top = (y - stage.top - 10) + "px";
  layer.appendChild(n);
  setTimeout(function () { n.remove(); }, 1150);
}

/* ---------------- Rendering: bins, stations, orders, plate, HUD ---------------- */

function buildBins() {
  const wrap = $("bins");
  wrap.innerHTML = "";
  INGREDIENTS.forEach((g) => {
    const b = el("button", "bin");
    b.id = "bin-" + g.id;
    b.title = g.name + " → " + (g.station === "direct" ? "langsung ke piring" : STN[g.station].name);
    b.innerHTML = '<span class="bin-key">' + g.key + '</span>' +
      '<span class="bin-icon">' + g.icon + '</span>' +
      '<span class="bin-name">' + g.name + '</span>' +
      '<span class="bin-stock" id="stock-' + g.id + '">×' + Game.stock[g.id] + '</span>';
    b.addEventListener("click", function () { selectIngredient(g.id); });
    wrap.appendChild(b);
  });
}

function buildStations() {
  const wrap = $("stations");
  wrap.innerHTML = "";
  STATIONS.forEach((s) => {
    const d = el("div", "station");
    d.id = "stn-" + s.id;
    d.innerHTML =
      '<div class="station-head"><span class="station-name">' + s.name + '</span>' +
      '<span class="station-key">' + s.key + '</span></div>' +
      '<div class="station-body" id="stn-body-' + s.id + '">' + s.icon + '</div>' +
      '<div class="station-item" id="stn-item-' + s.id + '"></div>' +
      '<div class="station-bar"><div id="stn-bar-' + s.id + '"></div></div>' +
      '<div class="station-status" id="stn-status-' + s.id + '">' + s.hint + '</div>';
    d.addEventListener("click", function () { clickStation(s.id); });
    wrap.appendChild(d);
  });
}

function renderBins() {
  INGREDIENTS.forEach((g) => {
    const b = $("bin-" + g.id);
    const s = $("stock-" + g.id);
    if (!b || !s) { return; }
    s.textContent = "×" + Game.stock[g.id];
    s.classList.toggle("low", Game.stock[g.id] <= 2);
    b.classList.toggle("out", Game.stock[g.id] <= 0);
    b.classList.toggle("selected", Game.selectedBin === g.id);
  });
  $("btn-restock").disabled = Game.coins < RESTOCK_COST;
}

function renderStations() {
  STATIONS.forEach((s) => {
    const box = $("stn-" + s.id);
    const st = Game.stations[s.id];
    const body = $("stn-body-" + s.id);
    const item = $("stn-item-" + s.id);
    const bar = $("stn-bar-" + s.id);
    const status = $("stn-status-" + s.id);
    box.classList.remove("busy", "done", "burning", "accept");
    if (!st) {
      body.textContent = s.icon;
      item.textContent = "";
      bar.style.width = "0%";
      status.textContent = s.hint;
      if (Game.hand && Game.hand.kind === "raw" && STN[s.id].accepts.indexOf(ING[Game.hand.id].station) >= 0) {
        box.classList.add("accept");
      }
      return;
    }
    const g = ING[st.ingId];
    body.textContent = g.icon;
    item.textContent = g.name + (st.state === "done" ? " ✅ MATANG!" : st.state === "burning" ? " 🔥 GOSONG!" : "");
    if (st.state === "cooking") {
      const p = Math.min(1, (Date.now() - st.startedAt) / st.cookMs);
      bar.style.width = Math.round(p * 100) + "%";
      status.textContent = "Memasak… " + Math.ceil((st.cookMs - (Date.now() - st.startedAt)) / 1000) + " dtk";
      box.classList.add("busy");
    } else if (st.state === "done") {
      bar.style.width = "100%";
      const left = Math.max(0, BURN_AFTER_MS - (Date.now() - st.doneAt));
      status.textContent = "AMBIL! Gosong dalam " + Math.ceil(left / 1000) + " dtk";
      box.classList.add("done");
    } else {
      bar.style.width = "100%";
      status.textContent = "GOSONG! Klik untuk buang.";
      box.classList.add("burning");
    }
  });
}

function renderOrders() {
  const wrap = $("orders");
  wrap.innerHTML = "";
  $("orders-empty").style.display = Game.orders.length ? "none" : "block";
  Game.orders.forEach((o) => {
    const r = RECIPE[o.recipeId];
    const frac = Math.max(0, o.patienceMs / o.maxPatienceMs);
    const card = el("div", "order-card" + (o.id === Game.selectedOrderId ? " selected" : "") + (frac < 0.3 ? " urgent" : ""));
    card.id = "order-" + o.id;
    const icons = r.steps.map((id) => ING[id].icon).join("");
    card.innerHTML =
      '<div class="order-top"><span class="order-name">' + r.icon + " " + r.name + '</span>' +
      '<span class="order-tip">🪙 ' + tipFor(o) + '</span></div>' +
      '<div class="order-recipe">' + icons + '</div>' +
      '<div class="order-steps">' + r.blurb + ' · ' + r.steps.length + ' bahan</div>' +
      '<div class="order-patience"><div style="width:' + Math.round(frac * 100) + '%"></div></div>';
    card.addEventListener("click", function () { selectOrder(o.id); });
    wrap.appendChild(card);
  });
}

function renderPlate() {
  const items = $("plate-items");
  const empty = $("plate-empty");
  if (Game.plate.length === 0) {
    items.textContent = "";
    empty.style.display = "flex";
  } else {
    empty.style.display = "none";
    items.textContent = Game.plate.map((id) => ING[id].icon).join(" ");
  }
  const target = Game.selectedOrderId !== null
    ? Game.orders.find((o) => o.id === Game.selectedOrderId) : null;
  $("target-name").textContent = target ? RECIPE[target.recipeId].name : "— pilih pesanan —";
  const btn = $("btn-serve");
  const ready = plateMatchesTarget();
  btn.disabled = !ready || !Game.running || Game.paused;
  btn.classList.toggle("ready", ready);
  $("serve-hint").textContent = ready && target
    ? "· +" + tipFor(target) + " koin" : "";
  const hand = $("hand-content");
  if (!Game.hand) { hand.textContent = "kosong"; }
  else {
    const g = ING[Game.hand.id];
    hand.textContent = g.icon + " " + g.name + (Game.hand.kind === "cooked" ? " (matang ✅)" : " (mentah)");
  }
}

function renderHud() {
  $("hud-timer").textContent = fmtClock(Game.timeLeftMs);
  $("hud-timer").classList.toggle("low", Game.timeLeftMs <= 30000 && Game.running);
  $("hud-shift").innerHTML = "SHIFT " + Game.shift + ' <span class="hud-label">/ Hari ' + Game.shift + "</span>";
  const quota = quotaForLevel(Game.level);
  $("hud-quota").innerHTML = "🎯 " + Game.served + "/" + quota + ' <span class="hud-label">pesanan</span>';
  $("hud-coins").textContent = Game.coins;
  const comboEl = $("hud-combo");
  comboEl.textContent = "🔥 COMBO ×" + Math.max(1, Game.combo);
  comboEl.classList.toggle("hot", Game.combo >= 3);
  $("hud-hearts").textContent = "❤️".repeat(Math.max(0, Game.hearts)) + "🖤".repeat(Math.max(0, 3 - Game.hearts));
  $("level-num").textContent = Game.level;
  const need = Math.max(0, levelUpAt(Game.level) - Game.servedTotal);
  $("level-fill").style.width = Math.min(100, (Game.servedTotal / levelUpAt(Game.level)) * 100) + "%";
  $("level-sub").textContent = need > 0
    ? "Sajikan " + need + " hidangan lagi untuk naik level"
    : "Level maksimal — pertahankan combo!";
  $("score-today").textContent = Game.earned;
  $("score-best").textContent = Math.max(Game.best, Game.earned);
  $("btn-sound").textContent = AudioSys.muted ? "🔇" : "🔊";
}

function renderAll() {
  renderBins(); renderStations(); renderOrders(); renderPlate(); renderHud();
}

/* ---------------- Rules: quota, tips, level ---------------- */

function quotaForLevel(level) { return 6 + level * 2; }   /* L1: 8 */
function levelUpAt(level) { return level * 6; }            /* L1: 6 serves */
function patienceForLevel(level) { return Math.max(22000, 45000 - (level - 1) * 6000); }

function tipFor(order) {
  const r = RECIPE[order.recipeId];
  const frac = Math.max(0, order.patienceMs / order.maxPatienceMs);
  const tip = Math.round(r.price * (0.5 + frac));
  const mult = 1 + Math.min(4, Game.combo) * 0.25;
  return Math.round(tip * mult);
}

function plateMatchesTarget() {
  if (Game.selectedOrderId === null) { return false; }
  const order = Game.orders.find((o) => o.id === Game.selectedOrderId);
  if (!order) { return false; }
  const need = RECIPE[order.recipeId].steps.slice().sort().join(",");
  const have = Game.plate.slice().sort().join(",");
  return need === have;
}

/* ---------------- Player actions ---------------- */

function selectIngredient(id) {
  if (!Game.running || Game.paused || Game.over) { return; }
  AudioSys.ensure();
  if (Game.stock[id] <= 0) {
    toast("⚠️ Stok " + ING[id].name + " habis — beli stok dulu!");
    AudioSys.fail();
    return;
  }
  if (Game.hand) {
    toast("✋ Tangan penuh — taruh dulu di stasiun / piring.");
    return;
  }
  if (ING[id].station === "direct") {
    /* Es batu langsung ke piring, tanpa masak. */
    Game.stock[id]--;
    Game.plate.push(id);
    AudioSys.click();
    toast("🧊 Es masuk piring!");
    renderAll();
    return;
  }
  Game.stock[id]--;
  Game.hand = { kind: "raw", id: id };
  Game.selectedBin = id;
  AudioSys.click();
  const st = STN[ING[id].station];
  toast(ING[id].icon + " " + ING[id].name + " di tangan → klik " + st.name);
  renderAll();
}

function clickStation(stationId) {
  if (!Game.running || Game.paused || Game.over) { return; }
  AudioSys.ensure();
  const st = Game.stations[stationId];
  const station = STN[stationId];
  if (st && st.state === "burning") {
    delete Game.stations[stationId];
    Game.burned++;
    toast("🗑️ Masakan gosong dibuang.");
    AudioSys.fail();
    renderAll();
    return;
  }
  if (st && st.state === "done") {
    if (Game.hand) { toast("✋ Tangan penuh — kosongkan dulu."); return; }
    Game.hand = { kind: "cooked", id: st.ingId };
    delete Game.stations[stationId];
    AudioSys.ding();
    toast(ING[st.ingId].icon + " " + ING[st.ingId].name + " matang diambil → klik piring!");
    renderAll();
    return;
  }
  if (st && st.state === "cooking") {
    toast("⏳ Masih dimasak — tunggu sampai ✅.");
    return;
  }
  /* Empty station: start cooking what is in hand. */
  if (!Game.hand || Game.hand.kind !== "raw") {
    toast("Pilih bahan dulu di konter bawah, lalu klik " + station.name + ".");
    return;
  }
  const g = ING[Game.hand.id];
  if (station.accepts.indexOf(g.station) < 0) {
    toast("❌ " + g.name + " tidak dimasak di " + station.name + " — butuh " + STN[g.station].name + ".");
    AudioSys.fail();
    return;
  }
  Game.stations[stationId] = {
    ingId: g.id, startedAt: Date.now(), cookMs: g.cookMs, state: "cooking", doneAt: 0,
  };
  Game.hand = null;
  Game.selectedBin = null;
  if (g.station === "chop") { AudioSys.chop(); } else { AudioSys.sizzle(); }
  renderAll();
}

function clickPlateRemove(index) {
  if (!Game.running || Game.paused || Game.over) { return; }
  if (index < 0 || index >= Game.plate.length) { return; }
  const removed = Game.plate.splice(index, 1)[0];
  toast("🗑️ " + ING[removed].name + " dibuang dari piring.");
  AudioSys.click();
  renderAll();
}

function selectOrder(id) {
  if (!Game.running || Game.paused || Game.over) { return; }
  Game.selectedOrderId = id;
  const o = Game.orders.find((x) => x.id === id);
  AudioSys.click();
  if (o) { toast("🎯 Target: " + RECIPE[o.recipeId].name + " — susun " + RECIPE[o.recipeId].steps.map((s) => ING[s].icon).join(" ") + " di piring!"); }
  renderAll();
}

function serveDish() {
  if (!Game.running || Game.paused || Game.over) { return; }
  if (!plateMatchesTarget()) { return; }
  const order = Game.orders.find((o) => o.id === Game.selectedOrderId);
  const r = RECIPE[order.recipeId];
  const tip = tipFor(order);
  Game.coins += tip;
  Game.earned += tip;
  Game.combo++;
  Game.maxCombo = Math.max(Game.maxCombo, Game.combo);
  Game.served++;
  Game.servedTotal++;
  Game.orders = Game.orders.filter((o) => o.id !== order.id);
  Game.plate = [];
  Game.selectedOrderId = Game.orders.length ? Game.orders[0].id : null;
  AudioSys.coin();
  const btn = $("btn-serve").getBoundingClientRect();
  floatScore("+" + tip + " 🪙", btn.left + btn.width / 2, btn.top);
  toast("🎉 " + r.name + " tersaji! +" + tip + " koin" + (Game.combo >= 2 ? " · COMBO ×" + Game.combo : ""));
  if (Game.coins > Game.best) { Game.best = Game.coins; saveBest(); }
  checkLevelUp();
  renderAll();
}

function trashPlate() {
  if (!Game.running || Game.paused || Game.over) { return; }
  if (Game.plate.length === 0 && !Game.hand) { toast("Piring & tangan sudah kosong."); return; }
  Game.plate = [];
  Game.hand = null;
  Game.selectedBin = null;
  AudioSys.fail();
  toast("🗑️ Piring dikosongkan.");
  renderAll();
}

function restock() {
  if (!Game.running || Game.paused || Game.over) { return; }
  if (Game.coins < RESTOCK_COST) {
    toast("💰 Butuh " + RESTOCK_COST + " koin untuk beli stok (kamu punya " + Game.coins + ").");
    AudioSys.fail();
    return;
  }
  Game.coins -= RESTOCK_COST;
  INGREDIENTS.forEach((g) => { Game.stock[g.id] += RESTOCK_AMOUNT; });
  AudioSys.coin();
  toast("🛒 Stok +4 semua bahan!");
  renderAll();
}

function checkLevelUp() {
  const next = levelUpAt(Game.level);
  if (Game.servedTotal >= next && Game.level < 5) {
    Game.level++;
    Game.spawnMs = Math.max(6000, Game.spawnMs - 1500);
    toast("⭐ LEVEL " + Game.level + "! Pesanan datang lebih cepat — hadiah lebih besar!");
    AudioSys.win();
  }
}

/* ---------------- Orders: spawn, expiry ---------------- */

function unlockedRecipes() {
  /* Level 1: 3 resep; tiap level buka 1 resep baru sampai 6. */
  return RECIPES.slice(0, Math.min(RECIPES.length, 2 + Game.level));
}

function spawnOrder() {
  if (Game.orders.length >= 4) { return; }
  const pool = unlockedRecipes();
  const recipe = pool[Math.floor(Math.random() * pool.length)];
  const patience = patienceForLevel(Game.level);
  const order = {
    id: ++Game.orderSeq,
    recipeId: recipe.id,
    patienceMs: patience,
    maxPatienceMs: patience,
  };
  Game.orders.push(order);
  if (Game.selectedOrderId === null) { Game.selectedOrderId = order.id; }
  AudioSys.tone(660, 0.12, "triangle", 0.1);
  toast("📋 Pesanan baru: " + recipe.name + "!");
  renderOrders(); renderPlate();
}

function expireOrder(order) {
  Game.orders = Game.orders.filter((o) => o.id !== order.id);
  Game.lost++;
  Game.combo = 0;
  Game.hearts--;
  AudioSys.fail();
  toast("😤 Pelanggan " + RECIPE[order.recipeId].name + " kabur! Combo hangus, ❤️ -1.");
  if (Game.selectedOrderId === order.id) {
    Game.selectedOrderId = Game.orders.length ? Game.orders[0].id : null;
  }
  renderAll();
}

/* ---------------- Game loop ---------------- */

function tick() {
  if (!Game.running || Game.paused || Game.over) { return; }
  const now = Date.now();
  Game.timeLeftMs -= 100;
  Game.orders.forEach((o) => { o.patienceMs -= 100; });
  const expired = Game.orders.filter((o) => o.patienceMs <= 0);
  expired.forEach(expireOrder);
  /* Station progress: cooking -> done -> burning. */
  let stationChanged = false;
  Object.keys(Game.stations).forEach((id) => {
    const st = Game.stations[id];
    if (st.state === "cooking" && now - st.startedAt >= st.cookMs) {
      st.state = "done"; st.doneAt = now;
      stationChanged = true;
      AudioSys.ding();
      toast("✅ " + ING[st.ingId].name + " matang di " + STN[id].name + " — ambil sekarang!");
    } else if (st.state === "done" && now - st.doneAt >= BURN_AFTER_MS) {
      st.state = "burning";
      stationChanged = true;
      AudioSys.alarm();
      toast("🔥 " + ING[st.ingId].name + " GOSONG di " + STN[id].name + "!");
    }
  });
  /* Spawn new orders on schedule. */
  if (now - Game.lastSpawnAt >= Game.spawnMs) {
    Game.lastSpawnAt = now;
    spawnOrder();
  }
  if (Game.hearts <= 0) { endShift(false, "Semua pelanggan kabur — reputasi warung hancur!"); return; }
  if (Game.timeLeftMs <= 0) {
    const quota = quotaForLevel(Game.level);
    if (Game.served >= quota) { endShift(true, "Target tercapai!"); }
    else { endShift(false, "Waktu habis — target " + quota + " pesanan tidak tercapai."); }
    return;
  }
  renderStations(); renderOrders(); renderHud();
  if (stationChanged) { renderStations(); }
}

/* ---------------- Start / pause / end ---------------- */

function startShift() {
  Game.running = true; Game.paused = false; Game.over = false;
  Game.timeLeftMs = SHIFT_SECONDS * 1000;
  Game.coins = 0; Game.earned = 0;
  Game.combo = 0; Game.maxCombo = 0;
  Game.served = 0; Game.servedTotal = 0; Game.lost = 0; Game.burned = 0;
  Game.hearts = 3;
  Game.stock = freshStock();
  Game.hand = null; Game.selectedBin = null; Game.selectedOrderId = null;
  Game.plate = []; Game.orders = []; Game.stations = {};
  Game.orderSeq = 0;
  Game.level = 1; Game.spawnMs = 12000;
  Game.lastSpawnAt = Date.now();
  Game.startedAt = Date.now();
  $("start-overlay").classList.add("hidden");
  $("end-overlay").classList.add("hidden");
  $("pause-overlay").classList.add("hidden");
  AudioSys.ensure();
  AudioSys.win();
  spawnOrder();
  setTimeout(spawnOrder, 2500);
  if (Game.tickTimer) { clearInterval(Game.tickTimer); }
  Game.tickTimer = setInterval(tick, 100);
  toast("🔥 Shift dimulai! Sajikan " + quotaForLevel(1) + " pesanan dalam " + fmtTime(SHIFT_SECONDS * 1000) + "!");
  renderAll();
}

function togglePause() {
  if (!Game.running || Game.over) { return; }
  Game.paused = !Game.paused;
  $("pause-overlay").classList.toggle("hidden", !Game.paused);
  AudioSys.click();
}

function endShift(won, reason) {
  Game.over = true;
  Game.running = false;
  clearInterval(Game.tickTimer);
  const quota = quotaForLevel(Game.level);
  const stars = won ? (Game.earned >= 220 ? 3 : Game.earned >= 140 ? 2 : 1) : 0;
  $("end-title").textContent = won ? "🎉 SHIFT SELESAI!" : "💔 SHIFT GAGAL";
  $("end-stars").textContent = "⭐".repeat(stars) + "☆".repeat(3 - stars);
  $("end-stats").innerHTML =
    "<div>" + reason + "</div>" +
    "<div>🍽️ Pesanan tersaji: <b>" + Game.served + " / " + quota + "</b></div>" +
    "<div>🪙 Koin hari ini: <b>" + Game.earned + "</b></div>" +
    "<div>🔥 Combo tertinggi: <b>×" + Math.max(1, Game.maxCombo) + "</b></div>" +
    "<div>😤 Pelanggan kabur: <b>" + Game.lost + "</b> · 🔥 Gosong: <b>" + Game.burned + "</b></div>" +
    "<div>🏆 Rekor koin: <b>" + Math.max(Game.best, Game.earned) + "</b></div>";
  $("btn-again").textContent = won ? "▶ SHIFT BERIKUTNYA" : "▶ COBA LAGI";
  if (won) { AudioSys.win(); } else { AudioSys.fail(); }
  $("end-overlay").classList.remove("hidden");
  renderAll();
}

function nextShift() {
  if (Game.over && $("end-title").textContent.indexOf("SELESAI") >= 0) {
    Game.shift++;
    startShift();
  } else {
    startShift();
  }
}

/* ---------------- Keyboard ---------------- */

document.addEventListener("keydown", function (e) {
  if (e.key === "m" || e.key === "M") {
    AudioSys.muted = !AudioSys.muted;
    renderHud();
    return;
  }
  if (!Game.running) {
    if (e.key === "Enter" && !$("start-overlay").classList.contains("hidden")) { startShift(); }
    return;
  }
  if (e.key === "p" || e.key === "P" || e.key === "Escape") { togglePause(); return; }
  if (e.key === "r" || e.key === "R") { startShift(); return; }
  if (Game.paused || Game.over) { return; }
  if (e.key === " ") { e.preventDefault(); serveDish(); return; }
  if (e.key === "t" || e.key === "T") { trashPlate(); return; }
  const ing = INGREDIENTS.find((g) => g.key === e.key);
  if (ing) { selectIngredient(ing.id); return; }
  const stn = STATIONS.find((s) => s.key.toLowerCase() === e.key.toLowerCase());
  if (stn) { clickStation(stn.id); }
});

/* ---------------- Buttons ---------------- */

$("btn-start").addEventListener("click", startShift);
$("btn-again").addEventListener("click", nextShift);
$("btn-retry").addEventListener("click", startShift);
$("btn-resume").addEventListener("click", togglePause);
$("btn-pause").addEventListener("click", togglePause);
$("btn-restart").addEventListener("click", function () { if (Game.running) { startShift(); } });
$("btn-sound").addEventListener("click", function () {
  AudioSys.muted = !AudioSys.muted;
  renderHud();
});
$("btn-serve").addEventListener("click", serveDish);
$("btn-trash").addEventListener("click", trashPlate);
$("btn-restock").addEventListener("click", restock);
$("plate").addEventListener("click", function (e) {
  /* Klik piring: taruh isi tangan (matang) ke piring, atau buang 1 item. */
  if (!Game.running || Game.paused || Game.over) { return; }
  if (Game.hand && Game.hand.kind === "cooked") {
    Game.plate.push(Game.hand.id);
    AudioSys.click();
    Game.hand = null;
    renderAll();
    return;
  }
  if (Game.hand && Game.hand.kind === "raw") {
    toast("⚠️ Bahan mentah tidak bisa ke piring — masak dulu di stasiun!");
    return;
  }
  if (Game.plate.length > 0) { clickPlateRemove(Game.plate.length - 1); }
});

/* ---------------- Demo staging (screenshot helper) ----------------
   ?demo=cover|rush|serve|results stages a real game state through the
   same state + render path the player reaches. No gameplay advantage:
   the flag only exists so screenshots show a busy kitchen. */

function stageDemo(scene) {
  Game.demo = true;
  Game.running = true; Game.paused = false; Game.over = false;
  Game.timeLeftMs = scene === "results" ? 0 : (scene === "rush" ? 62000 : 118000);
  Game.level = scene === "rush" ? 3 : 2;
  Game.shift = 1;
  Game.spawnMs = 8000;
  const coins = scene === "serve" ? 96 : scene === "rush" ? 74 : scene === "results" ? 168 : 58;
  Game.coins = coins; Game.earned = coins;
  Game.combo = scene === "serve" ? 4 : scene === "rush" ? 3 : scene === "results" ? 5 : 2;
  Game.maxCombo = Game.combo;
  Game.served = scene === "results" ? 10 : scene === "serve" ? 6 : scene === "rush" ? 5 : 4;
  Game.servedTotal = scene === "results" ? 11 : 8;
  Game.lost = scene === "results" ? 1 : 0;
  Game.burned = 0;
  Game.hearts = scene === "results" ? 2 : 3;
  Game.stock = freshStock();
  Game.stock.nasi = 4; Game.stock.ayam = 2; Game.stock.cabai = 3;
  const now = Date.now();
  function mkOrder(id, recipeId, frac) {
    const patience = patienceForLevel(Game.level);
    return { id: id, recipeId: recipeId, patienceMs: patience * frac, maxPatienceMs: patience };
  }
  if (scene === "results") {
    $("start-overlay").classList.add("hidden");
    endShift(true, "Target tercapai!");
    return;
  }
  Game.orders = [
    mkOrder(1, "nasgor", scene === "rush" ? 0.22 : 0.62),
    mkOrder(2, "miegor", scene === "rush" ? 0.45 : 0.78),
    mkOrder(3, "sate", 0.9),
  ];
  if (scene === "rush") { Game.orders.push(mkOrder(4, "geprek", 0.35)); }
  Game.orderSeq = Game.orders.length;
  Game.selectedOrderId = 1;
  Game.stations = {
    wok: { ingId: "nasi", startedAt: now - 3800, cookMs: 4200, state: "cooking", doneAt: 0 },
    grill: { ingId: "ayam", startedAt: now - 6100, cookMs: 6000, state: "done", doneAt: now - 2000 },
    chop: scene === "rush"
      ? { ingId: "cabai", startedAt: now - 9000, cookMs: 2200, state: "burning", doneAt: now - 7000 }
      : { ingId: "sayur", startedAt: now - 1200, cookMs: 2200, state: "cooking", doneAt: 0 },
    pot: scene === "serve"
      ? { ingId: "teh", startedAt: now - 3600, cookMs: 3500, state: "done", doneAt: now - 1000 }
      : { ingId: "teh", startedAt: now - 1500, cookMs: 3500, state: "cooking", doneAt: 0 },
  };
  Game.plate = scene === "serve" ? ["nasi", "telur", "cabai"] : scene === "cover" ? ["nasi"] : [];
  Game.hand = scene === "cover" ? { kind: "cooked", id: "telur" } : null;
  Game.selectedBin = scene === "cover" ? "cabai" : null;
  $("start-overlay").classList.add("hidden");
  $("end-overlay").classList.add("hidden");
  $("pause-overlay").classList.add("hidden");
  if (Game.tickTimer) { clearInterval(Game.tickTimer); }
  Game.tickTimer = setInterval(tick, 100);
  renderAll();
  /* Freeze the timer display for screenshots: pause ticking of the clock
     only in demo mode by stopping the interval after first render. */
  clearInterval(Game.tickTimer);
  Game.tickTimer = null;
}

/* ---------------- Init ---------------- */

buildBins();
buildStations();
renderAll();

/* Scale stage to fit any window (keeps 1280x720 layout intact). */
function fitStage() {
  const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720, 1.6);
  $("stage").style.transform = "scale(" + s + ")";
}
window.addEventListener("resize", fitStage);
fitStage();

const params = new URLSearchParams(window.location.search);
const demoScene = params.get("demo");
if (demoScene) {
  stageDemo(demoScene);
} else {
  $("start-overlay").classList.remove("hidden");
}

/* Exposed for play-testing (screenshots + local QA only). */
window.__game = Game;
window.__stageDemo = stageDemo;
window.__actions = { selectIngredient: selectIngredient, clickStation: clickStation, serveDish: serveDish, startShift: startShift };
