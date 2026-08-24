# connection-status Specification

## Purpose

SignalR hub connection-state observability (idle/connecting/connected/reconnecting/disconnected), exposed read-only from `BusHubService`, plus an explicit broker "connecting"/"disconnecting" pending state for `ConnectComponent`'s in-flight REST calls. Renders a combined status affordance that keeps broker state (episodic, last-known) visually distinct from hub state (live).

## Requirements

### Requirement: Hub Connection State Is Exposed Read-Only

`BusHubService` MUST expose a read-only `connectionState` signal with values `idle | connecting | connected | reconnecting | disconnected`, wired from the initial `start()` outcome and the native SignalR `onreconnecting`/`onreconnected`/`onclose` callbacks. Consumers MUST NOT be able to set this state directly.

#### Scenario: Initial start reflects connecting then connected

- GIVEN `BusHubService.start()` is invoked
- WHEN the connection is in flight
- THEN `connectionState` reads `connecting`
- AND WHEN the connection succeeds
- THEN `connectionState` reads `connected`

#### Scenario: onreconnecting sets reconnecting state

- GIVEN the hub connection was `connected`
- WHEN SignalR's automatic reconnect fires `onreconnecting`
- THEN `connectionState` reads `reconnecting`

#### Scenario: onreconnected restores connected state

- GIVEN `connectionState` reads `reconnecting`
- WHEN SignalR fires `onreconnected`
- THEN `connectionState` reads `connected`

#### Scenario: onclose sets disconnected state

- GIVEN the hub connection was `connected` or `reconnecting`
- WHEN SignalR exhausts retries and fires `onclose`
- THEN `connectionState` reads `disconnected`

#### Scenario: State is read-only to consumers

- GIVEN a component injects `BusHubService`
- WHEN it reads `connectionState`
- THEN no public setter or mutation method is available on the service for that signal

### Requirement: Hub Connection Ownership Stays With MessagesComponent

`MessagesComponent` MUST remain the sole caller of `BusHubService.start()`. `ConnectComponent` MUST only read `connectionState` and MUST NOT call `start()`, `stop()`, or otherwise trigger hub lifecycle transitions.

#### Scenario: ConnectComponent never starts the hub

- GIVEN `ConnectComponent` is rendered independent of `MessagesComponent`
- WHEN `ConnectComponent` initializes
- THEN no hub `start()` call originates from `ConnectComponent`

#### Scenario: Hub status renders once MessagesComponent has started it

- GIVEN `MessagesComponent` has called `start()` at least once this session
- WHEN `ConnectComponent` renders
- THEN the hub status reflects `BusHubService.connectionState`, independent of the broker's connected/disconnected state

### Requirement: Broker Connect and Disconnect Show a Pending State

`ConnectComponent` MUST show an explicit "connecting" pending state for the duration of an in-flight broker connect POST, and an explicit "disconnecting" pending state for the duration of an in-flight broker disconnect DELETE. The triggering action button MUST be disabled while its own pending state is active, preventing duplicate submits.

#### Scenario: Connect button disables during connecting

- GIVEN the developer submits the connect form
- WHEN the broker POST is in flight
- THEN the UI shows a "connecting" pending state
- AND the Connect button is disabled until the request settles

#### Scenario: Disconnect button disables during disconnecting

- GIVEN the developer triggers disconnect
- WHEN the broker DELETE is in flight
- THEN the UI shows a "disconnecting" pending state
- AND the Disconnect button is disabled until the request settles

#### Scenario: Pending state clears on settlement

- GIVEN a connect or disconnect request is pending
- WHEN the request resolves (success or error)
- THEN the pending state clears and the corresponding button re-enables

### Requirement: Broker and Hub Status Render as Distinguishable, Combined Affordance

`ConnectComponent` MUST render broker state and hub state as visually distinct elements within one combined status affordance, so a developer can tell a last-known REST result apart from the live hub state. Hub `reconnecting` MUST render inline next to the broker status, not as a persistent banner. The rendering MUST NOT imply continuous broker liveness beyond the last REST response.

#### Scenario: Broker and hub states are labeled distinctly

- GIVEN both broker and hub states are known
- WHEN `ConnectComponent` renders
- THEN broker state and hub state appear as separately labeled, distinguishable elements

#### Scenario: Reconnecting renders inline, not as a banner

- GIVEN hub `connectionState` is `reconnecting`
- WHEN `ConnectComponent` renders
- THEN the reconnecting indicator appears inline next to the broker status
- AND no persistent full-width banner is shown

#### Scenario: Broker state never implies live continuity

- GIVEN the broker was connected via a past successful REST call with no subsequent poll
- WHEN `ConnectComponent` renders broker status
- THEN the copy reflects a last-known snapshot, not an implied continuously-live state
