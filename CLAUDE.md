# JARVIS — Claude Code Context

## Project Overview
Electron-based AI desktop assistant for macOS. Runs as a menu bar tray app (380×600px frameless transparent window). Toggle via **Cmd+Shift+J** or tray click. Responds in German by default (switches to English if user writes English).

Owner/developer: Paul Küffmann (pkueffmann-debug/Jarvis on GitHub)

---

## Stack
- **Electron 28** + Node.js (main process)
- **React 18 + Vite + Tailwind CSS** (renderer)
- **Anthropic SDK** → `claude-sonnet-4-6` with streaming + tool use
- **OpenAI SDK** — Whisper STT + optional TTS
- **ElevenLabs** — primary TTS voice
- **Picovoice Porcupine** — wake word detection ("JARVIS")
- **node-cron** — proactive briefings
- **Express + Stripe** — licensing backend (Railway)
- **Electron Builder** → DMG (arm64 + x64), GitHub Releases auto-update

---

## File Structure
```
main.js              Electron main: tray, windows, IPC, tool executor (switch)
preload.js           contextBridge → window.jarvis API for renderer
renderer/src/        React UI: App, Chat, Settings, Voice, WakeWord, Paywall
services/
  claude.js          Claude streaming + tool loop + history management
  license.js         Local license check (trial / free / paid)
  memory.js          Key-value facts + conversation history (~/.jarvis/)
  proactive.js       Cron jobs: morning briefing, evening summary, meeting alerts
  voice.js           STT (Whisper) + TTS (ElevenLabs / OpenAI)
  wakeword.js        Porcupine wake word engine
  config.js          Persisted API key storage (independent of .env)
  os-control.js      Open/close/switch apps, volume, brightness, shell, screenshot
  screen.js          Screen capture + Claude Vision analysis
  clipboard-history.js  Rolling clipboard monitor
  focus.js           Focus mode + DND
  [gmail, calendar, imessage, contacts, notes, reminders, photos, safari,
   notion, obsidian, weather, search, news, stocks, crypto, wikipedia,
   whatsapp, notifications, files, system, permissions, updater]
backend/server.js    Express: Stripe checkout, license verify, webhook
website/index.html   Landing page (standalone HTML, served by website/server.js)
```

---

## Claude Integration (`services/claude.js`)
- Model: `claude-sonnet-4-6`, max_tokens: 2048
- System prompt: German, JARVIS persona, no Markdown in responses, max 2-3 sentences
- System prompt uses `cache_control: { type: 'ephemeral' }` for prompt caching
- **Tool use loop**: up to 10 iterations; breaks on non-`tool_use` stop_reason
- **History**: max 10 messages sent per API call (`history.slice(-10)`), stored up to 40
- **`sanitizeMessages(msgs)`**: forward-scan — every `tool_use` must be immediately followed by `tool_result`; orphaned pairs dropped. Runs before EVERY API call.
- History persisted to `~/.jarvis/history.json`

### History Bug — Fixed
The `tool_use ids were found without tool_result blocks` error was caused by orphaned `tool_use` messages after history trimming. Fixed with a forward-scan in `sanitizeMessages` that processes pairs together and drops any broken pair in both directions.

---

## Tools (50+ defined in `TOOLS` array in `services/claude.js`)
Gmail, Calendar, Memory (remember/recall/forget), Files, System info, Clipboard,
Notifications, OS Control (open/close/switch apps, volume, brightness, screenshot,
lock, sleep, restart, shutdown), Shell (`execute_shell` with dangerous-command gate),
Screen analysis (vision), Clipboard history, Focus mode, iMessage, Contacts,
Apple Notes, Reminders, Photos, Safari (tabs/history), Notion, Obsidian,
Weather (wttr.in, free), Web search (DuckDuckGo, free), News (RSS),
Stocks (Yahoo Finance, free), Crypto (CoinGecko, free), Wikipedia, WhatsApp, FaceTime

**Dangerous tools** (`system_restart`, `system_shutdown`, `execute_shell` when risky)
send `jarvis-confirm` to renderer and await user confirmation before executing.

---

## Licensing (`services/license.js`)
- 7-day trial → unlimited messages
- After trial: 50 messages/day free
- Paid: Pro €49/mo (1 user), Team €199/mo (10 users), Enterprise €499/mo (unlimited)
- Keys: `JARVIS-XXXX-XXXX-XXXX` stored in `~/.jarvis/license.json`
- Backend verifies via `POST /verify-license` (`BACKEND_URL` env var)

---

## API Keys & Config
Stored via `services/config.js` (persists in `~/.jarvis/config.json`, loaded into `process.env` on startup — survives `.env` changes).

| Key | Purpose |
|-----|---------|
| `ANTHROPIC_API_KEY` | Required |
| `OPENAI_API_KEY` | STT (Whisper) + fallback TTS |
| `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` | Primary TTS |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Gmail + Calendar |
| `PICOVOICE_ACCESS_KEY` | Wake word |
| `NOTION_API_KEY` + `NOTION_DATABASE_ID` | Notion integration |
| `OBSIDIAN_VAULT_PATH` | Obsidian vault path |
| `BACKEND_URL` | License backend (default: `http://localhost:4000`) |

Personalization in `.env`:
```
JARVIS_OWNER_NAME=Paul
JARVIS_WAKE_WORD=Hey JARVIS
JARVIS_MORNING_BRIEFING_TIME=08:00
JARVIS_EVENING_SUMMARY_TIME=18:00
```

---

## Proactive Features (`services/proactive.js`)
- **Morning briefing** — cron at `JARVIS_MORNING_BRIEFING_TIME`: greets, shows today's calendar + unread email count
- **Evening summary** — cron at `JARVIS_EVENING_SUMMARY_TIME`: asks what to prep for tomorrow
- **Meeting watcher** — every minute: sends macOS notification 5 min before Google Calendar events

---

## Dev Commands
```bash
npm run dev          # Vite + Electron hot reload
npm run build        # Vite build → dist/
npm run dist         # build + create DMG (arm64 + x64)
cd backend && node server.js  # license backend on :4000
```

---

## Key Patterns & Gotchas
- **IPC flow**: renderer sends `send-message` → main calls `claude.streamChat` → streams `jarvis-chunk` back → sends `jarvis-done`
- **Config vs .env**: user keys are in `config.js` store, not `.env`. `configSvc.applyToEnv()` runs on app ready.
- **History sync**: `newMessages` tracks only this exchange's messages; appended to `history[]` (mutated in place) after the loop.
- **Screenshot tool**: hides window 500ms before capture, shows it after.
- **Single instance**: enforced in production via `app.requestSingleInstanceLock()`. Dev mode skips this.
- **First launch**: shows onboarding window (560×680) to request permissions. `perms.isFirstLaunch()` gates this.
- **Dock**: hidden in normal operation (tray-only). Shown during onboarding and dev mode.
