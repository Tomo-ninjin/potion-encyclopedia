"use strict";

// 管理者用リセット機能：本番では false にすると右上の操作領域も無効になります。
const ENABLE_ADMIN_RESET = true;

// ===== 図鑑データ：この配列の中だけで項目を編集・追加・削除できます =====
// id は履歴の識別に使うため、名前を変えても変更しないでください。
const ENCYCLOPEDIA = [
  {
    id: "potion-a", name: "ポーションA", image: "",
    color: "赤", material1: "赤い薬草", material2: "湧き水",
    effect: "体力を少し回復する。", uses: "1回"
  },
  {
    id: "potion-b", name: "ポーションB", image: "",
    color: "青", material1: "青い花", material2: "朝露",
    effect: "魔力を少し回復する。", uses: "2回"
  },
  {
    id: "potion-c", name: "ポーションC", image: "",
    color: "緑", material1: "緑の葉", material2: "澄んだ水",
    effect: "毒を取り除く。", uses: "1回"
  },
  {
    id: "potion-d", name: "ポーションD", image: "",
    color: "黄", material1: "黄色い実", material2: "花の蜜",
    effect: "しばらくの間、暗い場所でも見やすくなる。", uses: "3回"
  }
];
// ===== ここから下は画面・履歴の処理です =====
const STORAGE_KEY = "memory-encyclopedia.history.v1";
const byId = new Map(ENCYCLOPEDIA.map(entry => [entry.id, entry]));
const $ = id => document.getElementById(id);
let historyIds = [];
function storageWarning() {
  $("storage-message").textContent = "このブラウザでは記憶を保存できません。今開いている間は検索と思い出す機能を利用できます。";
}
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (Array.isArray(saved)) historyIds = [...new Set(saved.filter(id => byId.has(id)))];
} catch { storageWarning(); }
function showView(id) {
  ["search-view", "detail-view", "memory-view"].forEach(view => { $(view).hidden = view !== id; });
}
function showEntry(entry, record) {
  if (record && !historyIds.includes(entry.id)) {
    historyIds.push(entry.id);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(historyIds)); } catch { storageWarning(); }
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
  if (entry.image) img.src = entry.image;
  showView("detail-view");
  $("entry-name").focus();
}
$("search-form").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("name-input").value.trim();
  if (!name) { $("search-message").textContent = "調べたい名前を入力してください。"; $("search-title").focus(); return; }
  const entry = ENCYCLOPEDIA.find(item => item.name === name);
  $("search-message").textContent = entry ? "" : "その名前は図鑑に見つかりませんでした。";
  if (entry) showEntry(entry, true);
});
$("remember-button").addEventListener("click", () => {
  const entries = historyIds.map(id => byId.get(id));
  $("memory-text").textContent = entries.length ? entries.map(entry => "『" + entry.name + "』").join("") + "を思い出した。" : "思い出せるものはまだ何もないようだ。";
  $("memory-list").replaceChildren();
  entries.forEach(entry => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button"; button.className = "secondary"; button.textContent = entry.name;
    button.addEventListener("click", () => showEntry(entry, false));
    li.append(button); $("memory-list").append(li);
  });
  showView("memory-view"); $("memory-title").focus();
});
document.querySelectorAll(".back-button").forEach(button => button.addEventListener("click", () => {
  $("name-input").value = "";
  $("search-message").textContent = "";
  showView("search-view"); $("search-title").focus();
}));
// 管理者向け。開発者ツールのConsoleで resetEncyclopediaHistory() を実行。
window.resetEncyclopediaHistory = function () {
  historyIds = [];
  $("name-input").value = "";
  $("search-message").textContent = "";
  try { localStorage.removeItem(STORAGE_KEY); } catch { storageWarning(); }
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
