import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TorrentsService } from '../torrents/torrents.service';
import { WorkerPool } from '../worker.pool';
import { TorrentInfoStatus } from 'src/torrents/entities/torrent.entity';

@Injectable()
export class TorrentFromQueueService {
  constructor(
    private readonly torrentsService: TorrentsService,
    private readonly workerPool: WorkerPool,
  ) {}
  @Cron(CronExpression.EVERY_SECOND, { name: TorrentFromQueueService.name })
  async torrentInfoJobProducer() {
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

        const { infoHash, magnetURI, name, files } =
          await this.workerPool.getTorrentInfoFromFeedUrl(torrent.feedURL);
        await this.torrentsService.update(torrent.id, {
          ...torrent,
          magnetURI,
          infoHash,
          name,
          files: JSON.stringify(files, null, 0),
          status: TorrentInfoStatus.READY,
          isVisible: true,
        });
      } catch (err) {
        await this.torrentsService.update(torrent.id, {
          ...torrent,
          status: TorrentInfoStatus.ERROR,
          isVisible: false,
          errors: JSON.stringify(err),
        });
      }
    }
  }
}
