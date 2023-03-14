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

<table class="params">
    <thead>
    <tr>

        <th>Name</th>
        

        <th>Type</th>

        
        <th>Attributes</th>
        

        

        <th class="last">Description</th>
    </tr>
    </thead>

    <tbody>
    

        <tr>
            
                <td class="name"><code>address</code></td>
            

            <td class="type">


<span class="param-type">string</span>



            </td>

            
                <td class="attributes">
                

                

                
                </td>
            

            

            <td class="description last">The URL to which to connect</td>
        </tr>

    

        <tr>
            
                <td class="name"><code>protocol</code></td>
            

            <td class="type">


<span class="param-type">string</span>
|

<span class="param-type">Array.&lt;string></span>



            </td>

            
                <td class="attributes">
                
                    &lt;optional><br>
                

                

                
                </td>
            

            

            <td class="description last">The list of subprotocols</td>
        </tr>

    

        <tr>
            
                <td class="name"><code>options</code></td>
            

            <td class="type">


<span class="param-type">object</span>



            </td>

            
                <td class="attributes">
                
                    &lt;optional><br>
                

                

                
                </td>
            

            

            <td class="description last">Options as described below, plus options as specified on https://github.com/websockets/ws/blob/master/doc/ws.md#class-websocket
                <h6>Properties</h6>


<table class="params">
    <thead>
    <tr>

        <th>Name</th>
        

        <th>Type</th>

        
        <th>Attributes</th>
        

        
        <th>Default</th>
        

        <th class="last">Description</th>
    </tr>
    </thead>

    <tbody>
    

        <tr>
            
                <td class="name"><code>automaticOpen</code></td>
            

            <td class="type">


<span class="param-type">object</span>



            </td>

            
                <td class="attributes">
                
                    &lt;optional><br>
                

                

                
                </td>
            

            
                <td class="default">
                
                    true
                
                </td>
            

            <td class="description last">-</td>
        </tr>

    

        <tr>
            
                <td class="name"><code>reconnect</code></td>
            

            <td class="type">


<span class="param-type">object</span>



            </td>

            
                <td class="attributes">
                
                    &lt;optional><br>
                

                

                
                </td>
            

            
                <td class="default">
                
                </td>
            

            <td class="description last">Optional parameter for reconnecting. If parameter property is missing or `null`, no reconnection will reoccur
                <h6>Properties</h6>


<table class="params">
    <thead>
    <tr>

        <th>Name</th>
        

        <th>Type</th>

        
        <th>Attributes</th>
        

        
        <th>Default</th>
        

        <th class="last">Description</th>
    </tr>
    </thead>

    <tbody>
    

        <tr>
            
                <td class="name"><code>factor</code></td>
            

            <td class="type">


<span class="param-type">number</span>



            </td>

            
                <td class="attributes">
                
                    &lt;optional><br>
                

                

                
                </td>
            

            
                <td class="default">
                
                    1.5
                
                </td>
            

            <td class="description last">Multiplicative factor for exponential backoff strategy.</td>
        </tr>

    

        <tr>
            
                <td class="name"><code>initialDelay</code></td>
            

            <td class="type">


<span class="param-type">number</span>



            </td>

            
                <td class="attributes">
                
                    &lt;optional><br>
                

                

                
                </td>
            

            
                <td class="default">
                
                    50
                
                </td>
            

            <td class="description last">Defaults to 50 ms</td>
        </tr>

    

        <tr>
            
                <td class="name"><code>maxDelay</code></td>
            

            <td class="type">


<span class="param-type">number</span>



            </td>

            
                <td class="attributes">
                
                    &lt;optional><br>
                

                

                
                </td>
            

            
                <td class="default">
                
                    10000
                
                </td>
            

            <td class="description last">Defaults to 10000 ms</td>
        </tr>

    

        <tr>
            
                <td class="name"><code>randomizeDelay</code></td>
            

            <td class="type">


