import { Injectable, Logger } from '@nestjs/common';
import type { Torrent } from 'webtorrent';
import { TorrentInfo } from '../types';

@Injectable()
export class TorrentUtil {
  private readonly logger = new Logger(TorrentUtil.name);

  constructor(
    private readonly parseTorrentLib,
    private readonly remote,
    private readonly toMagnetURILib,
  ) {}

  async getTorrentFromUrl(
    torrentInfo: string | ArrayBuffer,
    timeout: number = 60 * 1000,
  ): Promise<Torrent> {
    const resolveTorrent: Promise<Torrent> = new Promise(
      async (resolve, reject) => {
        try {
          await this.remote(torrentInfo, { timeout }, (err, parsedTorrent) => {
            if (err) reject(err);

            resolve(parsedTorrent);
          });
        } catch (err) {
          this.logger.error(
            { err },
            `Error fetching torrent torrent from remote`,
          );
          reject(err);
        }
      },
    );

    try {
      const torrent = await resolveTorrent;
      return torrent;
    } catch (err) {
      this.logger.error({ err }, `Error parsing torrent`);
      throw err;
    }
  }

  async parseMagnetURI(magnet: string): Promise<Partial<Torrent>> {
    return await this.getTorrentFromUrl(magnet);
  }

  async parseTorrent(torrent: string | ArrayBuffer | Torrent) {
    return this.parseTorrentLib(torrent);
  }

  toMagnetURI(torrent) {
    return this.toMagnetURILib(torrent);
  }

  async getInfoHashFromJacketteUrl(torrentUrl: string) {
    const resp = await fetch(torrentUrl, {
      method: 'get',
      redirect: 'manual',
    });
    if (
      resp.status === 302 &&
      resp.headers.get('location').startsWith('magnet:')
    ) {
      const { infoHash } = await this.parseTorrent(
        resp.headers.get('location'),
      );
      return infoHash;
    }

    if (
      resp.status === 200 &&
      resp.headers.get('content-type') === 'application/x-bittorrent' &&
      resp.headers.get('content-disposition').startsWith('attachment;')
    ) {
      const torrentAsArrayBuffer = await resp.arrayBuffer();
      const torrentArrayBufferView = new Uint8Array(torrentAsArrayBuffer);
      const { infoHash } = await this.parseTorrent(torrentArrayBufferView);
      return infoHash;
    }

    this.logger.error(`ERROR gettting infoHash for ${torrentUrl}`);
    return null;
  }

  async getTorrentInfoFromJacketteUrl(
    torrentUrl: string,
  ): Promise<TorrentInfo> {
    const resp = await fetch(torrentUrl, {
      method: 'get',
      redirect: 'manual',
    });
    if (
      resp.status === 302 &&
      resp.headers.get('location').startsWith('magnet:')
    ) {
      const magnetURI = resp.headers.get('location');
      const { infoHash } = await this.parseTorrent(magnetURI);
      return {
        infoHash,
        magnetURI,
        sourceType: 'magnet',
      };
    }

    if (
      resp.status === 200 &&
      resp.headers.get('content-type') === 'application/x-bittorrent' &&
      resp.headers.get('content-disposition').startsWith('attachment;')
    ) {
      const torrentAsArrayBuffer = await resp.arrayBuffer();
      const torrentArrayBufferView = new Uint8Array(torrentAsArrayBuffer);
      const torrent = await this.parseTorrent(torrentArrayBufferView);
      const { infoHash, files, name } = torrent;
      const magnetURI = this.toMagnetURILib(torrent);
      return {
        name,
        infoHash,
        torrentBlob: torrentArrayBufferView,
        magnetURI,
        files,
        sourceType: 'file',
      };
    }

    this.logger.error(
      `ERROR gettting torrent data from jackett for ${torrentUrl}`,
    );
    return null;
  }

  async getMagnetLinkFromJacketteUrl(torrentUrl: string) {
    const resp = await fetch(torrentUrl, {
      method: 'get',
      redirect: 'manual',
    });
    if (
      resp.status === 302 &&
      resp.headers.get('location').startsWith('magnet:')
    ) {
      return resp.headers.get('location');
    }

    if (
      resp.status === 200 &&
      resp.headers.get('content-type') === 'application/x-bittorrent' &&
      resp.headers.get('content-disposition').startsWith('attachment;')
    ) {
      const torrentAsArrayBuffer = await resp.arrayBuffer();
      const torrentArrayBufferView = new Uint8Array(torrentAsArrayBuffer);
      const torrent = await this.parseTorrent(torrentArrayBufferView);
      return this.toMagnetURI(torrent);
    }

    this.logger.error(`ERROR gettting magnet link for ${torrentUrl}`);
    return null;
  }

  async resolveTorrentRemote(torrentUrl) {
    return await this.remote(torrentUrl);
  }
}
