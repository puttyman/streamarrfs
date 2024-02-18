import { TorrentInfoStatus } from '../../torrents/db/entities/torrent.entity';
import { CreateTorrentDto } from '../../torrents/db/dto/create-torrent.dto';

const torrentMultipleFiles: CreateTorrentDto = {
  name: 'video',
  infoHash: '58ae7abc1d9e50d85f26dc376ef439b4a1fb5228',
  files: JSON.stringify([
    {
      name: 'video.mp4',
      path: 'dir/video.mp4',
      length: 111111111,
    },
    {
      name: 'text.txt',
      path: 'dir/text.txt',
      length: 222,
    },
    {
      name: 'image.jpg',
      path: 'dir/image.jpg',
      length: 3333,
    },
  ]),
  magnetURI: 'magnet://torrent1',
  feedGuid: 'torrent1',
  feedURL: 'http://torrent1',
  isVisible: true,
  status: TorrentInfoStatus.READY,
};

export { torrentMultipleFiles };
