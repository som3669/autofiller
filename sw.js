// QuickFill service worker: on user action, inject a filler into the active tab.

const DEFAULT_PROFILE = {
  firstName: "", lastName: "", fullName: "", email: "", phone: "",
  address1: "", address2: "", city: "", state: "", zip: "", country: "",
  company: "", website: ""
};

const DEFAULT_FAKE = {
  passwordMode: "fixed",            // "fixed" | "random"
  password: "Test@1234",            // used when passwordMode === "fixed"
  ignoreMatch: ["captcha"],         // skip fields whose id/name/label match any
  ignoreHidden: true,               // skip hidden/invisible fields
  ignoreFilled: false,              // skip fields that already have content
  confirmMatch: ["confirm", "reenter", "retype", "repeat", "secondary"],
  agreeMatch: ["agree", "terms", "conditions"],
  matchUsing: { id: true, name: true, label: true, ariaLabel: true, ariaLabelledby: true, class: false, placeholder: false },
  maxLength: 20,
  highlight: true                   // flash filled fields green
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "fake", title: "Fill all inputs (fake data)", contexts: ["page", "editable", "action"] });
    chrome.contextMenus.create({ id: "fake-form", title: "Fill this form (fake data)", contexts: ["editable"] });
    chrome.contextMenus.create({ id: "fake-input", title: "Fill this input (fake data)", contexts: ["editable"] });
    chrome.contextMenus.create({ id: "fake-submit", title: "Fill all & submit", contexts: ["page", "editable", "action"] });
    chrome.contextMenus.create({ id: "fill", title: "Fill with my profile", contexts: ["page", "editable", "action"] });
    chrome.contextMenus.create({ id: "sep", type: "separator", contexts: ["action"] });
    chrome.contextMenus.create({ id: "opts", title: "Settings…", contexts: ["action"] });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "opts") { chrome.runtime.openOptionsPage(); return; }
  if (!tab) return;
  if (info.menuItemId === "fill") fillTab(tab);
  else if (info.menuItemId === "fake") fakeFillTab(tab, "all", false);
  else if (info.menuItemId === "fake-form") fakeFillTab(tab, "form", false);
  else if (info.menuItemId === "fake-input") fakeFillTab(tab, "input", false);
  else if (info.menuItemId === "fake-submit") fakeFillTab(tab, "all", true);
});
chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "fill-page") fillActive();
  else if (cmd === "fake-fill") fakeFillActive("all");
  else if (cmd === "fill-form") fakeFillActive("form");
  else if (cmd === "fill-input") fakeFillActive("input");
});

// Clicking the toolbar icon = instant fake fill of the whole page.
chrome.action.onClicked.addListener((tab) => { if (tab) fakeFillTab(tab, "all", false); });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "fillActive") { fillActive().then((r) => sendResponse(r)); return true; }
  if (msg.type === "fakeFillActive") { fakeFillActive(msg.scope || "all", !!msg.doSubmit).then((r) => sendResponse(r)); return true; }
});

// Active profile (supports multiple named profiles; falls back to legacy single profile).
async function getActiveProfile() {
  const { profiles = null, activeProfile = "Default", profile = {} } = await chrome.storage.sync.get({ profiles: null, activeProfile: "Default", profile: {} });
  if (profiles && profiles[activeProfile]) return profiles[activeProfile];
  if (profiles) { const first = Object.values(profiles)[0]; if (first) return first; }
  return profile || {};
}
async function getHighlight() {
  const { fakeSettings = {} } = await chrome.storage.sync.get({ fakeSettings: {} });
  return fakeSettings.highlight !== false; // default on
}

async function fillActive() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ? fillTab(tab) : { filled: 0, error: "no tab" };
}

async function fillTab(tab) {
  if (!tab.url || !/^https?:/.test(tab.url)) return { filled: 0, error: "unsupported page" };
  const profile = await getActiveProfile();
  const { rules = [] } = await chrome.storage.sync.get({ rules: [] });
  const highlight = await getHighlight();
  let host = ""; try { host = new URL(tab.url).hostname; } catch {}
  const applicable = rules.filter((r) => !r.site || r.site === host);
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: fillPage,
      args: [{ ...DEFAULT_PROFILE, ...profile }, applicable, highlight]
    });
    const filled = results.reduce((n, r) => n + ((r.result && r.result.filled) || 0), 0);
    return { filled };
  } catch (e) {
    return { filled: 0, error: String(e && e.message || e) };
  }
}

async function fakeFillActive(scope, doSubmit) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ? fakeFillTab(tab, scope, doSubmit) : { filled: 0, error: "no tab" };
}

