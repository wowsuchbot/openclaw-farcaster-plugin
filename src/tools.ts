/**
 * Agent Tools for Farcaster Operations
 */

import type { PluginAPI } from 'openclaw/plugin-sdk/core';
import type { FarcasterConfig } from './types.js';
import { NeynarClient, toCast } from './neynar.js';
import { RedashClient } from './redash.js';

interface ToolContext {
  cfg: unknown;
  accountId?: string;
}

export function registerFarcasterTools(config: FarcasterConfig, api: PluginAPI) {
  const neynar = new NeynarClient(config);
  const redash = new RedashClient(config);
  const logger = api.logger.child({ component: 'farcaster-tools' });

  // Tool: Post a cast
  api.registerTool({
    name: 'farcaster_cast',
    description: 'Post a cast to Farcaster. Use for broadcasting thoughts, announcements, or starting conversations.',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The cast text (max 320 characters recommended)',
        },
        channel: {
          type: 'string',
          description: 'Optional channel ID to post in (e.g., "cryptoart")',
        },
        parentHash: {
          type: 'string',
          description: 'Optional parent cast hash to reply to',
        },
      },
      required: ['text'],
    },
    handler: async (params: { text: string; channel?: string; parentHash?: string }) => {
      const response = await neynar.postCast(params.text, {
        channelId: params.channel,
        parentHash: params.parentHash,
      });

      return {
        success: true,
        cast: {
          hash: response.cast.hash,
          text: response.cast.text,
          author: response.cast.author.username,
          timestamp: response.cast.timestamp,
        },
      };
    },
  });

  // Tool: Reply to a cast
  api.registerTool({
    name: 'farcaster_reply',
    description: 'Reply to an existing cast on Farcaster.',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The reply text',
        },
        parentHash: {
          type: 'string',
          description: 'The hash of the cast to reply to',
        },
      },
      required: ['text', 'parentHash'],
    },
    handler: async (params: { text: string; parentHash: string }) => {
      const response = await neynar.replyToCast(params.text, params.parentHash);
      return {
        success: true,
        reply: {
          hash: response.cast.hash,
          text: response.cast.text,
          parentHash: params.parentHash,
        },
      };
    },
  });

  // Tool: Search casts
  api.registerTool({
    name: 'farcaster_search',
    description: 'Search for casts on Farcaster by keyword.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        limit: {
          type: 'number',
          description: 'Number of results (default: 10)',
        },
      },
      required: ['query'],
    },
    handler: async (params: { query: string; limit?: number }) => {
      const response = await neynar.searchCasts(params.query, { limit: params.limit ?? 10 });
      
      return {
        success: true,
        query: params.query,
        results: response.result.casts.map(cast => ({
          hash: cast.hash,
          text: cast.text,
          author: cast.author.username,
          authorFid: cast.author.fid,
          timestamp: cast.timestamp,
          likes: cast.reactions.likes_count,
          recasts: cast.reactions.recasts_count,
        })),
      };
    },
  });

  // Tool: Get user profile
  api.registerTool({
    name: 'farcaster_user',
    description: 'Look up a Farcaster user by FID or username.',
    parameters: {
      type: 'object',
      properties: {
        fid: {
          type: 'number',
          description: 'User FID',
        },
        username: {
          type: 'string',
          description: 'Username (without @)',
        },
      },
    },
    handler: async (params: { fid?: number; username?: string }) => {
      if (params.fid) {
        const response = await neynar.getUserByFid(params.fid);
        return { success: true, users: response.users };
      } else if (params.username) {
        const response = await neynar.getUserByUsername(params.username);
        return { success: true, user: response.result.user };
      }
      return { success: false, error: 'Provide fid or username' };
    },
  });

  // Tool: Get channel feed
  api.registerTool({
    name: 'farcaster_feed',
    description: 'Get recent casts from a Farcaster channel.',
    parameters: {
      type: 'object',
      properties: {
        channelId: {
          type: 'string',
          description: 'Channel ID (e.g., "cryptoart")',
        },
        limit: {
          type: 'number',
          description: 'Number of casts (default: 25)',
        },
      },
      required: ['channelId'],
    },
    handler: async (params: { channelId: string; limit?: number }) => {
      const response = await neynar.getChannelFeed(params.channelId, { limit: params.limit ?? 25 });
      
      return {
        success: true,
        channelId: params.channelId,
        casts: response.casts.map(cast => ({
          hash: cast.hash,
          text: cast.text,
          author: cast.author.username,
          authorFid: cast.author.fid,
          timestamp: cast.timestamp,
          likes: cast.reactions.likes_count,
        })),
      };
    },
  });

  // Tool: Analytics - Top channel users
  api.registerTool({
    name: 'farcaster_analytics_top_users',
    description: 'Get top users in a Farcaster channel by cast count. Uses Snapchain Postgres.',
    parameters: {
      type: 'object',
      properties: {
        channelId: {
          type: 'string',
          description: 'Channel ID (e.g., "cryptoart")',
        },
        daysBack: {
          type: 'number',
          description: 'Days to look back (default: 7)',
        },
        limit: {
          type: 'number',
          description: 'Number of users (default: 10)',
        },
      },
      required: ['channelId'],
    },
    handler: async (params: { channelId: string; daysBack?: number; limit?: number }) => {
      try {
        const results = await redash.getTopChannelUsers(params.channelId, {
          daysBack: params.daysBack ?? 7,
          limit: params.limit ?? 10,
        });
        return { success: true, results };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Query failed',
          note: 'Redash may not be configured',
        };
      }
    },
  });

  // Tool: Analytics - Channel stats
  api.registerTool({
    name: 'farcaster_analytics_channel_stats',
    description: 'Get statistics for a Farcaster channel. Uses Snapchain Postgres.',
    parameters: {
      type: 'object',
      properties: {
        channelId: {
          type: 'string',
          description: 'Channel ID (e.g., "cryptoart")',
        },
      },
      required: ['channelId'],
    },
    handler: async (params: { channelId: string }) => {
      try {
        const stats = await redash.getChannelStats(params.channelId);
        return { success: true, stats };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Query failed',
          note: 'Redash may not be configured',
        };
      }
    },
  });

  // Tool: Analytics - Custom SQL query
  api.registerTool({
    name: 'farcaster_analytics_query',
    description: 'Run a custom SQL query against Farcaster Snapchain data. Use for complex analytics.',
    parameters: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'SQL query (SELECT only, tables: casts, fids, fnames, channels, channel_follows)',
        },
      },
      required: ['sql'],
    },
    handler: async (params: { sql: string }) => {
      // Safety check - only allow SELECT
      if (!params.sql.trim().toLowerCase().startsWith('select')) {
        return { success: false, error: 'Only SELECT queries allowed' };
      }

      try {
        const results = await redash.query(params.sql);
        return { success: true, results, rowCount: results.length };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Query failed',
          note: 'Redash may not be configured',
        };
      }
    },
  });

  logger.info('Farcaster tools registered', {
    toolCount: 8,
    hasRedash: !!(config.redashApiUrl && config.redashApiKey),
  });
}
