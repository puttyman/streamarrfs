import { ConfigService } from '@nestjs/config';
import { TorrentUtil } from '../torrent-util/torrent.util';
import dynamicImport from '../utils/dynamic-import';
import { WebTorrentService } from '../webtorrent/webtorrent.service';

export function useWebtorrentServiceProvider(torrentPort: number = 0) {
  return {
    provide: WebTorrentService,
    async useFactory(configService?: ConfigService, torrentUtil?: TorrentUtil) {
      const { default: webTorrentClass } = await dynamicImport('webtorrent');
      return new WebTorrentService(
        webTorrentClass,
        configService,
        torrentUtil,
        torrentPort,
      );
    },
    inject: [ConfigService, TorrentUtil],
  };
}
