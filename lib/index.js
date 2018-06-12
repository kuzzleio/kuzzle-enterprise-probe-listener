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
  Bluebird = require('bluebird'),
  _ = require('lodash'),
  debug = require('debug')('kuzzle:probe:listener'),
  Kuzzle = require('kuzzle-sdk');

/**
 * @class ProbeListenerPlugin
 */
class ProbeListenerPlugin {
  /**
   * @constructor
   */
  constructor() {
    this.hooks = {};
    this.probes = {};
    this.client = {};
    this.context = {};
  }

  /**
   * Initializes the plugin, connects it to ElasticSearch, and loads probes
   *
   * Probes configuration example:
   * {
   *   kdcAddress: 'kdc-proxy',
   *   probes: {
   *     monitor: {
   *       type: 'monitor',
   *       hooks: ['server:afterInfo']
   *     },
   *     counter: {
   *       type: 'counter',
   *       increasers: ['server:afterInfo'],
   *       decreasers: ['server:afterNow']
   *     },
   *     watcher: {
   *       type: 'watcher',
   *       index: 'example',
   *       collection: 'test'
   *     },
   *     sampler: {
   *       type: 'sampler',
   *       index: 'example',
   *       collection: 'test'
   *     }
   *   }
   * }
   *
   * @param {Object} customConfig - plugin configuration
   * @param {Object} context - kuzzle context
   * @returns {Promise}
   */
  init(customConfig, context) {
    const
      defaultConfig = {
        kdcHost: 'kdc-kuzzle',
        kdcPort: 7512,
        maxKdcConnectionErrors: 10,
        probes: {}
      },
      config = Object.assign(defaultConfig, customConfig);

    this.probes = this._configureProbes(config.probes);
    this.context = context;
    this.config = config;
    this.kdcConnectionErrorCount = 0;

    if (Object.keys(this.probes).length === 0) {
      return Bluebird.resolve();
    }

    this.hooks = this._buildHooksList(this.probes);
    this.hooks['core:kuzzleStart'] = 'connectToKDC';
  }

  connectToKDC () {
    const kdcUrl = `http://${this.config.kdcHost}:${this.config.kdcPort}`;
    this.client = new Kuzzle(this.config.kdcHost, {
      autoQueue: true,
      autoReplay: true,
      port: this.config.kdcPort
    }, (err) => {
      if (err) {
        if (this.kdcConnectionErrorCount < this.config.maxKdcConnectionErrors) {
          this.kdcConnectionErrorCount++;
          this.context.log.info(`Trying to connect to KDC at ${kdcUrl}...`);
        } else {
          this.context.log.error(`
###############################
##   KDC seems to be down.   ##
###############################
${err}
No measures will be sent to probes.`);
          this.client.disconnect();
        }
        return;
      }
      this.context.log.info(`Successfully connected to KDC at ${kdcUrl}`);
    });
  }

  /**
   * @param {object} payload
   * @param {string} event
   */
  monitor(payload, event) {
    debug(`Received measure for monitor ${event}`);
    this._sendPayload('monitor', event);
  }

  /**
   * @param {object} payload
   * @param {string} event
   */
  counter(payload, event) {
    debug(`Received measure for counter ${event}`);
    this._sendPayload('counter', event);
  }

  /**
   * @param {object} payload
   * @param {string} event
   */
  watcher(payload, event) {
    debug(`Received measure for watcher ${event}`);
    this._sendPayload('watcher', event, payload);
  }

  /**
   * @param {object} payload
   * @param {string} event
   */
  sampler(payload, event) {
    debug(`Received measure for sampler ${event}`);
    this._sendPayload('sampler', event, payload);
  }

