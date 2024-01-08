export type TorrentInfoFile = {
  name: string;
  path: string;
  length: number;
};

export type TorrentInfo = {
  infoHash: string;
  name: string;
  magnetURI: string;
  files: Array<TorrentInfoFile>;
};

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
