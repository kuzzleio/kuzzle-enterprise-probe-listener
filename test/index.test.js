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
  Listener = require('../lib/index');

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
    good_monitor_probe = {
      type: 'monitor',
      hooks: ['some:event', 'realtime:beforePublish']
    },
    good_monitor_probe_bis = {
      type: 'monitor',
      hooks: ['some:event', 'realtime:beforePublish']
    },
    good_watcher_probe = {
      type: 'watcher',
      index: 'some_index',
      collection: 'some_collection'
    },
    good_sampler_probe = {
      type: 'sampler',
      index: 'some_index',
      collection: 'some_collection'
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
    fakeContext = {},
    Request,
    kuzzleMock;

  beforeEach(() => {
    sinon.reset();

    Request = function(payload) {
      return {
        serialize: () => JSON.stringify(payload)
      };
    };

    kuzzleMock = {
      query: sinon.spy()
    };

    listener = new Listener();
  });

  it('should stop init if probes are empty', () => {
    return Promise.resolve(listener.init(emptyConfig, fakeContext))
      .then(() => {
        should(listener.client).match({});
      });
  });

  it('should initialize probes properly if everything is well configured', () => {
    return Promise.resolve(listener.init(allGoodProbesConfig, fakeContext))
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

  describe('unknown probe errors', () => {
    it('should throw an error if "type" parameter is missing', () => {
      const pluginConfig = {
        probes: {
          badProbe: {
            something: 'else'
          }
        }
      };

      return should(() => listener.init(pluginConfig, fakeContext))
        .throw('plugin-probe: [probe: badProbe] Configuration error: missing "type" parameter');
    });

    it('should throw an error if the type is not supported', () => {
      const pluginConfig = {
        probes: {
          badProbe: {
            type: 'unknown'
          }
        }
      };

      return should(() => listener.init(pluginConfig, fakeContext))
        .throw('plugin-probe: [probe: badProbe] Configuration error: type "unknown" is not supported');
    });
  });

  describe('counter probe errors', () => {
    it('should throw an error if "increasers" and "decreseaser" parameters are missing', () => {
      const pluginConfig = {
        probes: {
          badProbe: {
            type: 'counter'
          }
        }
      };

      return should(() => listener.init(pluginConfig, fakeContext))
        .throw('plugin-probe: [probe: badProbe] Configuration error: missing "increasers" or "decreasers"');
    });

    it('should throw an error if "increasers" parameter is not an array', () => {
      const pluginConfig = {
        probes: {
          badProbe: {
            type: 'counter',
            increasers: 'not an array'
          }
        }
      };

      return should(() => listener.init(pluginConfig, fakeContext))
        .throw('plugin-probe: [probe: badProbe] Configuration error: "increasers" must be an array');
    });

    it('should throw an error if "decreasers" parameter is not an array', () => {
      const pluginConfig = {
        probes: {
          badProbe: {
            type: 'counter',
            decreasers: 'not an array'
          }
        }
      };

      return should(() => listener.init(pluginConfig, fakeContext))
        .throw('plugin-probe: [probe: badProbe] Configuration error: "decreasers" must be an array');
    });

    it('should throw an error if the same event is set for increaser and decreaser', () => {
      const pluginConfig = {
        probes: {
          badProbe: {
            type: 'counter',
            increasers: ['same:event'],
            decreasers: ['same:event']
          }
        }
      };

      return should(() => listener.init(pluginConfig, fakeContext))
        .throw('plugin-probe: [probe: badProbe] Configuration error: an event cannot be set both to increase and to decrease a counter');
    });
  });

  describe('monitor probe errors', () => {
    it('should throw an error if "hooks" parameter is missing', () => {
      const pluginConfig = {
        probes: {
          badProbe: {
            type: 'monitor'
          }
        }
      };

      return should(() => listener.init(pluginConfig, fakeContext))
        .throw('plugin-probe: [probe: badProbe] Configuration error: missing "hooks"');
    });
  });

  describe('watcher probe errors', () => {
    it('should throw an error if "index" parameter is missing', () => {
      const pluginConfig = {
        probes: {
          badProbe: {
            type: 'watcher',
            collection: 'bar'
          }
        }
      };

      return should(() => listener.init(pluginConfig, fakeContext))
        .throw('plugin-probe: [probe: badProbe] Configuration error: missing "index" or "collection"');
    });

    it('should throw an error if "collection" parameter is missing', () => {
      const pluginConfig = {
        probes: {
          badProbe: {
            type: 'watcher',
            index: 'foo'
          }
        }
      };

      return should(() => listener.init(pluginConfig, fakeContext))
        .throw('plugin-probe: [probe: badProbe] Configuration error: missing "index" or "collection"');
    });
  });

  describe('sampler probe errors', () => {
    it('should throw an error if "index" parameter is missing', () => {
      const pluginConfig = {
        probes: {
          badProbe: {
            type: 'sampler',
            collection: 'bar'
          }
        }
      };

      return should(() => listener.init(pluginConfig, fakeContext))
        .throw('plugin-probe: [probe: badProbe] Configuration error: missing "index" or "collection"');
    });

    it('should throw an error if "collection" parameter is missing', () => {
      const pluginConfig = {
        probes: {
          badProbe: {
            type: 'sampler',
            index: 'foo'
          }
        }
      };

      return should(() => listener.init(pluginConfig, fakeContext))
        .throw('plugin-probe: [probe: badProbe] Configuration error: missing "index" or "collection"');
    });
  });

  it('should send a request without payload for monitor', () => {
    return Promise.resolve(listener.init(allGoodProbesConfig, fakeContext))
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
    return Promise.resolve(listener.init(allGoodProbesConfig, fakeContext))
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

    return Promise.resolve(listener.init(allGoodProbesConfig, fakeContext))
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

    return Promise.resolve(listener.init(allGoodProbesConfig, fakeContext))
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