  /**
   * Takes the probes configuration and returns a ready-to-use object
   *
   * @param {Object} probes - raw probes configuration
   * @returns {Object} converted probes
   */
  _configureProbes(probes) {
    const output = {};

    if (!probes || _.isEmpty(probes)) {
      return output;
    }

    Object.keys(probes).forEach(name => {
      const probe = _.cloneDeep(probes[name]);
      probe.name = name;

      if (!probe.type) {
        return console.error(`plugin-probe: [probe: ${name}] "type" parameter missing"`);
      }

      if (['counter', 'monitor', 'watcher', 'sampler'].indexOf(probe.type) === -1) {
        return console.error(`plugin-probe: [probe: ${name}] type "${probe.type}" is not supported"`);
      }

      if (probe.type === 'monitor' && (!probe.hooks || !Array.isArray(probe.hooks))) {
        return console.error(`plugin-probe: [probe: ${name}] Configuration error: missing "hooks"`);
      }

      /*
       In the case of a counter probe, the same event cannot be in
       the "increasers" and in the "decreasers" lists at the same
       time
       */
      if (probe.type === 'counter') {
        if (!probe.increasers && !probe.decreasers) {
          return console.error(`plugin-probe: [probe: ${name}] Configuration error: missing "increasers" or "decreasers"`);
        }

        if (probe.increasers && !Array.isArray(probe.increasers)) {
          return console.error(`plugin-probe: [probe: ${name}] Configuration error: "increasers" must be an array`);
        }

        if (probe.decreasers && !Array.isArray(probe.decreasers)) {
          return console.error(`plugin-probe: [probe: ${name}] Configuration error: "decreasers" must be an array`);
        }

        if (_.intersection(probe.increasers, probe.decreasers).length > 0) {
          return console.error(`plugin-probe: [probe: ${name}] Configuration error: an event cannot be set both to increase and to decrease a counter`);
        }
      }

      /*
       watcher and sampler configuration check
       */
      if (['watcher', 'sampler'].indexOf(probe.type) > -1 && (!probe.index || !probe.collection)) {
        return console.error(`plugin-probe: [probe: ${name}] Configuration error: missing "index" or "collection"`);
      }

      output[name] = probe;
    });

    return output;
  }

  /**
   * Creates a hooks list from the probes configuration, binding listed probes hooks
   * to their corresponding plugin functions.
   * Rules of binding: probe type === plugin function name
   *
   * @param {Object} probes configuration
   * @returns {Object} resulting hooks object, used by Kuzzle
   */
  _buildHooksList(probes) {
    let
      hooks = {};

    Object.keys(probes).forEach(name => {
      if (['monitor', 'counter'].indexOf(probes[name].type) > -1) {
        []
          .concat(probes[name].hooks, probes[name].increasers, probes[name].decreasers)
          .filter(value => value)
          .forEach(event => {
            hooks = this._addEventToHooks(hooks, event, probes[name].type);
          });
      }

      // Adds a generic event listener on new messages/documents for watcher and sampler probes
      if (['watcher', 'sampler'].indexOf(probes[name].type) > -1) {
        hooks = this._addEventToHooks(hooks, 'realtime:beforePublish', probes[name].type);
        hooks = this._addEventToHooks(hooks, 'document:beforeCreate', probes[name].type);
        hooks = this._addEventToHooks(hooks, 'document:beforeCreateOrReplace', probes[name].type);
      }
    });

    return hooks;
  }

  /**
   * Simple function avoiding repetition of code
   * Returns a new hooks object with an added "event: probe" attribute in it
   *
   * @param {Object} hooks
   * @param {string} event
   * @param {string} probeType
   * @returns {Object} new hooks object
   */
  _addEventToHooks(hooks, event, probeType) {
    const newHooks = _.clone(hooks);

    if (!newHooks[event]) {
      newHooks[event] = probeType;
    }
    else if (typeof newHooks[event] === 'string' && newHooks[event] !== probeType) {
      newHooks[event] = [newHooks[event], probeType];
    }
    else if (Array.isArray(newHooks[event]) && newHooks[event].indexOf(probeType) === -1) {
      newHooks[event].push(probeType);
    }

    return newHooks;
  }

  /**
   * @param {string} probeType
   * @param {string} event
   * @param {KuzzleRequest} payload
   */
  _sendPayload(probeType, event, payload = null) {
    const
      queryArgs = {
        controller: 'kuzzle-plugin-probe/measure',
        action: probeType
      },
      queryPayload = {
        body: {
          event
        }
      };

    if (payload) {
      queryPayload.body.payload = payload.serialize();
    }

    this.client.query(queryArgs, queryPayload);
  }
}

module.exports = ProbeListenerPlugin;
