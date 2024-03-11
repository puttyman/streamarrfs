import { Injectable, Logger } from '@nestjs/common';
import { WebTorrentService } from '../webtorrent/webtorrent.service';
import { TorrentsService } from '../torrents/torrents.service';
import { StreamarrFsTorrent } from '../types';
@Injectable()
export class StreamarrService {
  private readonly logger = new Logger(StreamarrService.name);

  constructor(
    private readonly webTorrentService: WebTorrentService,
    private readonly torrentService: TorrentsService,
  ) {}

  private bytesToMegaBytes(bytesPerSecond) {
    if (!bytesPerSecond || bytesPerSecond === 0) return 0;
    // 1 MB = 1024 * 1024 bytes
    const BYTES_IN_MEGABYTE = 1024 * 1024;
    // Convert bytes per second to mega bytes per second
    const megaBytesPerSecond = bytesPerSecond / BYTES_IN_MEGABYTE;
    return megaBytesPerSecond.toFixed(2);
  }

  private toHumanFriendly(torrent: Partial<StreamarrFsTorrent>) {
    return {
      ...torrent,
      uploadSpeed: this.bytesToMegaBytes(torrent.uploadSpeed),
      downloadSpeed: this.bytesToMegaBytes(torrent.downloadSpeed),
      downloaded: this.bytesToMegaBytes(torrent.downloaded),
    };
  }

  torrents() {
    return this.webTorrentService
      .torrents()
      .map((torrent) => this.toHumanFriendly(torrent));
  }

  async stopTorrent(infoHash: string) {
    const torrentDb = await this.torrentService.findOneByInfoHash(infoHash);

    // Make torrent inVisible before stop.
    // This is to make sure any read can no longer happen
    await this.torrentService.update(torrentDb.id, {
      isVisible: false,
    });

    await this.webTorrentService.stopTorrentWithInfoHash(torrentDb.infoHash);

    // Make torrent visible again
    await this.torrentService.update(torrentDb.id, {
      isVisible: true,
    });
  }
}
