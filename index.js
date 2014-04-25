#!/usr/local/bin/node

var cli = require('cli'),
	sonos = require('./sonos_additions.js').sonos,
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




cli.main(function(args, options){

	var deferred = Q.defer();
	var sonosIP = process.env.PREFERRED_SONOS;

	if(options.device)
		sonosIP = options.device;

	if(sonosIP){
		deferred.resolve(new sonos(sonosIP));
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


function addTrack(track){
	var deferred = Q.defer();

	device.enqueueSpotify(track).then(function(nr){
		deferred.resolve(nr);
	});

	return deferred.promise;
}

function playTrack(nr){
	device.seekTrackNr(nr).then(function(){
		device.play(function(err, data){
			process.exit(0);
		});
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
			var track = index > 0 ? album.tracks[index - 1].href : album.href;
			addTrack(track).then(function(nr){
				if(autoplay){
					playTrack(nr);
				} else {
					process.exit(0);
				}
			});
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
