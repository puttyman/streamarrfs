import { resolve } from 'path';
import { Injectable } from '@nestjs/common';
import Piscina from 'piscina';
import type { TorrentInfo } from './types';
import { toMagnetURI } from 'parse-torrent';

@Injectable()
export class WorkerPool {
  private pool: Piscina;
  constructor() {
    this.pool = new Piscina({
      filename: resolve(__dirname, 'workers/torrent-info.worker.js'),
      maxThreads: 1,
      minThreads: 1,
      concurrentTasksPerWorker: 1,
    });
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
