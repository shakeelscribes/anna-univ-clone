## ADDED Requirements

### Requirement: Always-available status page
The system SHALL ensure that students always receive a meaningful, human-readable status page under all failure and overload conditions. A blank page, connection error, or unbranded server error page SHALL never be the student-facing response.

#### Scenario: Origin is overloaded but CDN is available
- **WHEN** origin servers are at capacity and cannot accept new connections
- **THEN** the CDN edge SHALL serve a pre-cached static status page informing the student that the portal is under heavy load and to try again shortly

#### Scenario: Waiting room queue is at maximum capacity
- **WHEN** the Redis queue has reached the configured maximum size
- **THEN** new student requests SHALL receive a styled status page stating the queue is full with an estimated retry time
- **AND** the student SHALL NOT receive a generic HTTP 503 or a blank page

#### Scenario: Batch pre-generation has not yet completed
- **WHEN** a student arrives before results have been pre-generated and the portal is not yet in serving mode
- **THEN** the system SHALL display a status page indicating results are not yet published, with the expected go-live time if known

#### Scenario: Partial system failure (Redis unavailable)
- **WHEN** the Redis queue/KV store becomes unreachable
- **THEN** the system SHALL serve the static status/degradation page from CDN
- **AND** log an alert for operators
- **AND** SHALL NOT expose raw error messages or stack traces to students


