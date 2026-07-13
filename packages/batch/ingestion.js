const fs = require('fs');
const { parse } = require('csv-parse');

/**
 * Parses the raw CSV from the exam cell and yields records as they complete.
 * Expected CSV headers: reg_no,name,branch,dob,semester,subject_code,grade,result_status
 */

async function* ingestData(filePath) {
    const parser = fs.createReadStream(filePath)
        .pipe(parse({ columns: true, skip_empty_lines: true }));

    let currentStudent = null;
    let totalRows = 0;
    
    for await (const row of parser) {
        totalRows++;
        
        // Validation
        if (!row.reg_no || !row.semester || !row.subject_code || !row.result_status) {
            continue; 
        }

        const regNo = row.reg_no.trim();
        
        // If regNo changes, yield the completed student
        if (currentStudent && currentStudent.reg_no !== regNo) {
            yield currentStudent;
            currentStudent = null;
        }

        if (!currentStudent) {
            currentStudent = {
                reg_no: regNo,
                name: row.name ? row.name.trim() : 'Unknown',
                branch: row.branch ? row.branch.trim() : 'Unknown',
                dob: row.dob ? row.dob.trim() : '',
                subjects: []
            };
        }

        currentStudent.subjects.push({
            semester: row.semester.trim(),
            code: row.subject_code.trim(),
            grade: row.grade ? row.grade.trim() : '',
            result: row.result_status.trim()
        });
    }

    if (currentStudent) {
        yield currentStudent;
    }
}

module.exports = { ingestData };
