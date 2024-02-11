import type { LogLevel } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { Feed, FeedIndexer, FeedType } from './types';

if (process.env.NODE_ENV !== 'production') {
  try {
    require('./test-feeds');
  } catch (err) {
    console.warn(`./test-feeds not found`);
  }
}

function getFeedType(feedKey): FeedType {
  if (/rss/gi.test(process.env[feedKey])) {
    return FeedType.RSS;
  }

  if (/json/gi.test(process.env[feedKey])) {
    return FeedType.JSON;
  }

  return FeedType.RSS;
}

function getFeedIndexer(feedKey): FeedIndexer {
  if (/jackett/gi.test(process.env[feedKey])) {
    return FeedIndexer.JACKETT;
  }

  if (/prowlarr/gi.test(process.env[feedKey])) {
    return FeedIndexer.PROWLARR;
  }

  return FeedIndexer.JACKETT;
}

const STREAMARRFS_JACKETTE_FEEDS = Object.keys(process.env)
  .filter((envName) =>
    envName.startsWith(
      process.env.STREAMARRFS_JACKETT_FEED_URL_PREFIX ||
        'STREAMARRFS_JACKETTE_FEED_URL_ITEM',
    ),
  )
  .map((feedKey) => {
    return {
      name: feedKey,
      url: process.env[feedKey],
      type: getFeedType(feedKey),
      indexer: getFeedIndexer(feedKey),
    } as Feed;
  });

const logLevel = (): Array<LogLevel> => {
  if (process.env.STREAMARRFS_LOG_LEVEL) {
    return process.env.STREAMARRFS_LOG_LEVEL.split(',').map(
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

export default () => {
  return {
    STREAMARRFS_DB_PATH: process.env.STREAMARRFS_DB_PATH ?? 'db/db.sqlite',

    STREAMARRFS_ADD_FREE_TORRENTS:
      process.env.STREAMARRFS_ADD_FREE_TORRENTS == 'true' || true,

    STREAMARRFS_TORRENT_PAUSE_AFTER_MS:
      parseInt(process.env.STREAMARRFS_TORRENT_PAUSE_AFTER_MS) || 1000 * 10,
    STREAMARRFS_TORRENT_STOP_AFTER_MS:
      parseInt(process.env.STREAMARRFS_TORRENT_STOP_AFTER_MS) || 1000 * 60,
    STREAMARRFS_TORRENT_MAX_READY:
      parseInt(process.env.STREAMARRFS_TORRENT_MAX_READY) || 2,
    STREAMARRFS_TORRENT_START_TIMEOUT:
      parseInt(process.env.STREAMARRFS_TORRENT_START_TIMEOUT) || 1000 * 60 * 2,
    STREAMARRFS_TORRENT_INDEXER_CONCURRENCY:
      process.env.STREAMARRFS_TORRENT_INDEXER_CONCURRENCY || 5,

    STREAMARRFS_WEBTORRENT_MAX_CONNS:
      parseInt(process.env.STREAMARRFS_WEBTORRENT_MAX_CONNS) || 55,
    STREAMARRFS_WEBTORRENT_UPLOAD_LIMIT:
      parseInt(process.env.STREAMARRFS_WEBTORRENT_UPLOAD_LIMIT) || -1,
    STREAMARRFS_WEBTORRENT_DOWNLOAD_LIMIT:
      parseInt(process.env.STREAMARRFS_WEBTORRENT_DOWNLOAD_LIMIT) || -1,
    STREAMARRFS_WEBTORRENT_DOWNLOAD_PATH:
      process.env.STREAMARRFS_WEBTORRENT_DOWNLOAD_PATH ??
      '/tmp/streamarrfs-downloads',
    STREAMARRFS_WEBTORRENT_TORRENT_PORT:
      parseInt(process.env.STREAMARRFS_WEBTORRENT_TORRENT_PORT) || 0,

    STREAMARRFS_JACKETT_FEED_URL_PREFIX:
      process.env.STREAMARRFS_JACKETT_FEED_URL_PREFIX ??
      'STREAMARRFS_JACKETTE_FEED_URL_ITEM',
    STREAMARRFS_JACKETTE_FEED_DISABLED:
      process.env.STREAMARRFS_JACKETTE_FEED_DISABLED ?? 'false',
    STREAMARRFS_JACKETTE_CRON_JOB_EXPRESSION:
      process.env.STREAMARRFS_JACKETTE_CRON_JOB_EXPRESSION ??
      CronExpression.EVERY_HOUR,
    STREAMARRFS_JACKETTE_FEEDS,

    STREAMARRFS_MOUNT_PATH:
      process.env.STREAMARRFS_MOUNT_PATH ?? '/tmp/streamarrfs-mnt',
    STREAMARRFS_SERVER_PORT:
      parseInt(process.env.STREAMARRFS_SERVER_PORT) || 3000,

    STREAMARRFS_LOG_LEVEL: logLevel(),

    STREAMARRFS_FUSE_AUTO_UNMOUNT:
      process.env.STREAMARRFS_FUSE_AUTO_UNMOUNT === 'true',
    STREAMARRFS_FUSE_DEBUG: process.env.STREAMARRFS_FUSE_DEBUG === 'true',
    STREAMARRFS_FUSE_TIMEOUT: parseInt(
      process.env.STREAMARRFS_FUSE_TIMEOUT ?? `${1000 * 30}`,
    ),
    STREAMARRFS_FUSE_NON_EMPTY:
      process.env.STREAMARRFS_FUSE_AUTO_UNMOUNT === 'true',
    STREAMARRFS_FUSE_ALLOW_OTHER: process.env.STREAMARRFS_FUSE_ALLOW_OTHER
      ? process.env.STREAMARRFS_FUSE_ALLOW_OTHER == 'true'
      : true,
    STREAMARRFS_FUSE_ALLOW_ROOT: process.env.STREAMARRFS_FUSE_ALLOW_ROOT
      ? process.env.STREAMARRFS_FUSE_ALLOW_ROOT == 'true'
      : false,
    STREAMARRFS_FUSE_ALLOW_MAX_READ: parseInt(
      process.env.STREAMARRFS_FUSE_TIMEOUT ?? `${1024 * 1000}`,
    ),
  };
};
