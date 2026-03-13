/**
 * Redash API Client
 * Query Farcaster Snapchain Postgres for analytics
 */

import type { FarcasterConfig, RedashQueryRequest, RedashQueryResult } from './types.js';

export class RedashClient {
  private apiUrl?: string;
  private apiKey?: string;

  constructor(config: FarcasterConfig) {
    this.apiUrl = config.redashApiUrl;
    this.apiKey = config.redashApiKey;
  }

  private isConfigured(): boolean {
    return !!(this.apiUrl && this.apiKey);
  }

  /**
   * Execute a SQL query via Redash
   */
  async query(sql: string, params?: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    if (!this.isConfigured()) {
      throw new Error('Redash not configured. Set REDASH_API_URL and REDASH_API_KEY.');
    }

    // Create query
    const createResponse = await fetch(`${this.apiUrl}/api/queries`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `OpenClaw Plugin Query - ${Date.now()}`,
        query: sql,
        data_source_id: 1, // Default data source, may need to be configurable
        options: {
          parameters: params || [],
        },
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Redash query creation failed: ${error}`);
    }

    const queryData = await createResponse.json() as { id: number };
    const queryId = queryData.id;

    // Execute query
    const executeResponse = await fetch(`${this.apiUrl}/api/queries/${queryId}/results`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parameters: params || {},
        max_age: 0, // Always fresh
      }),
    });

    if (!executeResponse.ok) {
      const error = await executeResponse.text();
      throw new Error(`Redash query execution failed: ${error}`);
    }

    const result = await executeResponse.json() as RedashQueryResult;
    return result.query_result.data.rows;
  }

  /**
   * Get top users in a channel by cast count
   */
  async getTopChannelUsers(channelId: string, options?: {
    limit?: number;
    daysBack?: number;
  }): Promise<{ fid: number; username: string; cast_count: number }[]> {
    const sql = `
      SELECT 
        c.fid,
        f.username,
        COUNT(*) as cast_count
      FROM casts c
      JOIN fnames f ON c.fid = f.fid
      WHERE c.parent_url LIKE '%${channelId}%'
        AND c.deleted_at IS NULL
        AND c.timestamp > NOW() - INTERVAL '${options?.daysBack ?? 7} days'
      GROUP BY c.fid, f.username
      ORDER BY cast_count DESC
      LIMIT ${options?.limit ?? 10}
    `;

    return this.query(sql) as Promise<{ fid: number; username: string; cast_count: number }[]>;
  }

  /**
   * Search casts with full SQL flexibility
   */
  async searchCasts(options: {
    textContains?: string;
    channelId?: string;
    mentionsFid?: number;
    limit?: number;
    daysBack?: number;
  }): Promise<Record<string, unknown>[]> {
    const conditions: string[] = ['c.deleted_at IS NULL'];
    
    if (options.textContains) {
      conditions.push(`c.text ILIKE '%${options.textContains}%'`);
    }
    
    if (options.channelId) {
      conditions.push(`c.parent_url LIKE '%${options.channelId}%'`);
    }
    
    if (options.mentionsFid) {
      conditions.push(`${options.mentionsFid} = ANY(c.mentions)`);
    }
    
    conditions.push(`c.timestamp > NOW() - INTERVAL '${options.daysBack ?? 7} days'`);

    const sql = `
      SELECT 
        encode(c.hash, 'hex') as hash,
        c.fid,
        c.text,
        c.timestamp,
        f.username,
        c.mentions
      FROM casts c
      JOIN fnames f ON c.fid = f.fid
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.timestamp DESC
      LIMIT ${options.limit ?? 25}
    `;

    return this.query(sql);
  }

  /**
   * Get channel stats
   */
  async getChannelStats(channelId: string): Promise<{
    total_casts: number;
    unique_authors: number;
    avg_casts_per_day: number;
  }> {
    const sql = `
      SELECT 
        COUNT(*) as total_casts,
        COUNT(DISTINCT fid) as unique_authors,
        COUNT(*)::float / GREATEST(EXTRACT(DAY FROM MAX(timestamp) - MIN(timestamp)), 1) as avg_casts_per_day
      FROM casts
      WHERE parent_url LIKE '%${channelId}%'
        AND deleted_at IS NULL
    `;

    const results = await this.query(sql) as { total_casts: number; unique_authors: number; avg_casts_per_day: number }[];
    return results[0];
  }

  /**
   * Get most mentioned FIDs
   */
  async getMostMentioned(options?: {
    limit?: number;
    daysBack?: number;
  }): Promise<{ fid: number; mention_count: number }[]> {
    const sql = `
      SELECT 
        unnest(mentions) as fid,
        COUNT(*) as mention_count
      FROM casts
      WHERE deleted_at IS NULL
        AND array_length(mentions, 1) > 0
        AND timestamp > NOW() - INTERVAL '${options?.daysBack ?? 7} days'
      GROUP BY fid
      ORDER BY mention_count DESC
      LIMIT ${options?.limit ?? 10}
    `;

    return this.query(sql) as Promise<{ fid: number; mention_count: number }[]>;
  }
}
