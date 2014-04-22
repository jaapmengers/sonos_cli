#!/usr/local/bin/node

var cli = require('cli'),
	sonos = require('sonos'),
	Q = require('q'),
	http = require('http'),
	_ = require('underscore'),
	xml2js = require('xml2js'),
	readline = require('readline');


var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var device;

cli.parse({
	play: ['p', 'Play whichever track is currently queued'],
	pause: ['u', 'Pause playback'],
	search: ['s', 'Search an artist in Spotify\'s collection', 'string' ],
	addandplay: ['a', 'Add a track or an album by spotify URI and play it', 'string'],
	getvolume: ['g', 'Get volume'],
	setvolume: ['v', 'Set volume, 1..100', 'int'],
	mute: ['m', 'Mute'],
	unmute: ['u', 'Unmute'],
	browse: ['b', 'Browse the list of enqueued tracks'],
	next: ['n', 'Plays the next track in the queue'],
	previous: ['r', 'Plays the previous track in the queue'],
	current: ['c', 'Shows the track currently playing'],
	device: ['d', 'Connects to the device at the provided IP', 'string']
});

sonos.Sonos.prototype.browse = function(){

	var RENDERING_ENDPOINT = '/MediaServer/ContentDirectory/Control';
  	var action = '"urn:schemas-upnp-org:service:ContentDirectory:1#Browse"';
	var body = '<u:Browse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1"><ObjectID>Q:0</ObjectID><BrowseFlag>BrowseDirectChildren</BrowseFlag><Filter>dc:title,res,dc:creator,upnp:artist,upnp:album,upnp:albumArtURI</Filter><StartingIndex>0</StartingIndex><RequestedCount>100</RequestedCount><SortCriteria></SortCriteria></u:Browse>';

	var defer = Q.defer();

	this.request(RENDERING_ENDPOINT, action, body, 'u:BrowseResponse', function(err, data){

		new xml2js.Parser().parseString(data[0].Result, function(err, didl) {
      		
      		var items = [];
      
			_.each(didl['DIDL-Lite'].item, function(item, index){
        		items.push({"title": item['dc:title'][0], "artist": item['dc:creator'][0], "index": index+1});
        	});

        	defer.resolve(items);
      	});
	});

	return defer.promise;
};

sonos.Sonos.prototype.enqueueSpotify = function(uri){

	var encodedUri = encodeURIComponent(uri);
	var isAlbum = uri.indexOf('spotify:album') > -1;

	var audioClass = isAlbum ? 'object.container.album.musicAlbum' : 'object.item.audioItem.musicTrack';
	var enqueuedURI = isAlbum ? 'x-rincon-cpcontainer:0004006c' + encodedUri : 'x-sonos-spotify:' + encodedUri;
	var code = isAlbum ? '0004006c' : '00030000';

	var RENDERING_ENDPOINT = '/MediaRenderer/AVTransport/Control';
  	var action = '"urn:schemas-upnp-org:service:AVTransport:1#AddURIToQueue"';
  	var body = '<u:AddURIToQueue xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"> \
         <InstanceID>0</InstanceID> \
         <EnqueuedURI>' + enqueuedURI + '</EnqueuedURI> \
         <EnqueuedURIMetaData> \
         	&lt;DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" \
         	xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" \
         	xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"&gt;&lt;item id="' + code + encodedUri + '" \
         	restricted="true"&gt;&lt;dc:title&gt;America&lt;/dc:title&gt; \
         	&lt;upnp:class&gt;' + audioClass + '&lt;/upnp:class&gt;&lt;desc id="cdudn" \
         	nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/"&gt;SA_RINCON2311_X_#Svc2311-0-Token&lt;/desc&gt;&lt;/item&gt;&lt;/DIDL-Lite&gt; \
     	</EnqueuedURIMetaData> \
         <DesiredFirstTrackNumberEnqueued>0</DesiredFirstTrackNumberEnqueued> \
         <EnqueueAsNext>0</EnqueueAsNext> \
      </u:AddURIToQueue>';

	var defer = Q.defer();	

   	this.request(RENDERING_ENDPOINT, action, body, 'u:AddURIToQueueResponse', function(err, data){
	  	var newIndex =  _.reduce(data[0].FirstTrackNumberEnqueued, function(it, num){
	  		return parseInt(num);
	  	}, 0);
	  	defer.resolve(newIndex);
  	});

   	return defer.promise;
}

