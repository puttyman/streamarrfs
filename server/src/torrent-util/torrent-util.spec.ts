import { Test, TestingModule } from '@nestjs/testing';
import { TorrentUtil } from './torrent.util';
import { useTorrentUtilProvider } from '../module-providers';

describe('TorrentUtil', () => {
  let torrentUtil: TorrentUtil;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      providers: [useTorrentUtilProvider()],
    }).compile();

    torrentUtil = app.get<TorrentUtil>(TorrentUtil);
  });

  describe('getMagnetLinkFromJacketteUrl', () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('', {
        status: 302,
        statusText: 'OK',
        headers: {
          location: 'magnet://',
        },
      }),
    );
    it('it should return the magnet link from a jackette url', async () => {
      const magnetUrl = await torrentUtil.getMagnetLinkFromJacketteUrl(
        'http://jacket/torrent/url/magnet',
      );
      expect(magnetUrl).toBe('magnet://');
    });
  });

  describe('getTorrentInfoFromJacketteUrl', () => {
    it('it should throw when fetch failed', async () => {
      expect(
        torrentUtil.getTorrentInfoFromJacketteUrl('http://jackett/torrent'),
      ).rejects.toThrow();
    });

    it('it should return null when no info found', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response('', {
          status: 404,
          statusText: 'notfound',
        }),
      );

      const torrentInfo =
        await torrentUtil.getTorrentInfoFromJacketteUrl('http://jackett/404');
      expect(torrentInfo).toBeNull();
    });
  });
});
