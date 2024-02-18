import { TorrentInfoStatus } from '../../torrents/db/entities/torrent.entity';
import { CreateTorrentDto } from '../../torrents/db/dto/create-torrent.dto';

const torrentSingleFile: CreateTorrentDto = {
  name: 'singlefile',
  infoHash: '1111111111111111111111111111111111111111',
  files: JSON.stringify([
    {
      name: 'singlefile.mp4',
      path: 'singlefile.mp4',
      length: 111111111,
    },
  ]),
  magnetURI: 'magnet://singlefile',
  feedGuid: 'singlefile',
  feedURL: 'http://singlefile',
  isVisible: true,
  status: TorrentInfoStatus.READY,
};

export { torrentSingleFile };
