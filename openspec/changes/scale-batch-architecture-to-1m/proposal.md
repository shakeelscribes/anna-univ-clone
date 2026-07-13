## Why

The current batch generation architecture was designed for a 100k student proof of concept. Scaling to 1 million students exposes severe bottlenecks: loading 1M students into memory crashes Node.js (heap limit), writing 1M individual files into a single directory freezes the Linux file system (ext4 directory limits and inode exhaustion), and sending 1M individual commands to Redis is too slow. We must restructure the ingestion and storage to handle 1M+ students safely on the Oracle VM.

## What Changes

- Modify `generate-mock-data.js` to generate 1 million students.
- Refactor `ingestion.js` to stream students one by one instead of holding all 1 million in memory.
- Refactor `generator.js` to use **directory sharding** for `mock-s3` (e.g., slicing the reg_no to create nested folders).
- Refactor `indexer.js` to write to Redis using batched pipelines rather than individual SET commands.

## Capabilities

### New Capabilities
- `batch-scaling`: Defines the architectural limits and file system sharding structures needed to support 1 million students.

### Modified Capabilities


## Impact

- **packages/batch/generate-mock-data.js**: Modified to support 1 million.
- **packages/batch/ingestion.js**: Switched to a streaming architecture.
- **packages/batch/generator.js**: Added directory sharding for mock-s3.
- **packages/batch/indexer.js**: Implemented Redis pipelining.
- **mock-s3/**: Data structure on disk will change significantly.
