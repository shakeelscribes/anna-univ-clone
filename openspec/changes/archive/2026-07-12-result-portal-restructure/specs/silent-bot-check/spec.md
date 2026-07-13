## ADDED Requirements

### Requirement: Proof-of-Work CAPTCHA on entry
The system SHALL require all students to solve a cryptographic Proof-of-Work (PoW) challenge before they are allowed to join the waiting room queue.

#### Scenario: Student passes PoW challenge
- **WHEN** a student fills the login form and clicks submit
- **THEN** their browser fetches a unique cryptographic challenge
- **AND** solves it in the background using JavaScript
- **AND** submits the proof to `/api/queue/join` to receive a queue token

#### Scenario: PoW challenge failure or invalid proof
- **WHEN** a client submits an invalid or expired proof to the queue endpoint
- **THEN** the system SHALL reject the request with a 400 Bad Request
- **AND** the student is NOT added to the Redis queue

### Requirement: Bot check is transparent to human students
The system SHALL integrate the bot check such that a legitimate human student experiences no manual puzzle solving.

#### Scenario: Human student waits for challenge to solve
- **WHEN** a legitimate human student clicks submit on the login form
- **THEN** the UI displays "Security Check / Queue" with a spinner while the PoW is solved in the background
- **AND** once solved, they automatically join the queue

### Requirement: PoW tokens are single-use
The system SHALL ensure that a solved PoW challenge cannot be replayed to join the queue multiple times.

#### Scenario: Replay attack prevention
- **WHEN** a student submits a valid PoW solution to join the queue
- **THEN** the challenge ID is marked as used in Redis
- **AND** any subsequent attempt to use the same challenge ID SHALL be rejected
