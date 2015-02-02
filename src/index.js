'use strict';

var Server = require('promised-http-server');
var Router = require('http-routing');
var Cors = require('http-cors');
var bodyParse = require('http-body-parse');
var queryParse = require('http-query-parse');
var debug = require('debug')('roomie');

module.exports = function(){
	var router = new Router();
	var cors = new Cors();

	var room = [];
	var count = 0;

	router
		.get('/messages?', function(){
			var query = queryParse(this.request)
			var since = parseInt(query.since, 10) || 0;

			return room.slice(since);
		})
		.get('/count', function(){
			return count;
		})
		.post('/messages', function(){
			return bodyParse(this.request)
				.then(function( msg ){
					debug('received #%d: %o', count, msg);
					room.push(msg);
					count++;
				});
		})
		.catchAll(function(){
			throw Server.Error(404);
		});

	return new Server(function(){
		if (cors.apply(this.request, this.response))
			return;


		return router.run(this.request.url, this.request.method, this);
	});
};