<span class="param-type">boolean</span>



            </td>

            
                <td class="attributes">
                
                    &lt;optional><br>
                

                

                
                </td>
            

            
                <td class="default">
                
                    false
                
                </td>
            

            <td class="description last">Range of randomness and must be between 0 and 1. By default, no randomisation is applied</td>
        </tr>

    
    </tbody>
</table>

            </td>
        </tr>

    

        <tr>
            
                <td class="name"><code>timeout</code></td>
            

            <td class="type">


<span class="param-type">number</span>



            </td>

            
                <td class="attributes">
                
                    &lt;optional><br>
                

                

                
                </td>
            

            
                <td class="default">
                
                </td>
            

            <td class="description last">timeout in milliseconds after which the websockets reconnects when no messages are received. Defaults to no timeout.</td>
        </tr>

    

        <tr>
            
                <td class="name"><code>ping</code></td>
            

            <td class="type">


<span class="param-type">object</span>



            </td>

            
                <td class="attributes">
                
                    &lt;optional><br>
                

                

                
                </td>
            

            
                <td class="default">
                
                </td>
            

            <td class="description last">Controls how ping are sent to websocket server. By default no ping is sent
                <h6>Properties</h6>


<table class="params">
    <thead>
    <tr>

        <th>Name</th>
        

        <th>Type</th>

        
        <th>Attributes</th>
        

        
        <th>Default</th>
        

        <th class="last">Description</th>
    </tr>
    </thead>

    <tbody>
    

        <tr>
            
                <td class="name"><code>interval</code></td>
            

            <td class="type">


<span class="param-type">number</span>



            </td>

            
                <td class="attributes">
                
                    &lt;optional><br>
                

                

                
                </td>
            

            
                <td class="default">
                
                </td>
            

            <td class="description last">Ping interval value in milliseconds</td>
        </tr>

    

        <tr>
            
                <td class="name"><code>data</code></td>
            

            <td class="type">


<span class="param-type">array</span>
|

<span class="param-type">number</span>
|

<span class="param-type">object</span>
|

<span class="param-type">string</span>
|

<span class="param-type">ArrayBuffer</span>
|

<span class="param-type">buffer</span>



            </td>

            
                <td class="attributes">
                
                    &lt;optional><br>
                

                

                
                </td>
            

            
                <td class="default">
                
                </td>
            

            <td class="description last">The data to send in the ping frame</td>
        </tr>

    

        <tr>
            
                <td class="name"><code>mask</code></td>
            

            <td class="type">


<span class="param-type">boolean</span>



            </td>

            
                <td class="attributes">
                
                    &lt;optional><br>
                

                

                
                </td>
            

            
                <td class="default">
                
                    true
                
                </td>
            

            <td class="description last">Specifies whether `data` should be masked or not. Defaults to `true` when websocket is not a server client</td>
        </tr>

    
    </tbody>
</table>

            </td>
        </tr>

    

        <tr>
            
                <td class="name"><code>newWebSocket</code></td>
            

            <td class="type">


<span class="param-type">function</span>



            </td>

            
                <td class="attributes">
                
                    &lt;optional><br>
                

                

                
                </td>
            

            
                <td class="default">
                
                </td>
            

            <td class="description last">Functions which returns a WebSocket instance. If present it will be called when a new WebSocket is needed when reconnecting. The function could be useful in situations when the new WebSocket connection needs to be created with different parameters when reconnecting (e.g. a timestamp in the headers, or different URL).</td>
        </tr>

    
    </tbody>
</table>

            </td>
        </tr>

    
    </tbody>
</table>


## Methods

All methods supported by WebSocket are supported, with unchanged behaviours and parameters.
Exception are the methods below:


### Method: `connect()`
Connects the WebSocket. 

When `ForeverWebsocket` is created with `automaticOpen = false` in the constructor, underlying WebSocket objects not initially created.
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
