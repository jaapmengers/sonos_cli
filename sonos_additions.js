var sonos = require('sonos'),
    Q = require('q'),
    _ = require('underscore');

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

module.exports.sonos = sonos.Sonos;