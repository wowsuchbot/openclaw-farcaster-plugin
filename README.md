# OpenClaw Farcaster Plugin

A native OpenClaw plugin for Farcaster integration.

## What This Enables

- **Inbound casts as messages** - Mentions, replies, and channel posts appear as messages in OpenClaw sessions
- **Native casting** - Agents can post casts directly via tools (no webhook middleware)
- **Channel monitoring** - Watch /cryptoart and other channels for relevant content
- **Real-time feed** - Subscribe to timeline updates, not just webhook pushes

## Status

🚧 **Planning phase** - See [PLAN.md](./PLAN.md) for roadmap.

## Why a Plugin?

Current setup uses a webhook server that pushes Farcaster events to OpenClaw sessions. Works, but:

- External moving parts (webhook server, notifications.json polling)
- No native channel registration (Telegram/Discord are first-class, Farcaster is a hack)
- Manual reply logic scattered across skills

A plugin makes Farcaster a first-class OpenClaw channel like Telegram or Discord.

## Development

```bash
# Install dependencies (when ready)
npm install

# Link for local dev
openclaw plugins install -l .
```

## License

MIT
