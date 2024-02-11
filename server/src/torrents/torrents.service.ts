import { Injectable } from '@nestjs/common';
import { CreateTorrentDto } from './db/dto/create-torrent.dto';
import { UpdateTorrentDto } from './db/dto/update-torrent.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Equal, Raw } from 'typeorm';
import { Torrent, TorrentInfoStatus } from './db/entities/torrent.entity';

@Injectable()
export class TorrentsService {
  constructor(
    @InjectRepository(Torrent) private torrentsRepository: Repository<Torrent>,
  ) {}

  create(createTorrentDto: CreateTorrentDto) {
    const newTorrent = this.torrentsRepository.create(createTorrentDto);
    return this.torrentsRepository.save(newTorrent);
  }

  visibleTorrentsRootIndex() {
    return this.torrentsRepository.find({
      select: {
        infoHash: true,
        name: true,
      },
      where: {
        isVisible: true,
      },
    });
  }

  async updateTorrentStatus(
    torrent: Pick<Torrent, 'id'>,
    status: TorrentInfoStatus,
  ) {
    return this.update(torrent.id, {
      ...torrent,
      status,
    });
  }

  async popNewTorrent() {
    const torrent = await this.torrentsRepository.findOne({
      where: {
        status: TorrentInfoStatus.NEW,
      },
      order: {
        createdAt: 'ASC',
      },
    });

    if (torrent !== null) {
      await this.updateTorrentStatus(torrent, TorrentInfoStatus.QUEUED);
    }

    return torrent;
  }

  async queuedTorrents() {
    return await this.torrentsRepository.find({
      where: {
        status: TorrentInfoStatus.QUEUED,
      },
    });
  }

  async processingTorrents(minutesAgo = 5) {
    return await this.torrentsRepository.find({
      where: {
        status: TorrentInfoStatus.PROCESSING,
        updatedAt: Raw(
          (alias) =>
            `${alias} > datetime(datetime(), '-${minutesAgo} minutes')`,
        ),
      },
    });
  }

  async pendingTorrents(minutesAgo = 5) {
    return this.torrentsRepository.find({
      where: {
        status: TorrentInfoStatus.PROCESSING,
        updatedAt: Raw(
          (alias) =>
            `${alias} > datetime(datetime(), '-${minutesAgo} minutes')`,
        ),
      },
    });
  }

  findAll() {
    return this.torrentsRepository.find();
  }

  findOne(id: number) {
    return this.torrentsRepository.findOneBy({ id });
  }

  findOneByMagetURI(magnetURI) {
    return this.torrentsRepository.findOneBy({
      magnetURI: Equal(magnetURI),
    });
  }

  findOneByInfoHash(infoHash) {
    return this.torrentsRepository.findOneBy({
      infoHash: Equal(infoHash),
    });
  }

  findOneByFeedGuid(feedGuid) {
    return this.torrentsRepository.findOneBy({
      feedGuid: Equal(feedGuid),
    });
  }

  findOneByRecentlyAdded(minutesAgo: number = 5) {
    return this.torrentsRepository.findOneBy({
      createdAt: Raw(
        (alias) => `${alias} > datetime(datetime(), '-${minutesAgo} minutes')`,
      ),
    });
  }

  async update(id: number, updateTorrentDto: UpdateTorrentDto) {
    const torrent = await this.findOne(id);
    return this.torrentsRepository.save({ ...torrent, ...updateTorrentDto });
  }

  remove(id: number) {
    return this.torrentsRepository.delete({ id });
  }
}
