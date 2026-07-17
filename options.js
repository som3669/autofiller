const $ = (id) => document.getElementById(id);

const PROFILE_KEYS = ["firstName","lastName","fullName","email","phone","address1","address2","city","state","zip","country","company","website"];

let rules = [];
let savedTimer;

// ---- Multiple profiles ----
let profiles = {};
let activeProfile = "Default";

function toast() {
  const el = $("saved"); el.classList.add("show");
  clearTimeout(savedTimer); savedTimer = setTimeout(() => el.classList.remove("show"), 1200);
}

function renderProfileSelect() {
  const sel = $("profileSel");
  sel.innerHTML = "";
  for (const name of Object.keys(profiles)) {
    const o = document.createElement("option"); o.value = name; o.textContent = name; sel.appendChild(o);
  }
  sel.value = activeProfile;
}
function fillProfileFields() {
  const p = profiles[activeProfile] || {};
  for (const k of PROFILE_KEYS) $(k).value = p[k] || "";
}
async function saveProfiles() {
  await chrome.storage.sync.set({ profiles, activeProfile });
  toast();
}
function saveActiveFields() {
  const p = {};
  for (const k of PROFILE_KEYS) p[k] = $(k).value.trim();
  profiles[activeProfile] = p;
  saveProfiles();
}

$("profileSel").addEventListener("change", () => { activeProfile = $("profileSel").value; fillProfileFields(); saveProfiles(); });
$("profNew").addEventListener("click", () => {
  const name = (prompt("New profile name:") || "").trim();
  if (!name || profiles[name]) return;
  profiles[name] = {}; activeProfile = name;
  renderProfileSelect(); fillProfileFields(); saveProfiles();
});
$("profRename").addEventListener("click", () => {
  const name = (prompt("Rename profile to:", activeProfile) || "").trim();
  if (!name || profiles[name]) return;
  profiles[name] = profiles[activeProfile]; delete profiles[activeProfile]; activeProfile = name;
  renderProfileSelect(); saveProfiles();
});
$("profDelete").addEventListener("click", () => {
  const names = Object.keys(profiles);
  if (names.length < 2) { alert("Keep at least one profile."); return; }
  if (!confirm(`Delete profile "${activeProfile}"?`)) return;
  delete profiles[activeProfile]; activeProfile = Object.keys(profiles)[0];
  renderProfileSelect(); fillProfileFields(); saveProfiles();
});

async function saveRules() {
  const clean = rules
    .map((r) => ({ match: (r.match || "").trim(), type: r.type || "fixed", value: r.value ?? "", site: (r.site || "").trim().toLowerCase() }))
    .filter((r) => r.match !== "");
  await chrome.storage.sync.set({ rules: clean });
  toast();
}

async function load() {
  const st = await chrome.storage.sync.get({ profiles: null, activeProfile: "Default", profile: {}, rules: [] });
  if (st.profiles && Object.keys(st.profiles).length) {
    profiles = st.profiles;
    activeProfile = st.profiles[st.activeProfile] ? st.activeProfile : Object.keys(st.profiles)[0];
  } else {
    profiles = { Default: st.profile || {} }; activeProfile = "Default";
  }
  renderProfileSelect();
  fillProfileFields();
  rules = (st.rules || []).map((x) => ({ ...x }));
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

    const PLACE = { fixed: "Value to fill", list: "a, b, c (random one)", number: "1-100 (range)", date: "2000-01-01 to 2024-12-31", regex: "INV-#### (#digit ?letter *alnum)", lorem: "word count e.g. 5" };
    const type = document.createElement("select");
    type.style.maxWidth = "110px";
    for (const t of ["fixed", "list", "number", "date", "regex", "lorem"]) {
      const o = document.createElement("option"); o.value = t; o.textContent = t; type.appendChild(o);
    }
    type.value = rule.type || "fixed";

    const value = document.createElement("input");
    value.type = "text"; value.placeholder = PLACE[type.value];
    value.value = rule.value || "";
    value.addEventListener("change", () => { rules[i].value = value.value; saveRules(); });
    type.addEventListener("change", () => { rules[i].type = type.value; value.placeholder = PLACE[type.value]; saveRules(); });

    const site = document.createElement("input");
    site.type = "text"; site.className = "site"; site.placeholder = "site (optional)";
    site.value = rule.site || "";
    site.addEventListener("change", () => { rules[i].site = site.value.trim().toLowerCase(); site.value = rules[i].site; saveRules(); });

    const del = document.createElement("button");
    del.className = "del"; del.textContent = "×"; del.title = "Remove rule";
    del.setAttribute("aria-label", "Remove rule");
    del.addEventListener("click", () => { rules.splice(i, 1); renderRules(); saveRules(); });

    row.append(match, type, value, site, del);
    box.appendChild(row);
  });
}

