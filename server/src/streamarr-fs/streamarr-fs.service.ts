import { mkdir, rm } from 'fs/promises';
import Fuse from '@cocalc/fuse-native';
import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pWaitFor from 'p-wait-for';
import WebTorrent, { TorrentFile } from 'webtorrent';
import { TorrentsService } from '../torrents/torrents.service';
import { WebTorrentService } from '../webtorrent/webtorrent.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StreamarrFsFileEvent } from '../types';

type FuseCallback = (returnCode: number, ...args: any) => void;
export type FileStat = {
  mtime: Date;
  atime: Date;
  ctime: Date;
  size: number;
  mode: 'dir' | 'file' | 'link' | number;
  uid: number;
  gid: number;
};

export type TorrentFileTree = {
  files: Partial<TorrentFile>;
  isDir: boolean;
};

export interface StreamarrFsTorrent extends WebTorrent.Torrent {
  status: 'running' | 'pausing' | 'paused' | 'stopping';
  lastReadDate: number;
  activeReads?: number;
}

@Injectable()
export class StreamarrFsService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(StreamarrFsService.name);
  private fuseInstance;
  private readonly torrentStartTimeout;
  private readonly streamarrFsMountPath;

  constructor(
    private readonly torrentService: TorrentsService,
    private readonly webtorrentService: WebTorrentService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.torrentStartTimeout = this.configService.get<number>(
      'STREAMARR_TORRENT_START_TIMEOUT',
    );
    this.streamarrFsMountPath = this.configService.get<string>(
      'STREAMARRFS_MOUNT_PATH',
    );
  }

  async onApplicationShutdown(signal?: string) {
    const mountPath = this.getMountPath();
    this.logger.debug(`onApplicationShutdown signal=${signal}`);
    Fuse.unmount(this.getMountPath(), (err) => {
      if (err) {
        this.logger.error(
          `ERROR unmounting during shutdown for path ${mountPath}`,
        );
      }
    });
    await this.wipeMountPath();
  }

  async onModuleInit() {
    const mountPath = this.getMountPath();
    await this.wipeMountPath();
    const fuseHooks = ['readdir', 'getattr', 'read', 'open', 'release'].reduce(
      (prev, func) => {
        return {
          ...prev,
          [func]: this[func].bind(this),
        };
      },
      {},
    );

    this.fuseInstance = new Fuse(
      mountPath,
      {
        ...fuseHooks,
      },
      {
        autoUnmount: true,
        debug: true, //process.env.NODE_ENV !== 'production',
        timeout: 1000 * 100,
        // nonEmpty: true,
        allowOther: true,
        // allowRoot: true,
        maxRead: 1024 * 1000, // 1MB
      },
    );

    await this.mount();
  }

  private async mount() {
    const mountPath = this.getMountPath();
    const mountTask = new Promise((resolve, reject) => {
      this.fuseInstance.mount((err) => {
        if (err !== null) {
          this.logger.error(err, `ERROR mounting on path=${mountPath}`);
          return reject(err);
        }

        this.logger.log(`Mounted on path=${mountPath}`);
        return resolve(true);
      });
    });

    return mountTask;
  }

  private getMountPath() {
    return this.streamarrFsMountPath;
  }

  private async wipeMountPath() {
    const mountPath = this.getMountPath();
    try {
      await rm(mountPath, { recursive: true, force: true });
      await mkdir(mountPath);
    } catch (err) {
      this.logger.error(err, `ERROR wiping mountpath=${mountPath}`);
    }
  }

  private stat = (st: Partial<FileStat>): FileStat => {
    return {
      mtime: st.mtime || new Date(),
      atime: st.atime || new Date(),
      ctime: st.ctime || new Date(),
      size: st.size !== undefined ? st.size : 0,
      mode:
        st.mode === 'dir'
          ? 16877
          : st.mode === 'file'
            ? 33188
            : st.mode === 'link'
              ? 41453
              : st.mode,
      uid: st.uid !== undefined ? st.uid : process.getuid(),
      gid: st.gid !== undefined ? st.gid : process.getgid(),
    };
  };

  buildTree(files) {
    const tree = {};

    files.forEach((file) => {
      const parts = file.path.split('/');
      let currentLevel = tree;

      parts.forEach((part, index) => {
        if (!currentLevel[part]) {
          currentLevel[part] =
            index === parts.length - 1 ? { length: file.length } : {};
        }
        currentLevel = currentLevel[part];
      });
    });

    return tree;
  }

  async getTorrentTreeForInfoHash(infoHash: string) {
    const torrentFiles = await this.getTorrentFilesForInfoHash(infoHash);
    const torrentFilesTree = this.buildTree(torrentFiles);
    return torrentFilesTree;
  }

  async getTorrentFilesForInfoHash(infoHash: string) {
    const torrent = await this.torrentService.findOneByInfoHash(infoHash);
    return JSON.parse(torrent.files);
  }

  private isPathStartsWithTorrentHash(path) {
    return /^\/[a-f0-9]{40}\/?.*/i.test(path);
  }

  private isPathTorrentRoot(path) {
    return /^\/[a-f0-9]{40}\/?$/i.test(path);
  }

  private isPathTorrentFile(path) {
    return /^\/[a-f0-9]{40}\/?.*/i.test(path);
  }

  private getInfoHashFromPath(path) {
    return path.split('/')[1];
  }

  private getTorrentFilePathFromPath(path) {
    return path.split('/').splice(2).join('/');
  }

  private getDirFromFileTree(fileTree, dirPath) {
    const dirPathSplit = dirPath.split('/');
    let curDir = fileTree;
    for (let i = 0; i < dirPathSplit.length && curDir !== undefined; i++) {
      curDir = curDir[dirPathSplit[i]];
    }

    return curDir;
  }

  private async readdir(path: string, cb: FuseCallback): Promise<void> {
    this.logger.debug(`readdir=${path}`);
    if (path === '/') {
      const rootDirInfo = await this.torrentService.visibleTorrentsRootIndex();
      const hashFolders = rootDirInfo.map((torrent) => torrent.infoHash);
      return process.nextTick(cb, 0, hashFolders);
    }

    // In torrent
    if (this.isPathStartsWithTorrentHash(path)) {
      const infoHash = this.getInfoHashFromPath(path);
      const torrentFilesTree = await this.getTorrentTreeForInfoHash(infoHash);

      // If dir is torrent root
      if (this.isPathTorrentRoot(path)) {
        return process.nextTick(cb, 0, Object.keys(torrentFilesTree));
      }

      // If path is torrent dir
      if (this.isPathTorrentFile(path)) {
        const torrentFilesTree = await this.getTorrentTreeForInfoHash(infoHash);
        const filePathInTorrent = this.getTorrentFilePathFromPath(path);
        const curDir = this.getDirFromFileTree(
          torrentFilesTree,
          filePathInTorrent,
        );

        // If dir in torrent
        return process.nextTick(
          cb,
          0,
          curDir ? Object.keys(curDir) : undefined,
        );
      }

      return process.nextTick(cb, Fuse.ENOENT);
    }

    return process.nextTick(cb, 0);
  }

  private async getattr(path: string, cb: FuseCallback): Promise<void> {
    this.logger.debug('getattr', path);
    if (path === '/') {
      const dirSize = (await this.torrentService.visibleTorrentsRootIndex())
        .length;
      return process.nextTick(
        cb,
        null,
        this.stat({ mode: 'dir', size: dirSize }),
      );
    }

    // If a path to a torrent
    if (this.isPathStartsWithTorrentHash(path)) {
      const infoHash = this.getInfoHashFromPath(path);

      // Check if the torrent exists
      if (!(await this.torrentService.findOneByInfoHash(infoHash))) {
        return process.nextTick(cb, Fuse.ENOENT);
      }

      // If dir is torrent root
      if (this.isPathTorrentRoot(path)) {
        const torrentFilesTree = await this.getTorrentTreeForInfoHash(infoHash);
        return process.nextTick(
          cb,
          null,
          this.stat({
            mode: 'dir',
            size: Object.keys(torrentFilesTree).length,
          }),
        );
      }

      // If path is torrent file/dir
      if (this.isPathTorrentFile(path)) {
        const filePathInTorrent = this.getTorrentFilePathFromPath(path);
        const torrentFiles = await this.getTorrentFilesForInfoHash(infoHash);
        const fileInTorrent = torrentFiles.find(
          (torrent) => torrent.path === filePathInTorrent,
        );

        if (fileInTorrent) {
          return process.nextTick(
            cb,
            null,
            this.stat({
              mode: 'file',
              size: fileInTorrent.length,
            }),
          );
        }

        // Check if path is dir
        const torrentFilesTree = await this.getTorrentTreeForInfoHash(infoHash);
        const curDir = this.getDirFromFileTree(
          torrentFilesTree,
          filePathInTorrent,
        );

        if (curDir) {
          return process.nextTick(
            cb,
            null,
            this.stat({
              mode: 'dir',
              size: Object.keys(curDir).length,
            }),
          );
        }
      }
    }

    return process.nextTick(cb, Fuse.ENOENT);
  }

  private async open(path: string, flags: number, cb: FuseCallback) {
    this.logger.debug('open', path, flags);

    if (this.isPathStartsWithTorrentHash(path)) {
      const infoHash = this.getInfoHashFromPath(path);

      if (!(await this.torrentService.findOneByInfoHash(infoHash))) {
        return process.nextTick(cb, Fuse.ENOENT);
      }

      if (
        this.webtorrentService.hasReachedMaxConcurrentReadyTorrents() &&
        !this.webtorrentService.isTorrentInClient(infoHash)
      ) {
        return process.nextTick(cb, Fuse.EBUSY);
      }

      await this.notifyTorrentOpen(infoHash);
      return process.nextTick(cb, 0);
    }

    if (!this.isPathStartsWithTorrentHash(path)) {
      return process.nextTick(cb, Fuse.ENOENT);
    }
  }

  private async release(path, fd, cb) {
    this.logger.debug('realease', path, fd);
    if (this.isPathStartsWithTorrentHash(path)) {
      const infoHash = this.getInfoHashFromPath(path);
      await this.notifyTorrentRelease(infoHash);
      return process.nextTick(cb, 0);
    }
  }

  private async read(path, fd, buf, len, pos, cb) {
    try {
      // this.logger.debug('read', path, len, pos);
      if (this.isPathStartsWithTorrentHash(path)) {
        const infoHash = this.getInfoHashFromPath(path);

        // Return busy if max concurrency reached
        if (
          !(await this.webtorrentService.isTorrentInClient(infoHash)) &&
          this.webtorrentService.hasReachedMaxConcurrentReadyTorrents()
        ) {
          return process.nextTick(cb, Fuse.EBUSY);
        }

        const readableTorrent = await this.makeTorrentReadable(infoHash);

        if (!readableTorrent) {
          return process.nextTick(cb, Fuse.ECOMM);
        }

        const torrentFilePath = this.getTorrentFilePathFromPath(path);
        const file = await this.webtorrentService.getTorrentFileByPath(
          infoHash,
          torrentFilePath,
        );

        if (pos >= file.length) return process.nextTick(cb, 0); // done

        let totalLengthCopied = 0;
        for await (const data of file[Symbol.asyncIterator]({
          start: pos,
          end: pos + len,
        })) {
          const copylen = data.copy(buf, totalLengthCopied);
          totalLengthCopied += copylen;
        }
        this.notifyTorrentRead(infoHash);
        return process.nextTick(cb, totalLengthCopied);
      }
    } catch (err) {
      this.logger.error(`ERROR read`, path, fd, len, pos);
      return process.nextTick(cb, Fuse.EFAULT);
    }
  }

  private async notifyTorrentOpen(infoHash) {
    this.eventEmitter.emit('streamarrfs.file.open', {
      infoHash,
    } as StreamarrFsFileEvent);
  }

  private async notifyTorrentRead(infoHash) {
    this.eventEmitter.emit('streamarrfs.file.read', {
      infoHash,
    } as StreamarrFsFileEvent);
  }

  private async notifyTorrentRelease(infoHash) {
    this.eventEmitter.emit('streamarrfs.file.release', {
      infoHash,
    } as StreamarrFsFileEvent);
  }

  /**
   * Ensure the torrent is in ready state for every read.
   * - When torrent is ready and not paused return it.
   * - When torrent is paused resume it.
   * - When torrent is not running it start it.
   * @param infoHash
   * @returns torrent
   */
  async makeTorrentReadable(infoHash): Promise<WebTorrent.Torrent | null> {
    const readyTorrent =
      await this.webtorrentService.findReadyAndUnpausedTorrent(infoHash);
    if (readyTorrent) {
      return readyTorrent;
    }

    const resumedTorrent = await this.webtorrentService.resumeTorrent(infoHash);

    if (resumedTorrent) return readyTorrent;

    if (!resumedTorrent) {
      const torrentInfo = await this.torrentService.findOneByInfoHash(infoHash);

      const torrentInClient =
        await this.webtorrentService.getTorrentWithInfoHash(infoHash);
      if (!torrentInClient) {
        this.logger.debug(
          `torrent ${infoHash} not in client starting new torrent.`,
        );
        const startedTorrent =
          await this.webtorrentService.startTorrentWithMagnetLink(
            torrentInfo.magnetURI,
          );
        return startedTorrent;
      }

      if (torrentInClient && !torrentInClient.ready) {
        this.logger.debug(
          `torrent ${infoHash} is in client waiting for to be readable.`,
        );

        try {
          await pWaitFor(
            async () => {
              const polledTorrent =
                await this.webtorrentService.getTorrentWithInfoHash(infoHash);
              return polledTorrent.ready;
            },
            {
              interval: 1000,
              timeout: 1000 * 30,
            },
          );
          const readyTorrent =
            await this.webtorrentService.getTorrentWithInfoHash(infoHash);
          return readyTorrent;
        } catch (err) {
          this.logger.error(`ERROR while waiting for torrent ${infoHash}`);
          this.logger.error(err);
          return null;
        }
      }
    }
  }
}
