import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebTorrentService } from '../webtorrent/webtorrent.service';
import { TorrentsService } from '../torrents/torrents.service';
import { StreamarrFsService } from './streamarr-fs.service';
import { TypeOrmSQLITETestingModule } from '../test-utils/TypeORMSQLITETestingModule';
import { TorrentUtil } from '../torrent-util/torrent.util';

const setupTestData = async (torrentService: TorrentsService) => {
  await torrentService.create({
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
  });

  await torrentService.create({
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
  });
};

describe('StreamarrFsService', () => {
  let service: StreamarrFsService;
  let torrentService: TorrentsService;

  const webTorrentService = { findAll: () => ['test'] };

  beforeAll(async () => {
    try {
      execSync('fusermount -u -z /tmp/streamarrfs');
      await fs.rm('/tmp/streamarrfs', { recursive: true, force: true });
    } catch (err) {}
    const module: TestingModule = await Test.createTestingModule({
      imports: [...TypeOrmSQLITETestingModule()],
      providers: [
        ConfigService,
        TorrentUtil,
        TorrentsService,
        WebTorrentService,
        StreamarrFsService,
      ],
    })
      .overrideProvider(WebTorrentService)
      .useValue(webTorrentService)
      .compile();

    torrentService = module.get<TorrentsService>(TorrentsService);
    service = module.get<StreamarrFsService>(StreamarrFsService);
    await setupTestData(torrentService);
    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('mount', () => {
    it('should mount on init', async () => {
      const rootDir = await fs.readdir('/tmp/streamarrfs');
      expect(rootDir).toHaveLength(2);
      expect(rootDir).toEqual([
        '1111111111111111111111111111111111111111',
        '58ae7abc1d9e50d85f26dc376ef439b4a1fb5228',
      ]);
    });
  });

  describe('torrent 58ae7abc1d9e50d85f26dc376ef439b4a1fb5228', () => {
    it('should have one dir', async () => {
      const torrentRoot = await fs.readdir(
        '/tmp/streamarrfs/58ae7abc1d9e50d85f26dc376ef439b4a1fb5228',
      );
      expect(torrentRoot).toHaveLength(1);
      expect(torrentRoot[0]).toEqual('dir');
    });

    it('should have 3 files in dir', async () => {
      const torrentDir = await fs.readdir(
        '/tmp/streamarrfs/58ae7abc1d9e50d85f26dc376ef439b4a1fb5228/dir',
      );
      expect(torrentDir).toHaveLength(3);
      expect(torrentDir).toEqual(['image.jpg', 'text.txt', 'video.mp4']);
    });

    it('should return correct length for video', async () => {
      const fileStat = await fs.stat(
        '/tmp/streamarrfs/58ae7abc1d9e50d85f26dc376ef439b4a1fb5228/dir/video.mp4',
      );
      expect(fileStat.size).toEqual(111111111);
    });
  });

  describe('torrent 1111111111111111111111111111111111111111', () => {
    it('should have one file only', async () => {
      const torrentRoot = await fs.readdir(
        '/tmp/streamarrfs/1111111111111111111111111111111111111111',
      );
      expect(torrentRoot).toHaveLength(1);
      expect(torrentRoot[0]).toEqual('singlefile.mp4');
    });
  });

  afterAll(async () => {
    await service.onApplicationShutdown();
  });
});
