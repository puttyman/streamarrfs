import { TorrentUtil } from '../torrent-util/torrent.util';
import dynamicImport from '../utils/dynamic-import';

export function useTorrentUtilProvider() {
  return {
    provide: TorrentUtil,
    async useFactory() {
      const {
        default: parseTorrent,
        remote,
        toMagnetURI,
      } = await dynamicImport('parse-torrent');
      return new TorrentUtil(parseTorrent, remote, toMagnetURI);
    },
  };
}
