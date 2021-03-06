/*******************************************************************************
 * Copyright 2017 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *******************************************************************************/
'use strict';

const debug = require('debug')('appmetrics-codewind:test');
const express = require('express');
const http = require('http');
const request = require('request');
const tap = require('tap');
const util = require('util');

const config = require('./config');

require('..').attach();

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);

require('appmetrics-dash').monitor({server, app});

io.on('connection', function(socket) {
  socket.on('hello', function() {
    socket.emit('farewell');
  });
});

app.get('*', (req, res) => {
  res.status(404).send('Not Found');
});

server.listen(0, '127.0.0.1');

let base;

tap.test('start', function(t) {
  server.on('listening', function() {
    const port = this.address().port;
    let addr = this.address().address;
    if (addr === '0.0.0.0')
      addr = '127.0.0.1';
    if (addr === '::')
      addr = '[::1]';
    base = util.format('http://%s:%s', addr, port);
    t.pass('listened');
    t.end();
  });
});

tap.test('/metrics available', function(t) {
  const options = {
    url: base + '/metrics',
  };
  debug('request %j', options);
  request(options, function(err, resp, body) {
    t.ifError(err);
    config.expectedMetrics.forEach(metricName => {
      t.similar(body, metricName);
    });
    t.end();
  });
});

tap.test('collections API available', function(t) {
  const options = {
    url: base + '/appmetrics/api/v1/collections',
  };
  debug('request %j', options);
  request(options, function(err, resp, body) {
    t.ifError(err);
    t.equal(body, '{"collectionUris":[]}');
    t.end();
  });
});

tap.test('appmetrics-dash websocket responds', function(t) {
  const io = require('socket.io-client').connect(base, {
    path: '/appmetrics-dash/socket.io'
  });

  io.on('connect', function() {
    io.emit('connected');
    io.emit('enableprofiling');
    io.emit('disableprofiling');
    io.emit('nodereport');
    io.emit('heapdump');
    io.on('gc', disconnect);
  });

  function disconnect() {
    io.disconnect();
  }

  io.on('disconnect', t.end);
});

tap.test('stop', function(t) {
  server.close(t.end);
});
