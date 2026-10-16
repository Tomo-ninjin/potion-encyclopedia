"use strict";

// 管理者用リセット機能：本番では false にすると右上の操作領域も無効になります。
const ENABLE_ADMIN_RESET = true;

// 検索データはCloudflare Workerで管理します。
const API_URL = "https://potion-research.tomon2002.workers.dev/";
const STORAGE_KEY = "potion-encyclopedia.api-history.v1";
// Workerのデータを修正し、保存済み情報も更新させたい場合は v1 を v2 などに変更。
const CACHE_KEY = "potion-encyclopedia.discovered.v1";
const potionCache = new Map();
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
  activeController?.abort();
  const version = ++requestVersion;
  activeController = null;
  $(messageId).textContent = "";
  if (potionCache.has(name)) {
    showEntry(potionCache.get(name), record);
    return;
  }
  const controller = new AbortController();
  activeController = controller;
  const timer = setTimeout(() => controller.abort(), 12000);
  $(messageId).textContent = "";
  try {
    const response = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }), signal: controller.signal,
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
    if (!isPotion(entry) || entry.name !== name) throw new Error("Invalid response");
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
  const entries = historyNames;
  $("memory-text").textContent = entries.length ? entries.map(name => "『" + name + "』").join("") + "を思い出した。" : "思い出せるものはまだ何もないようだ。";
  $("memory-list").replaceChildren();
  entries.forEach(name => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button"; button.className = "secondary"; button.textContent = name;
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
