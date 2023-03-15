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


## Constructor

### `new ForeverWebSocket(address[, protocol][, options])`
Parameters:

Parameters:

Name | 	Type         | 	Attributes   |	Default |	Description
-----|---------------|---------------|----------|-------------
`address` | string        |               | |  The URL to which to connect
`protocol` | string \      | string[]      | \<optional\> |  | The list of subprotocols
`options` | object        | \<optional\>  | | Options[^1]
`options.automaticOpen` | boolean       | \<optional\>  | `true` | Controls if WebSocket should be created and connected automatically to the server. See also [`connect()`](#method-connect)
`options.reconnect` | object \      | `null`        | \<optional\>  | `{}` | Parameters for reconnecting. If `null`, no reconnection will reoccur 
`options.reconnect.strategy` | `'fibonacci'` \ | `'exponential'` | \<optional\>  | `'fibonacci'` | Backoff strategy
`options.reconnect.initialDelay` | number        | \<optional\>  | `50` | Initial delay in milliseconds
`options.reconnect.factor` | number        | \<optional\>  | `1.5` | Multiplicative factor for `'exponential'` backoff strategy
`options.reconnect.maxDelay` | number        | \<optional\>  | `10000` | Maximum delay in milliseconds
`options.reconnect.randomizeDelay` | number        | \<optional\>  | `0` | Range of randomness and must be between `0` and `1`
`options.timeout` | number        | \<optional\>  | no timeout | Timeout in milliseconds after which the websockets reconnects when no messages are received
`options.ping` | object        | \<optional\>  | no ping | Controls how ping are sent to websocket server
`options.ping.interval` | number        | \<optional\>  |  | Ping interval value in milliseconds
`options.ping.data` | array \       | number \      | object \| string \| ArrayBuffer \| buffer           | \<optional\>  |  | The data to send in the ping frame
`options.ping.mask` | boolean       | \<optional\>  | `true` | Specifies whether `data` should be masked or not
`options.newWebSocket` | function      | \<optional\>  |  | Functions which returns a WebSocket instance. If present it will be called when a new WebSocket is needed when reconnecting. The function could be useful in situations when the new WebSocket connection needs to be created with different parameters when reconnecting (e.g. a timestamp in the headers, or different URL).


[^1]: Standard WebSocket options are supported, in addition options described here are implemented


## Methods

All methods supported by WebSocket are supported, with unchanged behaviours and parameters.
Exception are the methods below:


### Method: `connect()`
Connects the WebSocket. 

When `ForeverWebsocket` is created with `automaticOpen = false` in the constructor, underlying WebSocket objects is not created.
In this case, method `connect()` needs to be used to create the WebSocket and connect it to the server.

>The method has effect when `automaticOpen = true`, or when it is called the second time.    


### Method: `send(data)`
Calls WebSocket `send()`. Parameter `data` can be an object, if so it is `stringify`'ed before it is sent. 


### Method: `refresh(code, reason)`
Calls Websocket `close()`. When event `close` is emitted, WebSocket is re-newed if `reconnect` option is active.  


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
