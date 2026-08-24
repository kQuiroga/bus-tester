# Delta for UI Presentation

## ADDED Requirements

### Requirement: Send Panel Validates Exchange and Payload as Required

The `SendComponent` MUST treat `exchange` and `payload` as required, non-blank fields, rejecting empty or whitespace-only values.

#### Scenario: Blank exchange or payload is rejected

- GIVEN `exchange` or `payload` is empty or whitespace-only
- WHEN the field is evaluated
- THEN it is marked invalid with an inline error

#### Scenario: Non-blank exchange and payload are accepted

- GIVEN `exchange` and `payload` both contain non-blank values
- WHEN evaluated
- THEN neither shows an inline error

### Requirement: Send Panel Validates Routing Key as Optional-If-Present

The `SendComponent` MUST treat `routingKey` as optional, but MUST reject a non-empty value that is whitespace-only.

#### Scenario: Empty routing key is accepted

- GIVEN `routingKey` is empty
- WHEN evaluated
- THEN it is marked valid, no inline error

#### Scenario: Whitespace-only routing key is rejected

- GIVEN `routingKey` contains only whitespace
- WHEN evaluated
- THEN it is marked invalid with an inline error

### Requirement: Submit Is Gated on Form Validity

The `SendComponent` MUST block submission while any field is invalid and MUST show per-field inline errors identifying what to correct.

#### Scenario: Submit is blocked while invalid

- GIVEN any field is invalid
- WHEN the tester attempts to submit
- THEN the send request is not dispatched and inline errors remain visible

#### Scenario: Submit proceeds when valid

- GIVEN all fields pass validation
- WHEN the tester submits
- THEN the send request is dispatched with no inline errors

### Requirement: Recent Sends Are Recorded, Capped, and Recallable

The system MUST record each successful send into a newest-first "recent sends" list, capped at a fixed maximum with FIFO eviction of the oldest entry beyond the cap, and MUST let a tester recall an entry back into the form.

#### Scenario: Successful send is added newest-first and capped

- GIVEN a send completes successfully
- WHEN the recent sends list is inspected
- THEN the new entry appears first, and if the list exceeded its cap the oldest entry was evicted

#### Scenario: Recalling a recent send populates the form

- GIVEN an entry exists in the recent sends list
- WHEN the tester selects it to recall
- THEN `exchange`, `routingKey`, and `payload` are populated with that entry's values

### Requirement: Named Templates Can Be Saved, Loaded, and Deleted

The system MUST let a tester save the current form as a named template, load a saved template's values into the form, and delete a saved template.

#### Scenario: Saving current form as a template

- GIVEN the tester provides a name and the form holds values
- WHEN the tester saves the template
- THEN a new named template entry is persisted with those values

#### Scenario: Loading a template populates the form

- GIVEN a saved template exists
- WHEN the tester loads it
- THEN `exchange`, `routingKey`, and `payload` are populated with the template's values

#### Scenario: Deleting a template removes it

- GIVEN a saved template exists
- WHEN the tester deletes it
- THEN it no longer appears in the saved templates list

### Requirement: History and Templates Persist via Feature-Scoped localStorage

Recent sends and saved templates MUST persist in `localStorage` under keys scoped to the send panel feature, distinct from any other feature's data.

#### Scenario: Data persists across reloads

- GIVEN recent sends and/or saved templates exist
- WHEN the page is reloaded
- THEN each list is restored from its own feature-scoped `localStorage` key

### Requirement: Corrupted Persisted Data Fails Gracefully to Empty State

WHEN persisted recent-sends or templates data is missing, malformed, or not valid JSON, the system MUST NOT throw and MUST fall back to an empty list for the affected data.

#### Scenario: Malformed JSON falls back to empty, no throw

- GIVEN the `localStorage` entry for recent sends or templates contains malformed JSON
- WHEN the send panel initializes
- THEN no error is thrown and the affected list renders empty
