const Redis = require('ioredis');
require('dotenv').config();

class IndexWriter {
    constructor() {
        const host = process.env.REDIS_HOST || 'localhost';
        const port = process.env.REDIS_PORT || 6379;
        
        if (process.env.USE_MOCK_REDIS === 'true') {
            const RedisMock = require('ioredis-mock');
            this.redis = new RedisMock();
        } else {
            this.redis = new Redis({ host, port });
        }
    }

    /**
     * Atomically maps a student's registration number to their result file's key in object storage.
     */
    async writeIndex(regNo, resultKey) {
        // We use a simple KV string lookup for speed
        const key = `student_result:${regNo}`;
        await this.redis.set(key, resultKey);
    }
    
    /**
     * Optional batch method using pipelining for faster inserts during the 1.5M load
     */
    async writeBatchIndexes(entries) {
        const pipeline = this.redis.pipeline();
        for (const entry of entries) {
            pipeline.set(`student_result:${entry.regNo}`, entry.resultKey);
        }
        await pipeline.exec();
    }
    
    async close() {
        await this.redis.quit();
    }
}

module.exports = IndexWriter;
