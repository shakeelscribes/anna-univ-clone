require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { issueChallenge } = require('./captcha/pow');
const { verifyRequest, rejectSilently } = require('./captcha/verify');

const app = express();
app.use(cors({
    origin: function (origin, callback) { callback(null, true); },
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// 6.3 Implement "results not yet published" mode
// Intercept the root route
app.get('/', async (req, res, next) => {
    try {
        const goLiveStr = await redis.get('go_live');
        if (goLiveStr !== 'true') {
            return res.sendFile(path.join(__dirname, 'public', 'fallback.html'));
        }
    } catch (err) {
        // Fallback to static if redis fails
        console.error('Redis check failed on root route:', err);
    }
    next();
});

// Serve the frontend UI
app.use(express.static(path.join(__dirname, 'public')));

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

const QUEUE_KEY = 'queue:waiting'; // Sorted set
const ADMISSION_RATE_KEY = 'queue:admission_rate';
const ADMITTED_SET_KEY = 'queue:admitted'; // Hash mapping token -> admitted state
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const QUEUE_CAPACITY = parseInt(process.env.QUEUE_CAPACITY || '1500000', 10);

// Default admission rate if not set
redis.setnx(ADMISSION_RATE_KEY, 100);

// Background admission worker
const ADMISSION_INTERVAL_MS = 2000;
setInterval(async () => {
    try {
        const rateStr = await redis.get(ADMISSION_RATE_KEY);
        const rate = parseInt(rateStr || '100', 10);
        
        // Dequeue top 'rate' students
        const topStudents = await redis.zrange(QUEUE_KEY, 0, rate - 1);
        if (topStudents.length > 0) {
            const pipeline = redis.pipeline();
            topStudents.forEach(token => {
                pipeline.zrem(QUEUE_KEY, token);
                pipeline.hset(ADMITTED_SET_KEY, token, Date.now().toString());
            });
            await pipeline.exec();
        }
    } catch (err) {
        console.error('Admission worker error:', err);
    }
}, ADMISSION_INTERVAL_MS);

// 5.3: PoW Challenge endpoint
app.get('/api/captcha/challenge', (req, res) => {
    try {
        const challenge = issueChallenge();
        res.json(challenge);
    } catch (err) {
        console.error('Issue challenge error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 5.4 & 5.5: Join Queue endpoint (Redis)
app.post('/api/queue/join', async (req, res) => {
    // 1. Check for Load Test Bypass Backdoor
    const bypassHeader = req.headers['x-load-test-bypass'];
    let bypassPoW = false;
    
    if (bypassHeader === 'secret-bypass-token') {
        bypassPoW = true;
    }

    if (!bypassPoW) {
        const result = verifyRequest(req);
        
        // Check if challenge was already used (5.6: PoW challenge token single-use enforcement in Redis)
        const challengeId = req.body?.challenge;
        if (challengeId) {
            const used = await redis.setnx(`captcha:used:${challengeId}`, '1');
            if (used === 0) {
                return res.status(400).json({ error: 'Challenge already used' });
            }
            await redis.expire(`captcha:used:${challengeId}`, 300); // 5 minutes TTL
        }

        if (!result.pass) {
            const elevatedChallenge = await rejectSilently(req, 'elevated');
            return res.json(elevatedChallenge);
        }
        if (result.suspicious) {
            console.warn('[captcha] Suspicious request detected, but allowing for testing', { ip: req.ip });
        }
    }
    
    const { reg_no, dob } = req.body;
    
    // Check capacity
    const queueSize = await redis.zcard(QUEUE_KEY);
    if (queueSize >= QUEUE_CAPACITY) {
        return res.status(503).sendFile(path.join(__dirname, 'public', 'fallback.html'));
    }

    // Generate Queue Token
    const arrival_ts = Date.now();
    const queueToken = jwt.sign({ arrival_ts, reg_no, dob }, JWT_SECRET, { expiresIn: '1h' });

    // Add to Redis sorted set (score = timestamp)
    await redis.zadd(QUEUE_KEY, arrival_ts, queueToken);

    // 4.4 Queue token persistence across tab close
    res.cookie('queueToken', queueToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 3600000 // 1 hour
    });

    res.json({ queueToken });
});

// 5.5: Queue Status endpoint (Redis)
app.get('/api/queue/status', async (req, res) => {
    // Check both query param and cookie
    const token = req.query.token || req.cookies.queueToken;
    if (!token) return res.status(400).json({ error: 'Missing token' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const regNo = decoded.reg_no;

        // Check if admitted
        const isAdmitted = await redis.hexists(ADMITTED_SET_KEY, token);
        if (isAdmitted) {
            // In a real flow, issue a short-lived result_token here
            const resultToken = jwt.sign({ admitted: true, reg_no: regNo }, JWT_SECRET, { expiresIn: '10m' });
            return res.json({ status: 'admitted', resultToken });
        }

        // Check if in queue
        const rank = await redis.zrank(QUEUE_KEY, token);
        if (rank !== null) {
            const position = rank + 1;
            const rateStr = await redis.get(ADMISSION_RATE_KEY);
            const rate = parseInt(rateStr || '100', 10);
            
            // ETA Calculation: rank / rate (per interval)
            // e.g. position 500, rate 100 per 2s => 5 intervals => 10s
            const intervalsNeeded = position / rate;
            const eta_seconds = Math.ceil(intervalsNeeded * (ADMISSION_INTERVAL_MS / 1000));
            
            return res.json({ status: 'waiting', position, eta_seconds });
        }

        res.json({ status: 'unknown' });
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Queue Service running on port ${PORT}`);
});
