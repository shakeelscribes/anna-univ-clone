const path = require('path');
const { ingestData } = require('./ingestion');
const { generateResultJson, uploadToMockS3 } = require('./generator');
const IndexWriter = require('./indexer');

// Mock S3 Path
const MOCK_S3_PATH = path.join(__dirname, 'mock-s3');
const CDN_BASE_URL = 'http://localhost:8080'; // Mock CDN for testing

async function warmCdnCache(key) {
    // In a real environment, we'd hit the CDN URL so it fetches from origin and caches it.
    // For this mock, we just simulate the HTTP GET request.
    const url = `${CDN_BASE_URL}/${key}`;
    // console.log(`[CDN Warmup] Simulating GET ${url}`);
    return true; // Pretend it succeeded
}

async function runBatch(csvFilePath) {
    console.log(`Starting Result Pre-Generation Batch Job...`);
    const startTime = Date.now();
    
    // 1-4. Ingestion, Generation, S3 Upload, & Redis Indexing
    console.log(`\n[1-4/5] Streaming CSV, generating JSON, sharding to Object Storage, and pipelining to Redis...`);
    const indexer = new IndexWriter();
    const batchIndexes = []; // Used for CDN warmup
    let generatedCount = 0;

    for await (const record of ingestData(csvFilePath)) {
        const { current_semester, json } = generateResultJson(record);
        const key = await uploadToMockS3(MOCK_S3_PATH, record.reg_no, current_semester, json);
        
        await indexer.writeIndex(record.reg_no, key);
        batchIndexes.push({ regNo: record.reg_no, resultKey: key });
        generatedCount++;
    }

    // 5. CDN Cache Warm-up
    console.log(`\n[5/5] Warming CDN Cache...`);
    let warmedCount = 0;
    let warmFailedCount = 0;
    for (const entry of batchIndexes) {
        try {
            await warmCdnCache(entry.resultKey);
            warmedCount++;
        } catch (e) {
            warmFailedCount++;
        }
    }

    // Cleanup
    await indexer.close();

    // 6. Summary Report
    const durationMs = Date.now() - startTime;
    console.log(`\n=================================================`);
    console.log(`          BATCH JOB SUMMARY REPORT               `);
    console.log(`=================================================`);
    console.log(`Duration          : ${durationMs} ms`);
    console.log(`Files Generated   : ${generatedCount}`);
    console.log(`KV Entries Written: ${batchIndexes.length}`);
    console.log(`CDN URLs Warmed   : ${warmedCount} (Failed: ${warmFailedCount})`);
    console.log(`=================================================\n`);
}

// If run directly from terminal
if (require.main === module) {
    const inputCsv = process.argv[2];
    if (!inputCsv) {
        console.error("Usage: node index.js <path-to-csv>");
        process.exit(1);
    }
    runBatch(inputCsv).catch(console.error);
}

module.exports = { runBatch };
