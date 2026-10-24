// Metro config: shim the Node core modules GramJS imports so it bundles and
// runs under React Native. `crypto` is routed to the pure-JS crypto-browserify
// (randomBytes flows through the react-native-get-random-values polyfill), so
// no native crypto module is needed. GramJS uses WebSocket (provided by RN)
// for transport.

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Prefer the "browser" field so GramJS uses its browser implementations
// (e.g. PromisedWebSockets backed by RN's global WebSocket) instead of the
// Node variants that need the `websocket` npm package.
config.resolver.resolverMainFields = ["react-native", "browser", "main"];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve("crypto-browserify"),
  stream: require.resolve("stream-browserify"),
  buffer: require.resolve("buffer"),
  process: require.resolve("process"),
  events: require.resolve("events"),
  vm: require.resolve("vm-browserify"),
  // GramJS's `websocket` dep -> RN global WebSocket (w3cwebsocket is undefined
  // in the Node package under React Native).
  websocket: require.resolve("./src/websocket-shim.js"),
  zlib: require.resolve("browserify-zlib"),
  os: require.resolve("os-browserify/browser"),
  path: require.resolve("path-browserify"),
  constants: require.resolve("constants-browserify"),
  // Unused on-device (TCP transport + node-localstorage session store, which
  // we replace with StringSession) — stub so the bundler is satisfied.
  net: require.resolve("./src/empty.js"),
  tls: require.resolve("./src/empty.js"),
  fs: require.resolve("./src/empty.js"),
};

module.exports = config;
