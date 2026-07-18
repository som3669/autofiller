# AutoFiller

Fill web forms in one click — with realistic **fake test data** (for developers
and QA) or your own saved **profile**. Click the toolbar icon and the whole page
fills instantly. Passwords are never stored.

## Install (unpacked, for testing)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `autofiller` folder

## Quick start

- **Click the toolbar icon** → fills the current page with fake data
- **`Alt+Shift+F`** → same, from the keyboard
- **Right-click a page or field** → more options (see below)
- **Right-click the icon → Settings…** → set up your profile and options

## Two modes

- **Fake data** (default) — realistic random values for testing forms
- **My profile** — your real name, email, phone, address, etc.

## Features

- One consistent identity per fill — email matches the name, city/state/zip are coherent
- Valid data — Luhn-valid card numbers, valid email/phone/postal formats
- Covers text, email, tel, number, url, date, color, range, textarea, select,
  radio, checkbox, **file inputs**, and **contenteditable** editors
- Works inside **Shadow DOM** and iframes
- Custom field rules with generators: fixed, list, number range, date range, regex/template, lorem
- Multiple profiles you can switch between
- Fill this form / this input (scoped) and Fill & submit
- **Fill with invalid data** to test form validation
- **Inspect fields** — click any field to save it as a rule
- Highlight filled fields (green flash)
- Backup/restore settings, and **import from Fake Filler**
- No passwords ever stored (fake mode fills a dummy value only)

See MANUAL.md for the full guide.

## Privacy

Everything runs on your device. AutoFiller sends no data anywhere. It only touches
a page when you trigger it (`activeTab` + `scripting`, no broad host access). See
PRIVACY.md.
