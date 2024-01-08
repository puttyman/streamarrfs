import { NestFactory } from '@nestjs/core';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { WorkerModule } from './workers.module';
import { TorrentUtil } from '../torrent-util/torrent.util';
import { WebTorrentService } from '../webtorrent/webtorrent.service';

import { TorrentInfo } from '../types';

const logger = new Logger(`Worker - getTorrentInfo`);
let app: INestApplicationContext = null;
async function initialize() {
  if (app === null) {
    app = await NestFactory.createApplicationContext(WorkerModule);
    app.enableShutdownHooks();
  }
}

export async function getTorrentInfoFromFeedUrl(
  feedUrl,
): Promise<TorrentInfo | null> {
  logger.log(`getTorrentInfoFromFeedUrl=${feedUrl}`);

  try {
    await initialize();
    const parseTorrent = app.get<TorrentUtil>(TorrentUtil);
    const webTorrentService = app.get<WebTorrentService>(WebTorrentService);
    const magnetURI = await parseTorrent.getMagnetLinkFromJacketteUrl(feedUrl);
    const torrentInfo =
      await webTorrentService.getTorrentInfoFromMagnetURI(magnetURI);
    return torrentInfo;
  } catch (err) {
    logger.error(`Error getting info for URL=${feedUrl}`);
    logger.error(err);
    throw err;
  }
}

export async function getTorrentInfoFromMagnetUri(
  magnetURI,
): Promise<TorrentInfo> {
  logger.log(`getTorrentInfoFromMagnetUri=${magnetURI}`);

  try {
    await initialize();
    const webTorrentService = app.get<WebTorrentService>(WebTorrentService);
    const torrentInfo =
      await webTorrentService.getTorrentInfoFromMagnetURI(magnetURI);
    return torrentInfo;
  } catch (err) {
    logger.error(`Error getting info for magnetURI=${magnetURI}`);
    logger.error(err);
    throw err;
  }
}
