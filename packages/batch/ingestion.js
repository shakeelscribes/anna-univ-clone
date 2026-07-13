const fs = require('fs');
const { parse } = require('csv-parse');

/**
 * Parses the raw CSV from the exam cell and validates records.
 * Expected CSV headers: reg_no,name,branch,dob,semester,subject_code,grade,result_status
 */

function ingestData(filePath) {
    return new Promise((resolve, reject) => {
        const studentMap = new Map();
        const skipped = [];
        let totalRows = 0;

        fs.createReadStream(filePath)
            .pipe(parse({ columns: true, skip_empty_lines: true }))
            .on('data', (row) => {
                totalRows++;
                
                // Validation
                if (!row.reg_no || !row.semester || !row.subject_code || !row.result_status) {
                    skipped.push({ row, reason: "Missing required fields" });
                    return;
                }

                const regNo = row.reg_no.trim();
                
                // Grouping logic
                if (!studentMap.has(regNo)) {
                    studentMap.set(regNo, {
                        reg_no: regNo,
                        name: row.name ? row.name.trim() : 'Unknown',
                        branch: row.branch ? row.branch.trim() : 'Unknown',
                        dob: row.dob ? row.dob.trim() : '',
                        subjects: []
                    });
                }

                const student = studentMap.get(regNo);
                student.subjects.push({
                    semester: row.semester.trim(),
                    code: row.subject_code.trim(),
                    grade: row.grade ? row.grade.trim() : '',
                    result: row.result_status.trim()
                });
            })
            .on('end', () => {
                // Convert Map values to an array
                const records = Array.from(studentMap.values());
                console.log(`Ingested ${totalRows} subject rows into ${records.length} distinct student records.`);
                resolve({ records, skipped, totalRows });
            })
            .on('error', (err) => {
                reject(err);
            });
    });
}

module.exports = { ingestData };