$("ruleAdd").addEventListener("click", () => { rules.push({ match: "", type: "fixed", value: "", site: "" }); renderRules(); });

for (const k of PROFILE_KEYS) $(k).addEventListener("change", saveActiveFields);

// ---- Fake data settings ----
const DEFAULT_FAKE = {
  passwordMode: "fixed", password: "Test@1234",
  ignoreMatch: ["captcha"], ignoreHidden: true, ignoreFilled: false,
  confirmMatch: ["confirm", "reenter", "retype", "repeat", "secondary"],
  agreeMatch: ["agree", "terms", "conditions"],
  matchUsing: { id: true, name: true, label: true, ariaLabel: true, ariaLabelledby: true, class: false, placeholder: false },
  maxLength: 20, highlight: true
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
  $("fHighlight").checked = f.highlight !== false;
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
    maxLength: Math.max(1, Math.min(5000, parseInt($("fMaxLen").value, 10) || 20)),
    highlight: $("fHighlight").checked
  };
  $("fMaxLen").value = fakeSettings.maxLength;
  $("fPassword").disabled = fakeSettings.passwordMode === "random";
  await chrome.storage.sync.set({ fakeSettings });
  toast();
}

["pwFixed","pwRandom","fPassword","fIgnore","fIgnoreHidden","fIgnoreFilled","fConfirm","fAgree","fMaxLen","fHighlight"]
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

// Import from the Fake Filler extension's export format → map to AutoFiller.
$("importFF").addEventListener("click", () => $("importFFFile").click());
$("importFFFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const ff = JSON.parse(await file.text());
    const o = ff.options || ff; // Fake Filler wraps settings under "options"
    const fakeSettings = { ...DEFAULT_FAKE };
    if (o.defaultMaxLength) fakeSettings.maxLength = parseInt(o.defaultMaxLength, 10) || 20;
    if (o.ignoredFields) fakeSettings.ignoreMatch = String(o.ignoredFields).split(",").map((s) => s.trim()).filter(Boolean);
    if (typeof o.ignoreHiddenFields === "boolean") fakeSettings.ignoreHidden = o.ignoreHiddenFields;
    if (typeof o.ignoreFieldsWithContent === "boolean") fakeSettings.ignoreFilled = o.ignoreFieldsWithContent;
    if (o.confirmFields) fakeSettings.confirmMatch = String(o.confirmFields).split(",").map((s) => s.trim()).filter(Boolean);
    if (o.agreeTermsFields) fakeSettings.agreeMatch = String(o.agreeTermsFields).split(",").map((s) => s.trim()).filter(Boolean);
    if (o.passwordSettings && o.passwordSettings.password) fakeSettings.password = o.passwordSettings.password;
    if (o.fieldMatchSettings) {
      const m = o.fieldMatchSettings;
      fakeSettings.matchUsing = {
        id: !!m.matchId, name: !!m.matchName, label: !!m.matchLabel,
        ariaLabel: !!m.matchAriaLabel, ariaLabelledby: !!m.matchAriaLabelledBy,
        class: !!m.matchClass, placeholder: !!m.matchPlaceholder
      };
    }
    // Custom fields → AutoFiller rules (best-effort)
    if (Array.isArray(o.customFields)) {
      const mapType = (t) => ({ "number": "number", "randomized-list": "list", "date": "date", "regex": "regex", "telephone": "regex", "text": "lorem" }[t] || "fixed");
      const imported = o.customFields.map((c) => ({
        match: (c.name || "").split(",")[0].trim(),
        type: mapType(c.type),
        value: c.list || c.template || c.value || (c.min != null ? `${c.min}-${c.max}` : "") || "",
        site: ""
      })).filter((r) => r.match);
      if (imported.length) { const { rules: cur = [] } = await chrome.storage.sync.get({ rules: [] }); await chrome.storage.sync.set({ rules: cur.concat(imported) }); }
    }
    await chrome.storage.sync.set({ fakeSettings });
    await load(); await loadFake();
    toast();
    alert("Imported from Fake Filler. Review the Custom field rules — some advanced generators may need adjusting.");
  } catch {
    alert("Could not import: not a recognized Fake Filler export file.");
  }
  e.target.value = "";
});

load();
loadFake();
loadShortcuts();
