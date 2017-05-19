/**
 * @constructor
 */
class ProbeListenerPlugin {
  constructor() {
    this.hooks = {};
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
  }
}