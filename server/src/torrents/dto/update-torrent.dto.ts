import { PartialType } from '@nestjs/mapped-types';
import { CreateTorrentDto } from './create-torrent.dto';

export class UpdateTorrentDto extends PartialType(CreateTorrentDto) {}
