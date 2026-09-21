# Changelog

## 1.1.0

### Fixed
* `addListener()` and `removeListener()` now register and detach listeners on the underlying WebSocket. Previously they were inherited from the EventEmitter and bypassed that logic, so `addListener()` never received socket messages and `removeListener()` did not stop delivery.
* Recovery actions (reconnect scheduling, `refresh()`, `connect()`) now run even when a listener of the `error`, `connecting`, `timeout` or `delay` event throws. Previously a throwing listener silently cancelled the self-healing.
* `updateOptions()` can now enable a feature which was not configured in the constructor (`reconnect`, `timeout`, `ping`, `connectTimeout`) and can disable a feature by passing `null` (or a non-positive value for the timeouts).
* `options.ping.pingFrame` is now honored. Previously only the undocumented `ping.frame` option was read.
* `updateOptions({ timeout })` now takes effect. The timeout manager used Node's `timer.refresh()`, which re-armed the timer with the previous duration.
* Throwing `error` listeners no longer leave `this.ws` pointing at a failed socket.
* Replicated WebSocket properties (`url`, `protocol`, `bufferedAmount`, `extensions`, `binaryType`) return sane defaults instead of throwing before a socket exists (e.g. with `automaticOpen: false`, or while a socket is being recreated). A `binaryType` set before connecting is applied to the WebSocket.
* The reconnection retry counter now increases across attempts and the `reconnected` event is emitted again. `connect()` no longer resets the reconnect manager before the connection is open.
* A late `close` event from a socket which has already been superseded no longer schedules an extra reconnect.
* The inactivity timeout is reset by inbound `ping` frames as well as `pong` frames and messages.
* `terminate()` now stops the connection managers, as documented. It was shadowed by the replicated WebSocket method.

### Added
* `options.connectTimeout` and the `connectTimeout` event. A connection which is not established in time is closed and a reconnect is attempted (if reconnection is enabled).
* `connect()` is now a no-op while the connection is `CONNECTING`; use `refresh()` to force a new connection.
* `test/` suite using the built-in `node:test` runner (`yarn test`), and a post-build step which makes the emitted CommonJS entry point resolvable.

### Changed
* Documentation corrected: `randomizeDelay` is a boolean which defaults to `true`, `reconnect` is enabled by default (only `null` disables it), and `createWebSocket` is the documented option name.
* Removed the unused `lodash` dependency.
