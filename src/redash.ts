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
   * Uses profile_with_addresses view for rich user data
   */
  async getTopChannelUsers(channelId: string, options?: {
    limit?: number;
    daysBack?: number;
  }): Promise<{ fid: number; fname: string; display_name: string; cast_count: number }[]> {
    const sql = `
      SELECT 
        c.fid,
        p.fname,
        p.display_name,
        COUNT(*) as cast_count
      FROM casts c
      JOIN profile_with_addresses p ON c.fid = p.fid
      WHERE c.parent_url LIKE '%${channelId}%'
        AND c.deleted_at IS NULL
        AND c.timestamp > NOW() - INTERVAL '${options?.daysBack ?? 7} days'
      GROUP BY c.fid, p.fname, p.display_name
      ORDER BY cast_count DESC
      LIMIT ${options?.limit ?? 10}
    `;

    return this.query(sql) as Promise<{ fid: number; fname: string; display_name: string; cast_count: number }[]>;
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
        p.fname,
        p.display_name,
        c.mentions
      FROM casts c
      JOIN profile_with_addresses p ON c.fid = p.fid
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
  }): Promise<{ fid: number; fname: string; mention_count: number }[]> {
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

    const results = await this.query(sql) as { fid: number; mention_count: number }[];
    
    // Enrich with usernames
    if (results.length > 0) {
      const fids = results.map(r => r.fid).join(',');
      const userSql = `
        SELECT fid, fname 
        FROM profile_with_addresses 
        WHERE fid IN (${fids})
      `;
      const users = await this.query(userSql) as { fid: number; fname: string }[];
      const userMap = new Map(users.map(u => [u.fid, u.fname]));
      
      return results.map(r => ({
        fid: r.fid,
        fname: userMap.get(r.fid) || 'unknown',
        mention_count: r.mention_count,
      }));
    }
    
    return [];
  }

  /**
   * Get top casters overall
   */
  async getTopCasters(options?: {
    limit?: number;
    daysBack?: number;
  }): Promise<{ fid: number; fname: string; cast_count: number }[]> {
    const sql = `
      SELECT 
        c.fid,
        p.fname,
        COUNT(*) as cast_count
      FROM casts c
      JOIN profile_with_addresses p ON c.fid = p.fid
      WHERE c.deleted_at IS NULL
        AND c.timestamp > NOW() - INTERVAL '${options?.daysBack ?? 7} days'
      GROUP BY c.fid, p.fname
      ORDER BY cast_count DESC
      LIMIT ${options?.limit ?? 10}
    `;

    return this.query(sql) as Promise<{ fid: number; fname: string; cast_count: number }[]>;
  }

  /**
   * Get reaction stats for a cast
   */
  async getCastReactions(castHash: string): Promise<{
    likes: number;
    recasts: number;
  }> {
    const sql = `
      SELECT 
        SUM(CASE WHEN reaction_type = 1 THEN 1 ELSE 0 END) as likes,
        SUM(CASE WHEN reaction_type = 2 THEN 1 ELSE 0 END) as recasts
      FROM reactions
      WHERE target_hash = decode('${castHash}', 'hex')
        AND deleted_at IS NULL
    `;

    const results = await this.query(sql) as { likes: number; recasts: number }[];
    return results[0] || { likes: 0, recasts: 0 };
  }

  /**
   * Get follower graph for a FID
   */
  async getFollowerGraph(fid: number, options?: {
    limit?: number;
  }): Promise<{ fid: number; fname: string }[]> {
    const sql = `
      SELECT 
        l.fid,
        p.fname
      FROM links l
      JOIN profile_with_addresses p ON l.fid = p.fid
      WHERE l.target_fid = ${fid}
        AND l.type = 'follow'
        AND l.deleted_at IS NULL
      ORDER BY l.timestamp DESC
      LIMIT ${options?.limit ?? 100}
    `;

    return this.query(sql) as Promise<{ fid: number; fname: string }[]>;
  }

  /**
   * Get user's verified addresses
   */
  async getUserAddresses(fid: number): Promise<{
    fid: number;
    fname: string;
    verified_addresses: string[];
  }> {
    const sql = `
      SELECT 
        fid,
        fname,
        verified_addresses
      FROM profile_with_addresses
      WHERE fid = ${fid}
    `;

    const results = await this.query(sql) as { fid: number; fname: string; verified_addresses: string[] }[];
    return results[0];
  }
}
