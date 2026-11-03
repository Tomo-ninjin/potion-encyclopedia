"use strict";

// 管理者用リセット機能：本番では false にすると右上の操作領域も無効になります。
const ENABLE_ADMIN_RESET = true;

// 検索データはCloudflare Workerで管理します。
const API_URL = "https://potion-research.tomon2002.workers.dev/";
const STORAGE_KEY = "potion-encyclopedia.api-history.v1";
// Workerのデータを修正し、保存済み情報も更新させたい場合は v1 を v2 などに変更。
const CACHE_KEY = "potion-encyclopedia.discovered.v1";
const potionCache = new Map();
// 検索用だけを正規化。正式名称や保存する表示名は変更しません。
function normalizeSearchName(name) {
  return name.trim().normalize("NFC").replace(/[\u3041-\u3096\u309D\u309E]/g,
    character => String.fromCharCode(character.charCodeAt(0) + 0x60));
}
// 「色」欄の表記と対応する色。必要に応じて表記を追加できます。
const POTION_COLORS = {
  "赤": "#b94e47", "青": "#507fb0", "緑": "#5b9261", "黄": "#d1b143",
  "紫": "#9670ad", "桃": "#cf8caa", "ピンク": "#cf8caa",
  "橙": "#ce8c48", "オレンジ": "#ce8c48", "水": "#78b8ce",
  "茶": "#927252", "褐": "#927252", "琥珀": "#c19440",
  "白": "#ffffff", "黒": "#595451", "灰": "#96938b",
  "金": "#c1a34e", "銀": "#a5a9ad", "無": "#faf6ed", "透明": "#faf6ed",
  "red": "#b94e47", "blue": "#507fb0", "green": "#5b9261", "yellow": "#d1b143",
  "purple": "#9670ad", "pink": "#cf8caa", "orange": "#ce8c48",
  "white": "#ffffff", "black": "#595451", "gray": "#96938b", "grey": "#96938b"
};
function normalizeColorLabel(color) {
  return color.trim().toLowerCase().replace(/^(淡い|薄い|濃い|明るい|暗い|深い)/, "").replace(/色$/, "");
}
function memoryColorOrder(name) {
  const color = normalizeColorLabel(potionCache.get(name)?.color || "");
  const rank = { "赤": 0, "red": 0, "青": 1, "blue": 1, "緑": 2, "green": 2, "黄": 3, "yellow": 3 };
  return Object.hasOwn(rank, color) ? rank[color] : 4;
}
function memoryButtonTint(color) {
  const label = normalizeColorLabel(color);
  let hex = POTION_COLORS[label] || label;
  if (/^#[0-9a-f]{3}$/i.test(hex)) hex = "#" + [...hex.slice(1)].map(c => c + c).join("");
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  // 羊皮紙色へ14%だけ混ぜ、濃い文字との読みやすさを維持します。
  const paper = [250, 246, 237];
  const rgb = paper.map((base, i) => Math.round(base * 0.86 + parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) * 0.14));
  return "rgb(" + rgb.join(", ") + ")";
}
function isPotion(entry) {
  return entry && ["id", "name", "image", "color", "material1", "material2", "effect", "uses"].every(key => typeof entry[key] === "string");
}
const $ = id => document.getElementById(id);
let historyNames = [];
let requestVersion = 0;
let activeController = null;
let detailReturnView = "search-view";
function storageWarning() {
  $("storage-message").textContent = "このブラウザでは記憶を保存できません。今開いている間は検索と思い出す機能を利用できます。";
}
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (Array.isArray(saved)) historyNames = [...new Set(saved.filter(name => typeof name === "string" && name.length > 0 && name.length <= 100))];
} catch { storageWarning(); }
try {
  const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
  if (Array.isArray(saved)) saved.filter(entry => isPotion(entry) && historyNames.includes(entry.name)).forEach(entry => potionCache.set(entry.name, entry));
} catch { storageWarning(); }

