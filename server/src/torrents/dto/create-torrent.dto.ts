import { TorrentInfoStatus } from '../entities/torrent.entity';
export class CreateTorrentDto {
  infoHash?: string;
  feedGuid: string;
  feedURL: string;
  name?: string;
  files?: string;
  magnetURI?: string;
  isVisible: boolean;
  status?: TorrentInfoStatus;
  errors?: string;
  lastStartedAt?: Date;
}
