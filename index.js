#!/usr/local/bin/node

var cli = require('cli'),
	sonos = require('sonos'),
	Q = require('q'),
	http = require('http'),
	_ = require('underscore'),
	readline = require('readline');


var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var device;


sonos.Sonos.prototype.enqueueSpotify = function(uri){
	var encodedUri = encodeURIComponent(uri);
	var RENDERING_ENDPOINT = '/MediaRenderer/AVTransport/Control';
  	var action = '"urn:schemas-upnp-org:service:AVTransport:1#AddURIToQueue"';
  	var body = '<u:AddURIToQueue xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"> \
         <InstanceID>0</InstanceID> \
         <EnqueuedURI>x-sonos-spotify:' + encodedUri + '?sid=9&amp;flags=0</EnqueuedURI> \
         <EnqueuedURIMetaData> \
         	&lt;DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" \
         	xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" \
         	xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"&gt;&lt;item id="00030000' + encodedUri + '" \
         	restricted="true"&gt;&lt;dc:title&gt;America&lt;/dc:title&gt;&lt;upnp:class&gt;object.item.audioItem.musicTrack&lt;/upnp:class&gt;&lt;desc id="cdudn" \
         	nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/"&gt;SA_RINCON2311_X_#Svc2311-0-Token&lt;/desc&gt;&lt;/item&gt;&lt;/DIDL-Lite&gt; \
     	</EnqueuedURIMetaData> \
         <DesiredFirstTrackNumberEnqueued>0</DesiredFirstTrackNumberEnqueued> \
         <EnqueueAsNext>0</EnqueueAsNext> \
      </u:AddURIToQueue>';

  return this.request(RENDERING_ENDPOINT, action, body, null, function(err, data){
  	
  });
}

cli.parse({
	play: ['p', 'Play whichever track is currently queued', 'string'],
	search: ['s', 'Search an artist in Spotify\'s collection', 'string' ]
});


cli.main(function(args, options){


	var deferred = Q.defer();

	sonos.search(function(device){
		deferred.resolve(device);
	});


	deferred.promise.then(function(_device){

		device = _device;

		if(options.search){
			var artistSelection = getArtists(options.search).then(selectArtist);

		}
	});
});

function selectArtist(searchResults){
	console.log('');
	_.each(searchResults.artists, function(artist, i){
		console.log(i + '. ' + artist.name);
	});

	rl.question("Select an artist: ", function(answer){
		var index = parseInt(answer);
		var artist = searchResults.artists[index];

		var result = getAlbumsForArtist(artist);
		result.then(function(albums){
			selectAlbum(albums.artist.albums);
		});
	});
}

function selectAlbum(albums){
	console.log('');
	_.each(albums, function(it, i){
		console.log(i + '. ' + it.album.artist + ' - ' + it.album.name);
	});

	rl.question('Select an album: ', function(answer){
		var index = parseInt(answer);
		var it = albums[index];
		var promise = getTracksForAlbum(it.album);
		promise.then(function(tracks){
			selectTrack(tracks.album);
		});
	})
}

function playTrack(track){
	device.enqueueSpotify(track.href);
	device.play(function(err, data){
		process.exit(0);
	});
}

function selectTrack(album){
	console.log('');
	_.each(album.tracks, function(track, i){
		console.log(i + '. ' + album.artist + ' - ' + track.name);
	});

	rl.question("Select a track: ", function(answer){
		var index = parseInt(answer);
		var track = album.tracks[index];

		playTrack(track);
	});
}

function getTracksForAlbum(album){
	var def = Q.defer();
	var url = "http://ws.spotify.com/lookup/1/.json?extras=track&uri=" + album.href;

	http.get(url, function(res){
		handleResponse(res, def);
	}).on('error', function(e) {
		console.log("Got error: ", e);
	});
	return def.promise;	
}

function getAlbumsForArtist(artist){
	var def = Q.defer();
	var url = "http://ws.spotify.com/lookup/1/.json?extras=album&uri=" + artist.href;

	http.get(url, function(res){
		handleResponse(res, def);
	}).on('error', function(e) {
		console.log("Got error: ", e);
	});
	return def.promise;
}


function handleResponse(res, promise){
    var body = '';

    res.on('data', function(chunk) {
        body += chunk;
    });

    res.on('end', function() {
        var resp = JSON.parse(body)
        promise.resolve(resp);
    });
}

function getArtists(query){
	var def = Q.defer();

	var url = "http://ws.spotify.com/search/1/artist.json?q=" + query;
	http.get(url, function(res) {
		handleResponse(res, def);
	}).on('error', function(e) {
		console.log("Got error: ", e);
	});

	return def.promise;
}
