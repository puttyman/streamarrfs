import { Logger, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pTimeout, { TimeoutError } from 'p-timeout';
import WebTorrent from 'webtorrent';
import { TorrentUtil } from '../torrent-util/torrent.util';

import type { TorrentInfo } from '../types';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
export interface CreateServerOptions {
  origin: string;
  hostname: string;
  path: string;
  controller: ServiceWorkerRegistration;
}

export type WebTorrentV2Options = WebTorrent.Options & {
  downloadLimit: number;
  uploadLimit: number;
  torrentPort: number;
};

export type WebTorrentV2 = WebTorrent.WebTorrent & {
  new (config?: WebTorrentV2Options): WebTorrent.Instance;
  (config?: WebTorrentV2Options): WebTorrent.Instance;
};

export interface StreamarrFsTorrent extends WebTorrent.Torrent {
  status: 'running' | 'pausing' | 'paused' | 'stopping';
  lastReadDate: number;
  activeReads?: number;
}

@Injectable()
export class WebTorrentService implements OnApplicationShutdown {
  private readonly logger = new Logger(WebTorrentService.name);
  public client: WebTorrent.Instance;
  private downloadPath: string;
  private torrentMaxReady: number;
  private torrentPauseAfterMs: number;
  private torrentStopAfterMs: number;

  constructor(
    private readonly WebTorrentClass: WebTorrentV2,
    private readonly configService: ConfigService,
    private readonly parseTorrent: TorrentUtil,
    private readonly torrentPort: number,
  ) {
    this.downloadPath = configService.get<string>(
      'STREAMARRFS_WEBTORRENT_DOWNLOAD_PATH',
    );
    const maxConns = this.configService.get<number>(
      'STREAMARRFS_WEBTORRENT_MAX_CONNS',
    );
    const downloadLimit = this.configService.get<number>(
      'STREAMARRFS_WEBTORRENT_DOWNLOAD_LIMIT',
    );
    const uploadLimit = this.configService.get<number>(
      'STREAMARRFS_WEBTORRENT_UPLOAD_LIMIT',
    );
    this.torrentMaxReady = this.configService.get<number>(
      'STREAMARRFS_TORRENT_MAX_READY',
    );
    this.torrentPauseAfterMs = this.configService.get<number>(
      'STREAMARRFS_TORRENT_PAUSE_AFTER_MS',
    );
    this.torrentStopAfterMs = this.configService.get<number>(
      'STREAMARRFS_TORRENT_STOP_AFTER_MS',
    );
    this.client = new WebTorrentClass({
      maxConns,
      downloadLimit,
      uploadLimit,
      torrentPort,
    });
    this.logger.log('Created webtorrent client');
  }

  torrents() {
    return this.client.torrents.map((torrent) => {
      const smTorrent = torrent as StreamarrFsTorrent;
      return {
        infoHash: smTorrent.infoHash,
        name: smTorrent.name,
        ready: smTorrent.ready,
        downloadSpeed: smTorrent.downloadSpeed,
        uploadSpeed: smTorrent.uploadSpeed,
        downloaded: smTorrent.downloaded,
        paused: smTorrent.paused,
        status: smTorrent.status ?? '',
        lastReadDate: smTorrent.lastReadDate ?? '',
        activeReads: smTorrent.activeReads ?? 0,
      };
    });
  }

  async getTorrentWithInfoHash(infoHash): Promise<WebTorrent.Torrent | null> {
    const runningTorrent = (await this.client.get(
      infoHash,
    )) as WebTorrent.Torrent;

    return runningTorrent;
  }

  async isTorrentInClient(infoHash) {
    const torrent = await this.getTorrentWithInfoHash(infoHash);
    return torrent !== null;
  }

  async startTorrentWithMagnetLink(
    magnetURI,
  ): Promise<WebTorrent.Torrent | null> {
    const startTorrent = new Promise(async (resolve) => {
      this.client.add(
        magnetURI,
        { path: this.downloadPath, skipVerify: false },
        (torrent) => {
          this.logger.log(`torrent ${torrent.infoHash} started`);
          resolve(torrent);
        },
      );
    });

    const startedTorrent = (await startTorrent) as WebTorrent.Torrent;
    return startedTorrent;
  }

  async stopTorrentWithInfoHash(infoHash) {
    const torrent = await this.getTorrentWithInfoHash(infoHash);
    const stopTorrent = new Promise(async (resolve, reject) => {
      torrent.destroy({ destroyStore: true }, (err) => {
        if (err) {
          this.logger.error(`failed to stop torrent ${infoHash}`);
          reject(err);
        }

        resolve(true);
      });
    });

    return await stopTorrent;
  }

  async getTorrentFileByPath(infoHash, path) {
    const torrent = await this.getTorrentWithInfoHash(infoHash);
    const file = torrent.files.find((file) => file.path === path);
    return file;
  }

  async getTorrentInfoFromMagnetURI(magnetURI): Promise<TorrentInfo> {
    const startTorrentTask = new Promise<WebTorrent.Torrent>((resolve) => {
      this.client.add(
        magnetURI,
        { path: this.downloadPath },
        function ontorrent(torrent) {
          resolve(torrent);
        },
      );
    });

    try {
      const { infoHash, name, magnetURI, files } = await pTimeout(
        startTorrentTask,
        this.configService.get<number>('STREAMARRFS_TORRENT_START_TIMEOUT'),
      );
      const torrentInfo = {
        ...{},
        infoHash,
        name,
        magnetURI,
        files: files.map((file) => {
          return {
            name: file.name,
            path: file.path,
            length: file.length,
          };
        }),
      };
      await this.destroyTorrent(infoHash);
      // throw new Error('test error');
      return torrentInfo;
    } catch (err) {
      if (err instanceof TimeoutError) {
        this.logger.error(
          `ERROR timeout on getTorrentInfoFromMagnetURI magnetURI=${magnetURI}`,
        );
        const { infoHash } = await this.parseTorrent.parseTorrent(magnetURI);
        await this.destroyTorrent(infoHash);
      } else {
        this.logger.error(
          `ERROR getTorrentInfoFromMagnetURI magnetURI=${magnetURI}`,
        );
      }
      this.logger.error(err);
      throw err;
    }
  }

  async destroyTorrent(infoHash, destroyStore = true) {
    const torrent = await this.getTorrentWithInfoHash(infoHash);
    if (torrent) {
      const destroyTorrentTask = new Promise((resolve, reject) => {
        torrent.destroy({ destroyStore }, (err) => {
          if (err) return reject(err);

          resolve(true);
        });
      });

      try {
        await pTimeout(
          destroyTorrentTask,
          this.configService.get<number>('STREAMARRFS_TORRENT_START_TIMEOUT'),
        );
      } catch (err) {
        this.logger.error(`ERROR failed to destroy ${infoHash}`);
        this.logger.error(err);
        throw err;
      }
    }
  }

  /**
   * Start a torrent with a timeout. If torrent exceeds timeout to be ready
   * null is returned and the torrent is stopped.
   * @param infoHash infohash of torrent
   * @returns The torrent
   */
  async startTorrentWithTimeout(
    infoHash,
    magnetURI,
    timeout = this.configService.get<number>(
      'STREAMARRFS_TORRENT_START_TIMEOUT',
    ),
  ): Promise<WebTorrent.Torrent | null> {
    const torrent = await this.getTorrentWithInfoHash(infoHash);

    if (torrent && torrent.ready === true && torrent.paused === true) {
      this.logger.log(`torrent ${infoHash} running already but is paused`);
      return torrent;
    }

    if (!torrent) {
      this.logger.log(`torrent ${infoHash} not running attempting to start`);
      try {
        this.logger.log(`torrent ${infoHash} starting...`);
        const startedTorrent = await pTimeout(
          this.startTorrentWithMagnetLink(magnetURI),
          timeout,
        );

        this.logger.log(`torrent ${startedTorrent.infoHash} started`);
      } catch (err) {
        if (err instanceof TimeoutError) {
          this.logger.log(`torrent ${infoHash} start ready timeout`);
          await this.stopTorrentWithInfoHash(infoHash);
        } else {
          throw err;
        }
      }
    }

    return null;
  }

  /**
   * Resume a torrent
   * @param infoHash
   * @returns torrent or null
   */
  async resumeTorrent(infoHash) {
    const torrent = (await this.getTorrentWithInfoHash(
      infoHash,
    )) as StreamarrFsTorrent;
    if (torrent && torrent.ready === true && torrent.paused === true) {
      if (torrent) {
        torrent.resume();
        torrent.status = 'running';
        this.logger.debug(`torrent ${infoHash} resumed`);
        return torrent;
      }
    }

    if (!torrent) {
      this.logger.warn(`torrent ${infoHash} cannot resumed not running`);
    }

    return null;
  }

  /**
   * Try to resume a torrent if in client. If not start it
   * @param infoHash
   * @returns torrent
   */
  async tryResumeOtherwiseStartTorrent(infoHash, magnetURI) {
    const resumedTorrent = await this.resumeTorrent(infoHash);
    if (resumedTorrent) {
      return resumedTorrent;
    }

    if (!resumedTorrent) {
      const startedTorrent = await this.startTorrentWithMagnetLink(magnetURI);
      return startedTorrent;
    }
  }

  /**
   * Find a torrent in client which is ready and not paused
   * @param infoHash
   * @returns torrent or null
   */
  async findReadyAndUnpausedTorrent(infoHash) {
    const torrent = await this.getTorrentWithInfoHash(infoHash);

    if (torrent && torrent.ready === true && torrent.paused === false) {
      return torrent;
    }

    return null;
  }

  /**
   * Returns true if max allowed ready torrents reached
   * @returns boolean
   */
  public hasReachedMaxConcurrentReadyTorrents() {
    const readyTorrents = this.client.torrents.filter(
      (torrent) => torrent.ready === true,
    );
    return readyTorrents.length >= this.torrentMaxReady;
  }

  @OnEvent('streamarrfs.file.open', { async: false })
  private async handleTorrentOpen(infoHash) {
    const torrent = (await this.getTorrentWithInfoHash(
      infoHash,
    )) as StreamarrFsTorrent;
    if (torrent) {
      torrent.lastReadDate = Date.now();
      torrent.status = 'running';

      if (!torrent.activeReads) {
        torrent.activeReads = 1;
      }

      torrent.activeReads = torrent.activeReads + 1;
    }
  }

  @OnEvent('streamarrfs.file.read', { async: false })
  private async handleTorrentRead(infoHash) {
    const torrent = (await this.getTorrentWithInfoHash(
      infoHash,
    )) as StreamarrFsTorrent;
    if (torrent) {
      torrent.lastReadDate = Date.now();
      torrent.status = 'running';
    }
  }

  @OnEvent('streamarrfs.file.release', { async: false })
  private async handleTorrentRelease(infoHash) {
    const torrent = (await this.getTorrentWithInfoHash(
      infoHash,
    )) as StreamarrFsTorrent;
    if (torrent) {
      torrent.activeReads = torrent.activeReads - 1;
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: `${WebTorrentService.name} - updateTorrentStatus`,
  })
  async updateTorrentStatus() {
    this.logger.verbose('running updateTorrentStatus');
    const now = Date.now();
    for (const torrent of this.client.torrents) {
      const streamarrfsTorrent = torrent as StreamarrFsTorrent;
      if (
        streamarrfsTorrent.ready &&
        streamarrfsTorrent.status !== 'paused' &&
        now - streamarrfsTorrent.lastReadDate >= this.torrentPauseAfterMs
      ) {
        streamarrfsTorrent.status = 'pausing';
        this.logger.verbose(
          `updateTorrentStatus changed ${streamarrfsTorrent.infoHash} to pausing`,
        );
      }

      if (
        streamarrfsTorrent.ready &&
        streamarrfsTorrent.status !== 'stopping' &&
        now - streamarrfsTorrent.lastReadDate >= this.torrentStopAfterMs
      ) {
        streamarrfsTorrent.status = 'stopping';
        this.logger.verbose(
          `updateTorrentStatus changed ${streamarrfsTorrent.infoHash} to stopping`,
        );
      }

      if (
        streamarrfsTorrent.ready &&
        now - streamarrfsTorrent.lastReadDate < this.torrentPauseAfterMs
      ) {
        streamarrfsTorrent.status = 'running';
        this.logger.verbose(
          `updateTorrentStatus changed ${streamarrfsTorrent.infoHash} to running`,
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_5_SECONDS, {
    name: `${WebTorrentService.name} - pauseOrStopTorrents`,
  })
  async pauseOrStopTorrents() {
    this.logger.verbose('running pauseOrStopTorrents');
    for (const torrent of this.client.torrents) {
      const streamarrfsTorrent = torrent as StreamarrFsTorrent;
      if (streamarrfsTorrent.status === 'pausing') {
        this.logger.verbose(
          `pauseOrStopTorrents pausing ${streamarrfsTorrent.infoHash}`,
        );
        streamarrfsTorrent.pause();
        streamarrfsTorrent.status = 'paused';
      }

      if (streamarrfsTorrent.status === 'stopping') {
        this.logger.verbose(
          `pauseOrStopTorrents stopping ${streamarrfsTorrent.infoHash}`,
        );
        await this.stopTorrentWithInfoHash(streamarrfsTorrent.infoHash);
      }
    }
  }

  async onApplicationShutdown(signal?: string) {
    this.logger.verbose(`onApplicationShutdown signal=${signal} started`);
    const pDestroy = new Promise((resolve, reject) => {
      this.client.destroy((err) => {
        if (err) reject(err);

        resolve(true);
      });
    });
    try {
      await pDestroy;
    } catch (err) {
      if (err) {
        this.logger.error('error destroying webtorrent client');
        this.logger.error(err);
      }
    }
    this.logger.verbose(`onApplicationShutdown signal=${signal} completed`);
  }
}
