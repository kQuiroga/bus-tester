# Delta for connection-status

## ADDED Requirements

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
