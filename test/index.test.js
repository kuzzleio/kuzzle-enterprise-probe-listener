/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


const
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  Listener = rewire('../lib/index');

describe('# Testing index file', () => {
  let
    listener,
    emptyConfig = {
      probes: {}
    },
    good_counter_probe = {
      type: 'counter',
      increasers: ['some:event'],
      decreasers: ['some:otherEvent']
    },
    bad_counter_probe = {
      type: 'counter'
    },
    bad_increaser_counter_probe = {
      type: 'counter',
      increasers: 'not an array'
    },
    bad_decreaser_counter_probe = {
      type: 'counter',
      decreasers: 'not an array'
    },
    bad_same_event_counter_probe = {
      type: 'counter',
      increasers: ['same:event'],
      decreasers: ['same:event']
    },
    good_monitor_probe = {
      type: 'monitor',
      hooks: ['some:event', 'realtime:beforePublish']
    },
    good_monitor_probe_bis = {
      type: 'monitor',
      hooks: ['some:event', 'realtime:beforePublish']
    },
    bad_monitor_probe = {
      type: 'monitor'
    },
    good_watcher_probe = {
      type: 'watcher',
      index: 'some_index',
      collection: 'some_collection'
    },
    bad_watcher_probe = {
      type: 'watcher',
      index: 'some_index'
    },
    good_sampler_probe = {
      type: 'sampler',
      index: 'some_index',
      collection: 'some_collection'
    },
    bad_sampler_probe = {
      type: 'sampler',
      index: 'some_index'
    },
    unknown_probe = {
      type: 'unknown'
    },
    not_a_probe = {
      something: 'else'
    },
    allGoodProbesConfig = {
      probes: {
        good_counter_probe,
        good_monitor_probe,
        good_monitor_probe_bis,
        good_sampler_probe,
        good_watcher_probe
      }
    },
    allBadProbesConfig = {
      probes: {
        bad_counter_probe,
        bad_increaser_counter_probe,
        bad_decreaser_counter_probe,
        bad_same_event_counter_probe,
        bad_monitor_probe,
        bad_sampler_probe,
        bad_watcher_probe,
        unknown_probe,
        not_a_probe
      }
    },
    fakeContext = {},
    errorSpy,
    Request,
    kuzzleMock;

  beforeEach(() => {
    sinon.reset();

    Request = function(payload) {
      return {
        serialize: () => JSON.stringify(payload)
      };
    };

    errorSpy = sinon.spy((...args) => console.error(args));
    kuzzleMock = {
      query: sinon.spy()
    };

    Listener.__set__({
      console: {
        error: errorSpy
      }
    });

    listener = new Listener();
  });

  it('should stop init if probes are empty', () => {
    return listener.init(emptyConfig, fakeContext)
      .then(() => {
        should(listener.client).match({});
      });
  });

  it('should initialize probes properly if everything is well configured', () => {
    return listener.init(allGoodProbesConfig, fakeContext)
      .then(() => {
        should(Object.keys(listener.probes)).be.length(5);
        should(Object.keys(listener.hooks)).be.length(6);
        listener.hooks.should.have.property('core:kuzzleStart');
        listener.hooks.should.have.property('some:event');
        listener.hooks.should.have.property('some:otherEvent');
        listener.hooks.should.have.property('realtime:beforePublish');
        listener.hooks.should.have.property('document:beforeCreate');
        listener.hooks.should.have.property('document:beforeCreateOrReplace');
      });
  });

  it('should not initialize probes if probes are not configured properly', () => {
    return listener.init(allBadProbesConfig, fakeContext)
      .then(() => {
        should(listener.client).match({});
        should(Object.keys(listener.probes)).be.length(0);
        should(Object.keys(listener.hooks)).be.length(0);
        should(errorSpy.callCount).be.eql(9);
      });
  });

  it('should send a request without payload for monitor', () => {
    return listener.init(allGoodProbesConfig, fakeContext)
      .then(() => {
        listener.client = kuzzleMock;
        listener.monitor({}, 'some:event');

        should(kuzzleMock.query.callCount).be.eql(1);
        should(kuzzleMock.query.args[0][0]).be.eql({
          controller: 'kuzzle-plugin-probe/measure',
          action: 'monitor'
        });
        should(kuzzleMock.query.args[0][1]).match({
          body: {
            event: 'some:event'
          }
        });
      });
  });

  it('should send a request without payload for counter', () => {
    return listener.init(allGoodProbesConfig, fakeContext)
      .then(() => {
        listener.client = kuzzleMock;
        listener.counter({}, 'some:event');

        should(kuzzleMock.query.callCount).be.eql(1);
        should(kuzzleMock.query.args[0][0]).be.eql({
          controller: 'kuzzle-plugin-probe/measure',
          action: 'counter'
        });
        should(kuzzleMock.query.args[0][1]).match({
          body: {
            event: 'some:event'
          }
        });
      });
  });

  it('should send a request without payload for watcher', () => {
    const request = new Request({
      body: {
        some: 'body'
      }
    });

    return listener.init(allGoodProbesConfig, fakeContext)
      .then(() => {
        listener.client = kuzzleMock;
        listener.watcher(request, 'some:event');

        should(kuzzleMock.query.callCount).be.eql(1);

        should(kuzzleMock.query.args[0][0]).be.eql({
          controller: 'kuzzle-plugin-probe/measure',
          action: 'watcher'
        });

        should(kuzzleMock.query.args[0][1]).match({
          body: {
            event: 'some:event',
            payload: request.serialize()
          }
        });
      });
  });

  it('should send a request without payload for sampler', () => {
    const request = new Request({
      body: {
        some: 'body'
      }
    });

    return listener.init(allGoodProbesConfig, fakeContext)
      .then(() => {
        listener.client = kuzzleMock;
        listener.sampler(request, 'some:event');

        should(kuzzleMock.query.callCount).be.eql(1);

        should(kuzzleMock.query.args[0][0]).be.eql({
          controller: 'kuzzle-plugin-probe/measure',
          action: 'sampler'
        });

        should(kuzzleMock.query.args[0][1]).match({
          body: {
            event: 'some:event',
            payload: request.serialize()
          }
        });
      });
  });
});
