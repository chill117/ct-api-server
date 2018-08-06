'use strict';

var _ = require('underscore');
var async = require('async');
var expect = require('chai').expect;
var zmq = require('zeromq');

var manager = require('../../manager');
var app = manager.app();
var BitcoindZeroMQ = app.lib.BitcoindZeroMQ;

describe('BitcoindZeroMQ', function() {

	describe('connecting and receiving data via TCP socket', function() {

		var pubs = {};
		var instances = {};
		before(function() {
			var networks = _.keys(BitcoindZeroMQ.prototype.networks);
			_.each(networks, function(network, index) {
				var addr = 'tcp://127.0.0.1:360' + (5 + index);
				var pub = zmq.socket('pub');
				pub.bind(addr);
				pubs[network] = pub;
				var instance = new BitcoindZeroMQ({
					network: network,
					url: addr,
				});
				instances[network] = instance;
			});
		});

		after(function() {
			_.invoke(pubs, 'close');
		});

		after(function() {
			_.invoke(instances, 'close');
		});

		it('should receive data', function(done) {

			async.each(instances, function(instance, nextInstance) {

				var network = instance.options.network;

				var sampleTxs = _.filter(manager.fixtures.txs, function(tx) {
					return tx.network === network;
				});

				var pub = pubs[network];

				async.each(sampleTxs, function(sampleTx, nextTx) {

					var topic = 'rawtx';
					var message = Buffer.from(sampleTx.rawTx, 'hex');

					var doneTx = _.once(function(error) {
						clearInterval(sendInterval);
						nextTx(error);
					});

					async.each(sampleTx.outputs, function(output, nextOutput) {

						var doneOutput = _.once(function(error) {
							instance.removeListener('tx', onTx);
							nextOutput(error);
						});

						var onTx = function(tx) {
							try {
								expect(tx).to.be.an('object');
								if (tx.address === output.address) {
									expect(tx.amount).to.equal(output.amount);
									expect(tx.txid).to.equal(output.txid);
									doneOutput();
								}
							} catch (error) {
								return doneOutput(error);
							}
						};

						instance.on('tx', onTx);

					}, doneTx);

					var sendInterval = setInterval(function() {
						pub.send([topic, message]);
					}, 5);

				}, nextInstance);
			}, done);
		});
	});

	describe('getOutputsFromRawTx(rawTx[, network])', function() {

		var sampleTxs;
		before(function() {
			sampleTxs = manager.fixtures.txs;
		});

		it('should return an array of outputs given a raw transaction', function() {
			_.each(sampleTxs, function(sampleTx) {
				var outputs = BitcoindZeroMQ.prototype.getOutputsFromRawTx(sampleTx.rawTx, sampleTx.network);
				expect(outputs).to.deep.equal(sampleTx.outputs);
			});
		});
	});

	describe('decodeRawTx(rawTx)', function() {

		var sampleTxs;
		before(function() {
			sampleTxs = manager.fixtures.txs;
		});

		it('should return a decoded transaction given a raw transaction', function() {
			_.each(sampleTxs, function(sampleTx) {
				var tx = BitcoindZeroMQ.prototype.decodeRawTx(sampleTx.rawTx);
				expect(tx).to.not.be.null;
				expect(tx.outs).to.be.an('array');
			});
		});
	});
});
