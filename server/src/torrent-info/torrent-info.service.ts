import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebTorrentService } from '../webtorrent/webtorrent.service';
import { useWebtorrentServiceProvider } from '../module-providers/useWebtorrentServiceProvider';
import { TorrentUtil } from '../torrent-util/torrent.util';
import { TorrentInfo } from 'src/types';

@Injectable()
export class TorrentInfoService implements OnModuleInit {
  // We don't want to use injection as we want this service to
  // have new webtorrent client instance for getting torrent info.
  private webTorrentService: WebTorrentService;

  constructor(
    private readonly configService: ConfigService,
    private readonly torrentUtil: TorrentUtil,
  ) {}

  async onModuleInit() {
    const webTorrentServiceProvider = await useWebtorrentServiceProvider();
    this.webTorrentService = await webTorrentServiceProvider.useFactory(
      this.configService,
      this.torrentUtil,
    );
  }

  async getTorrentInfoFromMagnetUri(magnetURI: string): Promise<TorrentInfo> {
    const torrentInfo =
      await this.webTorrentService.getTorrentInfoFromMagnetURI(magnetURI);
    return torrentInfo;
  }
}
