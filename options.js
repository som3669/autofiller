const $ = (id) => document.getElementById(id);

const PROFILE_KEYS = ["firstName","lastName","fullName","email","phone","address1","address2","city","state","zip","country","company","website"];

let rules = [];
let savedTimer;

function toast() {
  const el = $("saved"); el.classList.add("show");
  clearTimeout(savedTimer); savedTimer = setTimeout(() => el.classList.remove("show"), 1200);
}

async function saveProfile() {
  const profile = {};
  for (const k of PROFILE_KEYS) profile[k] = $(k).value.trim();
  await chrome.storage.sync.set({ profile });
  toast();
}

async function saveRules() {
  const clean = rules
    .map((r) => ({ match: (r.match || "").trim(), value: r.value ?? "", site: (r.site || "").trim().toLowerCase() }))
    .filter((r) => r.match !== "");
  await chrome.storage.sync.set({ rules: clean });
  toast();
}

async function load() {
  const { profile = {}, rules: r = [] } = await chrome.storage.sync.get({ profile: {}, rules: [] });
  for (const k of PROFILE_KEYS) $(k).value = profile[k] || "";
  rules = r.map((x) => ({ ...x }));
  renderRules();
}

function renderRules() {
  const box = $("ruleList");
  box.innerHTML = "";
  rules.forEach((rule, i) => {
    const row = document.createElement("div");
    row.className = "rule";

    const match = document.createElement("input");
    match.type = "text"; match.placeholder = "Match (field name or CSS selector)";
    match.value = rule.match || "";
    match.addEventListener("change", () => { rules[i].match = match.value; saveRules(); });

    const value = document.createElement("input");
    value.type = "text"; value.placeholder = "Value to fill";
    value.value = rule.value || "";
    value.addEventListener("change", () => { rules[i].value = value.value; saveRules(); });

    const site = document.createElement("input");
    site.type = "text"; site.className = "site"; site.placeholder = "site (optional)";
    site.value = rule.site || "";
    site.addEventListener("change", () => { rules[i].site = site.value.trim().toLowerCase(); site.value = rules[i].site; saveRules(); });

    const del = document.createElement("button");
    del.className = "del"; del.textContent = "×"; del.title = "Remove rule";
    del.setAttribute("aria-label", "Remove rule");
    del.addEventListener("click", () => { rules.splice(i, 1); renderRules(); saveRules(); });

    row.append(match, value, site, del);
    box.appendChild(row);
  });
}

$("ruleAdd").addEventListener("click", () => { rules.push({ match: "", value: "", site: "" }); renderRules(); });

for (const k of PROFILE_KEYS) $(k).addEventListener("change", saveProfile);

// ---- Fake data settings ----
const DEFAULT_FAKE = {
  passwordMode: "fixed", password: "Test@1234",
  ignoreMatch: ["captcha"], ignoreHidden: true, ignoreFilled: false,
  confirmMatch: ["confirm", "reenter", "retype", "repeat", "secondary"],
  agreeMatch: ["agree", "terms", "conditions"],
  matchUsing: { id: true, name: true, label: true, ariaLabel: true, ariaLabelledby: true, class: false, placeholder: false },
  maxLength: 20
};
const csv = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

async function loadFake() {
  const { fakeSettings = {} } = await chrome.storage.sync.get({ fakeSettings: {} });
  const f = { ...DEFAULT_FAKE, ...fakeSettings, matchUsing: { ...DEFAULT_FAKE.matchUsing, ...(fakeSettings.matchUsing || {}) } };
  $("pwFixed").checked = f.passwordMode === "fixed";
  $("pwRandom").checked = f.passwordMode === "random";
  $("fPassword").value = f.password;
  $("fPassword").disabled = f.passwordMode === "random";
  $("fIgnore").value = f.ignoreMatch.join(", ");
  $("fIgnoreHidden").checked = f.ignoreHidden;
  $("fIgnoreFilled").checked = f.ignoreFilled;
  $("fConfirm").value = f.confirmMatch.join(", ");
  $("fAgree").value = f.agreeMatch.join(", ");
  $("fMaxLen").value = f.maxLength;
  document.querySelectorAll("#matchUsing input[data-mu]").forEach((c) => { c.checked = !!f.matchUsing[c.dataset.mu]; });
}

async function saveFake() {
  const matchUsing = {};
  document.querySelectorAll("#matchUsing input[data-mu]").forEach((c) => { matchUsing[c.dataset.mu] = c.checked; });
  const fakeSettings = {
    passwordMode: $("pwRandom").checked ? "random" : "fixed",
    password: $("fPassword").value || "Test@1234",
    ignoreMatch: csv($("fIgnore").value),
    ignoreHidden: $("fIgnoreHidden").checked,
    ignoreFilled: $("fIgnoreFilled").checked,
    confirmMatch: csv($("fConfirm").value),
    agreeMatch: csv($("fAgree").value),
    matchUsing,
    maxLength: Math.max(1, Math.min(5000, parseInt($("fMaxLen").value, 10) || 20))
  };
  $("fMaxLen").value = fakeSettings.maxLength;
  $("fPassword").disabled = fakeSettings.passwordMode === "random";
  await chrome.storage.sync.set({ fakeSettings });
  toast();
}

["pwFixed","pwRandom","fPassword","fIgnore","fIgnoreHidden","fIgnoreFilled","fConfirm","fAgree","fMaxLen"]
  .forEach((id) => $(id).addEventListener("change", saveFake));
document.querySelectorAll("#matchUsing input[data-mu]").forEach((c) => c.addEventListener("change", saveFake));

// ---- Keyboard shortcuts: show live bindings + open Chrome's page ----
$("openShortcuts").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});
async function loadShortcuts() {
  if (!chrome.commands || !chrome.commands.getAll) return;
  const cmds = await chrome.commands.getAll();
  const map = { "fake-fill": 0, "fill-form": 1, "fill-input": 2, "fill-page": 3 };
  const rows = document.querySelectorAll("#shortcutRows tr");
  for (const c of cmds) {
    const i = map[c.name];
    if (i == null) continue;
    const cell = rows[i].querySelector("code");
    if (cell) cell.textContent = c.shortcut && c.shortcut.trim() ? c.shortcut : "Not set";
  }
}

// ---- Backup and restore ----
$("exportBtn").addEventListener("click", async () => {
  const data = await chrome.storage.sync.get(null);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "autofiller-settings.json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (typeof data !== "object" || data === null) throw new Error("bad file");
    await chrome.storage.sync.set(data);
    await load(); await loadFake();
    toast();
  } catch {
    alert("Could not import: the file is not valid AutoFiller settings.");
  }
  e.target.value = "";
});

load();
loadFake();
loadShortcuts();
