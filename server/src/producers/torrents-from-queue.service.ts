import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TorrentsService } from '../torrents/torrents.service';
import { WorkerPool } from '../worker.pool';
import { TorrentInfoStatus } from 'src/torrents/entities/torrent.entity';

@Injectable()
export class TorrentFromQueueService {
  private readonly logger = new Logger(TorrentFromQueueService.name);

  constructor(
    private readonly torrentsService: TorrentsService,
    private readonly workerPool: WorkerPool,
  ) {}
  @Cron(CronExpression.EVERY_5_SECONDS, { name: TorrentFromQueueService.name })
  async torrentInfoJobProducer() {
    if (this.workerPool.queueSize() > 0) {
      this.logger.log(
        `${this.workerPool.queueSize()} job(s) queue already therefore sleeping.`,
      );
      return;
    }

    const torrent = await this.torrentsService.popQueuedTorrent();
    if (torrent) {
      try {
        if (torrent.feedURL.startsWith('free')) {
          await this.torrentsService.update(torrent.id, {
            ...torrent,
            status: TorrentInfoStatus.READY,
            isVisible: true,
          });
          return;
        }

        const torrentInfo = await this.workerPool.getTorrentInfoFromFeedUrl(
          torrent.feedURL,
        );
        if (torrentInfo) {
          const { infoHash, magnetURI, name, files } = torrentInfo;
          await this.torrentsService.update(torrent.id, {
            ...torrent,
            magnetURI,
            infoHash,
            name,
            files: JSON.stringify(files, null, 0),
            status: TorrentInfoStatus.READY,
            isVisible: true,
          });
        }

        if (!torrentInfo) {
          await this.torrentsService.update(torrent.id, {
            ...torrent,
            status: TorrentInfoStatus.ERROR,
            errors: 'Failed to get torrent info',
            isVisible: false,
          });
        }
      } catch (err) {
        await this.torrentsService.update(torrent.id, {
          ...torrent,
          status: TorrentInfoStatus.ERROR,
          isVisible: false,
          errors: err.message ?? 'NA',
        });
      }
    }
  }
}
