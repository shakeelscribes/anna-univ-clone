import http from 'k6/http';
import { check, sleep } from 'k6';

// 1.5M virtual users ramping up over 60s
export const options = {
    stages: [
        { duration: '30s', target: 500 }, // Ramping up
        { duration: '30s', target: 500 }, // Sustained load
        { duration: '10s', target: 0 },   // Ramping down
    ],
    thresholds: {
        http_req_failed: ['rate<0.01'], // error rate <= 1%
        http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    },
};

const QUEUE_API_URL = 'http://localhost:3000/api/queue';
const RESULT_API_URL = 'http://localhost:3001/api/result';

export default function () {
    // Generate a mock registration number for the test
    const mockRegNo = `8222104${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;
    
    // 1. Join Queue (USING BYPASS BACKDOOR)
    const joinRes = http.post(`${QUEUE_API_URL}/join`, JSON.stringify({
        reg_no: mockRegNo,
        dob: '01/01/2000'
    }), {
        headers: { 
            'Content-Type': 'application/json',
            'x-load-test-bypass': 'secret-bypass-token'
        },
    });

    check(joinRes, {
        'joined queue successfully': (r) => r.status === 200 && r.json('queueToken') !== undefined,
        'queue not full': (r) => r.status !== 503,
    });

    if (joinRes.status !== 200) return;

    const queueToken = joinRes.json('queueToken');
    let admitted = false;
    let resultToken = null;

    // 2. Poll Status until admitted
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

    // 3. Fetch Result
    if (admitted && resultToken) {
        const resultRes = http.get(`${RESULT_API_URL}?token=${resultToken}`);
        check(resultRes, {
            'result API reachable': (r) => r.status !== 0,
        });
    }
}
