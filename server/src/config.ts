import type { LogLevel } from '@nestjs/common';

const STREAMARR_FEED_URLS = Object.keys(process.env)
  .filter((envName) =>
    envName.startsWith(
      process.env.STREAMARR_FEED_URL_PREFIX || 'STREAMARR_FEED_URL_ITEM',
    ),
  )
  .map((feedKey) => process.env[feedKey]);

const logLevel = (): Array<LogLevel> => {
  if (process.env.STREAMARR_LOG_LEVEL) {
    return process.env.STREAMARR_LOG_LEVEL.split(',').map(
      (level) => level.trim() as LogLevel,
    );
  }

  if (process.env.NODE_ENV === 'production') {
    return ['error', 'log'];
  }

  if (process.env.NODE_ENV !== 'production') {
    return ['debug', 'error', 'fatal', 'log', 'warn', 'verbose'];
  }
};

export default () => ({
  STREAMARR_DB_PATH: process.env.STREAMARR_DB_PATH ?? 'db/db.sqlite',

  STREAMARR_ADD_FREE_TORRENTS:
    process.env.STREAMARR_ADD_FREE_TORRENTS == 'true' || true,

  STREAMARR_TORRENT_PAUSE_AFTER_MS:
    parseInt(process.env.STREAMARR_TORRENT_PAUSE_AFTER_MS) || 1000 * 10,
  STREAMARR_TORRENT_STOP_AFTER_MS:
    parseInt(process.env.STREAMARR_TORRENT_STOP_AFTER_MS) || 1000 * 60,
  STREAMARR_TORRENT_MAX_READY:
    parseInt(process.env.STREAMARR_TORRENT_MAX_READY) || 2,
  STREAMARR_TORRENT_START_TIMEOUT:
    parseInt(process.env.STREAMARR_TORRENT_START_TIMEOUT) || 1000 * 30,

  STREAMARR_WEBTORRENT_MAX_CONNS:
    parseInt(process.env.STREAMARR_WEBTORRENT_MAX_CONNS) || 55,
  STREAMARR_WEBTORRENT_UPLOAD_LIMIT:
    parseInt(process.env.STREAMARR_WEBTORRENT_UPLOAD_LIMIT) || -1,
  STREAMARR_WEBTORRENT_DOWNLOAD_LIMIT:
    parseInt(process.env.STREAMARR_WEBTORRENT_DOWNLOAD_LIMIT) || -1,
  STREAMARR_WEBTORRENT_DOWNLOAD_PATH:
    process.env.STREAMARR_WEBTORRENT_DOWNLOAD_PATH ??
    '/tmp/streamarrfs-downloads',
  STREAMARR_WEBTORRENT_TORRENT_PORT:
    parseInt(process.env.STREAMARR_WEBTORRENT_TORRENT_PORT) || 0,

  STREAMARR_FEED_URL_PREFIX:
    process.env.STREAMARR_FEED_URL_PREFIX ?? 'STREAMARR_FEED_URL_ITEM',
  STREAMARR_FEED_DISABLED: process.env.STREAMARR_FEED_DISABLED ?? 'false',
  STREAMARR_FEED_ADD_QUEUE_CONCURRENCY:
    parseInt(process.env.STREAMARR_FEED_ADD_QUEUE_CONCURRENCY) || 5,
  STREAMARR_FEED_URLS,

  STREAMARRFS_MOUNT_PATH:
    process.env.STREAMARRFS_MOUNT_PATH ?? '/tmp/streamarrfs',
  STREAMARR_SERVER_PORT: parseInt(process.env.STREAMARR_SERVER_PORT) || 3000,

  STREAMARR_LOG_LEVEL: logLevel(),
});
