# AutoFiller

Fill web forms in one click. Save your profile and custom field rules once, then
fill any form with a click, a shortcut, or the right-click menu. **Passwords are
never stored or filled.**

## Install (unpacked, for testing)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `autofiller` folder

## Use

1. Click the AutoFiller icon → **Edit profile & rules** → fill in your details
2. Open any page with a form
3. Click the icon → **⚡ Fill this page** (or press `Alt+Shift+F`, or right-click → fill)

## Features

- **One-click fill** — popup button, keyboard shortcut, or context menu
- **Profile** — name, email, phone, full address, company, website
- **Custom rules** — match a field by its name/label/placeholder or a CSS selector,
  and give it a value; scope a rule to one site or apply it everywhere
- **Smart matching** — uses `autocomplete` attributes, input types, names, ids,
  labels and placeholders
- **Framework-safe** — dispatches proper input/change events so React/Vue forms
  register the values
- **No passwords** — password fields are always skipped

## How it works

AutoFiller does nothing until you act. On your click/shortcut, it injects a
one-off script into the current tab (via `activeTab` + `scripting`) that reads
your saved profile/rules and fills matching fields. It requests **no broad host
permissions** — it only touches a page when you tell it to.

## Privacy

Everything stays on your device. AutoFiller sends no data anywhere. Your profile
is saved with Chrome's storage and never leaves your browser. See PRIVACY.md.
