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

### Requirement: Connection UI Is a Load-Time Popup That Collapses to a Status Pill

On app load with no active broker connection, `ConnectComponent` MUST present its connect form inside a popup (modal/overlay) rather than as a permanent column. Once a broker connection is established, the popup MUST dismiss and the connection UI MUST collapse to a compact, always-visible status pill. The pill MUST remain clickable at all times. Activating the pill while connected MUST open controls to disconnect or to switch broker (re-open the connect popup for a different broker/vhost) and MUST NOT prompt for credentials again. Activating the pill while disconnected MUST re-open the connect popup. The pill MUST keep broker state and hub state visually distinguishable, consistent with the combined-affordance requirement.

#### Scenario: Popup shows on load when not connected

- GIVEN the app loads with no active broker connection
- WHEN the shell renders
- THEN the connect form is shown in a popup and does not occupy a permanent column

#### Scenario: Popup collapses to the status pill after connecting

- GIVEN the tester completes the connect form and the broker connection succeeds
- WHEN the request settles
- THEN the popup dismisses and a compact status pill is shown in its place

#### Scenario: Clicking the pill while connected offers disconnect and switch, not re-login

- GIVEN the broker is connected and the status pill is shown
- WHEN the tester activates the pill
- THEN controls to disconnect or switch broker appear
- AND no credential fields are presented

#### Scenario: Clicking the pill while disconnected re-opens the popup

- GIVEN there is no active broker connection
- WHEN the tester activates the status pill
- THEN the connect popup re-opens with the connect form

#### Scenario: Hub reconnecting renders inline within the pill

- GIVEN the broker is connected and the SignalR hub enters `reconnecting`
- WHEN the status pill renders
- THEN the reconnecting state is shown inline within the pill (e.g. `[data-testid="hub-state-inline"]`)
- AND it is NOT rendered as a full-width banner

### Requirement: Reserved Broker-Selector Slot

The header/connection area MUST reserve visible layout space for a future broker selector. In this change the slot MUST be inert: it MUST NOT switch brokers, MUST NOT expose Kafka options as functional, and MUST carry no wiring behind it.

#### Scenario: The slot is present but inert

- GIVEN the console shell renders
- WHEN the tester inspects the header/connection area
- THEN a reserved broker-selector slot is visible
- AND interacting with it performs no broker change and triggers no request
