# secclaw

A minimal personal AI agent that runs on your machine. You talk to it in Telegram.

secclaw is a thin bridge of about 400 lines. [Pi](https://pi.dev) does the real work: the agent loop, tools (`read`, `write`, `edit`, `bash`), models, skills, extensions, and history. You bring your own model, skills, and CLIs.

## Install

Requires [Node.js 22+](https://nodejs.org). On Windows, also install [Git for Windows](https://git-scm.com/download/win), because Pi's shell tool uses Git Bash.

Models come preconfigured, so you only add your keys:

| Provider | Models | Key in `.env` |
|---|---|---|
| [OpenRouter](https://openrouter.ai/keys) | GLM (`z-ai/glm-5.3-flash`), the default | `OPENROUTER_API_KEY` |
| [Abliteration](https://abliteration.ai) | Abliterated Model, Large, Large v2 | `ABLITERATION_API_KEY` |

Each provider is active once its key is set. Switch between them with `/model` in Telegram.

### Option 1: setup wizard

```bash
git clone https://github.com/NetanelRotem/secclaw && cd secclaw
./setup.sh        # Linux / macOS
setup.cmd         # Windows
```

The setup installs dependencies, asks for a Telegram bot token, your API keys, and which skills to enable. It can also run the bot in the background and start it automatically on boot or login:

| OS | How | Logs |
|---|---|---|
| Linux | systemd service (restarts on crash) | `journalctl -u secclaw -f` |
| macOS | launchd agent (restarts on crash) | `data/secclaw.log` |
| Windows | hidden process started from the Startup folder | `data/secclaw.log` |

At the end it prints a pairing code: send `/pair <code>` to your bot and the bot is yours. Everyone else is ignored.

### Option 2: just a `.env` file

```bash
git clone https://github.com/NetanelRotem/secclaw && cd secclaw
npm ci && npm run build
cp .env.example .env    # fill in TELEGRAM_BOT_TOKEN and your API keys
npm start
```

Get a bot token from [@BotFather](https://t.me/BotFather). On first start the bot prints a pairing code in the terminal: send `/pair <code>` to your bot.

Run `npm run setup` again at any time to change these settings. To update, run `git pull && npm run build`. Your personal files are git-ignored, so an update never touches them.

## Telegram commands

| Command | |
|---|---|
| `/new` | start a new conversation |
| `/stop` | abort the current run |
| `/model` | switch between your configured models |
| `/skills` | enable / disable skills |
| `/status` | model, session, active skills |
| `/reload` | reload skills, extensions and AGENTS.md |
| `/skill:name …` | run a skill explicitly (Pi built-in) |

Everything else is a message to the agent. If you send a message while the agent is still working, it steers the current run.

## Make it yours

Everything personal lives in `pi/`, which is Pi's own config directory:

| Path | What |
|---|---|
| `pi/AGENTS.md` | personality, rules, what it knows about you |
| `pi/skills/<name>/SKILL.md` | skills: instructions plus any CLI on the machine |
| `pi/extensions/` | custom tools, hooks, providers ([example](pi/extensions/README.md)) |
| `pi/models.json` | OpenAI-compatible endpoints (Abliteration, Ollama, vLLM, Groq, …) |
| `pi/settings.json` | default model and [other Pi settings](node_modules/@earendil-works/pi-coding-agent/docs/settings.md) |

The agent works in `workspace/`. Conversations are stored in `data/sessions/`.
`npm run pi -- <args>` runs Pi's own CLI against this `pi/` folder.

### Add a model

**Built-in provider** (OpenRouter, Anthropic, OpenAI, Google, Groq, DeepSeek, …): add its key to `.env` (e.g. `ANTHROPIC_API_KEY=sk-...`) and restart the bot. To restart, run `sudo systemctl restart secclaw` on Linux, or run `npm run setup` again on any OS.

Then list the models you want in `/model` under `enabledModels` in `pi/settings.json` (e.g. `"anthropic/claude-sonnet-5"`; patterns like `"anthropic/*"` work too).

**Subscription login** (Claude, ChatGPT, …): run `npm run pi`, then type `/login` inside Pi.

**Any OpenAI-compatible endpoint** (Ollama, vLLM, LM Studio, a proxy): add it to `pi/models.json`:

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [{ "id": "qwen3:8b" }]
    }
  }
}
```

`apiKey` can also reference an env var, e.g. `"$MY_API_KEY"`. Then pick the model in `/model`.

**What `/model` shows:** everything in `pi/models.json`, the default model, and `enabledModels` from `pi/settings.json` — only the ones Pi has a key for.

**Default model:** set `defaultProvider` and `defaultModel` in `pi/settings.json`. Choosing a model in `/model` also saves it as the default.

### Install a skill

A skill is a folder with a `SKILL.md`: a name, a description, and instructions. Any [Agent Skills](https://agentskills.io) skill works.

```bash
# copy or clone it into pi/skills
git clone https://github.com/someone/some-skill pi/skills/some-skill

# or install a Pi package (skills + extensions) from npm or git
npm run pi -- install git:github.com/someone/pi-tools
```

Then send `/reload` in Telegram and toggle the skill in `/skills`.

Write your own skill:

```markdown
---
name: weather
description: Get the weather forecast. Use when the owner asks about weather.
---
Run `curl -s "wttr.in/CITY?format=3"` and answer in one line.
```

A skill can wrap any CLI you install on the machine (`gh`, `ffmpeg`, `yt-dlp`, …). Install the CLI, then write a skill describing when and how to use it.

### Add a tool

Put a Pi extension in `pi/extensions/` ([example](pi/extensions/README.md)) and send `/reload`.

## Other scripts

```bash
npm run chat          # talk to the agent in the terminal (no Telegram)
npm run chat "hi"     # one-shot
npm run dev           # run the bot without building
npm run unpair        # forget the owner and allow pairing again
npm run pi            # Pi's own CLI on this config (login, install, …)
journalctl -u secclaw -f   # service logs (Linux; data/secclaw.log on macOS/Windows)
```

## Security

The agent has a real shell with your user's permissions, and prompt injection from web pages or files is possible. Run it as a dedicated user or on a machine you don't mind it touching. See [Pi's security notes](node_modules/@earendil-works/pi-coding-agent/docs/security.md).
