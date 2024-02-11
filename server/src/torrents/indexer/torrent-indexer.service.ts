import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import PQueue from 'p-queue';
import { TorrentsService } from '../torrents.service';
import { Torrent, TorrentInfoStatus } from '../db/entities/torrent.entity';
import { TorrentUtil } from '../../torrent-util/torrent.util';
import { TorrentInfo } from '../../types';
import { TorrentInfoService } from '../../torrent-info/torrent-info.service';
import { ConfigService } from '@nestjs/config';

/**
 * TorrentIndexerService finds info of torrents such as infoHash and files content.
 * Once there is enough info for torrent it is then updated to a READY state to be
 * made visible to StreamarrFsService.
 */
@Injectable()
export class TorrentIndexerService {
  private readonly logger = new Logger(TorrentIndexerService.name);
  private isQueueJobRunning = false;
  private isProcessingJobRunning = false;
  private queue: PQueue;
  private concurrency: number;

  constructor(
    private readonly torrentsService: TorrentsService,
    private readonly torrentUtil: TorrentUtil,
    private readonly torrentInfoService: TorrentInfoService,
    private readonly configService: ConfigService,
  ) {
    this.concurrency = this.configService.get<number>(
      'STREAMARRFS_TORRENT_INDEXER_CONCURRENCY',
    );
    this.queue = new PQueue({ concurrency: this.concurrency });
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: `${TorrentIndexerService.name} - queueTorrent`,
    disabled: false,
  })
  async queueNewTorrents() {
    const queuedTorrents = await this.torrentsService.queuedTorrents();
    if (!this.isQueueJobRunning && queuedTorrents.length < this.concurrency) {
      this.isQueueJobRunning = true;
      // Move torrent from NEW to QUEUED status
      await this.torrentsService.popNewTorrent();
    }
    this.isQueueJobRunning = false;
  }

  @Cron(CronExpression.EVERY_30_SECONDS, {
    name: `${TorrentIndexerService.name} - consumedQueuedTorrents`,
    disabled: false,
  })
  async consumedQueuedTorrents() {
    this.isProcessingJobRunning = true;
    const queuedTorrents = await this.torrentsService.queuedTorrents();

    for (const queuedTorrent of queuedTorrents) {
      if (this.queue.pending >= this.concurrency) {
        this.isProcessingJobRunning = false;
        return;
      }

      await this.torrentsService.updateTorrentStatus(
        queuedTorrent,
        TorrentInfoStatus.PROCESSING,
      );
    }

    for (const queuedTorrent of queuedTorrents) {
      if (this.queue.pending >= this.concurrency) {
        this.isProcessingJobRunning = false;
        return;
      }
      await this.queue.add(() => this.indexTorrent(queuedTorrent));
    }

    this.isProcessingJobRunning = false;
  }

  isQueueBusy() {
    return false;
  }

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
