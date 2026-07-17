// QuickFill service worker: on user action, inject a filler into the active tab.

const DEFAULT_PROFILE = {
  firstName: "", lastName: "", fullName: "", email: "", phone: "",
  address1: "", address2: "", city: "", state: "", zip: "", country: "",
  company: "", website: ""
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "fill", title: "QuickFill: fill this page", contexts: ["page", "editable", "action"] });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => { if (info.menuItemId === "fill" && tab) fillTab(tab); });
chrome.commands.onCommand.addListener((cmd) => { if (cmd === "fill-page") fillActive(); });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "fillActive") { fillActive().then((r) => sendResponse(r)); return true; }
});

async function fillActive() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ? fillTab(tab) : { filled: 0, error: "no tab" };
}

async function fillTab(tab) {
  if (!tab.url || !/^https?:/.test(tab.url)) return { filled: 0, error: "unsupported page" };
  const { profile = {}, rules = [] } = await chrome.storage.sync.get({ profile: {}, rules: [] });
  let host = ""; try { host = new URL(tab.url).hostname; } catch {}
  const applicable = rules.filter((r) => !r.site || r.site === host);
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: fillPage,
      args: [{ ...DEFAULT_PROFILE, ...profile }, applicable]
    });
    const filled = results.reduce((n, r) => n + ((r.result && r.result.filled) || 0), 0);
    return { filled };
  } catch (e) {
    return { filled: 0, error: String(e && e.message || e) };
  }
}

// ---- Injected into the page. Must be fully self-contained. ----
function fillPage(profile, rules) {
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
  }

  const inputs = Array.from(document.querySelectorAll("input, textarea, select")).filter(fillable);
  const used = new Set();
  let filled = 0;

  // 1) Custom rules first (explicit user intent). match = CSS selector or keyword.
  for (const rule of rules) {
    if (!rule || !rule.match || rule.value == null) continue;
    let targets = [];
    try { if (/[#.\[\]>:]/.test(rule.match)) targets = Array.from(document.querySelectorAll(rule.match)).filter(fillable); } catch {}
    if (!targets.length) {
      const m = rule.match.toLowerCase();
      targets = inputs.filter((el) => !used.has(el) && haystack(el).includes(m));
    }
    for (const el of targets) {
      if (used.has(el)) continue;
      setValue(el, rule.value); used.add(el); filled++;
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
