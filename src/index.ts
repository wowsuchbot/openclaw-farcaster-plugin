/**
 * OpenClaw Farcaster Plugin
 * Native Farcaster integration via Neynar API and Snapchain Postgres
 */

import type { PluginAPI } from 'openclaw/plugin-sdk/core';
import type { FarcasterConfig } from './types.js';
import { createFarcasterChannel } from './channel.js';
import { registerFarcasterTools } from './tools.js';

export interface PluginConfig {
  enabled?: boolean;
  config?: FarcasterConfig;
}

const DEFAULT_CONFIG: Partial<FarcasterConfig> = {
  autoReplyToMentions: true,
  watchChannels: [],
};

export default function register(api: PluginAPI, pluginConfig?: PluginConfig) {
  // Merge config from plugin entry + defaults
  const config: FarcasterConfig = {
    ...DEFAULT_CONFIG,
    ...pluginConfig?.config,
  } as FarcasterConfig;

  // Validate required config
  if (!config.neynarApiKey) {
    api.logger.warn('Farcaster plugin missing neynarApiKey - plugin disabled');
    return;
  }
  if (!config.neynarSignerUuid) {
    api.logger.warn('Farcaster plugin missing neynarSignerUuid - plugin disabled');
    return;
  }
  if (!config.botFid) {
    api.logger.warn('Farcaster plugin missing botFid - plugin disabled');
    return;
  }

  // Register the channel
  const channel = createFarcasterChannel(config, api);
  api.registerChannel({ plugin: channel });

  // Register agent tools
  registerFarcasterTools(config, api);

  // Register HTTP route for webhooks (if needed)
  api.registerHttpRoute({
    path: '/farcaster/webhook',
    auth: 'plugin',
    match: 'exact',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method not allowed');
        return true;
      }

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          api.logger.info('Farcaster webhook received', { 
            type: payload.type,
            hash: payload.data?.hash,
          });

          // Process webhook - emit to channel
          // This would connect to the channel's inbound processing
          // For now, just acknowledge receipt
          
          res.statusCode = 200;
          res.end(JSON.stringify({ received: true }));
        } catch (error) {
          api.logger.error('Farcaster webhook parse error', { error });
          res.statusCode = 400;
          res.end('Invalid JSON');
        }
      });

      return true;
    },
  });

  // Register background service for mention polling
  api.registerService({
    id: 'farcaster-mention-poller',
    start: () => {
      api.logger.info('Farcaster mention poller started', { botFid: config.botFid });
      // Polling logic would go here
      // setInterval(() => checkMentions(), 60000)
    },
    stop: () => {
      api.logger.info('Farcaster mention poller stopped');
    },
  });

  api.logger.info('Farcaster plugin loaded', {
    botFid: config.botFid,
    watchChannels: config.watchChannels,
    hasRedash: !!(config.redashApiUrl && config.redashApiKey),
  });
}

// Export types and utilities
export * from './types.js';
export { NeynarClient, toCast } from './neynar.js';
export { RedashClient } from './redash.js';
