# APS Tools — Browser Extension

Chrome / Edge extension (Manifest V3) to:

- **Add the current page** to APS Tools (card + folder)
- **Import browser bookmarks** (select some or all) into a target card

No login required for now — links are created with `createdBy: extension`.

## Prerequisites

- APS Tools backend running on `http://localhost:3001`
- At least one card in the database

## Install (development)

### Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `extension/` folder

### Edge

1. Open `edge://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `extension/` folder

## Settings

Open extension **Settings** (link in popup footer) and set the API URL (default `http://localhost:3001`).

## Usage

### Add current page

1. Open the page you want to save
2. Click the extension icon
3. Adjust title / URL if needed, pick card + folder
4. **Add to APS Tools**

### Import bookmarks

1. Open the extension popup → **Import bookmarks**
2. Pick target card and folder
3. Check bookmarks (or **Select all**)
4. **Import selected**

## API

Uses existing endpoints:

- `GET /cards`
- `POST /cards/:id/links`
- `POST /cards/:id/links/bulk`

## Tests

```bash
cd extension && npm test
```

Backend bulk import is covered by the API integration test in the root test script (see below).
