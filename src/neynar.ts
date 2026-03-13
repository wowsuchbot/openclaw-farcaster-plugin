/**
 * Neynar API Client
 * Handles Farcaster operations via Neynar
 */

import type { FarcasterConfig, Cast, FarcasterUser, NeynarCastResponse, NeynarSearchResponse } from './types.js';

const NEYNAR_API_BASE = 'https://api.neynar.com/v2';

export class NeynarClient {
  private apiKey: string;
  private signerUuid: string;

  constructor(config: FarcasterConfig) {
    this.apiKey = config.neynarApiKey;
    this.signerUuid = config.neynarSignerUuid;
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST';
      body?: Record<string, unknown>;
      params?: Record<string, string | number>;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, params } = options;
    
    let url = `${NEYNAR_API_BASE}${endpoint}`;
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      );
      url += `?${searchParams.toString()}`;
    }

    const headers: Record<string, string> = {
      'api_key': this.apiKey,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Neynar API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * Post a new cast
   */
  async postCast(text: string, options?: {
    parentHash?: string;
    channelId?: string;
    embeds?: { url: string }[];
  }): Promise<NeynarCastResponse> {
    return this.request<NeynarCastResponse>('/farcaster/cast', {
      method: 'POST',
      body: {
        signer_uuid: this.signerUuid,
        text,
        parent: options?.parentHash,
        channel_id: options?.channelId,
        embeds: options?.embeds,
      },
    });
  }

  /**
   * Reply to a cast
   */
  async replyToCast(text: string, parentHash: string): Promise<NeynarCastResponse> {
    return this.postCast(text, { parentHash });
  }

  /**
   * Get cast by hash
   */
  async getCast(hash: string): Promise<NeynarCastResponse> {
    return this.request<NeynarCastResponse>('/farcaster/cast', {
      params: { identifier: hash, type: 'hash' },
    });
  }

  /**
   * Get user by FID
   */
  async getUserByFid(fid: number): Promise<{ users: FarcasterUser[] }> {
    return this.request('/farcaster/user/bulk', {
      params: { fids: fid },
    });
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<{ result: { user: FarcasterUser } }> {
    return this.request('/farcaster/user/by-username', {
      params: { username },
    });
  }

  /**
   * Search casts
   */
  async searchCasts(query: string, options?: {
    limit?: number;
    cursor?: string;
  }): Promise<NeynarSearchResponse> {
    const params: Record<string, string | number> = {
      q: query,
      top: options?.limit ?? 10,
    };
    if (options?.cursor) params.cursor = options.cursor;
    
    return this.request('/farcaster/cast/search', { params });
  }

  /**
   * Get feed for a channel
   */
  async getChannelFeed(channelId: string, options?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ casts: NeynarCastResponse['cast'][]; next: { cursor: string } }> {
    const params: Record<string, string | number> = {
      channel_id: channelId,
      limit: options?.limit ?? 25,
    };
    if (options?.cursor) params.cursor = options.cursor;

    return this.request('/farcaster/feed/channels', { params });
  }

  /**
   * Get user's followers
   */
  async getFollowers(fid: number, options?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ users: FarcasterUser[]; next: { cursor: string } }> {
    const params: Record<string, string | number> = {
      fid,
      limit: options?.limit ?? 100,
    };
    if (options?.cursor) params.cursor = options.cursor;

    return this.request('/farcaster/followers', { params });
  }

  /**
   * Get mentions for a user
   */
  async getMentions(fid: number, options?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ casts: NeynarCastResponse['cast'][]; next: { cursor: string } }> {
    const params: Record<string, string | number> = {
      fid,
      limit: options?.limit ?? 25,
    };
    if (options?.cursor) params.cursor = options.cursor;

    return this.request('/farcaster/mentions', { params });
  }
}

/**
 * Convert Neynar cast to internal Cast type
 */
export function toCast(neynarCast: NeynarCastResponse['cast']): Cast {
  return {
    hash: neynarCast.hash,
    fid: neynarCast.author.fid,
    text: neynarCast.text,
    timestamp: new Date(neynarCast.timestamp),
    parentHash: neynarCast.parent_hash,
    author: {
      fid: neynarCast.author.fid,
      username: neynarCast.author.username,
      displayName: neynarCast.author.display_name,
      pfpUrl: neynarCast.author.pfp_url,
    },
  };
}
