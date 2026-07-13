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
        
        this.buffer = [];
        this.totalWritten = 0;
    }

    /**
     * Atomically maps a student's registration number to their result file's key in object storage.
     */
    async writeIndex(regNo, resultKey) {
        this.buffer.push({ regNo, resultKey });
        // Flush buffer in batches of 10,000 for massive throughput
        if (this.buffer.length >= 10000) {
            await this.flush();
        }
    }
    
    async flush() {
        if (this.buffer.length === 0) return;
        
        const pipeline = this.redis.pipeline();
        for (const entry of this.buffer) {
            pipeline.set(`student_result:${entry.regNo}`, entry.resultKey);
        }
        await pipeline.exec();
        
        this.totalWritten += this.buffer.length;
        console.log(`[Redis] Pipelined ${this.totalWritten} entries to Redis...`);
        this.buffer = []; // clear buffer
    }
    
    async close() {
        await this.flush(); // ensure remaining buffer is flushed
        await this.redis.quit();
    }
}

module.exports = IndexWriter;