async function fakeFillTab(tab, scope, doSubmit) {
  if (!tab.url || !/^https?:/.test(tab.url)) return { filled: 0, error: "unsupported page" };
  const { fakeSettings = {} } = await chrome.storage.sync.get({ fakeSettings: {} });
  const settings = { ...DEFAULT_FAKE, ...fakeSettings, matchUsing: { ...DEFAULT_FAKE.matchUsing, ...(fakeSettings.matchUsing || {}) } };
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: fakeFillPage,
      args: [settings, scope || "all", settings.highlight !== false, !!doSubmit]
    });
    const filled = results.reduce((n, r) => n + ((r.result && r.result.filled) || 0), 0);
    return { filled };
  } catch (e) {
    return { filled: 0, error: String(e && e.message || e) };
  }
}

// ---- Injected into the page. Must be fully self-contained. ----
function fillPage(profile, rules, highlight) {
  // Map profile keys to autocomplete tokens + keyword hints.
  const FIELDS = {
    email:     { types: ["email"], auto: ["email"], kw: ["email", "e-mail"] },
    phone:     { types: ["tel"],   auto: ["tel"], kw: ["phone", "mobile", "tel", "contact number"] },
    firstName: { auto: ["given-name"], kw: ["first name", "firstname", "fname", "given name"] },
    lastName:  { auto: ["family-name"], kw: ["last name", "lastname", "lname", "surname", "family name"] },
    fullName:  { auto: ["name"], kw: ["full name", "your name", "name"] },
    address1:  { auto: ["address-line1", "street-address"], kw: ["address", "street", "address line 1"] },
    address2:  { auto: ["address-line2"], kw: ["address line 2", "apt", "suite", "unit"] },
    city:      { auto: ["address-level2"], kw: ["city", "town"] },
    state:     { auto: ["address-level1"], kw: ["state", "province", "region"] },
    zip:       { auto: ["postal-code"], kw: ["zip", "postal", "postcode", "post code"] },
    country:   { auto: ["country", "country-name"], kw: ["country"] },
    company:   { auto: ["organization"], kw: ["company", "organization", "organisation", "employer"] },
    website:   { auto: ["url"], kw: ["website", "url", "web site"] }
  };

  const SKIP_TYPES = ["password", "hidden", "submit", "button", "checkbox", "radio", "file", "image", "reset", "range", "color"];

  function labelText(el) {
    let t = "";
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) t += " " + l.textContent; }
    const wrap = el.closest("label"); if (wrap) t += " " + wrap.textContent;
    if (el.getAttribute("aria-label")) t += " " + el.getAttribute("aria-label");
    return t;
  }
  function haystack(el) {
    return [el.name, el.id, el.placeholder, el.getAttribute("autocomplete"), labelText(el)]
      .filter(Boolean).join(" ").toLowerCase();
  }
  function fillable(el) {
    if (el.disabled || el.readOnly) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName === "SELECT") return true;
    if (el.tagName !== "INPUT") return false;
    const type = (el.type || "text").toLowerCase();
    return !SKIP_TYPES.includes(type);
  }
  // Set value in a way React/Vue detect.
  function setValue(el, val) {
    if (el.tagName === "SELECT") {
      const v = String(val).toLowerCase();
      for (const o of el.options) {
        if (o.value.toLowerCase() === v || o.textContent.trim().toLowerCase() === v) { el.value = o.value; break; }
      }
    } else {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, val);
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    if (highlight) flash(el);
  }
  function flash(el) {
    try {
      const prev = el.style.outline, prevT = el.style.transition;
      el.style.transition = "outline .12s ease"; el.style.outline = "2px solid #22c55e";
      setTimeout(() => { el.style.outline = prev; el.style.transition = prevT; }, 700);
    } catch {}
  }

  // ---- generators for typed custom rules ----
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rnd(a.length)];
  const LOREM = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt".split(" ");
  const words = (n) => Array.from({ length: Math.max(1, n) }, () => pick(LOREM)).join(" ");
  function template(t) {
    return String(t).replace(/[#?*]/g, (c) =>
      c === "#" ? String(rnd(10)) :
      c === "?" ? "abcdefghijklmnopqrstuvwxyz"[rnd(26)] :
      "abcdefghijklmnopqrstuvwxyz0123456789"[rnd(36)]);
  }
  function genValue(rule) {
    const t = rule.type || "fixed";
    const v = rule.value || "";
    if (t === "list") { const o = v.split(",").map((s) => s.trim()).filter(Boolean); return o.length ? pick(o) : ""; }
    if (t === "number") { const m = v.split("-").map((s) => parseInt(s.trim(), 10)); const lo = isNaN(m[0]) ? 0 : m[0], hi = isNaN(m[1]) ? lo + 100 : m[1]; return String(lo + rnd(hi - lo + 1)); }
    if (t === "regex") return template(v);
    if (t === "lorem") return words(parseInt(v, 10) || 5);
    if (t === "date") {
      const parts = v.split(/\s*(?:to|\.\.|,)\s*/);
      const p = (s, d) => { const t2 = Date.parse(s); return isNaN(t2) ? d : t2; };
      const a = p(parts[0], Date.parse("2000-01-01")), b = p(parts[1], Date.now());
      const d = new Date(Math.min(a, b) + Math.random() * Math.abs(b - a));
      return d.toISOString().slice(0, 10);
    }
    return v; // fixed
  }

  const inputs = Array.from(document.querySelectorAll("input, textarea, select")).filter(fillable);
  const used = new Set();
  let filled = 0;

  // 1) Custom rules first (explicit user intent). match = CSS selector or keyword.
  for (const rule of rules) {
    if (!rule || !rule.match) continue;
    let targets = [];
    try { if (/[#.\[\]>:]/.test(rule.match)) targets = Array.from(document.querySelectorAll(rule.match)).filter(fillable); } catch {}
    if (!targets.length) {
      const m = rule.match.toLowerCase();
      targets = inputs.filter((el) => !used.has(el) && haystack(el).includes(m));
    }
    for (const el of targets) {
      if (used.has(el)) continue;
      setValue(el, genValue(rule)); used.add(el); filled++; // fresh value per field
    }
  }

  // 2) Profile fields by autocomplete/type/keyword.
  const order = ["email", "phone", "firstName", "lastName", "fullName", "address1", "address2", "city", "state", "zip", "country", "company", "website"];
  for (const key of order) {
    const val = profile[key];
    if (!val) continue;
    const spec = FIELDS[key];
    const match = inputs.find((el) => {
      if (used.has(el)) return false;
      const type = (el.type || "").toLowerCase();
      const ac = (el.getAttribute("autocomplete") || "").toLowerCase();
      if (spec.auto && spec.auto.some((a) => ac.split(/\s+/).includes(a))) return true;
      if (spec.types && spec.types.includes(type)) return true;
      const h = haystack(el);
      return spec.kw.some((k) => h.includes(k));
    });
    if (match) { setValue(match, val); used.add(match); filled++; }
  }

  return { filled };
}

// ---- Fake data filler. Fully self-contained (injected). ----
function fakeFillPage(settings, scope, highlight, doSubmit) {
  const S = settings || {};
  scope = scope || "all";
  const mu = S.matchUsing || { id: true, name: true, label: true, ariaLabel: true, ariaLabelledby: true, class: false, placeholder: false };
  const ignoreMatch = (S.ignoreMatch || []).map((x) => x.toLowerCase()).filter(Boolean);
  const confirmMatch = (S.confirmMatch || []).map((x) => x.toLowerCase()).filter(Boolean);
  const agreeMatch = (S.agreeMatch || []).map((x) => x.toLowerCase()).filter(Boolean);
  const MAXLEN = S.maxLength > 0 ? S.maxLength : 20;

  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rnd(a.length)];
  const FIRST = ["Jane","John","Alex","Maria","Sam","Priya","Liam","Noah","Emma","Olivia","Raj","Sofia"];
  const LAST = ["Smith","Doe","Patel","Garcia","Khan","Lee","Brown","Wilson","Novak","Kumar","Silva","Adams"];
  const DOMAIN = ["example.com","test.com","mail.com","demo.org"];
  const CITY = ["Austin","Denver","Portland","Kathmandu","Berlin","Toronto","Leeds","Pune"];
  const STATE = ["CA","TX","NY","WA","CO","FL"];
  const COMPANY = ["Acme Inc","Globex","Initech","Umbrella","Hooli","Stark Co"];
  const WORDS = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore".split(" ");
  const words = (n) => Array.from({ length: n }, () => pick(WORDS)).join(" ");
  const sentence = () => { const s = words(6 + rnd(8)); return s.charAt(0).toUpperCase() + s.slice(1) + "."; };
  const paragraph = () => Array.from({ length: 2 + rnd(2) }, sentence).join(" ");

  const firstName = () => pick(FIRST);
  const lastName = () => pick(LAST);
  const email = () => (pick(FIRST) + "." + pick(LAST) + rnd(99)).toLowerCase() + "@" + pick(DOMAIN);
  const phone = () => "+1 " + (200 + rnd(700)) + " " + (100 + rnd(900)) + " " + (1000 + rnd(9000));
  const pad = (n) => String(n).padStart(2, "0");
  const dateStr = () => `${2000 + rnd(25)}-${pad(1 + rnd(12))}-${pad(1 + rnd(28))}`;
  const monthStr = () => `${2000 + rnd(25)}-${pad(1 + rnd(12))}`;
  const weekStr = () => `${2000 + rnd(25)}-W${pad(1 + rnd(52))}`;
  const timeStr = () => `${pad(rnd(24))}:${pad(rnd(60))}`;
  const color = () => "#" + Array.from({ length: 6 }, () => "0123456789abcdef"[rnd(16)]).join("");

  // never touched
  const SKIP_TYPES = ["hidden", "submit", "button", "file", "image", "reset"];
  const passwordVal = () => S.passwordMode === "random"
    ? Array.from({ length: 8 }, () => "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[rnd(55)]).join("")
    : (S.password || "Test@1234");

  function labelText(el) {
    let t = "";
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) t += " " + l.textContent; }
    const w = el.closest("label"); if (w) t += " " + w.textContent;
    return t;
  }
  // Build match text from ONLY the attributes enabled in matchUsing.
  function hints(el) {
    const parts = [];
    if (mu.id) parts.push(el.id);
    if (mu.name) parts.push(el.name);
    if (mu.class) parts.push(el.className);
    if (mu.placeholder) parts.push(el.placeholder);
    if (mu.ariaLabel) parts.push(el.getAttribute("aria-label"));
    if (mu.ariaLabelledby) {
      const ref = el.getAttribute("aria-labelledby");
      if (ref) ref.split(/\s+/).forEach((id) => { const e = document.getElementById(id); if (e) parts.push(e.textContent); });
    }
    if (mu.label) parts.push(labelText(el));
    parts.push(el.getAttribute("autocomplete")); // always used for type detection
    return parts.filter(Boolean).join(" ").toLowerCase();
  }
  function isVisible(el) {
    if (el.type === "hidden") return false;
    return el.offsetParent !== null || el.getClientRects().length > 0;
  }
  function isIgnored(el) {
    if (!ignoreMatch.length) return false;
    const h = hints(el);
    return ignoreMatch.some((m) => h.includes(m));
  }
  function matchesAny(el, list) { const h = hints(el); return list.some((m) => h.includes(m)); }
  function flash(el) {
    if (!highlight) return;
    try {
      const prev = el.style.outline, prevT = el.style.transition;
      el.style.transition = "outline .12s ease"; el.style.outline = "2px solid #22c55e";
      setTimeout(() => { el.style.outline = prev; el.style.transition = prevT; }, 700);
    } catch {}
  }
  const touched = new Set(); // forms that got filled (for auto-submit)
  function setValue(el, val) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, val);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    flash(el);
    if (el.form) touched.add(el.form);
  }
  // cap to the field's maxlength AND the global max length setting
  function clip(el, s) {
    const m = parseInt(el.getAttribute("maxlength"), 10);
    let out = String(s);
    if (m > 0) out = out.slice(0, m);
    if (out.length > MAXLEN) out = out.slice(0, MAXLEN);
    return out;
  }
  // shared skip check for any element
  function skip(el) {
    if (el.disabled || el.readOnly) return true;
    if (S.ignoreHidden && !isVisible(el)) return true;
    if (isIgnored(el)) return true;
    return false;
  }
  function hasContent(el) {
    if (el.type === "checkbox" || el.type === "radio") return false;
    return !!(el.value && String(el.value).trim());
  }

  function textFor(el) {
    const h = hints(el);
    if (/e-?mail/.test(h)) return email();
    if (/phone|mobile|tel/.test(h)) return phone();
    if (/first ?name|given|fname/.test(h)) return firstName();
    if (/last ?name|surname|family|lname/.test(h)) return lastName();
    if (/full ?name|your name|(^|\b)name\b/.test(h)) return firstName() + " " + lastName();
    if (/city|town/.test(h)) return pick(CITY);
    if (/state|province|region/.test(h)) return pick(STATE);
    if (/zip|postal|postcode/.test(h)) return String(10000 + rnd(89999));
    if (/company|organi|employer/.test(h)) return pick(COMPANY);
    if (/address|street/.test(h)) return (1 + rnd(999)) + " " + pick(LAST) + " St";
    if (/url|website|web ?site/.test(h)) return "https://" + pick(DOMAIN);
    if (/country/.test(h)) return pick(["United States","Canada","Nepal","Germany","India"]);
    if (/age|number|qty|quantity|amount/.test(h)) return String(1 + rnd(100));
    return words(1 + rnd(2));
  }

  let filled = 0;
  let lastText = ""; // for confirmation fields (reuse the preceding value)

  // Determine scope: whole page, the active field's form, or just the active field.
  let inputEls, radioEls, selectEls;
  const active = document.activeElement;
  if (scope === "input") {
    const arr = active && active.tagName && active !== document.body ? [active] : [];
    inputEls = arr.filter((e) => e.tagName === "INPUT" || e.tagName === "TEXTAREA");
    selectEls = arr.filter((e) => e.tagName === "SELECT");
    radioEls = arr.filter((e) => e.type === "radio");
  } else {
    const root = scope === "form" ? ((active && active.closest && active.closest("form")) || document) : document;
    inputEls = Array.from(root.querySelectorAll("input, textarea"));
    radioEls = Array.from(root.querySelectorAll('input[type=radio]'));
    selectEls = Array.from(root.querySelectorAll("select"));
  }

  // inputs + textareas
  for (const el of inputEls) {
    if (el.type === "hidden" || SKIP_TYPES.includes((el.type || "text").toLowerCase())) continue;
    if (skip(el)) continue;
    if (S.ignoreFilled && hasContent(el)) continue;

    if (el.tagName === "TEXTAREA") { const v = clip(el, paragraph()); setValue(el, v); lastText = v; filled++; continue; }

    const type = (el.type || "text").toLowerCase();

    // Confirmation field → reuse the previous value so "confirm" matches.
    if (confirmMatch.length && matchesAny(el, confirmMatch) && lastText) {
      setValue(el, lastText); filled++; continue;
    }

    let v = null;
    switch (type) {
      case "password": v = passwordVal(); break;
      case "email": v = email(); break;
      case "tel": v = phone(); break;
      case "url": v = "https://" + pick(DOMAIN); break;
      case "number": {
        const min = parseFloat(el.min), max = parseFloat(el.max);
        const lo = isNaN(min) ? 0 : min, hi = isNaN(max) ? lo + 100 : max;
        v = String(Math.floor(lo + Math.random() * (hi - lo + 1))); break;
      }
      case "range": {
        const min = parseFloat(el.min) || 0, max = parseFloat(el.max) || 100;
        v = String(Math.floor(min + Math.random() * (max - min + 1))); break;
      }
      case "date": v = dateStr(); break;
      case "month": v = monthStr(); break;
      case "week": v = weekStr(); break;
      case "time": v = timeStr(); break;
      case "color": v = color(); break;
      case "checkbox": {
        // "agree to terms" checkboxes are always checked; others random.
        el.checked = matchesAny(el, agreeMatch) ? true : Math.random() > 0.5;
        el.dispatchEvent(new Event("change", { bubbles: true })); flash(el); if (el.form) touched.add(el.form); filled++; continue;
      }
      case "radio": continue; // handled per-group below
      default: v = clip(el, textFor(el));
    }
    if (v != null) { setValue(el, v); lastText = v; filled++; }
  }

  // radio groups: pick one per name (respecting skips)
  const groups = {};
  for (const r of radioEls) {
    if (skip(r)) continue;
    (groups[r.name || r.id] = groups[r.name || r.id] || []).push(r);
  }
  for (const name in groups) {
    const chosen = pick(groups[name]);
    chosen.checked = true; chosen.dispatchEvent(new Event("change", { bubbles: true })); flash(chosen); if (chosen.form) touched.add(chosen.form); filled++;
  }

  // selects: random non-empty option
  for (const sel of selectEls) {
    if (skip(sel)) continue;
    if (S.ignoreFilled && sel.value) continue;
    const opts = Array.from(sel.options).filter((o) => o.value !== "" && !o.disabled);
    if (!opts.length) continue;
    const o = pick(opts); sel.value = o.value;
    sel.dispatchEvent(new Event("change", { bubbles: true })); flash(sel); if (sel.form) touched.add(sel.form); filled++;
  }

  // optional auto-submit of the forms we filled
  if (doSubmit && touched.size) {
    setTimeout(() => {
      for (const form of touched) {
        const btn = form.querySelector('[type=submit], button:not([type])');
        if (btn) btn.click(); else if (form.requestSubmit) form.requestSubmit(); else form.submit();
      }
    }, 150);
  }

  return { filled };
}
