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
