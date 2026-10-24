// Metro config: shim the Node core modules GramJS imports so it bundles
// under React Native. GramJS uses WebSocket (provided by RN) for transport,
// so `net`/`tls` are stubbed to empty.

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: require.resolve("buffer"),
  stream: require.resolve("stream-browserify"),
  process: require.resolve("process"),
  events: require.resolve("events"),
};

module.exports = config;
