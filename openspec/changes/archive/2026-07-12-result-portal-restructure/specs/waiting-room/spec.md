## ADDED Requirements

### Requirement: Immediate queue token issuance
The system SHALL issue a queue token to every incoming student immediately upon their first request, before any backend processing, so that no student is left waiting without acknowledgement.

#### Scenario: Student receives queue token on first visit
- **WHEN** a student navigates to the portal URL for the first time
- **THEN** the system SHALL immediately return a queue token (signed JWT containing `{queue_position, arrival_ts, exp}`)
- **AND** the student SHALL see their current queue position and estimated wait time within 1 second

#### Scenario: Queue token is persisted across tab close and reopen
- **WHEN** a student closes the browser tab and reopens the portal URL within the token TTL
- **THEN** the system SHALL recognise the existing queue token (from cookie or localStorage)
- **AND** restore the student's original queue position rather than issuing a new token at the back of the queue

### Requirement: Live queue position and ETA polling
The system SHALL expose a status endpoint that returns a student's current queue position and an estimated wait time, updated in real time.

#### Scenario: Polling returns live position
- **WHEN** a client calls `GET /queue/status?token=<queue_token>` every 3–5 seconds
- **THEN** the system SHALL return `{position: <int>, eta_seconds: <int>, admitted: false}` based on the current Redis sorted set rank

#### Scenario: Admission event reflected immediately
- **WHEN** the admission worker moves a student from the queue to admitted state
- **THEN** the next poll of `/queue/status` for that student's token SHALL return `{admitted: true, result_token: "<token>"}`

#### Scenario: ETA estimate is present even if imprecise
- **WHEN** a student has more than 0 students ahead of them in the queue
- **THEN** the response SHALL always include a non-null `eta_seconds` value (may be approximate)
- **AND** the value SHALL be recalculated on each poll based on current admission rate

### Requirement: Controlled admission at a configurable rate
The system SHALL admit students from the queue in controlled batches at a rate that keeps origin load within safe bounds, and the admission rate SHALL be runtime-configurable without a deployment.

#### Scenario: Admission worker processes queue at configured rate
- **WHEN** the admission worker is running
- **THEN** it SHALL admit at most N students per second, where N is read from a runtime configuration key (e.g., Redis key `queue:admission_rate`)

#### Scenario: Admission rate can be changed at runtime
- **WHEN** an operator updates the `queue:admission_rate` Redis key to a new value
- **THEN** the admission worker SHALL pick up the new rate within one polling cycle (≤ 5 seconds) without a restart

#### Scenario: Queue is empty — admission worker is idle
- **WHEN** the Redis sorted set has zero entries
- **THEN** the admission worker SHALL remain running in an idle polling loop and not error

### Requirement: Queue token expiry and re-entry
The system SHALL handle queue token expiry gracefully, preventing students from holding indefinite queue positions.

#### Scenario: Expired queue token triggers re-entry
- **WHEN** a student's queue token TTL expires before they are admitted
- **THEN** `/queue/status` SHALL return HTTP 401
- **AND** the client SHALL prompt the student to re-join the queue (issuing a new token at the current back of the queue)

#### Scenario: Admitted token not consumed within window
- **WHEN** a student receives `admitted: true` but does not call `GET /result` within the result token TTL (10 minutes)
- **THEN** the result token SHALL expire and the student must re-join the waiting room queue
