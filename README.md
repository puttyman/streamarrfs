# Streamarrfs (experimental)

Streamarrfs allows to stream movie or tv shows torrents via plex, jellyfin and etc. Powered by ⚡️[webtorrent](https://github.com/webtorrent/webtorrent).

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/puttyman) if you like this project.

## How does it work?
  1. Streamarrfs finds torrents from your favorite torrent indexer. e.g. [Jackett](https://github.com/Jackett/Jackett)
  2. Stores info about torrents and including files in its internal database (sqlite3).
  3. Mount and creates a virtual directory through [fuse](https://github.com/libfuse/libfuse) to simulate as if the files in the torrents are present locally.
  4. Whenever a read if requested to a file, Streamarrfs starts the torrent and stream through the portion of the file requested.
  5. Automatically stop torrents that has no read activity after certain period.

## Features
- Monitors torrents that are not being streamed and stop them.
- Automatically paused followed to a stop of torrents if no read activity detected.
- Polls feed(s) on desired frequency.
- Ability to seek through video while streaming.
- File system can be mounted for other usage e.g. nginx as a file server.
- Handles torrent duplicates from multiple feeds.

### Supported Indexes
  - [Jackett](https://github.com/Jackett/Jackett)

### Caveats
  - When Plex or Jellyfin scans your media library it will cause torrents to start. Streamarrfs get around this problem by having a max number of streaming or running torrents see `STREAMARRFS_TORRENT_MAX_READY`. However, the limit might cause a new stream to result in an [error](https://github.com/puttyman/streamarrfs?tab=readme-ov-file#occassional-plex-errors) if the max running torrents has been reached. You can get around this problem by manually stopping the torrent via the [web gui](https://github.com/puttyman/streamarrfs?tab=readme-ov-file#is-there-a-web-gui) at `http://{HOST}:3000/` or simply wait for it to be automatically stopped due to no read activity.

## Setup instructions

At the present this project only supports running as a docker image and on a x86_64 architecture. PRs are welcomed for any features and bug fixes. Given this project is at an experimental stage it is recommended to use a seperate plex server instance.

### Dependencies & Prerequisites
  - Fuse v2 (host).

    ```bash
    # On Ubuntu 22.04 LTS you may install this with the commands below.
    apt update
    apt apt install fuse libfuse2 libfuse-dev -y
    ```
  - Docker & Docker compose v2 (host).

    ```bash
    # On Ubuntu 22.04 LTS you may install this with the commands below.
    apt update
    apt install docker.io
    # Install docker compose v2
    # See: https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-compose-on-ubuntu-22-04
    # Confirm you have docker and compose v2.x.x
    # Note make sure you have at least docker-compose 2.24
    docker info
    docker compose version
    ```
  - Root access. Running the image as a user should be possible with a few tweaks.
  - Hardware. Recommended minimum of 8gb RAM due to a [webtorrent issue](https://github.com/webtorrent/webtorrent/issues/1973).

### Common steps for Plex & Jellyfin (Tested on Ubuntu 22.04 LTS)

  1. Make sure your host has the fuse at `/dev/fuse`.

    ls /dev/fuse

  2. SSH as root with command:
  
    sudo su

  4. Create a directory where Streamarrfs will mount the torrents' files.
  
    mkdir /tmp/streamarrfs-tmp
  
  5. Create & change to directory for the docker compose file.
  
    mkdir /opt/streamarrfs && cd /opt/streamarrfs
  
  6. Create the docker-compose.yml file from the examples. 
    
  ```bash
  curl https://raw.githubusercontent.com/puttyman/streamarrfs/master/examples/plex/docker-compose.yml > docker-compose.yml
  ```

  7. Start the docker compose stack in the background.

  ```bash
  docker compose up -d
  ```
  8. Streamarrfs should now have the files of torrents mounted under **/tmp/streamarrfs-tmp/streamarrfs-mnt/**. You may now access the files directly on your host or mount it to another docker container e.g. Plex or Jellyfin. If you are unsure how to do so continue to [Adding the streamarrfs files as a media libray](https://github.com/puttyman/streamarrfs?tab=readme-ov-file#adding-the-streamarrfs-files-as-a-media-libray).

### Adding the streamarrfs files as a media libray

#### Plex

The instructions below is based on the [example](https://raw.githubusercontent.com/puttyman/streamarrfs/master/examples/plex/docker-compose.yml).

  1. On a browser go to your plex instance web ui. Based example on the docker file plex should be listening on the IP of your host machine.

  ```bash
  open http://{YOUR_HOST_IP}:32400/web
  ```

  2. Follow the [Official Plex Basic Setup Wizard](https://support.plex.tv/articles/200288896-basic-setup-wizard/)

  3. At **Step 10.** add the folder **/streamarrfs** as the media library.

  4. Optional for optimal experience. In the **Advanced** section. **Disable** the following options:

      4.1 Prefer artwork based on library language
      
      4.2 Disable Include related external content

      4.3 Use local assets

      4.4 Enable video preview thumbnails
  5. Save your media library and you may now test plex with the sample free torrents
  6. To add a Jackett feed. See [Adding Jackett indexers to Streamarrfs](https://github.com/puttyman/streamarrfs?tab=readme-ov-file#adding-jackett-indexers-to-streamarrfs)

#### Jellyfin (TODO)

The instructions below is based on the [example](https://raw.githubusercontent.com/puttyman/streamarrfs/master/examples/plex/docker-compose.yml).

### Adding Jackett indexers to Streamarrfs

  1. Create your desired Jackett indexer. The [example](https://raw.githubusercontent.com/puttyman/streamarrfs/master/examples/plex/docker-compose.yml) should have an instance of Jackett running at `http://{YOUR_HOST_IP}:9117`. If you are unsure how to do so follow this [guide](https://www.rapidseedbox.com/blog/guide-to-jackett).
  
  2. Copy the RSS link of your indexer from your Jackett web portal.
  3. In the [docker-compose.yaml](https://raw.githubusercontent.com/puttyman/streamarrfs/master/examples/plex/docker-compose.yml) file add a new environment variable named `STREAMARRFS_JACKETT_FEED_URL_ITEM_{NAME}`. Replace `{NAME}` with any name so you can uniquely identify your indexer. The value of the variable should be the RSS link of your indexer from Jackett. You may add any extra query params to fine tune your results from Jackett. Example below.

  ```yml
      environment:
        - NODE_ENV=production
        - STREAMARRFS_JACKETT_FEED_URL_ITEM_YTS=http://HOST:9117/api/v2.0/indexers/yts/results/torznab/api?apikey=key&t=search&cat=&q=
  ```
  4. Restart your docker stack. `docker compose restart`.
  5. Enjoy.

## Container environment variables

Note: some variables are undocumented.

| Variable | Description |
| --- | ----------- |
| STREAMARRFS_JACKETT_FEED_URL_PREFIX | The prefix of the environment variable to look for jackett feed URLs. Default = `STREAMARRFS_JACKETT_FEED_URL_ITEM` |
| STREAMARRFS_JACKETT_FEED_URL_ITEM_* | The prefix for a jackett feed URL |
| STREAMARRFS_LOG_LEVEL | Can be a list seperated by comma for multiple log level. e.g. debug,error,fatal,log,warn,verbose . Default for production error,log |
| STREAMARRFS_ADD_FREE_TORRENTS | Add some free torrents on startup. Default = true |
| STREAMARRFS_TORRENT_PAUSE_AFTER_MS | The time to wait when no read activity is detected to pause a torrent. |
| STREAMARRFS_TORRENT_STOP_AFTER_MS | The time to wait when no read activity is detected to stop a torrent. |
| STREAMARRFS_TORRENT_MAX_READY | The maximum number of torrents allowed to be streaming at any given time. Default = 1. |
| STREAMARRFS_TORRENT_START_TIMEOUT | The timeout for a torrent to be in a readable state. Default = 2mins. |
| STREAMARRFS_TORRENT_INDEXER_CONCURRENCY | The number of concurrent torrents which can be indexed at any given time. Default = 1. |
| STREAMARRFS_WEBTORRENT_MAX_CONNS | The max connections per torrent. Default = 1. |

## Development

### Linux/WSL (Ubuntu 22.04 LTS) dependencies
  1. Install libfuse

    apt update
    apt install fuse libfuse2 libfuse-dev -y

### OSX
  1. Install osxfuse

    brew install --cask osxfuse
  
  2. Alternatively install the .dmg from their [github releases](https://github.com/osxfuse/osxfuse/releases).

### Getting started

  1. From project root `cd server && npm i`
  2. Init database `npm run build`
  3. Init database `npm run migration:run`
  4. Run dev `npm run start:dev`

### Database changes & migrations

  1. Make changes to your entities .ts files.
  2. Generate a migration `npm run migration:generate db/migrations/db-change`.



## FAQs

#### Is there a web GUI?

There is a simple web gui available at http://{YOUR_SERVER_IP}:3000/web. This GUI should allow you to view stats of streaming and indexing torrent.

The UI also allow you stop them in case you do not wish to wait for the automatic cleanup.

#### Why stream when I can download?

- Quickly finds content of your liking before needing a download.
- No storage required. (only cached during streaming).
- Skim through multiple videos to check content.

## Occassional Plex errors

### Errors
  - Playback error.
  - Content Unavailable.
  - An error occurred trying to play "...". Error code: s1001 (Network)

#### You are likely to get this error if:
- Your connection is not fast enough.
- Your server is not fast enough.
- The torrent does not have enough peers.
- The torrent has timed-out to be in readable state.
- Plex is currently indexing the library and may cause torrents to start.
- Your server does not have enough RAM. Your allocated RAM should be more than the size of the video being streamed. See [webtorrent issue](https://github.com/webtorrent/webtorrent/issues/1973)
- The video your are trying to stream have multiple versions. e.g. movie.1080p.mp4 movie.2160p.mp4.

#### Solutions & Workarounds
 - Simply retry playing the video until it works.
 - Use a feed source that returns movies with 100+ Seeds. e.g. YTS
 - Check CPU usage and see if your server is powerful enough.
 - Plex indexing - wait for 1-2mins streamarrfs will stop the torrent after no activity.
 - Lower the frequency that torrents are added from feeds.

#### ERROR - Please check that the file exists and the necessary drive is mounted.

Plex will not see the files from streamarrfs if it has been restarted. 
Plex should always be started after streamarrfs has successfully been mounted. Restarting plex should fix the issue.

See [example](examples/plex/docker-compose.yml) to start plex as a docker image and depends on streamarrfs.


## Troubleshooting

### Common issues

- When you force remove the container, you have to sudo fusermount -uz /host/mount/point on the hostsystem!

```bash
rm: cannot remove '/tmp/streamarrfs: Device or resource busy
user@server: sudo fusermount -uz /tmp/streamarrfs
user@server: rm -rf /tmp/streamarrfs
```

- For running outside of docker.

```
npm ERR! Package fuse was not found in the pkg-config search path.
npm ERR! Perhaps you should add the directory containing `fuse.pc'
npm ERR! to the PKG_CONFIG_PATH environment variable
npm ERR! No package 'fuse' found
npm ERR! Package fuse was not found in the pkg-config search path.
npm ERR! Perhaps you should add the directory containing `fuse.pc'
npm ERR! to the PKG_CONFIG_PATH environment variable
npm ERR! No package 'fuse' found
npm ERR! gyp: Call to 'pkg-config --libs-only-L --libs-only-l fuse' returned exit status 1 while in binding.gyp. while trying to load binding.gyp
npm ERR! gyp ERR! configure error
```

You need to have libfuse-dev prior to `npm install` as @cocalc/fuse-native does not ship with libfuse.

```
sudo apt-get install -y libfuse-dev
```

#### Mounted directory is empty

Add this flag if you want to allow other users to access this fuse mountpoint.
You need to add user_allow_other flag to /etc/fuse.conf file.
 
```user_allow_other```