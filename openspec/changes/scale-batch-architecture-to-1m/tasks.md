## 1. Scale Generator Script

- [x] 1.1 Update `generate-mock-data.js` `TOTAL_STUDENTS` to `1000000` (1 million).
- [x] 1.2 Refactor `generate-mock-data.js` to ensure minimal memory overhead while streaming out 7 million rows to the CSV.

## 2. Implement Streaming Ingestion

- [x] 2.1 Refactor `ingestion.js` to use a true event-driven stream.
- [x] 2.2 In `ingestion.js`, track the `currentRegNo` and buffer subjects until the regNo changes.
- [x] 2.3 Once the regNo changes, emit the completed student record to `generator.js` and clear the buffer.

## 3. Implement Directory Sharding for Mock-S3

- [x] 3.1 Refactor `generator.js` `uploadToMockS3` function to shard the `bucketPath`.
- [x] 3.2 Slice the 12-digit `reg_no` into chunks (e.g., `951`, `822`, `100`, `000`).
- [x] 3.3 Ensure the returned `resultKey` reflects the newly sharded path so Redis stores the correct relative URL.

## 4. Implement Redis Bulk Pipelining

- [x] 4.1 Refactor `indexer.js` to accept individual student entries and buffer them internally in an array.
- [x] 4.2 When the buffer hits 10,000 entries (or EOF is reached), trigger `redis.pipeline()` to execute the bulk `SET` operation.
- [x] 4.3 Add logging to output batch pipeline progress (e.g., "Written 250,000 / 1,000,000 to Redis").

## 5. Verification

- [x] 5.1 Run `npm start` in `packages/batch` locally on a smaller subset (e.g., 5,000 students) to verify folder sharding logic.
- [x] 5.2 Validate that the `mock-s3/results` directory correctly creates nested subdirectories.
- [x] 5.3 Validate that `redis-cli keys *` correctly returns paths matching the sharded directory structure.
