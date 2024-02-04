import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import PQueue from 'p-queue';
import { TorrentsService } from '../torrents/torrents.service';
import {
  Torrent,
  TorrentInfoStatus,
} from '../torrents/entities/torrent.entity';
import { TorrentUtil } from '../torrent-util/torrent.util';
import { TorrentInfo } from '../types';
import { TorrentInfoService } from '../torrent-info/torrent-info.service';

@Injectable()
export class TorrentFromQueueService {
  private readonly logger = new Logger(TorrentFromQueueService.name);
  private isQueueJobRunning = false;
  private isProcessingJobRunning = false;
  private queue: PQueue;

  constructor(
    private readonly torrentsService: TorrentsService,
    private readonly torrentUtil: TorrentUtil,
    private readonly torrentInfoService: TorrentInfoService,
  ) {
    this.queue = new PQueue({ concurrency: 5 });
  }

  @Cron(CronExpression.EVERY_SECOND, {
    name: `${TorrentFromQueueService.name} - queueTorrent`,
    disabled: false,
  })
  async queueTorrent() {
    const queuedTorrents = await this.torrentsService.queuedTorrents();
    if (!this.isQueueJobRunning && queuedTorrents.length < 5) {
      this.isQueueJobRunning = true;
      // Move torrent from NEW to QUEUED status
      await this.torrentsService.popNewTorrent();
    }
    this.isQueueJobRunning = false;
  }

  @Cron(CronExpression.EVERY_SECOND, {
    name: `${TorrentFromQueueService.name} - consumedQueuedTorrents`,
    disabled: false,
  })
  async consumedQueuedTorrents() {
    // if (this.isProcessingJobRunning !== false) return;
    // if (this.isQueueBusy()) return;

    this.isProcessingJobRunning = true;
    const queuedTorrents = await this.torrentsService.queuedTorrents();

    for (const queuedTorrent of queuedTorrents) {
      await this.torrentsService.updateTorrentStatus(
        queuedTorrent,
        TorrentInfoStatus.PROCESSING,
      );
    }

    for (const queuedTorrent of queuedTorrents) {
      await this.queue.add(() => this.indexTorrent(queuedTorrent));
    }

    this.isProcessingJobRunning = false;
  }

  isQueueBusy() {
    return false;
  }

  // @Cron(CronExpression.EVERY_SECOND, {
  //   name: TorrentFromQueueService.name,
  //   disabled: false,
  // })
  // async torrentInfoJobProducer() {
  //   const queuedTorrents = await this.torrentsService.queuedTorrents();
  //   const processingTorrents = await this.torrentsService.processingTorrents();
  //   if (queuedTorrents.length > 5) {
  //     this.logger.log(
  //       `${queuedTorrents.length} queued torrents therefore sleeping.`,
  //     );
  //     return;
  //   }

  //   if (processingTorrents.length > 5) {
  //     this.logger.log(
  //       `${processingTorrents.length} processing torrents therefore sleeping.`,
  //     );
  //     return;
  //   }

  //   if (this.workerPool.queueSize() > 5) {
  //     this.logger.log(
  //       `${this.workerPool.queueSize()} job(s) queue already therefore sleeping.`,
  //     );
  //     return;
  //   }

  //   const torrent = await this.torrentsService.popNewTorrent();

  //   if (!torrent) {
  //     this.logger.log(`no queued torrent found therefore sleeping.`);
  //     return;
  //   }

  //   try {
  //     await this.indexPopedTorrent(torrent);
  //   } catch (err) {
  //     await this.torrentsService.update(torrent.id, {
  //       ...torrent,
  //       status: TorrentInfoStatus.ERROR,
  //       errors: err.message ?? `Error indexing torrent`,
  //       isVisible: false,
  //     });
  //   }
  // }

  hasEnoughInfoForReadyStatus(torrentInfo: TorrentInfo) {
    return (
      torrentInfo &&
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

  async indexTorrent(torrent: Torrent) {
    let torrentInfo: TorrentInfo;
    // If URI is a link to a torrent file
    if (torrent.feedURL.startsWith('http')) {
      this.torrentsService.updateTorrentStatus(
        torrent,
        TorrentInfoStatus.PROCESSING,
      );
      torrentInfo = await this.torrentUtil.getTorrentInfoFromJacketteUrl(
        torrent.feedURL,
      );
    }

    // If URI is a magnet link
    if (
      (torrentInfo && torrentInfo.sourceType === 'magnet') ||
      torrent.feedURL.startsWith('magnet')
    ) {
      this.torrentsService.updateTorrentStatus(
        torrent,
        TorrentInfoStatus.PROCESSING,
      );
      this.logger.log(`torrent id=${torrent.id} is magnet fetching files info`);
      const magnetURI = (() => {
        if (torrent.feedURL.startsWith('magnet')) return torrent.feedURL;
        if (torrentInfo && torrentInfo.sourceType === 'magnet')
          return torrentInfo.magnetURI;
      })();
      torrentInfo =
        await this.torrentInfoService.getTorrentInfoFromMagnetUri(magnetURI);
    }

    if (this.hasEnoughInfoForReadyStatus(torrentInfo)) {
      this.logger.log(`torrent ${torrent.id} updating to ready`);
      await this.updateTorrentToReady(torrent, torrentInfo);
    } else {
      this.logger.warn(`torrent ${torrent.id} failed to get full info`);
      await this.torrentsService.update(torrent.id, {
        status: TorrentInfoStatus.ERROR,
        errors: 'Failed to get info',
        isVisible: false,
      });
    }
  }
}