async function searchPotion(name, record, messageId) {
  const searchName = normalizeSearchName(name);
  activeController?.abort();
  const version = ++requestVersion;
  activeController = null;
  $(messageId).textContent = "";
  const cached = [...potionCache.values()].find(entry => normalizeSearchName(entry.name) === searchName);
  if (cached) {
    showEntry(cached, record);
    return;
  }
  const controller = new AbortController();
  activeController = controller;
  const timer = setTimeout(() => controller.abort(), 12000);
  $(messageId).textContent = "";
  try {
    const response = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: searchName }), signal: controller.signal,
      credentials: "omit", cache: "no-store"
    });
    if (!response.ok) throw new Error("API error");
    const data = await response.json();
    if (version !== requestVersion) return;
    if (data.potion === null) {
      $(messageId).textContent = "その名前は図鑑に見つかりませんでした。";
      return;
    }
    const entry = data.potion;
    if (!isPotion(entry) || normalizeSearchName(entry.name) !== searchName) throw new Error("Invalid response");
    $(messageId).textContent = "";
    showEntry(entry, record);
    potionCache.set(entry.name, entry);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify([...potionCache.values()])); } catch { storageWarning(); }
  } catch {
    if (version === requestVersion) $(messageId).textContent = "通信できませんでした。接続を確認して、もう一度お試しください。";
  } finally {
    clearTimeout(timer);
    if (version === requestVersion) activeController = null;
  }
}
function cancelSearch() {
  requestVersion++;
  activeController?.abort();
  activeController = null;
  $("search-message").textContent = "";
  $("memory-message").textContent = "";
}
function showView(id) {
  ["search-view", "detail-view", "memory-view"].forEach(view => { $(view).hidden = view !== id; });
}
function showEntry(entry, record) {
  detailReturnView = record ? "search-view" : "memory-view";
  if (record && !historyNames.includes(entry.name)) {
    historyNames.push(entry.name);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(historyNames)); } catch { storageWarning(); }
  }
  $("entry-name").textContent = entry.name;
  $("entry-color").textContent = entry.color;
  $("entry-material1").textContent = entry.material1;
  $("entry-material2").textContent = entry.material2;
  $("entry-effect").textContent = entry.effect;
  $("entry-uses").textContent = entry.uses;
  const img = $("entry-image");
  img.hidden = true;
  img.removeAttribute("src");
  $("image-fallback").hidden = true;
  img.onerror = () => { img.hidden = true; };
  img.onload = () => { img.hidden = false; };
  img.alt = entry.name + "の画像";
  if (entry.image) {
    try {
      const url = new URL(entry.image, document.baseURI);
      if (["https:", "http:"].includes(url.protocol)) img.src = url.href;
    } catch { /* 未設定と同じ空枠にします */ }
  }
  showView("detail-view");
  $("entry-name").focus();
}
$("search-form").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("name-input").value.trim();
  if (!name) { $("search-message").textContent = "調べたい名前を入力してください。"; $("search-title").focus(); return; }
  searchPotion(name, true, "search-message");
});
$("remember-button").addEventListener("click", () => {
  cancelSearch();
  // 保存した検索順は変えず、表示だけを赤→青→緑→黄に並べます。
  const entries = [...historyNames].sort((a, b) => memoryColorOrder(a) - memoryColorOrder(b));
  $("memory-text").textContent = entries.length ? entries.map(name => "『" + name + "』").join("") + "を思い出した。" : "思い出せるものはまだ何もないようだ。";
  $("memory-list").replaceChildren();
  entries.forEach(name => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button"; button.className = "secondary"; button.textContent = name;
    const entry = potionCache.get(name);
    const tint = entry ? memoryButtonTint(entry.color) : null;
    if (tint) button.style.setProperty("--potion-tint", tint);
    button.addEventListener("click", () => searchPotion(name, false, "memory-message"));
    li.append(button); $("memory-list").append(li);
  });
  showView("memory-view"); $("memory-title").focus();
});
document.querySelectorAll(".back-button").forEach(button => button.addEventListener("click", () => {
  cancelSearch();
  if (button.id === "detail-back-button" && detailReturnView === "memory-view") {
    showView("memory-view");
    $("memory-title").focus();
    return;
  }
  $("name-input").value = "";
  $("search-message").textContent = "";
  showView("search-view"); $("search-title").focus();
}));
// 管理者向け。開発者ツールのConsoleで resetEncyclopediaHistory() を実行。
window.resetEncyclopediaHistory = function () {
  cancelSearch();
  historyNames = [];
  potionCache.clear();
  $("name-input").value = "";
  $("search-message").textContent = "";
  try { localStorage.removeItem(STORAGE_KEY); } catch { storageWarning(); }
  try { localStorage.removeItem(CACHE_KEY); } catch { storageWarning(); }
  $("memory-list").replaceChildren(); $("memory-text").textContent = "思い出せるものはまだ何もないようだ。";
  showView("search-view"); $("search-title").focus();
  return "検索履歴を初期化しました。";
};

// 右上を連続で10回操作すると履歴を初期化します。
// 途中で5秒以上空いた場合は、1回目から数え直します。
let resetTapCount = 0;
let lastResetTap = 0;
$("reset-tap-area").hidden = !ENABLE_ADMIN_RESET;
$("reset-tap-area").addEventListener("click", () => {
  if (!ENABLE_ADMIN_RESET) return;
  const now = Date.now();
  resetTapCount = now - lastResetTap > 5000 ? 1 : resetTapCount + 1;
  lastResetTap = now;
  if (resetTapCount < 10) return;
  resetTapCount = 0;
  window.resetEncyclopediaHistory();
  $("reset-dialog").showModal();
});
