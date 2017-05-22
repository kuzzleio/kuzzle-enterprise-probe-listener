const
  Bluebird = require('bluebird'),
  ms = require('ms'),
  _ = require('lodash');

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
  }

  /**
   * Initializes the plugin, connects it to ElasticSearch, and loads probes
   *
   * @param {Object} customConfig - plugin configuration
   * @param {Object} context - kuzzle context
   * @returns {Promise}
   */
  init(customConfig, context) {
    const
      defaultConfig = {},
      config = Object.assign(defaultConfig, customConfig);

    this.probes = configureProbes(config.probes);

    if (Object.keys(this.probes).length === 0) {
      return Bluebird.resolve();
    }

    this.hooks = buildHooksList(this.probes);
  }
}

module.exports = ProbeListenerPlugin;

/**
 * Takes the probes configuration and returns a ready-to-use object
 *
 * @param {Object} probes - raw probes configuration
 * @returns {Object} converted probes
 */
function configureProbes(probes) {
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

    if (probe.type === 'sampler' && (probe.interval === 'none' || !probe.interval)) {
      return console.error(`plugin-probe: [probe: ${name}] An "interval" parameter is required for sampler probes`);
    }

    if (probe.interval === 'none') {
      probe.interval = undefined;
    }
    else if (typeof probe.interval === 'string') {
      probe.interval = ms(probe.interval);

      if (isNaN(probe.interval)) {
        return console.error(`plugin-probe: [probe: ${name}] Invalid interval "${probe.interval}".`);
      }
    }

    /*
     In the case of a counter probe, the same event cannot be in
     the "increasers" and in the "decreasers" lists at the same
     time
     */
    if (probe.type === 'counter' && _.intersection(probe.increasers, probe.decreasers).length > 0) {
      return console.error(`plugin-probe: [probe: ${name}] Configuration error: an event cannot be set both to increase and to decrease a counter`);
    }

    /*
     watcher and sampler configuration check
     */
    if (['watcher', 'sampler'].indexOf(probe.type) > -1) {
      if (!probe.index || !probe.collection) {
        return console.error(`plugin-probe: [probe: ${name}] Configuration error: missing index or collection`);
      }

      // checking if the "collects" parameter is correct
      if (probe.collects) {
        if (typeof probe.collects !== 'string' && !Array.isArray(probe.collects)) {
          return console.error(`plugin-probe: [probe: ${name}] Invalid "collects" format: expected array or string, got ${typeof probe.collects}`);
        }

        if (typeof probe.collects === 'string' && probe.collects !== '*') {
          return console.error(`plugin-probe: [probe: ${name}] Invalid "collects" value`);
        }

        if (Array.isArray(probe.collects) && probe.collects.length === 0) {
          probe.collects = null;
        }
      }

      // the "collects" parameter is required for sampler probes
      if (probe.type === 'sampler' && !probe.collects) {
        return console.error(`plugin-probe: [probe: ${name}] A "collects" parameter is required for sampler probes`);
      }

      // forcing an empty filter if not defined
      if (probe.filter === undefined || probe.filter === null) {
        probe.filter = {};
      }
    }

    // sampler probe specific check
    if (probe.type === 'sampler') {
      if (!probe.sampleSize) {
        return console.error(`plugin-probe: [probe: ${name}] "sampleSize" parameter missing`);
      }

      if (typeof probe.sampleSize !== 'number') {
        return console.error(`plugin-probe: [probe: ${name}] invalid "sampleSize" parameter. Expected a number, got a ${typeof probe.sampleSize}`);
      }
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
function buildHooksList(probes) {
  let
    hooks = {};

  Object.keys(probes).forEach(name => {
    if (['monitor', 'counter'].indexOf(probes[name].type) > -1) {
      []
        .concat(probes[name].hooks, probes[name].increasers, probes[name].decreasers)
        .filter(value => value)
        .forEach(event => {
          hooks = addEventToHooks(hooks, event, probes[name].type);
        });
    }

    // Adds a generic event listener on new messages/documents for watcher and sampler probes
    if (['watcher', 'sampler'].indexOf(probes[name].type) > -1) {
      hooks = addEventToHooks(hooks, 'realtime:beforePublish', probes[name].type);
      hooks = addEventToHooks(hooks, 'document:beforeCreate', probes[name].type);
      hooks = addEventToHooks(hooks, 'document:beforeCreateOrReplace', probes[name].type);
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
function addEventToHooks(hooks, event, probeType) {
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
