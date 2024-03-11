import fs from 'fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebTorrentService } from './webtorrent/webtorrent.service';
import { TorrentsService } from './torrents/torrents.service';

@Injectable()
export class AppService {
  private logger = new Logger(AppService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly webtorrentService: WebTorrentService,
    private readonly torrentsService: TorrentsService,
  ) {}

  async healthcheck() {
    return {
      service: {
        healthy: true,
      },
      webtorrent: {
        healthy: await this.webtorrentStatus(),
      },
      streamarrfs: {
        healthy: await this.streamfsStatus(),
      },
      db: {
        healthy: await this.dbStatus(),
      },
    };
  }

  async webtorrentStatus() {
    try {
      const torrents = await this.webtorrentService.torrents();
      if (torrents) return true;
    } catch (err) {
      this.logger.error(`ERROR health check for webtorrent failed`);
      return false;
    }
    return false;
  }

  async streamfsStatus() {
    try {
      const streamarrFsMountPath = this.configService.get<string>(
        'STREAMARRFS_MOUNT_PATH',
      );
      const dirList = await fs.readdir(streamarrFsMountPath);
      if (dirList) return true;
    } catch (err) {
      this.logger.error(`ERROR health check for streamarrfs failed`);
      return false;
    }
    return false;
  }

  async dbStatus() {
    try {
      const index = await this.torrentsService.visibleTorrentsRootIndex();
      if (index) return true;
    } catch (err) {
      this.logger.error(`ERROR healthcheck for db failed`);
      return false;
    }
    return false;
  }
}
