# OpenClaw Farcaster Plugin - Development Plan

## Phase 1: Core Channel Plugin

**Goal:** Register Farcaster as a native OpenClaw channel with basic send/receive.

### Tasks

- [ ] Create `openclaw.plugin.json` manifest
- [ ] Implement `registerChannel({ plugin })` with:
  - `meta.id`: `farcaster`
  - `meta.label`: `Farcaster`
  - `capabilities.chatTypes`: `["direct", "group"]`
  - `config.listAccountIds` / `config.resolveAccount`
- [ ] Implement `outbound.sendText` using Neynar API
- [ ] Wire up inbound via Neynar webhooks or polling
- [ ] Map Farcaster FIDs to OpenClaw sender IDs

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

## Phase 2: Agent Tools

**Goal:** Expose Farcaster operations as agent tools.

### Tools to Add

- `farcaster_cast` - Post a cast (text, parent hash, channel)
- `farcaster_reply` - Reply to a cast
- `farcaster_feed` - Fetch timeline or channel feed
- `farcaster_search` - Search casts by keyword
- `farcaster_user` - Look up user profile by FID/username

### Implementation

```ts
api.registerTool({
  name: "farcaster_cast",
  description: "Post a cast to Farcaster",
  parameters: { ... },
  handler: async (params) => { ... },
});
```

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

---

*Started: 2026-03-13*
