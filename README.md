# streamarrfs (experimental)

Currently a work in progress.

## Usage

STREAMARR_FEED_SOURCE_JACKETT_URL
STREAMARR_FEED_SOURCE_POLL_CRON
STREAMARR_FEED_SOURCE_ADD_DELAY=
STREAMARR_DOWNLOAD_PATH=./downloads
STREAMARRFS_PATH=/mnt/streamarrfs
STREAMARRFS_FORCE=true
export STREAMARR_FEED_URL_ITEM_1=http://10.0.0.100:9117/api/v2.0/indexers/yts/results/torznab/api\?apikey\=xxxx\&t\=search\&cat\=100044\&q\=2023


# Prequisites
- Docker
- Docker compose >= v2
- Fuse on host

# TODO
- Virtual video to stop all torrents
- p-limit feed if needed

# Troubleshooting

When you force remove the container, you have to sudo fusermount -u -z /host/mount/point on the hostsystem!

```bash
rm: cannot remove 'streamarr/media': Device or resource busy
user@server: sudo fusermount -u -z streamarr/media/
user@server: rm -rf streamarr/
```

## Errors

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

# Mounted directory is empty

Add this flag if you want to allow other users to access this fuse mountpoint.
You need to add user_allow_other flag to /etc/fuse.conf file.
 
```allow_other: true` 