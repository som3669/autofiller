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

load();
