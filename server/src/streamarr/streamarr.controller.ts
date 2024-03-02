import { Body, Controller, Get, Post, Sse } from '@nestjs/common';
import { StreamarrService } from './streamarr.service';
import { Observable, interval, map } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { TorrentInfoService } from '../torrent-info/torrent-info.service';
import { ActionDto } from './dto/create-streamarr.dto';
@Controller('api/streamarrfs')
export class StreamarrController {
  constructor(
    private readonly streamarrsService: StreamarrService,
    private readonly torrentInfoService: TorrentInfoService,
  ) {}

  @Get('torrents')
  torrents() {
    return this.streamarrsService.torrents();
  }

  @Post('actions')
  async actions(@Body() action: ActionDto) {
    console.log(action);
    if (action.stop) {
      await this.streamarrsService.stopTorrent(action.stop);
    }

    return 'OK';
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
