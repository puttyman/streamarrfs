import { ConfigService } from '@nestjs/config';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import RssParser from 'rss-parser';

import { TorrentsService } from '../torrents/torrents.service';
import { FeedType, type Feed } from '../types';
import { TorrentInfoStatus } from 'src/torrents/entities/torrent.entity';
import { throws } from 'assert';

@Injectable()
export class TorrentsFromFeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TorrentsFromFeedService.name);
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
    this.feeds = this.configService.get<Array<Feed>>('STREAMARRFS_FEEDS');
  }

  async onApplicationBootstrap() {
    this.torrentProducer();
  }

  @Cron(CronExpression.EVERY_HOUR, { name: TorrentsFromFeedService.name })
  async torrentProducer() {
    if (
      this.configService.get<string>('STREAMARRFS_FEED_DISABLED') === 'true'
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
}
