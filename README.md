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


## Methods

All methods supported by WebSocket are supported, with unchanged behaviours and parameters.
Exception are the methods below:


### Method: `connect()`
Connects the WebSocket. 

When if option `automaticOpen = false` is set in the constructor, `ForeverWebsocket` does not create underlying WebSocket object and connects to the server.
In this case, method `connect()` needs to be used to create the WebSocket and connenct to the server.

>The method has effect when called the second time, or when `automaticOpen` is not `false`.    


### Method: `send(data)`
Calls WebSocket `send()`. In addition, `data` can also be an object, in which case the object is `stringify`'ed before it is sent. 


### Method: `refresh(code, reason)`
Calls Websocket `close()`. When event `close` is emitted, WebSocket is re-newed if reconnection option is present.  


### Method: `close(code, reason)`
Calls Websocket `close()`. Reconnection is not attempted.


### Method: `terminate()`
Calls Websocket `terminate()`. Reconnection is not attempted.
> Some WebSocket implementations do not support `terminate()`, in such case `close()` is called instead.


## Events

All events normally emitted by WebSocket are emitted, with unchanged behaviour and parameters.

**In addition**, the following events are emitted:

### Event: `connecting`
* `retryNumber` - The retry number
* `lastConnectedMts` - Millisecond timestamp on when WebSocket was last connected

It is emitted just before WebSocket tries to reconnect again.


### Event: `delay`
* `retryNumber` - The retry number that will be attempted next
* `delay` - Period of delay in milliseconds until the next connection attempt 

* It is emitted when a connection attempt has failed and there needs to be a delay until the next retry.  


### Event: `reconnected`
* `retryNumber` - The number of retries needed to reconnect
* `lastConnectedMts` - Millisecond timestamp on when WebSocket was last connected

It is emitted when WebSocket is connected again.
 > WebSocket event  `connected` is still received. Event `reconnected` is an additional event which provides extra information.  


### Event: `timeout`
* lastRefreshMts - Millisecond timestamp when WebSocket connection was last refreshed, which is when connection was open or last message was received.

It is emitted when timout occurs. After the event is emitted the WebSocket connection is closed and a reconnect will be attempted if reconnection is configured. 
