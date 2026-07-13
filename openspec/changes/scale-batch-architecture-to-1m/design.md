## Context

The current batch generation system uses an in-memory `Map` to group CSV rows by student registration number, writes single `result.json` files per student into a flat `mock-s3` directory, and performs sequential network calls to Redis. This limits the system to ~100k students before hitting Node.js heap limits and severe ext4 directory/inode performance degradation. We are now scaling to strictly support 1 million students.

## Goals / Non-Goals

**Goals:**
- Ingest a 1-million student CSV (~7M rows) with near-zero memory footprint.
- Restructure the file system output to prevent Linux directory lookup limits.
- Ingest into Redis significantly faster using bulk operations.

**Non-Goals:**
- We are not changing the structure of the generated JSON itself; the frontend will continue to read the data in the exact same format.

## Decisions

**Decision 1: Stream-based processing**
- **Rationale**: Instead of loading the entire CSV into an array, `ingestion.js` will read the CSV stream, track the `current_reg_no`, and group rows dynamically. When a new `reg_no` arrives, it "emits" the completed student to the generator and clears them from memory. Memory usage remains constant (O(1)) regardless of scale.

**Decision 2: Directory Sharding for Mock-S3**
- **Rationale**: A flat directory with 1M JSON files degrades OS performance. We will implement 3-digit sharding in `generator.js` for the registration number. 
  - Instead of `mock-s3/results/951822100000/07/result.json`
  - It will become `mock-s3/results/951/822/100/000/07/result.json`
- This ensures no single directory contains more than 1,000 files/folders, maintaining ultra-fast file system access times.

**Decision 3: Redis Pipelining**
- **Rationale**: Sequential `SET` commands for 1M students are bottlenecked by network round-trip time. We will buffer students in `indexer.js` into chunks of 10,000 and write them to Redis using a `pipeline().exec()`, cutting Redis insertion time by over 90%.

## Risks / Trade-offs

- **Risk: Frontend Path Resolution**
  - If the directory structure changes, the Queue Service must correctly map the lookup paths to the newly sharded URLs.
  - *Mitigation*: The `resultKey` saved to Redis by `indexer.js` includes the full relative path to the S3 bucket. As long as we save the newly sharded path into Redis, the queue service and frontend will dynamically construct the correct URL without any code changes on their end!
