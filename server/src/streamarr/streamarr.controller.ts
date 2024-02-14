import { Controller, Get, Sse } from '@nestjs/common';
import { StreamarrService } from './streamarr.service';
import type { Torrent } from 'webtorrent';
import { Observable, interval, map } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { TorrentInfoService } from '../torrent-info/torrent-info.service';
@Controller('api/streamarrfs')
export class StreamarrController {
  constructor(
    private readonly streamarrsService: StreamarrService,
    private readonly torrentInfoService: TorrentInfoService,
  ) {}

  @Get('torrents')
  torrents(): Partial<Torrent>[] {
    return this.streamarrsService.torrents();
  }

  @Sse('sse')
  sse(): Observable<MessageEvent> {
    return interval(1000).pipe(
      map(() => ({
        data: {
          streamingTorrents: this.streamarrsService.torrents(),
          indexingTorrents: this.torrentInfoService.torrents(),
        },
      })),
    );
  }
}
