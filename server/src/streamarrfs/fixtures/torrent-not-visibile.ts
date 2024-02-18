import { TorrentInfoStatus } from '../../torrents/db/entities/torrent.entity';
import { CreateTorrentDto } from '../../torrents/db/dto/create-torrent.dto';

const torrentNotVisible: CreateTorrentDto = {
  name: 'video',
  infoHash: 'notv7abc1d9e50d85f26dc376ef439b4a1fb5228',
  files: JSON.stringify([
    {
      name: 'torrent-not-visible.mp4',
      path: 'dir/torrent-not-visible.mp4',
      length: 1234456,
    },
  ]),
  magnetURI: 'magnet://torrent-not-visible',
  feedGuid: 'torrent-not-visible',
  feedURL: 'http://torrent-not-visible',
  isVisible: false,
  status: TorrentInfoStatus.READY,
};

export { torrentNotVisible };
