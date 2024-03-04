import type { TorrentFile } from 'webtorrent';
import WebTorrent from 'webtorrent';

export type StreamarrFsFileEvent = {
  infoHash: string;
};

export enum FeedIndexer {
  JACKETT,
  PROWLARR,
}

export enum FeedType {
  RSS,
  JSON,
  TORZNAB,
}

export type Feed = {
  name: string;
  url: string;
  type: FeedType;
  indexer: FeedIndexer;
};

export type TorrentInfo = {
  name?: string;
  infoHash?: string;
  magnetURI?: string;
  torrentBlob?: ArrayBuffer;
  files?: Array<Pick<TorrentFile, 'name' | 'path' | 'length'>>;
  sourceType: 'magnet' | 'file';
};

export interface StreamarrFsTorrent extends WebTorrent.Torrent {
  status: 'na' | 'running' | 'pausing' | 'paused' | 'stopping';
  lastReadDate: number;
  activeReads?: number;
}
