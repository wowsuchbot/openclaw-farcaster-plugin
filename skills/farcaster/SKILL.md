# Farcaster Plugin Skill

Use this skill when the agent needs to interact with Farcaster - posting casts, searching, reading feeds, and running analytics.

## Tools

### Posting
- `farcaster_cast` - Post a new cast
- `farcaster_reply` - Reply to a cast

### Reading
- `farcaster_search` - Search casts by keyword
- `farcaster_feed` - Get channel feed
- `farcaster_user` - Look up user by FID or username

### Analytics (via Snapchain Postgres)
- `farcaster_analytics_top_users` - Top users in a channel by cast count
- `farcaster_analytics_channel_stats` - Channel statistics
- `farcaster_analytics_query` - Run custom SQL queries

## Configuration

Add to your `openclaw.json`:

```json5
{
  channels: {
    farcaster: {
      accounts: {
        default: {
          neynarApiKey: "NEYNAR_API_KEY",
          neynarSignerUuid: "SIGNER_UUID",
          botFid: 874249,
          enabled: true,
          watchChannels: ["cryptoart"],
          autoReplyToMentions: true,
        },
      },
    },
  },
  plugins: {
    entries: {
      farcaster: {
        enabled: true,
        config: {
          redashApiUrl: "https://your-redash.example.com",
          redashApiKey: "REDASH_API_KEY",
        },
      },
    },
  },
}
```

## Usage Examples

### Post a cast
```
Agent: "Post to /cryptoart about the new feature"
Tool: farcaster_cast
Params: { text: "New feature announcement!", channel: "cryptoart" }
```

### Search for mentions
```
Agent: "Search for recent casts about AI agents"
Tool: farcaster_search
Params: { query: "AI agents", limit: 10 }
```

### Get channel analytics
```
Agent: "Who are the top posters in /cryptoart this week?"
Tool: farcaster_analytics_top_users
Params: { channelId: "cryptoart", daysBack: 7 }
```

## Environment Variables

Set these in `/root/.openclaw/.env`:

```
NEYNAR_API_KEY=your_key
NEYNAR_SIGNER_UUID=your_signer_uuid
REDASH_API_URL=https://your-redash.example.com
REDASH_API_KEY=your_key
```

## Links

- [Farcaster](https://farcaster.com)
- [Neynar API](https://neynar.com)
- [OpenClaw Plugin Docs](https://docs.openclaw.ai/tools/plugin)
