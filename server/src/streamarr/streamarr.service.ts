import { Injectable, Logger } from '@nestjs/common';
import { WebTorrentService } from '../webtorrent/webtorrent.service';
import { TorrentsService } from '../torrents/torrents.service';
@Injectable()
export class StreamarrService {
  private readonly logger = new Logger(StreamarrService.name);

  constructor(
    private readonly webTorrentService: WebTorrentService,
    private readonly torrentService: TorrentsService,
  ) {}

  torrents() {
    return this.webTorrentService.torrents();
  }
}
