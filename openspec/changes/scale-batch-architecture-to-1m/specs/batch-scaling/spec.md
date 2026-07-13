## ADDED Requirements

### Requirement: CSV Streaming Ingestion
The system SHALL ingest the student results CSV file using a read stream to process students sequentially, emitting a completed student record only when the registration number changes, to maintain O(1) memory usage regardless of dataset size.

#### Scenario: Memory efficient ingestion
- **WHEN** processing a 1-million row CSV
- **THEN** the system only buffers rows for the current student and flushes the student when encountering a new reg_no or EOF

### Requirement: Directory Sharding for JSON Results
The system SHALL organize generated JSON result files into a sharded directory structure based on slices of the student's registration number (e.g., 3-digit prefixes) to avoid exceeding Linux directory item limits.

#### Scenario: S3 path generation
- **WHEN** saving a result for reg_no "951822100000" in semester "07"
- **THEN** the JSON is saved to a sharded path like `mock-s3/results/951/822/100/000/07/result.json`

### Requirement: Redis Bulk Pipelining
The system SHALL buffer index entries (reg_no to resultKey mapping) and write them to Redis using pipelines to minimize network round-trip overhead.

#### Scenario: Fast KV indexing
- **WHEN** a batch of students finishes generating JSONs
- **THEN** their index entries are pipelined to Redis in chunks of at least 1,000 to maximize throughput
