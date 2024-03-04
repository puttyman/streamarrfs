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
import { StreamarrFsFileEvent, StreamarrFsTorrent } from '../types';

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
      'STREAMARRFS_TORRENT_START_TIMEOUT',
    );
    this.streamarrFsMountPath = this.configService.get<string>(
      'STREAMARRFS_MOUNT_PATH',
    );
  }

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`onApplicationShutdown signal=${signal} started`);
    await this.unmountFs();
    await this.wipeAndRecreateMountedPath();
    this.logger.log(`onApplicationShutdown signal=${signal} completed`);
  }

  async onModuleInit() {
    const mountPath = this.getMountPath();
    await this.wipeAndRecreateMountedPath();
    await this.unmountFs();
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
        autoUnmount: this.configService.get<boolean>(
          'STREAMARRFS_FUSE_AUTO_UNMOUNT',
        ),
        debug: this.configService.get<boolean>('STREAMARRFS_FUSE_DEBUG'),
        timeout: this.configService.get<number>('STREAMARRFS_FUSE_TIMEOUT'),
        nonEmpty: this.configService.get<boolean>('STREAMARRFS_FUSE_NON_EMPTY'),
        allowOther: this.configService.get<boolean>(
          'STREAMARRFS_FUSE_ALLOW_OTHER',
        ),
        allowRoot: this.configService.get<boolean>(
          'STREAMARRFS_FUSE_ALLOW_ROOT',
        ),
        maxRead: this.configService.get<number>(
          'STREAMARRFS_FUSE_ALLOW_MAX_READ',
        ),
      },
    );

    await this.mountFs();
  }

  /**
   * Only used in unit test for workaround.
   */
  public async _unmountFuseInstance() {
    const pUnmountInstance = new Promise((resolve, reject) => {
      this.fuseInstance.unmount((err) => {
        if (err) {
          return reject(err);
        }

        return resolve(true);
      });
    });

    try {
      await pUnmountInstance;
    } catch (err) {
      this.logger.warn(`ERROR unmounting by instance ${this.getMountPath()}`);
      this.logger.warn(err);
    }
  }

  private async unmountFs() {
    const pUnmount = new Promise((resolve, reject) => {
      Fuse.unmount(this.getMountPath(), (err) => {
        if (!err) return reject(err);

        return resolve(true);
      });
    });
    try {
      await pUnmount;
      this.logger.log(`Unmounted successfully`);
    } catch (err) {
      this.logger.warn(`ERROR unmounting ${this.getMountPath()}`);
    }
  }

  private async mountFs() {
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

  private async wipeAndRecreateMountedPath() {
    const mountPath = this.getMountPath();
    try {
      await rm(mountPath, { recursive: true, force: true });
      await mkdir(mountPath, { recursive: true });
    } catch (err) {
      this.logger.warn(err, `ERROR wiping mountpath=${mountPath}`);
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

  async getFilesAsTree(torrent) {
    const files = JSON.parse(torrent.files);
    return this.buildTree(files);
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
    this.logger.verbose(`readdir=${path}`);
    try {
      if (path === '/') {
        const rootDirInfo =
          await this.torrentService.visibleTorrentsRootIndex();
        const hashFolders = rootDirInfo.map((torrent) => torrent.infoHash);
        return process.nextTick(cb, 0, ['healthcheck', ...hashFolders]);
      }

      if (path === '/healthcheck') {
        return process.nextTick(cb, 0, []);
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
          const torrentFilesTree =
            await this.getTorrentTreeForInfoHash(infoHash);
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
    } catch (err) {
      this.logger.error(`ERROR 'readdir'`, path);
      this.logger.error(err);
      return process.nextTick(cb, Fuse.EIO);
    }

    return process.nextTick(cb, 0);
  }

  private async getattr(path: string, cb: FuseCallback): Promise<void> {
    this.logger.verbose('getattr', path);
    try {
      if (path === '/') {
        const dirSize = (await this.torrentService.visibleTorrentsRootIndex())
          .length;
        return process.nextTick(
          cb,
          null,
          this.stat({ mode: 'dir', size: dirSize }),
        );
      }

      if (path === '/healthcheck') {
        return process.nextTick(cb, null, this.stat({ mode: 'dir', size: 1 }));
      }

      // If a path to a torrent
      if (this.isPathStartsWithTorrentHash(path)) {
        const infoHash = this.getInfoHashFromPath(path);

        // Check if the torrent exists
        const torrent =
          await this.torrentService.findOneVisibleByInfoHash(infoHash);
        if (!torrent) {
          return process.nextTick(cb, Fuse.ENOENT);
        }

        // If dir is torrent root
        if (this.isPathTorrentRoot(path)) {
          const torrentFilesTree =
            await this.getTorrentTreeForInfoHash(infoHash);
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
          const torrentFilesTree =
            await this.getTorrentTreeForInfoHash(infoHash);
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
    } catch (err) {
      this.logger.error(`ERROR 'getattr'`, path);
      this.logger.error(err);
      return process.nextTick(cb, Fuse.EIO);
    }

    return process.nextTick(cb, Fuse.ENOENT);
  }

  private async open(path: string, flags: number, cb: FuseCallback) {
    this.logger.verbose('open', path, flags);

    try {
      if (this.isPathStartsWithTorrentHash(path)) {
        const infoHash = this.getInfoHashFromPath(path);

        if (!(await this.torrentService.findOneVisibleByInfoHash(infoHash))) {
          return process.nextTick(cb, Fuse.ENOENT);
        }

        if (
          this.webtorrentService.hasReachedMaxConcurrentReadyTorrents() &&
          !this.webtorrentService.isTorrentInClient(infoHash)
        ) {
          this.logger.log(
            `Cannot open ${infoHash}. Max ready torrents reached.`,
          );
          return process.nextTick(cb, Fuse.EBUSY);
        }

        await this.notifyTorrentOpen(infoHash);
        return process.nextTick(cb, 0);
      }

      if (!this.isPathStartsWithTorrentHash(path)) {
        this.logger.error(`Cannot open path=${path}. Not found`);
        return process.nextTick(cb, Fuse.ENOENT);
      }
    } catch (err) {
      this.logger.error(`ERROR 'open'`, path);
      this.logger.error(err);
      return process.nextTick(cb, Fuse.EIO);
    }

    return process.nextTick(cb, Fuse.EIO);
  }

  private async release(path, fd, cb) {
    this.logger.verbose('realease', path, fd);
    try {
      if (this.isPathStartsWithTorrentHash(path)) {
        const infoHash = this.getInfoHashFromPath(path);
        await this.notifyTorrentRelease(infoHash);
        return process.nextTick(cb, 0);
      }

      return process.nextTick(cb, Fuse.ENOENT);
    } catch (err) {
      this.logger.error(`ERROR 'realease'`, path);
      this.logger.error(err);
      return process.nextTick(cb, Fuse.EIO);
    }
  }

  private async read(path, fd, buf, len, pos, cb) {
    try {
      this.logger.verbose('read', path, len, pos);
      if (this.isPathStartsWithTorrentHash(path)) {
        const infoHash = this.getInfoHashFromPath(path);

        // Return busy if max concurrency reached
        if (
          !(await this.webtorrentService.isTorrentInClient(infoHash)) &&
          this.webtorrentService.hasReachedMaxConcurrentReadyTorrents()
        ) {
          this.logger.log(
            `Cannot read ${infoHash}. Max ready torrents reached.`,
          );
          return process.nextTick(cb, Fuse.EBUSY);
        }

        const readableTorrent = await this.makeTorrentReadable(
          infoHash,
          async (torrent: StreamarrFsTorrent) => {
            this.notifyTorrentRead(torrent.infoHash);
          },
        );

        if (!readableTorrent) {
          // Just return busy error here. The user may retry/resume.
          this.logger.log(
            `Cannot read ${infoHash}. Torrent failed to be readable on time.`,
          );
          return process.nextTick(cb, Fuse.EBUSY);
        }

        const torrentFilePath = this.getTorrentFilePathFromPath(path);
        const file = await this.webtorrentService.getTorrentFileByPath(
          infoHash,
          torrentFilePath,
        );

        if (pos >= file.length) return process.nextTick(cb, 0); // done

        let totalLengthCopied = 0;
        this.notifyTorrentRead(infoHash);
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
      return process.nextTick(cb, Fuse.EIO); // IO error
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
   * - When torrent is not running it start it and return once ready
   * @param infoHash
   * @param onTorrentReadable Callback when torrent is readable.
   * @returns torrent
   */
  async makeTorrentReadable(
    infoHash,
    onTorrentReadable: (torrent: StreamarrFsTorrent) => Promise<void>,
  ): Promise<StreamarrFsTorrent | null> {
    let readableTorrent: StreamarrFsTorrent = null;

    const readyTorrent =
      await this.webtorrentService.findReadyAndUnpausedTorrent(infoHash);
    if (readyTorrent) {
      readableTorrent = readyTorrent;
    }

    const resumedTorrent = await this.webtorrentService.resumeTorrent(infoHash);
    if (resumedTorrent) {
      readableTorrent = resumedTorrent;
    }

    if (!resumedTorrent) {
      const torrentInfo =
        await this.torrentService.findOneVisibleByInfoHash(infoHash);

      const torrentInClient =
        await this.webtorrentService.getTorrentWithInfoHash(infoHash);
      if (!torrentInClient) {
        this.logger.log(
          `torrent ${infoHash} not in client starting new torrent.`,
        );
        const startedTorrent =
          await this.webtorrentService.startTorrentWithTimeout(
            infoHash,
            torrentInfo.magnetURI,
          );
        readableTorrent = startedTorrent;
      }

      if (torrentInClient && !torrentInClient.ready) {
        this.logger.log(
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
              timeout: this.configService.get<number>(
                'STREAMARRFS_TORRENT_START_TIMEOUT',
              ),
            },
          );
          const readyTorrent =
            await this.webtorrentService.getTorrentWithInfoHash(infoHash);
          readableTorrent = readyTorrent;
        } catch (err) {
          this.logger.error(`ERROR while waiting for torrent ${infoHash}`);
          this.logger.error(err);
          return null;
        }
      }
    }

    try {
      await onTorrentReadable(readableTorrent);
      return readableTorrent;
    } catch (err) {
      this.logger.error(`ERROR making torrent readable ${infoHash}`);
      this.logger.error(err);
      return null;
    }
  }
}
