# OpenClaw Farcaster Plugin - Development Plan

## Phase 1: Core Channel Plugin ✅

**Goal:** Register Farcaster as a native OpenClaw channel with basic send/receive.

### Tasks

- [x] Create `openclaw.plugin.json` manifest
- [x] Implement `registerChannel({ plugin })` with:
  - `meta.id`: `farcaster`
  - `meta.label`: `Farcaster`
  - `capabilities.chatTypes`: `["direct", "group"]`
  - `config.listAccountIds` / `config.resolveAccount`
- [x] Implement `outbound.sendText` using Neynar API
- [x] Wire up inbound via polling (`poll()` method)
- [x] Map Farcaster FIDs to OpenClaw sender IDs

### Config Shape

```json5
{
  channels: {
    farcaster: {
      accounts: {
        default: {
          neynarApiKey: "...",
          signerUuid: "...",
          fid: 874249,  // suchbot's FID
          enabled: true,
        },
      },
    },
  },
}
```

## Phase 2: Agent Tools ✅

**Goal:** Expose Farcaster operations as agent tools.

### Tools Implemented

- `farcaster_cast` - Post a cast (text, channel, parentHash)
- `farcaster_reply` - Reply to a cast
- `farcaster_feed` - Fetch channel feed
- `farcaster_search` - Search casts by keyword
- `farcaster_user` - Look up user profile by FID/username
- `farcaster_analytics_top_users` - Top channel users via Postgres
- `farcaster_analytics_channel_stats` - Channel statistics
- `farcaster_analytics_query` - Custom SQL queries

### Implementation

All tools registered via `api.registerTool()` with proper schemas.

## Phase 3: Channel Integration

**Goal:** Watch channels and trigger agent workflows.

### Features

- Channel subscription (/cryptoart, etc.)
- Keyword monitoring in watched channels
- Engagement detection (high likes/replies = agent attention)
- Auto-reply to mentions (move logic from Conductor skill to plugin)

### Config

```json5
{
  channels: {
    farcaster: {
      accounts: {
        default: { ... },
      },
      watch: {
        channels: ["cryptoart"],
        keywords: ["agent", "swarm", "nft"],
        autoReplyToMentions: true,
      },
    },
  },
}
```

## Phase 4: Polish & Distribution

- [ ] Error handling and retries
- [ ] Rate limiting awareness (Neynar limits)
- [ ] Multi-account support
- [ ] Skill file for agent guidance (`skills/farcaster/SKILL.md`)
- [ ] Publish to npm as `@openclaw/farcaster`

## Dependencies

- **Neynar API** - Primary Farcaster API provider
- `openclaw/plugin-sdk` - Plugin SDK
- TypeScript + jiti (runtime TS loading)

## Open Questions

1. **Webhook vs Polling** - Neynar webhooks are reliable but require a public endpoint. Polling is simpler but less real-time. Hybrid?
2. **State Storage** - Where to track last-seen cast hashes? Plugin-owned SQLite? OpenClaw state?
3. **Mention deduplication** - Current `notifications.json` approach works. Migrate or keep separate?

## Timeline

- **Week 1:** Phase 1 (basic channel)
- **Week 2:** Phase 2 (tools)
- **Week 3:** Phase 3 (channel watching)
- **Week 4:** Phase 4 (polish, publish)

## Progress

**2026-03-13:**
- ✅ Project scaffolding (manifest, package.json, tsconfig)
- ✅ Type definitions (Cast, User, Channel, etc.)
- ✅ Neynar client (post, reply, search, feed, user lookup)
- ✅ Redash/Postgres client (top users, channel stats, custom queries)
- ✅ Channel implementation (sendText, sendReply, poll)
- ✅ 8 agent tools registered
- ✅ Webhook endpoint (`/farcaster/webhook`)
- ✅ Background service for mention polling

**Next:**
- [ ] Build and test locally
- [ ] Link to OpenClaw for integration testing
- [ ] Add unit tests

---

*Started: 2026-03-13*
