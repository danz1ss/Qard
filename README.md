# AnkiGenerator

A desktop app that turns a plain list of words into ready-to-study Anki flashcards.
For each word it generates a definition, transcription (IPA) and example sentences
with an AI model, adds free audio pronunciation, lets you preview everything, and
pushes the cards straight into Anki.

Works with **English and Russian** vocabulary out of the box.

---

## Features

- **AI card generation** — definition, word type, transcription and example sentences for each word.
- **Multiple AI providers** — pick a preset (ProxyAPI, OpenAI, OpenRouter, DeepSeek, Gemini) or plug in any OpenAI-compatible endpoint via *Custom*.
- **Free audio pronunciation** — generated with Google Translate TTS, no extra API key.
- **Duplicate detection** — words that already exist in the target deck are flagged "Already in deck" and skipped on import (you can still force-add them).
- **Import from file** — load words from a `.txt` or `.csv` file in one click.
- **Direct Anki integration** — cards are added through the AnkiConnect add-on.
- **Flexible field mapping** — map generated data to the fields of any Anki note type.
- **Batch processing** — process many words at once with a live progress bar.

---

## Requirements

Before you start, you need three things:

1. **Node.js 18+** — download the LTS version from [nodejs.org](https://nodejs.org).
   This also installs `npm`, which you'll use to run the app.

2. **Anki + AnkiConnect add-on**
   - Install Anki from [apps.ankiweb.net](https://apps.ankiweb.net).
   - Open Anki → **Tools → Add-ons → Get Add-ons…**
   - Paste the code `2055492159` and click OK.
   - Restart Anki. (Anki must be **running** whenever you use AnkiGenerator.)

3. **An AI provider API key** — one of:
   | Provider | Where to get a key |
   |----------|--------------------|
   | ProxyAPI (default, good for Russia) | https://proxyapi.ru/cabinet/api |
   | OpenAI | https://platform.openai.com/api-keys |
   | OpenRouter | https://openrouter.ai/keys |
   | DeepSeek | https://platform.deepseek.com/api_keys |
   | Gemini | https://aistudio.google.com/app/apikey |

---

## Install & run (step by step)

You don't need to be a developer — just follow these commands in a terminal.

**1. Get the code**

```bash
git clone <repository-url>
cd AnkiGenerator
```

(Or click **Code → Download ZIP** on GitHub and unzip it, then `cd` into the folder.)

**2. Install dependencies**

```bash
npm install
```

**3. Build the app**

```bash
npm run build
```

**4. Start it**

```bash
npm start
```

The AnkiGenerator window opens. That's it.

> Tip: `npm run dev` builds and launches in one step while you experiment.

### Building a standalone app (optional)

To create a distributable build (e.g. a portable Windows executable):

```bash
npm run package
```

The result appears in the `release/` folder.

---

## How to use it

The app has four tabs. Go through them left to right.

### 1. Setup

- **Anki Connection** — make sure Anki is open, then click **Refresh**. The status should turn green ("Connected"). If not, re-check the AnkiConnect step above.
- **AI Provider** — choose your provider, pick a model, and paste your API key. For *Custom*, also enter the Base URL of your OpenAI-compatible endpoint.
- **Anki Settings** — pick the target **Deck**, the **Note Type (model)**, and how many example sentences per word (1–5).
- **Field Mapping** — match each field of your note type to a data source (Word, Definition, Transcription, Examples, Word Audio, …). The app auto-maps common field names; adjust as needed.
- Click **Save Settings**.

### 2. Input

- Type or paste words — one per line, or comma-separated.
- Or click **Import from file** and pick a `.txt` / `.csv` file.
- Optional markers tell the AI which meaning you want:
  - `to run` → verb
  - `a book`, `an apple`, `the house` → noun
  - `happy` (no marker) → most common part of speech
- Click **Parse Words** to review the list (shown as chips). Remove any with the ×.

### 3. Generate

- Click **Start Generation**.
- Watch the progress: current word, stage, and how many cards are done.
- The app generates definitions/examples and audio in parallel, then checks which words already exist in your deck.

### 4. Preview & Add

- Review the generated cards; click one to expand and see all fields or play the audio.
- Cards already in the deck show an **"Already in deck"** badge and are skipped by default. Tick **"Add duplicates anyway"** if you want them too.
- Remove unwanted cards with **Remove**.
- Click **Add All to Anki**. The cards are sent to Anki in a single batch; you'll see how many were added.

---

## Field mapping examples

**Basic model** (fields: Front, Back)
- Front → Word
- Back → Definition

**Custom vocabulary model** (Word, Definition, Transcription, Examples, Audio)
- Word → Word
- Definition → Definition
- Transcription → Transcription
- Examples → Example(s)
- Audio → Word Audio

---

## Troubleshooting

**"Anki is not running or AnkiConnect addon is not installed"**
- Make sure Anki is open.
- Verify AnkiConnect is installed (Tools → Add-ons) and restart Anki.
- Check nothing else is using port `8765`.

**"API key not set" / "Failed to generate word meanings"**
- Re-check the API key on the Setup tab (no extra spaces).
- Make sure the selected **provider** and **model** match your key.
- For *Custom*, confirm the Base URL is a valid OpenAI-compatible endpoint.
- Ensure your account has quota/credits.

**Some words fail to generate**
- Check your internet connection and provider rate limits.
- Try fewer words at once.
- Open the failing card to read the error message.

**Duplicates aren't detected**
- Detection runs against the **selected deck** and matches the Anki field mapped to **Word**. Make sure a deck is chosen and a field is mapped to Word.

---

## Project structure

```
AnkiGenerator/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts          # Entry point / window
│   │   ├── preload.ts         # Secure IPC bridge
│   │   ├── services/          # Business logic (AI, AnkiConnect, TTS, settings)
│   │   └── ipc/               # IPC handlers
│   ├── renderer/              # React UI
│   │   ├── components/        # WordInput, Generation, Preview, Settings, …
│   │   ├── hooks/             # useCardGeneration, useAddToAnki
│   │   └── store/             # Zustand state
│   └── shared/                # Shared types & word parser
├── dist/                      # Build output
└── package.json
```

---

## Tech stack

- **Electron** — desktop shell (main + preload + renderer, isolated IPC)
- **React + TypeScript** — UI
- **Zustand** — state management
- **Webpack** — bundler
- **openai SDK** — AI calls against any OpenAI-compatible provider
- **Google Translate TTS** — free text-to-speech
- **AnkiConnect** — Anki integration

---

## Available scripts

- `npm run build` — build the app
- `npm start` — launch the built app
- `npm run dev` — build and launch in one go
- `npm run package` — create a distributable build

Settings are stored locally:
- Windows: `%APPDATA%/anki-generator-settings`
- macOS: `~/Library/Application Support/anki-generator-settings`
- Linux: `~/.config/anki-generator-settings`

---

## License

MIT