sonos.Sonos.prototype.seekTrackNr = function(nr){
	var RENDERING_ENDPOINT = '/MediaRenderer/AVTransport/Control';
  	var action = '"urn:schemas-upnp-org:service:AVTransport:1#Seek"';
  	var body = '<s:Body><u:Seek xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Unit>TRACK_NR</Unit><Target>' + nr + '</Target></u:Seek>';

  	var defer = Q.defer();

   	this.request(RENDERING_ENDPOINT, action, body, 'u:AddURIToQueueResponse', function(err, data){
	  	defer.resolve();
  	});
  	return defer.promise;
}


cli.main(function(args, options){

	var deferred = Q.defer();

	if(options.device){
		deferred.resolve(new sonos.Sonos(options.device));

	} else {
		sonos.search(function(device){
			deferred.resolve(device);
		});
	}


	deferred.promise.then(function(_device){

		device = _device;

		if(options.addandplay){
			device.enqueueSpotify(options.addandplay).then(function(nr){
				device.seekTrackNr(nr);
			}).then(function(){
				device.play(function(){ 
					process.exit(0);
				});
			});
		}

		if(options.search){
			//I am not to pleased with the nested promises to handle the flow, but it will have to do for now
			getArtists(options.search).then(selectArtist);
		}

		if(options.play){
			device.play(function(){
				process.exit(0);
			});
		}

		if(options.pause){
			device.pause(function(){
				process.exit(0);
			})
		}

		if(options.getvolume){
			device.getVolume(function(err, volume){
				console.log('current volume is ' + volume);
				process.exit(0);
			})
		}

		if(options.setvolume !== null){
			if(options.setvolume > 100 || options.setvolume < 0) {
				console.log('volume must be between 0 and 100');
				process.exit(1);
			}

			device.setVolume(options.setvolume, function(){
				console.log('volume set to ' + options.setvolume);
				process.exit(0);
			})
		}

		if(options.mute){
			device.setMuted(true, function(){
				process.exit(0);
			});
		}

		if(options.unmute){
			device.setMuted(false, function(){
				process.exit(0);
			})
		}


		if(options.browse){			
			device.browse().then(showQueue);
		}

		if(options.next){
			device.next(function(){
				process.exit(0);
			});
		}

		if(options.previous){
			device.previous(function(){
				process.exit(0);
			});
		}

		if(options.current){
			device.currentTrack(function(err, result){
				console.log(result.artist + ' - ' + result.title);
				process.exit(0);
			});
		}
	});
});

function showQueue(browseResults){
	console.log('');
	_.each(browseResults, function(item, index){
		console.log(index + '. ', item.artist + ' - ' + item.title);
	});

	rl.question('\nSelect a track for playback: ', function(answer){
		var index = parseInt(answer);
		device.seekTrackNr(browseResults[index].index).then(function(){
			device.play(function(err, data){
				process.exit(0);
			});
		})
	})
}

function selectArtist(searchResults){
	console.log('');
	_.each(searchResults.artists, function(artist, i){
		console.log(i + '. ' + artist.name);
	});

	rl.question("\nSelect an artist: ", function(answer){
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

	rl.question('\nSelect an album: ', function(answer){
		var index = parseInt(answer);
		var it = albums[index];
		var promise = getTracksForAlbum(it.album);
		promise.then(function(tracks){
			selectTrack(tracks.album);
		});
	})
}

function playTrack(track, autoplay){
	device.enqueueSpotify(track).then(function(nr){
		device.seekTrackNr(nr).then(function(){
			if(autoplay){
				device.play(function(err, data){
					process.exit(0);
				});
			} else {
				process.exit(0);
			}	
		})
	});
}

function selectTrack(album){
	console.log('');
	console.log('0. Play entire album');
	_.each(album.tracks, function(track, i){
		console.log(parseInt(i) + 1 + '. ' + album.artist + ' - ' + track.name);
	});

	rl.question("\nSelect a track. Append 'p' to start playback at first added track (e.g. '3p'): ", function(answer){
		function play(index, autoplay){
			var track = index > 0 ? album.tracks[index].href : album.href;
			playTrack(track, autoplay);
		}

		var parseInput = answer.match(/(\d*)p/);

		parseInput ? play(parseInt(parseInput[1]), true) : play(parseInt(answer), false);
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
