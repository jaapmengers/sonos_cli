sonos_cli
=========

This NPM-package provides CLI playback control for those who exclusively or primarily use Sonos with Spotify.
It enables you to search artists, albums and tracks on Spotify, queue them and do some basic playback control.

Install with NPM: ```npm install sonos_cli```

```
Usage:
  sonos [OPTIONS] [ARGS]

Options:
  -p, --play             Play whichever track is currently queued
  -u, --pause            Pause playback
  -s, --search STRING    Search an artist in Spotify's collection
  -a, --addandplay STRINGAdd a track or an album by spotify URI and play it
  -m, --mute             Mute
  -u, --unmute           Unmute
  -b, --browse           Browse the list of enqueued tracks
  -n, --next             Plays the next track in the queue
  -r, --previous         Plays the previous track in the queue
  -c, --current          Shows the track currently playing
  -h, --help             Display help and usage details
```
