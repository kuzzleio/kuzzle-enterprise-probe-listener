# Table of Contents

- [About](#about)
- [Plugin configuration](#plugin-configuration)
  - [Installation](#installation)
  - [General configuration](#general-configuration)
  - [Retrieving probe measures](#retrieving-probe-measures)
- [Probes description](#probes-description)
  - [`monitor` probes](#monitor-probes)
    - [Description](#description)
    - [Configuration](#configuration)
  - [`counter` probes](#counter-probes)
    - [Description](#description-1)
    - [Configuration](#configuration-1)
  - [`watcher` probes](#watcher-probes)
    - [Description](#description-2)
    - [Configuration](#configuration-2)
  - [`sampler` probes](#sampler-probes)
    - [Description](#description-3)
    - [Configuration](#configuration-3)


# About

Plugin allowing to add probes, collecting data and events to calculate data metrics and send them to KDC (Kuzzle Data Collector). This plugin must be used in conjonction with a KDC instance where the plugin **kuzzle-enterprise-probe** is installed. Refer to the [kuzzle-enterprise-probe documentation](https://github.com/kuzzleio/kuzzle-enterprise-probe) for more information.


# Plugin configuration

## Installation

Place the plugin directory under `plugins/available`, then create a symbolic link pointing to it under `plugins/enabled`.


## General configuration

After a fresh installation, the plugin configuration looks like this:

```json
{
 "threads": 1,
 "loadedBy": "server",
 "kdcAddress": "kdc:7512",
 "probes": {}
}
```


# Probes description

## `monitor` probes

### Description

Please refer to the documentation of the [plugin-entreprise-probe](https://github.com/kuzzleio/kuzzle-enterprise-probe#description) for more information about the `monitor` probe.

### Configuration

Probe configuration example:

```json
{
  "probes": {
    "probe_monitor_1": {
      "type": "monitor",
      "hooks": ["some:event", "some:otherevent", "andyet:anotherone"]
    }
  }
}
```


## `counter` probes

### Description

Please refer to the documentation of the [plugin-entreprise-probe](https://github.com/kuzzleio/kuzzle-enterprise-probe#description-1) for more information about the `counter` probe.

### Configuration

Probe configuration example:

```json
{
  "probes": {
    "probe_counter_1": {
      "type": "counter",
      "increasers": ["list:of", "counterIncreasing:events"],
      "decreasers": ["anotherlist:of", "counterDecreasing:events"]
    }
  }
}
```


## `watcher` probes

### Description

Please refer to the documentation of the [plugin-entreprise-probe](https://github.com/kuzzleio/kuzzle-enterprise-probe#description-2) for more information about the `watcher` probe.

### Configuration

Probe configuration example:

```json
{
  "probes": {
    "probe_watcher_1": {
      "type": "watcher",
      "index": "some index",
      "collection": "some collection"
    }
  }
}
```

## `sampler` probes

### Description

Please refer to the documentation of the [plugin-entreprise-probe](https://github.com/kuzzleio/kuzzle-enterprise-probe#description-3) for more information about the `sampler` probe.

### Configuration

Probe configuration example:

```json
{
  "probes": {
    "probe_sampler": {
      "type": "sampler",
      "index": "some index",
      "collection": "some collection"
    }
  }
}
```
