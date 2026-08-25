# Delta for ui-presentation

## ADDED Requirements

### Requirement: Subscription Chip Row Renders Active Subscriptions With Live Counters

The Messages panel MUST render each active subscription as a distinct chip showing its `queueName` and a live count of messages received for that subscription only, plus an inline unsubscribe control. The chip row MUST wrap onto additional lines (not scroll horizontally) as chips accumulate, reusing the existing `flex flex-wrap items-center gap-2` pattern from the connect-status area, remaining usable with no clipping down to ~375px viewport width. The system MUST NOT impose a hard cap on the number of concurrent chips.

#### Scenario: Each active subscription renders as its own chip with a live counter

- GIVEN a developer holds two active subscriptions
- WHEN the Messages panel renders
- THEN each subscription appears as a distinct chip labeled with its queueName
- AND each chip's counter reflects only messages received for that subscription

#### Scenario: Chip row wraps at narrow widths

- GIVEN enough active subscriptions to exceed one row's width
- WHEN the viewport is ~375px or wider
- THEN the chip row wraps onto additional lines with no clipping or horizontal scroll

#### Scenario: No hard cap on concurrent chips

- GIVEN many active subscriptions exist
- WHEN the chip row renders
- THEN all chips are rendered, absorbed by wrapping, with no enforced maximum
