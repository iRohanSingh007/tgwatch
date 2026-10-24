// Metro config: shim the Node core modules GramJS imports so it bundles and
// runs under React Native. `crypto` is routed to the pure-JS crypto-browserify
// (randomBytes flows through the react-native-get-random-values polyfill), so
// no native crypto module is needed. GramJS uses WebSocket (provided by RN)
// for transport.

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve("crypto-browserify"),
  stream: require.resolve("stream-browserify"),
  buffer: require.resolve("buffer"),
  process: require.resolve("process"),
  events: require.resolve("events"),
  vm: require.resolve("vm-browserify"),
  zlib: require.resolve("browserify-zlib"),
  os: require.resolve("os-browserify/browser"),
  path: require.resolve("path-browserify"),
  // TCP transports — unused with useWSS; stub so the bundler is satisfied.
  net: require.resolve("./src/empty.js"),
  tls: require.resolve("./src/empty.js"),
};

module.exports = config;
