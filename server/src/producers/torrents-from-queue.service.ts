import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TorrentsService } from '../torrents/torrents.service';
import {
  Torrent,
  TorrentInfoStatus,
} from '../torrents/entities/torrent.entity';
import { TorrentUtil } from '../torrent-util/torrent.util';
import { WorkerPool } from '../worker.pool';
import { TorrentInfo } from 'src/types';

@Injectable()
export class TorrentFromQueueService {
  private readonly logger = new Logger(TorrentFromQueueService.name);

  constructor(
    private readonly torrentsService: TorrentsService,
    private readonly torrentUtil: TorrentUtil,
    private readonly workerPool: WorkerPool,
  ) {}
  @Cron(CronExpression.EVERY_SECOND, {
    name: TorrentFromQueueService.name,
    disabled: false,
  })
  async torrentInfoJobProducer() {
    const queuedTorrents = await this.torrentsService.queuedTorrents();
    const processingTorrents = await this.torrentsService.processingTorrents();
    if (queuedTorrents.length > 5) {
      this.logger.log(
        `${queuedTorrents.length} queued torrents therefore sleeping.`,
      );
      return;
    }

    if (processingTorrents.length > 5) {
      this.logger.log(
        `${processingTorrents.length} processing torrents therefore sleeping.`,
      );
      return;
    }

    if (this.workerPool.queueSize() > 5) {
      this.logger.log(
        `${this.workerPool.queueSize()} job(s) queue already therefore sleeping.`,
      );
      return;
    }

    const torrent = await this.torrentsService.popNewTorrent();

    if (!torrent) {
      this.logger.log(`no queued torrent found therefore sleeping.`);
      return;
    }

    try {
      await this.indexPopedTorrent(torrent);
    } catch (err) {
      await this.torrentsService.update(torrent.id, {
        ...torrent,
        status: TorrentInfoStatus.ERROR,
        errors: err.message ?? `Error indexing torrent`,
        isVisible: false,
      });
    }
  }

  hasTorrentInfoFromTorrentFile(torrentInfo: TorrentInfo) {
    return (
      torrentInfo.infoHash !== null &&
      typeof torrentInfo.infoHash === 'string' &&
      torrentInfo.files !== null &&
      typeof torrentInfo.files === 'object' &&
      torrentInfo.name !== null &&
      typeof torrentInfo.name === 'string' &&
      torrentInfo.torrentBlob !== null &&
      typeof torrentInfo.torrentBlob === 'object'
    );
  }

  hasMagnetURI(torrentInfo: TorrentInfo) {
    return (
      torrentInfo.magnetURI !== null &&
      typeof torrentInfo.magnetURI === 'string'
    );
  }

  hasTorrentInfoForReady(torrentInfo: TorrentInfo) {
    return (
      torrentInfo.infoHash !== null &&
      typeof torrentInfo.infoHash === 'string' &&
      torrentInfo.files !== null &&
      typeof torrentInfo.files === 'object' &&
      torrentInfo.name !== null &&
      typeof torrentInfo.name === 'string' &&
      torrentInfo.magnetURI !== null &&
      typeof torrentInfo.magnetURI === 'string'
    );
  }

  async updateTorrentToReady(torrentRec: Torrent, torrentInfo: TorrentInfo) {
    const { infoHash, magnetURI, name, files } = torrentInfo;
    await this.torrentsService.update(torrentRec.id, {
      ...torrentRec,
      magnetURI,
      infoHash,
      name,
      files: JSON.stringify(files, null, 0),
      status: TorrentInfoStatus.READY,
      isVisible: true,
    });
  }

  async indexPopedTorrent(torrent: Torrent) {
    if (torrent.feedURL.startsWith('http')) {
      this.torrentsService.updateTorrentStatus(
        torrent,
        TorrentInfoStatus.PROCESSING,
      );
      let torrentInfo = await this.torrentUtil.getTorrentInfoFromJacketteUrl(
        torrent.feedURL,
      );

      if (torrentInfo.sourceType === 'magnet') {
        this.logger.log(
          `torrent ${torrentInfo.infoHash} is magnet fetching files info`,
        );
        torrentInfo = await this.workerPool.getTorrentInfoFromMagnetUri(
          torrent.magnetURI,
        );
      }

      if (this.hasTorrentInfoForReady(torrentInfo)) {
        this.logger.log(`torrent ${torrentInfo.infoHash} updating to ready`);
        await this.updateTorrentToReady(torrent, torrentInfo);
      } else {
        this.logger.warn(
          `torrent ${torrentInfo.infoHash} failed to get full info`,
        );
        await this.torrentsService.update(torrent.id, {
          status: TorrentInfoStatus.ERROR,
          errors: 'Failed to get info',
          isVisible: false,
        });
      }
    }
  }
}
