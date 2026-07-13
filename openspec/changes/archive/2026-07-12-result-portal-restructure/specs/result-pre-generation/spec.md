## ADDED Requirements

### Requirement: Batch result file generation
The system SHALL accept a data feed of finalised exam results (one record per student containing registration number, subject-wise marks, grade, and result status) and generate a static result artifact per student before any student traffic arrives.

#### Scenario: Successful generation for a single student
- **WHEN** the batch job receives a valid result record for a registration number
- **THEN** the system generates a JSON result file for that student
- **AND** stores the file in a local mock object storage directory (`mock-s3/`) under a deterministic key derived from the registration number
- **AND** writes a `reg_no -> result_key` mapping to the KV store

#### Scenario: Idempotent re-run
- **WHEN** the batch job is run a second time with the same input data
- **THEN** the system overwrites existing files without error
- **AND** the final state is identical to a single run

#### Scenario: Invalid or incomplete record
- **WHEN** a result record is missing required fields (registration number, subject marks, or result status)
- **THEN** the system SHALL log the record as an error and skip it
- **AND** the batch job SHALL continue processing remaining records
- **AND** the job summary SHALL report the count of skipped records

### Requirement: KV lookup index population
The system SHALL populate a fast KV store with a mapping from each student's registration number to their result storage key as part of the batch job.

#### Scenario: Lookup index written during batch
- **WHEN** a student's result files are successfully written to the local mock storage
- **THEN** the system SHALL atomically write the `reg_no -> result_key` entry to the KV store with no TTL (persistent until explicitly deleted)

#### Scenario: Lookup index is queryable after batch completes
- **WHEN** the batch job finishes
- **THEN** every registration number in the input feed SHALL have a corresponding entry in the KV store resolvable in O(1)

### Requirement: CDN cache warm-up
The system SHALL proactively warm the CDN for pre-generated result files immediately after the batch job completes, so that student-facing result fetches are served from CDN edge without origin hits.

#### Scenario: Cache warm-up on batch completion
- **WHEN** the batch job has finished writing all result files to local storage
- **THEN** the system SHALL issue a GET request for each result file URL via the CDN endpoint
- **AND** log the count of successfully warmed files vs. failures

#### Scenario: Warm-up failure is non-blocking
- **WHEN** a CDN warm-up request for an individual file fails
- **THEN** the system SHALL log the failure and continue warming remaining files
- **AND** the result is still accessible (CDN will cache on first real student hit)

### Requirement: Batch job observability
The system SHALL emit a structured summary upon completion of the batch job.

#### Scenario: Batch job summary output
- **WHEN** the batch job completes (successfully or with partial errors)
- **THEN** the system SHALL output a summary containing: total records processed, files generated, KV entries written, CDN URLs warmed, skipped/error records with reasons
