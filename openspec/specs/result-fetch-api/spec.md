## Purpose

TBD - Ported from result-portal-restructure delta spec.

﻿### Requirement: Token-based idempotent result retrieval
The system SHALL expose a `GET /result` endpoint that accepts a short-lived signed result token and returns the pre-generated result data for the authenticated student. The endpoint SHALL be safe to call multiple times with the same token without any side effects.

#### Scenario: Valid token returns result
- **WHEN** a student calls `GET /result?token=<result_token>` with a valid, unexpired token
- **THEN** the system SHALL validate the HMAC signature and expiry of the token
- **AND** perform a KV lookup using the registration number embedded in the token
- **AND** return the student's result as a JSON response containing comprehensive metadata (name, reg_no, branch, dob, exam name), an array of subjects grouped by semester (each containing semester, subject code, grade, and status code), the overall computed status (based on Anna University hierarchy), and a signed PDF download URL.

#### Scenario: Repeated call with same token returns same result
- **WHEN** a student calls `GET /result?token=<result_token>` multiple times (e.g., via browser refresh or back button)
- **THEN** the system SHALL return the same result data each time without any error or re-computation

#### Scenario: Expired token is rejected
- **WHEN** a student calls `GET /result` with a token whose expiry timestamp has passed
- **THEN** the system SHALL return HTTP 401 with an error body instructing the student to re-authenticate via the waiting room

#### Scenario: Tampered or invalid token is rejected
- **WHEN** a student calls `GET /result` with a token whose HMAC signature does not validate
- **THEN** the system SHALL return HTTP 401 and log the invalid attempt

#### Scenario: Registration number not found in KV store
- **WHEN** a student's valid token contains a registration number that has no entry in the KV store
- **THEN** the system SHALL return HTTP 404 with a message indicating results are not yet available for that registration number

### Requirement: Result token issuance
The system SHALL issue a short-lived signed result token to a student upon successful admission from the waiting room and completion of the bot check.

#### Scenario: Result token issued on admission
- **WHEN** a student is admitted from the waiting room and passes the silent bot check
- **THEN** the system SHALL generate an HMAC-signed JWT containing `{reg_no, iat, exp}` with a 10-minute TTL
- **AND** return the token to the client

#### Scenario: Result token cannot be reused after expiry for a different student
- **WHEN** a result token's embedded registration number does not match the requesting session context
- **THEN** the system SHALL return HTTP 401

### Requirement: PDF result download
The system SHALL provide a mechanism for students to download their result as a PDF file.

#### Scenario: PDF download via signed URL
- **WHEN** the result JSON response is returned to the client
- **THEN** the response SHALL include a time-limited signed URL pointing to the pre-generated PDF in object storage
- **AND** the student can download the PDF by navigating to that URL without any additional authentication

#### Scenario: Signed PDF URL expiry
- **WHEN** the signed PDF URL TTL has expired (e.g., 30 minutes after issuance)
- **THEN** the object storage SHALL return an access-denied error
- **AND** the student must re-fetch the result endpoint to obtain a new signed URL
