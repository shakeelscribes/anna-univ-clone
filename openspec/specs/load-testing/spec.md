## Purpose

TBD - Ported from result-portal-restructure delta spec.

### Requirement: 1.5 million-scale pre-result-day load test
The system SHALL include a scripted load test suite that simulates concurrent registration-number lookups at 1.5 million-scale (minimum 1,500,000 simulated concurrent users) and SHALL be run and pass before each result day go-live.

#### Scenario: Load test simulates realistic traffic pattern
- **WHEN** the load test is executed
- **THEN** it SHALL simulate at minimum 1,500,000 virtual users concurrently submitting registration-number lookup requests
- **AND** the traffic pattern SHALL ramp up from 0 to peak over 60 seconds to simulate the real result-day spike

#### Scenario: Load test validates queue and admission pipeline
- **WHEN** the load test runs against the waiting room service
- **THEN** it SHALL verify that queue tokens are issued within 1 second for 99% of simulated users
- **AND** that queue position updates are returned within 2 seconds per poll
- **AND** that no more than 0.1% of requests receive a 5xx error response

#### Scenario: Load test validates result fetch latency
- **WHEN** simulated users are admitted and fetch their results
- **THEN** 95% of result fetch requests SHALL complete within 500 ms (p95)
- **AND** CDN cache hit rate SHALL be ≥ 99% (measured by origin request count vs. total requests)

#### Scenario: Load test produces a summary report
- **WHEN** the load test completes
- **THEN** the test tool SHALL output a report containing: requests per second, error rate, p50/p95/p99 response times, CDN hit rate, queue depth over time, and admission rate
- **AND** the report SHALL be stored as an artifact for comparison across result seasons

### Requirement: Admission rate calibration from load test
The system SHALL use load test results to set the initial production admission rate before go-live.

#### Scenario: Admission rate set from load test baseline
- **WHEN** the load test identifies the maximum safe requests-per-second rate for the current infrastructure configuration
- **THEN** the production `queue:admission_rate` configuration SHALL be set to no more than 80% of that measured safe rate (20% headroom)

### Requirement: Load test is re-runnable and non-destructive
The system SHALL support re-running the load test at any time against a staging or production environment without corrupting production data.

#### Scenario: Load test uses isolated or mock data
- **WHEN** the load test runs against a staging environment
- **THEN** it SHALL use a set of pre-seeded test registration numbers that do not overlap with real student records
- **AND** all queue tokens and result tokens generated during the test SHALL be automatically purged after the test completes

#### Scenario: Load test run against production (pre-go-live only)
- **WHEN** the load test is run against the production environment before go-live (no real student traffic)
- **THEN** the system SHALL be in a "test mode" flag state that prevents test tokens from being confused with real student sessions
