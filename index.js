#!/usr/local/bin/node

var cli = require('cli'),
	sonos = require('sonos'),
	Q = require('q');


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
  	console.log(err, data);
  });
}

cli.parse({
	play: ['p', 'Play whichever track is currently queued', 'string']
});


cli.main(function(args, options){


	var deferred = Q.defer();

	sonos.search(function(device){
		deferred.resolve(device);
	});


	deferred.promise.then(function(device){
		if(options.play){
			device.enqueueSpotify(options.play);
			device.play(function(err, data){
				console.log(err, data);
			});
		}
	});
});
