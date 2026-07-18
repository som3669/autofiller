# AutoFiller — User Manual

AutoFiller fills web forms for you in one click — either with realistic fake test
data (great for developers and QA) or with your own saved profile. It only acts
when you tell it to, and it never stores real passwords.

---

## Install

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select the `autofiller` folder
5. Pin the icon: click the puzzle-piece in the toolbar → pin AutoFiller

---

## The fastest way to fill a form

**Click the AutoFiller toolbar icon.** The whole page fills with fake data
instantly. Filled fields flash green.

That's it. Everything else below is optional.

---

## All the ways to fill

### Toolbar icon
Click it → fills the current page with fake data.

### Keyboard shortcuts
| Shortcut | Action |
|----------|--------|
| `Alt+Shift+F` | Fill all inputs (fake data) |
| `Alt+Shift+D` | Fill with my profile |
| (unset) | Fill this form |
| (unset) | Fill this input |

Change or add shortcuts at `chrome://extensions/shortcuts` (or Settings →
Keyboard Shortcuts → “Change keyboard shortcuts”).

### Right-click menu (on a page or a field)
- **Fill all inputs (fake data)**
- **Fill this form** — only the form you right-clicked in
- **Fill this input** — only the field you right-clicked
- **Fill all & submit** — fills, then submits the form
- **Fill with INVALID data** — deliberately bad values to test validation
- **Fill with my profile** — uses your saved profile
- **Inspect fields** — click fields to save them as rules (see below)

### Right-click the toolbar icon
Adds the same actions plus **Settings…**.

---

## Settings (tabs)

Open via right-click the icon → **Settings…**.

### General

**Profiles** — your real data for profile fill.
- Use the dropdown to switch profiles
- **＋ New / ✎ Rename / 🗑 Delete** to manage multiple profiles (e.g. Work, Personal)
- Fields: name, email, phone, address, company, website

**Fake data settings** — control the fake-fill mode:
- **Password value** — a fixed dummy value or a random 8-character one
- **Ignore fields matching** — comma list; fields matching are skipped (e.g. `captcha`)
- **Ignore hidden / invisible fields**
- **Ignore fields that already have content**
- **Highlight filled fields** — green flash on fill
- **Confirmation fields** — fields like “confirm password” reuse the preceding value
- **Agree-to-terms fields** — checkboxes matching these are always checked
- **Match fields using** — which attributes to match on (id, name, label, aria-*, class, placeholder)
- **Maximum text length** — caps generated text

### Custom Fields

Rules for specific fields the profile/fake logic doesn’t cover.
- **Match** — part of the field’s name/label/placeholder (e.g. `coupon`) or a CSS
  selector (e.g. `#promo`)
- **Type** — how to generate the value:
  | Type | Value field means |
  |------|-------------------|
  | fixed | the exact text to fill |
  | list | `S, M, L` → picks one at random |
  | number | `1-100` → random number in range |
  | date | `2020-01-01 to 2020-12-31` → random date |
  | regex | template: `#`=digit, `?`=letter, `*`=alnum (e.g. `INV-####`) |
  | lorem | a number = how many words |
- **Site** — optional; leave blank to apply everywhere, or set a hostname to scope it

### Keyboard Shortcuts
Shows your current bindings and a link to change them.

### Backup & Restore
- **Export settings** — download everything as a JSON file
- **Import settings** — restore from that file
- **Import from Fake Filler** — bring over settings and custom fields from the
  Fake Filler extension’s export

### Help
A short in-app version of this guide.

---

## Inspect fields (build rules fast)

1. Right-click → **Inspect fields**
2. Hover a field — it highlights and shows its name/id/type
3. Click it — AutoFiller saves a custom rule for that field (scoped to the site)
4. Press **Esc** to stop
5. Open **Settings → Custom Fields** and set the value/type for the new rule

---

## What gets filled

Text, email, phone, number (respects min/max), URL, date/month/week/time, color,
range, textarea, dropdowns (`select`), radio buttons, checkboxes, **file inputs**
(a dummy test file), and **contenteditable** rich-text editors — including fields
inside **Shadow DOM** and same-origin iframes.

### Consistent, valid data
One identity is used across the whole page: the email matches the name, the
city/state/zip are a real matching set, and card numbers are Luhn-valid so they
pass validation. Use **Fill with invalid data** when you want the opposite.

---

## What is never filled

- **Passwords** in profile mode (fake mode fills a dummy value only)
- Hidden, submit/button, image, and reset inputs
- Fields matching your **Ignore** list
- Fields you’ve marked to skip via “ignore already-filled”

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Only one/no fields fill | Reload the extension (`chrome://extensions` → reload) after updates |
| A specific field won’t fill | It may be a closed Shadow DOM, a cross-origin iframe, or a custom widget — these have browser limits |
| Wrong value in a field | Add a Custom Field rule to force the value |
| Shortcut does nothing | Another extension may own it — rebind at `chrome://extensions/shortcuts` |
| Settings not saving | Check you’re signed into Chrome (settings use Chrome sync) |

---

## Privacy

AutoFiller runs entirely on your device and sends no data anywhere. It only
accesses a page when you trigger a fill (no background access, no broad host
permissions). Profile data is saved with Chrome’s storage and never transmitted.
Passwords are never stored. See PRIVACY.md.
