'use strict';

var Promise = require('bluebird');
var needle = require('needle');
var tap = require('tap');
var findIdx = require('find-index');

var roomie = require('../')();

var address = roomie.listen(0);

tap.on('end', function(){
	roomie.close();
});

var test = tap.test;

test('Create message', function( t ){
	t.plan(1);

	post('/messages', {
		text: 'Something',
	})
		.tap(function( r ){
			t.equal(r.statusCode, 200, 'status code');
		});
});

test('Fetch messages', function( t ){
	t.plan(7);

	get('/messages')
		.tap(function( r ){
			t.equal(r.statusCode, 200, 'status code');
			t.ok(Array.isArray(r.body), 'request body');
		});

	var seed1 = post('/messages', {
		text: 'e',
	});

	var marker = Math.random();
	var firstAttrs = {
		marker: marker,
		first: true,
		text: 'e',
	};

	var first = seed1
		.then(function(){
			return post('/messages', firstAttrs);
		});

	var seed2 = first
		.then(function(){
			return post('/messages', {
				text: 'e',
			});
		});

	var second = seed2
		.then(function(){
			return post('/messages', {
				marker: marker,
				second: true,
				text: 'e',
			});
		});

	var idxs = Promise
		.join(first, second, seed1)
		.then(function(){
			return get('/messages');
		})
		.then(function( r ){
			t.ok(r.body.length >= 2, 'at least two messages is returned');

			var msgs = r.body;

			var idxFirst = findIdx(msgs, function( msg ){
				return msg.first && msg.marker === marker;
			});

			var idxSecond = findIdx(msgs, function( msg ){
				return msg.second && msg.marker === marker;
			});

			t.ok(idxFirst !== -1, 'inserted message is returned');
			t.ok(idxFirst < idxSecond, 'returned in expected order');

			return [ idxFirst, idxSecond ];
		});

	var messages = idxs
		.then(function( idxs ){
			return get('/messages?since=' + idxs[0]);
		});

	Promise
		.join(messages, idxs)
		.spread(function( r, idxs ){
			var msgs = r.body;

			t.deepEqual(msgs[0], firstAttrs, 'first in list is as expected');

			var idxSecond = findIdx(msgs, function( msg ){
				return msg.second && msg.marker === marker;
			});

			t.ok(idxSecond === (idxs[1] - idxs[0]), 'correct order of messages');
		});
});

test('Count messages', function( t ){
	t.plan(3);

	var initial = get('/count')
		.tap(function( r ){
			t.equal(r.statusCode, 200, 'status code');
		})
		.get('body')
		.tap(function( count ){
			t.equal(typeof count, 'number', 'returned body');
		});

	var seed = initial
		.then(function(){
			return post('/messages', {});
		});

	var later = seed
		.then(function(){
			return get('/count');
		})
		.get('body');

	Promise
		.join(initial, later)
		.spread(function( initial, later ){
			t.ok(later > initial, 'count is increased');
		});
});

function post( path, data ){
	return Promise
		.join(address, path, data)
		.spread(function( url, path, data ){
			return new Promise(function( resolve, reject ){
				needle.post(url + path, data, {
					json: true,
				}, function( err, r ){
					if (err)
						return reject(err);

					resolve(r);
				});
			});
		});
}

function get( path ){
	return Promise
		.join(address, path)
		.spread(function( url, path ){
			return new Promise(function( resolve, reject ){
				needle.get(url + path, {
					json: true,
				}, function( err, r ){
					if (err)
						return reject(err);

					resolve(r);
				});
			});
		});
}
