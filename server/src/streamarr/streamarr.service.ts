import { Injectable, Logger } from '@nestjs/common';
import { AddTorrentStreamarrDto } from './dto/create-streamarr.dto';
import { WebTorrentService } from '../webtorrent/webtorrent.service';
import { TorrentsService } from '../torrents/torrents.service';
@Injectable()
export class StreamarrService {
  private readonly logger = new Logger(StreamarrService.name);

  constructor(
    private readonly webTorrentService: WebTorrentService,
    private readonly torrentService: TorrentsService,
  ) {}

  getPromise() {
    const p = Promise.resolve(true);
    return p;
  }

  async addTorrent({ magnetURI }: AddTorrentStreamarrDto) {
    try {
      const torrent = await this.torrentService.findOneByMagetURI(magnetURI);
      if (torrent) {
        this.logger.warn({ torrent }, `torrent exists already`);
        return torrent;
      }

      const newTorrent =
        await this.webTorrentService.getTorrentInfoFromMagnetURI(magnetURI);
      // await this.torrentService.create(newTorrent);
    } catch (err) {
      this.logger.error(
        { err },
        `error adding torrent with magnetURI=${magnetURI}`,
      );
    }
  }

  torrents() {
    return this.webTorrentService.torrents();
  }

  async getTorrentInfoFromJackettLink(
    link: string,
  ): Promise<string | ArrayBuffer> {
    try {
      const resp = await fetch(link, { redirect: 'manual' });
      const locationHeader = resp.headers.get('location');

      if (locationHeader.indexOf('magnet:') === 0) {
        return locationHeader;
      }

      const torrentBody = resp.arrayBuffer();
      return torrentBody;
    } catch (err) {
      this.logger.error({ err }, `failed to get magnetURI for link=${link}`);
      throw err;
    }
  }
}
