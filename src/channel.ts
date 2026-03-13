/**
 * Farcaster Channel Implementation
 * Registers Farcaster as a native OpenClaw channel
 */

import type { PluginAPI } from 'openclaw/plugin-sdk/core';
import type { FarcasterConfig, Cast, FarcasterInboundMessage } from './types.js';
import { NeynarClient, toCast } from './neynar.js';

export function createFarcasterChannel(config: FarcasterConfig, api: PluginAPI) {
  const neynar = new NeynarClient(config);
  const logger = api.logger.child({ component: 'farcaster-channel' });

  return {
    id: 'farcaster',
    meta: {
      id: 'farcaster',
      label: 'Farcaster',
      selectionLabel: 'Farcaster (Neynar)',
      docsPath: '/channels/farcaster',
      blurb: 'Decentralized social network via Neynar API and Snapchain Postgres',
      aliases: ['fc', 'farcaster'],
    },

    capabilities: {
      chatTypes: ['direct', 'group'] as const,
      supportsThreads: true,
      supportsReactions: true,
      supportsMedia: false,
      supportsTyping: false,
    },

    config: {
      listAccountIds: (cfg) => {
        const accounts = cfg.channels?.farcaster?.accounts ?? {};
        return Object.keys(accounts);
      },

      resolveAccount: (cfg, accountId) => {
        const account = cfg.channels?.farcaster?.accounts?.[accountId ?? 'default'];
        if (!account) {
          return { accountId: accountId ?? 'default', enabled: false };
        }
        return {
          accountId: accountId ?? 'default',
          enabled: account.enabled ?? true,
          botFid: account.botFid,
        };
      },

      inspectAccount: (cfg, accountId) => {
        const account = cfg.channels?.farcaster?.accounts?.[accountId ?? 'default'];
        return {
          accountId: accountId ?? 'default',
          enabled: account?.enabled ?? false,
          configured: !!account,
          botFid: account?.botFid,
          botFidStatus: account?.botFid ? 'available' : 'missing',
          watchChannels: account?.watchChannels ?? [],
        };
      },
    },

    outbound: {
      deliveryMode: 'direct' as const,

      /**
       * Send a text message (cast)
       */
      sendText: async ({ text, replyTo, channel }) => {
        try {
          const response = await neynar.postCast(text, {
            parentHash: replyTo,
            channelId: channel,
          });

          logger.info('Cast posted', {
            hash: response.cast.hash,
            fid: response.cast.author.fid,
          });

          return {
            ok: true,
            messageId: response.cast.hash,
            timestamp: new Date(response.cast.timestamp),
          };
        } catch (error) {
          logger.error('Failed to post cast', { error, text: text.slice(0, 50) });
          return {
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },

      /**
       * Reply to a cast
       */
      sendReply: async ({ text, replyTo }) => {
        if (!replyTo) {
          return { ok: false, error: 'replyTo (parent hash) required' };
        }

        try {
          const response = await neynar.replyToCast(text, replyTo);
          return {
            ok: true,
            messageId: response.cast.hash,
            timestamp: new Date(response.cast.timestamp),
          };
        } catch (error) {
          logger.error('Failed to reply to cast', { error, replyTo });
          return {
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    },

    /**
     * Poll for new mentions/replies
     * Called by OpenClaw on heartbeat
     */
    poll: async (options?: { lastPolledAt?: Date }) => {
      if (!config.botFid) {
        return { messages: [] };
      }

      try {
        const mentions = await neynar.getMentions(config.botFid, { limit: 25 });
        
        const messages: FarcasterInboundMessage[] = mentions.casts
          .filter(cast => {
            if (options?.lastPolledAt) {
              return new Date(cast.timestamp) > options.lastPolledAt;
            }
            return true;
          })
          .map(cast => ({
            messageId: cast.hash,
            senderId: String(cast.author.fid),
            senderFid: cast.author.fid,
            text: cast.text,
            timestamp: new Date(cast.timestamp),
            channel: cast.channel_id,
            parentHash: cast.parent_hash,
            metadata: {
              hash: cast.hash,
              mentions: [], // Would need to fetch from full cast data
              embeds: [],
            },
          }));

        return { messages };
      } catch (error) {
        logger.error('Poll failed', { error });
        return { messages: [] };
      }
    },

    /**
     * Get channel feed
     */
    getChannelFeed: async (channelId: string, options?: { limit?: number }) => {
      return neynar.getChannelFeed(channelId, options);
    },

    /**
     * Search casts
     */
    searchCasts: async (query: string, options?: { limit?: number }) => {
      return neynar.searchCasts(query, options);
    },
  };
}

export type FarcasterChannel = ReturnType<typeof createFarcasterChannel>;
