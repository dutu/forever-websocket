# forever-websocket
WebSocket client, reconnecting and isomorphic, a simple implementation

## Features
* WebSocket API compatible.
  
  It exposes all properties and methods. API documentation is still valid: [MDN WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) for web browser and [Node.js WebSocket](https://github.com/websockets/ws/blob/master/doc/ws.md) for node.js
* Reconnecting, if connection drops 
* Configurable reconnecting timers 
* Configurable timeouts and reconnects when no message received
* Configurable pings to keep connection alive
* Allows changing URL and parameters between reconnections

