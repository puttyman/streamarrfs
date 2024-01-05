import { resolve } from 'path';
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import Piscina from 'piscina';
import type { TorrentInfo } from './types';

@Injectable()
export class WorkerPool implements OnApplicationShutdown {
  private readonly logger = new Logger(WorkerPool.name);

  private pool: Piscina;
  constructor() {
    this.pool = new Piscina({
      filename: resolve(__dirname, 'workers/torrent-info.worker.js'),
      maxThreads: 1,
      minThreads: 1,
      concurrentTasksPerWorker: 1,
    });
  }
  async onApplicationShutdown(signal?: string) {
    this.logger.log(`onApplicationShutdown signal=${signal} started`);
    try {
      await this.pool.destroy();
      this.logger.log(`SUCCESS destroying worker pool`);
    } catch (err) {
      this.logger.error(`ERROR destroying worker pool`);
      this.logger.error(err);
    }
    this.logger.log(`onApplicationShutdown signal=${signal} completed`);
  }

  public async getTorrentInfoFromFeedUrl(
    feedUrl: string,
  ): Promise<TorrentInfo> {
    return await this.pool.run(feedUrl, { name: 'getTorrentInfoFromFeedUrl' });
  }

  public async getTorrentInfoFromMagnetUri(
    magnetURI: string,
  ): Promise<TorrentInfo> {
    return await this.pool.run(magnetURI, {
      name: 'getTorrentInfoFromMagnetUri',
    });
  }
}
