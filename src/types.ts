/**
 * Farcaster Plugin Types
 */

export interface FarcasterConfig {
  neynarApiKey: string;
  neynarSignerUuid: string;
  botFid: number;
  redashApiUrl?: string;
  redashApiKey?: string;
  watchChannels?: string[];
  autoReplyToMentions?: boolean;
}

export interface Cast {
  hash: string;
  fid: number;
  text: string;
  timestamp: Date;
  parentHash?: string;
  parentFid?: number;
  parentUrl?: string;
  embeds?: CastEmbed[];
  mentions?: number[];
  rootParentHash?: string;
  rootParentUrl?: string;
  author?: FarcasterUser;
}

export interface CastEmbed {
  url?: string;
  castId?: { fid: number; hash: string };
}

export interface FarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
  verifiedAddresses?: string[];
}

export interface Channel {
  channelId: string;
  url: string;
  description?: string;
  imageUrl?: string;
  leadFid: number;
  moderatorFids?: number[];
  followerCount: number;
}

export interface ChannelFollow {
  fid: number;
  channelId: string;
  timestamp: Date;
}

// Neynar API types
export interface NeynarCastResponse {
  cast: {
    hash: string;
    author: {
      fid: number;
      username: string;
      display_name: string;
      pfp_url: string;
    };
    text: string;
    timestamp: string;
    parent_hash?: string;
    channel_id?: string;
    reactions: {
      likes_count: number;
      recasts_count: number;
    };
  };
}

export interface NeynarSearchResponse {
  result: {
    casts: NeynarCastResponse['cast'][];
  };
}

// Redash query types
export interface RedashQueryRequest {
  query: string;
  parameters?: Record<string, unknown>;
  max_age?: number;
}

export interface RedashQueryResult {
  query_result: {
    id: number;
    query_hash: string;
    data: {
      rows: Record<string, unknown>[];
      fields: { name: string; type: string }[];
    };
    runtime: number;
    retrieved_at: string;
  };
}

// OpenClaw message mapping
export interface FarcasterInboundMessage {
  messageId: string;
  senderId: string;
  senderFid: number;
  text: string;
  timestamp: Date;
  channel?: string;
  parentHash?: string;
  replyTo?: string;
  metadata: {
    hash: string;
    mentions: number[];
    embeds: CastEmbed[];
  };
}
