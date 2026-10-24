// GramJS's PromisedWebSockets does `new require("websocket").w3cwebsocket(...)`.
// The Node `websocket` package's w3cwebsocket resolves to undefined under
// React Native. RN provides a W3C-compliant global WebSocket, so expose that.
module.exports = { w3cwebsocket: global.WebSocket };
