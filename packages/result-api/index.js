const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs/promises');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({
    origin: function (origin, callback) { callback(null, true); },
    credentials: true
}));

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-development-only';

// Redis setup
const host = process.env.REDIS_HOST || 'localhost';
const port = process.env.REDIS_PORT || 6379;

let redis;
if (process.env.USE_MOCK_REDIS === 'true') {
    const RedisMock = require('ioredis-mock');
    redis = new RedisMock();
} else {
    const Redis = require('ioredis');
    redis = new Redis({ host, port });
}

/**
 * 3.1 Implement HMAC-signed result token generator
 * In our architecture, the queue-service (Admission worker) will actually call this or use the same secret
 * to generate the token, but for now we expose a dev endpoint to generate it.
 */
app.post('/api/dev/generate-token', express.json(), (req, res) => {
    const { reg_no } = req.body;
    if (!reg_no) return res.status(400).json({ error: "Missing reg_no" });

    // Generate token with 10-minute TTL
    const token = jwt.sign({ reg_no }, JWT_SECRET, { expiresIn: '10m' });
    res.json({ token });
});

/**
 * 3.2 Implement `GET /result?token=<result_token>` endpoint
 */
app.get('/api/result', async (req, res) => {
    const { token } = req.query;
    
    if (!token) {
        return res.status(401).json({ error: "Missing result token" });
    }

    try {
        // Validate signature and expiry
        const decoded = jwt.verify(token, JWT_SECRET);
        const regNo = decoded.reg_no;

        // Perform KV lookup in Redis
        const resultKey = await redis.get(`student_result:${regNo}`);
        
        if (!resultKey) {
            return res.status(404).json({ error: "Result not found for this registration number." });
        }

        // Fetch from object storage (local mock-s3 for development)
        // Note: In production, we would generate a pre-signed URL and redirect, 
        // or the client would fetch directly from CDN. For this mock API, we serve it.
        const mockS3Path = path.join(__dirname, '..', 'batch', 'mock-s3');
        const fullFilePath = path.join(mockS3Path, resultKey);

        const fileContent = await fs.readFile(fullFilePath, 'utf-8');
        res.json(JSON.parse(fileContent));

    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Result token expired." });
        }
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: "Invalid result token." });
        }
        console.error(err);
        return res.status(500).json({ error: "Internal server error fetching result." });
    }
});

const PORT = process.env.PORT || 3001;

// Only start listening if run directly
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Result API listening on port ${PORT}`);
    });
}

module.exports = app;
