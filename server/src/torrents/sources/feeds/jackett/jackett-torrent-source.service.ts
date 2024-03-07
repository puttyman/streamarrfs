import { ConfigService } from '@nestjs/config';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { promisify } from 'node:util';
import RssParser from 'rss-parser';

import config from '../../../../config';
import { TorrentsService } from '../../../torrents.service';
import { FeedType, type Feed } from '../../../../types';
import { TorrentInfoStatus } from '../../../db/entities/torrent.entity';

@Injectable()
export class JackettTorrentSourceService implements OnApplicationBootstrap {
  private readonly logger = new Logger(JackettTorrentSourceService.name);
  private isTaskRunning: boolean;
  private rssParser;
  private feeds;

  constructor(
    private readonly torrentService: TorrentsService,
    private readonly configService: ConfigService,
  ) {
    this.rssParser = new RssParser({
      customFields: {
        item: [['torznab:attr', 'torznabAttr']],
      },
    });
    this.feeds = this.configService.get<Array<Feed>>(
      'STREAMARRFS_JACKETT_FEEDS',
    );
  }

  async onApplicationBootstrap() {
    const delay = promisify(setTimeout);
    await delay(5000);
    await this.runJob();
  }

  @Cron(config().STREAMARRFS_JACKETT_CRON_JOB_EXPRESSION, {
    name: JackettTorrentSourceService.name,
  })
  async runJob() {
    if (
      this.configService.get<string>('STREAMARRFS_JACKETT_FEED_DISABLED') ===
      'true'
    ) {
      this.logger.verbose(`aborting feed is disabled`);
      return;
    }

    if (this.isTaskRunning) {
      this.logger.verbose(`aborting an existing task running already`);
      return;
    }

    try {
      this.isTaskRunning = true;
      this.logger.log(`fetching torrents from feed`);
      for (const feed of this.feeds) {
        if (feed.type === FeedType.RSS) {
          await this.processRssFeed(feed);
          continue;
        }

        if (feed.type === FeedType.JSON) {
          await this.processJsonFeed(feed);
          continue;
        }
        this.logger.warn(`Unsupported feed type=${feed.type}`);
      }
    } catch (err) {
      this.logger.error(`ERROR running feed cron`);
      this.logger.error(err);
    }

    this.isTaskRunning = false;
  }

  async processRssFeed(feed: Feed) {
    try {
      const feedContents = await this.rssParser.parseURL(feed.url);
      this.logger.log(
        `received ${feedContents.items.length ?? 'no'} items from feed=${
          feed.name
        }`,
      );
      for (const { guid: feedGuid, link: feedURL } of feedContents.items) {
        if (!feedGuid || !feedURL) continue;
        const existingTorrent =
          await this.torrentService.findOneByFeedGuid(feedGuid);
        if (!existingTorrent) {
          await this.torrentService.create({
            feedGuid,
            feedURL,
            status: TorrentInfoStatus.NEW,
            isVisible: false,
          });
        }
      }
    } catch (err) {
      this.logger.error(`Error processing feed=${feed.name}`);
      this.logger.error(err);
    }
  }

  async processJsonFeed(feed: Feed) {
    try {
      const resp = await fetch(feed.url);

      if (resp.status === 200) {
        const jsonData = await resp.json();
        const torrents = jsonData?.Results || [];

        this.logger.log(
          `received ${torrents.length ?? 'no'} items from feed=${feed.name}`,
        );
        for (const torrent of torrents) {
          const torrentGuid = torrent?.Guid || null;
          let torrentLink = torrent?.Link || null;

          if (torrentLink === null && `${torrentGuid}`.startsWith('magnet')) {
            torrentLink = torrentGuid;
          }

          if (torrentGuid === null || torrentLink === null) {
            this.logger.warn(torrent, `torrent missing required fields`);
            continue;
          }
          const existingTorrent =
            await this.torrentService.findOneByFeedGuid(torrentGuid);
          if (!existingTorrent) {
            await this.torrentService.create({
              feedGuid: torrentGuid,
              feedURL: torrentLink,
              status: TorrentInfoStatus.NEW,
              isVisible: false,
            });
          }
        }
      }

      if (resp.status !== 200) {
        this.logger.error(
          `Error processing feed=${feed.name} http status not 200`,
        );
      }
    } catch (err) {
      this.logger.error(`Error processing feed=${feed.name}`);
      this.logger.error(err);
    }
  }
}
