const fs = require('fs/promises');
const path = require('path');

// Hierarchy mapping: higher number = more severe
function getSeverity(status) {
    if (status.startsWith('WH')) return 60; // WHI, WH1, WH99 etc.
    switch (status) {
        case 'PDEB': return 100;
        case 'DIS': return 50;
        case 'SA': return 40;
        case 'AB': return 30;
        case 'RA': return 20;
        case 'PASS': return 10;
        default: return 0;
    }
}

function calculateOverallStatus(subjects) {
    if (!subjects || subjects.length === 0) return 'UNKNOWN';
    let worstStatus = 'PASS';
    let maxSeverity = 0;
    
    for (const sub of subjects) {
        const severity = getSeverity(sub.result);
        if (severity > maxSeverity) {
            maxSeverity = severity;
            worstStatus = sub.result;
        }
    }
    return worstStatus;
}

/**
 * Formats a raw student record into the final public JSON structure.
 */
function generateResultJson(record) {
    const overall = calculateOverallStatus(record.subjects);
    
    // Find current semester
    let current_semester = "01";
    if (record.subjects && record.subjects.length > 0) {
        let maxSem = 1;
        record.subjects.forEach(sub => {
            const semNum = parseInt(sub.semester || '1', 10);
            if (semNum > maxSem) maxSem = semNum;
        });
        current_semester = maxSem.toString().padStart(2, '0');
    }

    const current = [];
    const arrears = [];
    
    if (record.subjects) {
        record.subjects.forEach(sub => {
            if (parseInt(sub.semester || '1', 10) === parseInt(current_semester, 10)) {
                current.push(sub);
            } else {
                arrears.push(sub);
            }
        });
    }
    
    const json = {
        metadata: {
            name: record.name,
            regno: record.reg_no,
            branch: record.branch,
            dob: record.dob
        },
        exam: "Nov. / Dec. Examination, 2025",
        overall: overall,
        results: {
            current_semester: current_semester,
            current: current,
            arrears: arrears
        }
    };
    return { current_semester, json };
}

/**
 * Simulates uploading the generated JSON to S3 by writing it to the local `mock-s3/` folder.
 */
async function uploadToMockS3(bucketPath, regNo, semester, jsonContent) {
    const key = `results/${regNo}/${semester}/result.json`;
    const fullPath = path.join(bucketPath, key);
    
    // Ensure the directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    // Write the JSON file (simulating S3 PUT)
    await fs.writeFile(fullPath, JSON.stringify(jsonContent, null, 2));
    
    return key;
}

module.exports = { generateResultJson, uploadToMockS3, calculateOverallStatus };
