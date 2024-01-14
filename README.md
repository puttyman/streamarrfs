# streamarrfs (experimental)

Streamarrfs allows to stream torrents via plex, jellyfin and etc. Powered by [⚡️ webtorrent](https://github.com/webtorrent/webtorrent).

## How does it work?
  1. Streamarrfs finds torrents from your favorite torrent indexer. e.g. [Jackett](https://github.com/Jackett/Jackett)
  2. Finds list of files that are in the torrent.
  2. Stores info about torrents and including files in its internal database (sqlite).
  3. Mount and creates a virtual directory through [fuse](https://github.com/libfuse/libfuse) to simulate as if the files in the torrents are present locally.
  4. Whenever a read if requested to a file, Streamarrfs starts the torrent and stream through the portion of the file requested.

## Features
- Monitors torrents that are not being streamed and stop them.
- Automatically paused torrents if no read activity detected.
- Polls feed(s) on desired frequency.
- Ability to seek through video while streaming.
- File system can be mounted for other usage e.g. nginx as a file server.

## Setup instructions (Plex)

At the present this project only supports running as a docker image and on a amd64 architecture. PR is welcomed for any features. Given this project is at an experimental stage it is recommend to use a seperate plex server instance.

### Dependencies & Prerequisites
  - A plex account and able to generate a claim token at https://www.plex.tv/claim/ .
  - Fuse v2 (host).
  - Docker & Docker compose v2 (host).

## Steps (Tested on Ubuntu 22.04 LTS)

  1. Create your Nanode 1 GB
  2. SSH into it.
  3. `apt update && apt install docker.io` (you may skip if you already have docker and compose)
  4. Create the mount directory ```mkdir /tmp/streamarrfs```
  5. Create a directory for the docker compose file `mkdir /opt/streamarrfs`
  6. Create the docker-compose.yml file. `nano /opt/streamarrfs/docker-compose.yml`
  7. Paste the content from the example [docker-compose.yml](examples/plex/docker-compose.yml) file.
  8. Generate a claim token at https://www.plex.tv/claim/ .
  9. Update the `PLEX_CLAIM` with the token generated at 8.
  10. Save and start with `docker-compose up`


## Development

### Getting started

  1. From project root `cd server && npm i`
  2. Init database `npm run migration:run`
  2. Run dev `npm run start:dev`

### Database changes & migrations

  1. Make changes to your entities .ts files.
  2. Generate a migration `npm run migration:generate db/migrations/db-change`.



## FAQs and Caveats

#### Is there a web GUI?

Given project is experimental and if successful it will be implemented. PR welcomed.

#### Why stream when I can download?

- Quickly finds content of your liking before needing a download.
- No storage required. (only cached during streaming).
- Skim through multiple videos to check content.

#### Occassional plex errors

##### Errors
  - Playback error.
  - Content Unavailable.
  - An error occurred trying to play "...". Error code: s1001 (Network)

##### You are likely to get this error if:
- Your connection is not fast enough.
- Your server is not fast enough.
- The torrent does not have enough peers.
- The torrent has timed-out to be in readable state.
- Plex is currently indexing the library and may cause torrents to start.

##### Solutions & Workarounds
 - Simply retry playing the video until it works.
 - Use a feed source that returns movies with 100+ Seeds. e.g. YTS
 - Check CPU usage and see if your server is powerful enough.

##### ERROR - Please check that the file exists and the necessary drive is mounted.

Plex will not see the files from streamarrfs if it has been restarted. 
Plex should always be started after streamarrfs has successfully been mounted. Restarting plex should fix the issue.


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