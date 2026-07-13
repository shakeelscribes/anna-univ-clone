import http from 'k6/http';
import { check, sleep } from 'k6';
import crypto from 'k6/crypto';

// 1.5M virtual users ramping up over 60s
export const options = {
    stages: [
        { duration: '30s', target: 500 }, // Ramping up
        { duration: '30s', target: 500 }, // Sustained load
        { duration: '10s', target: 0 },   // Ramping down
    ],
    thresholds: {
        http_req_failed: ['rate<0.01'], // error rate <= 1%
        http_req_duration: ['p(95)<2000'], // Allow 2000ms here because solving PoW takes time on the CPU
    },
};

const QUEUE_API_URL = 'http://localhost:3000/api/queue';
const RESULT_API_URL = 'http://localhost:3001/api/result';

export default function () {
    // Generate a mock registration number for the test
    const mockRegNo = `8222104${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;
    
    // 1. Get PoW Challenge
    const challengeRes = http.get(`http://localhost:3000/api/captcha/challenge`);
    
    if (!check(challengeRes, { 'got challenge': (r) => r.status === 200 })) {
        return;
    }

    const { challenge, issuedAt, signature, difficultyBits } = challengeRes.json();

    // 2. Solve PoW Challenge (Bits based)
    let nonce = 0;
    let hashHex = '';
    
    // Helper to count leading zero bits in hex string
    function countLeadingZeroBits(hex) {
        let bits = 0;
        for (let i = 0; i < hex.length; i++) {
            const nibble = parseInt(hex[i], 16);
            if (nibble === 0) {
                bits += 4;
                continue;
            }
            // Count leading zeros in this 4-bit nibble using a manual approach
            if (nibble < 2) bits += 3;
            else if (nibble < 4) bits += 2;
            else if (nibble < 8) bits += 1;
            break;
        }
        return bits;
    }

    while (true) {
        hashHex = crypto.sha256(`${challenge}${nonce}`, 'hex');
        if (countLeadingZeroBits(hashHex) >= difficultyBits) {
            break;
        }
        nonce++;
    }

    // 3. Join Queue with solved PoW
    const joinRes = http.post(`${QUEUE_API_URL}/join`, JSON.stringify({
        reg_no: mockRegNo,
        dob: '01/01/2000',
        challenge: challenge,
        issuedAt: issuedAt,
        signature: signature,
        nonce: nonce,
        difficultyBits: difficultyBits,
        elapsed: 1200, // Simulate 1.2s to solve
        movements: 10, // Simulate some mouse movements
        website: '' // honeypot empty
    }), {
        headers: { 'Content-Type': 'application/json' },
    });

    check(joinRes, {
        'joined queue successfully': (r) => r.status === 200 && r.json('queueToken') !== undefined,
        'queue not full': (r) => r.status !== 503,
    });

    if (joinRes.status !== 200) return;

    const queueToken = joinRes.json('queueToken');
    let admitted = false;
    let resultToken = null;

    // 4. Poll Status until admitted
    for (let i = 0; i < 20; i++) { // Poll max 20 times
        sleep(3); // Poll interval (3s)
        
        const statusRes = http.get(`${QUEUE_API_URL}/status?token=${queueToken}`);
        check(statusRes, {
            'status check successful': (r) => r.status === 200,
        });

        if (statusRes.status === 200) {
            const body = statusRes.json();
            if (body.status === 'admitted') {
                admitted = true;
                resultToken = body.resultToken;
                break;
            }
        }
    }

    // 5. Fetch Result
    if (admitted && resultToken) {
        const resultRes = http.get(`${RESULT_API_URL}?token=${resultToken}`);
        check(resultRes, {
            'result API reachable': (r) => r.status !== 0,
        });
    }
}
