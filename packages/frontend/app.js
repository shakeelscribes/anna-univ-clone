document.addEventListener('DOMContentLoaded', () => {
    // State variables
    let currentQueueToken = null;
    let pollInterval = null;
    let savedRegNo = '';
    let savedDob = '';

    const API_BASE_URL = 'https://anna-univ-clone.duckdns.org';

    // DOM Elements
    const sections = {
        init: document.getElementById('init-section'),
        queue: document.getElementById('queue-section'),
        login: document.getElementById('login-section'),
        results: document.getElementById('results-section')
    };

    const queuePositionEl = document.getElementById('queue-position');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const loginBtn = document.getElementById('login-btn');

    // Utility: Switch visible section
    function showSection(sectionName) {
        Object.values(sections).forEach(sec => sec.classList.remove('active'));
        if (sections[sectionName]) {
            sections[sectionName].classList.add('active');
        }
    }

    // Step 1: Start with Login Section active
    showSection('login');

    // Step 2: Handle Form Submit (Form First UX)
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.style.display = 'none';
        loginBtn.disabled = true;
        loginBtn.textContent = 'Verifying...';

        savedRegNo = document.getElementById('regno').value.trim();
        savedDob = document.getElementById('dob').value;

        // Transition to queue UI (Security Check)
        showSection('queue');
        queuePositionEl.textContent = "Calculating... ⏳";

        await initializeSession();
    });

    // Step 3: Initialize CAPTCHA and join queue
    async function initializeSession() {
        try {
            console.log("Initializing secure session...");
            // Run the background CAPTCHA solver
            const captchaPayload = await window.__captcha.getPayload();
            
            // Artificial delay to prevent "too_fast" rejection on page load
            if (captchaPayload.elapsed < 1000) {
                await new Promise(r => setTimeout(r, 1000 - captchaPayload.elapsed));
                captchaPayload.elapsed = 1000;
            }

            console.log("CAPTCHA solved silently.");

            // Join the queue, submitting credentials + CAPTCHA proof
            const res = await fetch(API_BASE_URL + '/api/queue/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    reg_no: savedRegNo,
                    dob: savedDob,
                    ...captchaPayload
                })
            });

            if (!res.ok) throw new Error("Failed to join queue");
            
            const data = await res.json();
            
            if (data.queueToken) {
                currentQueueToken = data.queueToken;
                startPolling();
            } else if (data.challenge && data.signature) {
                // Elevated challenge received
                console.log("Received elevated challenge. Solving...");
                window.__captcha._reinit(data);
                // Retry joining
                return initializeSession();
            } else {
                throw new Error("Invalid response structure");
            }

        } catch (error) {
            console.error("Initialization failed:", error);
            alert("Security check failed. Please refresh the page.");
            showSection('login');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Check Results';
        }
    }

    // Step 4: Poll queue status
    function startPolling() {
        pollInterval = setInterval(async () => {
            try {
                const res = await fetch(API_BASE_URL + `/api/queue/status?token=${currentQueueToken}`, {
                    credentials: 'include'
                });
                if (!res.ok) throw new Error("Status check failed");
                
                const data = await res.json();
                
                if (data.status === 'admitted') {
                    clearInterval(pollInterval);
                    // Fetch the real result using data.resultToken
                    fetchResult(data.resultToken);
                } else if (data.status === 'waiting') {
                    queuePositionEl.textContent = data.position;
                } else {
                    // Unknown or expired
                    clearInterval(pollInterval);
                    alert("Queue session expired. Please refresh the page.");
                    showSection('login');
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Check Results';
                }
            } catch (err) {
                console.error("Polling error:", err);
            }
        }, 3000); // Poll every 3 seconds (as per spec)
    }

    // Step 5: Fetch Result from real API
    async function fetchResult(resultToken) {
        queuePositionEl.textContent = "Admitted! Fetching results...";
        try {
            // Note: In production, the result API would be a different host/port, but here we'll assume it's routed.
            // For local dev, we will fetch from localhost:3001
            const res = await fetch(API_BASE_URL + `/api/result?token=${resultToken}`, {
                credentials: 'include'
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to fetch result");
            }
            const data = await res.json();
            renderResults(data);
        } catch (err) {
            console.error("Result fetch failed:", err);
            alert("Error fetching result: " + err.message);
            showSection('login');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Check Results';
        }
    }

    // Step 6: Render Results
    function renderResults(data) {
        document.getElementById('res-name').textContent = data.metadata.name;
        document.getElementById('res-regno').textContent = data.metadata.regno;
        if (document.getElementById('res-branch')) {
            document.getElementById('res-branch').textContent = data.metadata.branch || 'N/A';
        }
        
        const statusEl = document.getElementById('res-status');
        const overallStatus = data.overall || data.performance?.result || 'UNKNOWN';
        statusEl.textContent = overallStatus;
        if (overallStatus !== 'PASS') {
            statusEl.style.color = '#d32f2f'; // Red for RA/WH
        } else {
            statusEl.style.color = 'var(--primary-blue)';
        }

        const tbody = document.getElementById('marks-tbody');
        tbody.innerHTML = ''; // Clear previous

        if (data.results) {
            const currentSemester = data.results.current_semester || '1';
            
            // Helper to render rows
            const renderRows = (subjects, semesterVal, label) => {
                if (!subjects || !subjects.length) return;
                
                // Add a sub-header row for clarity
                const headerTr = document.createElement('tr');
                headerTr.innerHTML = `<td colspan="4" style="background: #f0f4f8; color: #333; font-weight: 600; text-align: center; padding: 8px;">${label} (Semester 0${parseInt(semesterVal)})</td>`;
                tbody.appendChild(headerTr);

                subjects.forEach(sub => {
                    const tr = document.createElement('tr');
                    
                    // Color coding for results
                    let resultColor = '#333';
                    if (sub.result === 'PASS') resultColor = 'green';
                    else if (sub.result === 'RA') resultColor = '#d32f2f';
                    else if (sub.result && (sub.result.startsWith('WH') || sub.result === 'AB' || sub.result === 'SA' || sub.result === 'WD' || sub.result === 'PDEB')) resultColor = '#f57c00'; // Orange
                    
                    const semStr = sub.semester || semesterVal;
                    
                    tr.innerHTML = `
                        <td>0${parseInt(semStr)}</td>
                        <td>${sub.code}</td>
                        <td>${sub.grade || '-'}</td>
                        <td style="color: ${resultColor}; font-weight: 600;">${sub.result}</td>
                    `;
                    tbody.appendChild(tr);
                });
            };

            renderRows(data.results.current, currentSemester, "Current Semester");
            
            // Group arrears by semester
            if (data.results.arrears && data.results.arrears.length > 0) {
                const arrearsBySem = {};
                data.results.arrears.forEach(sub => {
                    const sem = sub.semester || '1';
                    if (!arrearsBySem[sem]) arrearsBySem[sem] = [];
                    arrearsBySem[sem].push(sub);
                });
                
                // Sort semester descending
                const semKeys = Object.keys(arrearsBySem).sort((a,b) => parseInt(b) - parseInt(a));
                semKeys.forEach(sem => {
                    renderRows(arrearsBySem[sem], sem, "Arrears");
                });
            }
        }

        showSection('results');
    }
});
