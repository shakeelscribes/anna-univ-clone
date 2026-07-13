const fs = require('fs');

const FILE_PATH = 'mock_1000.csv';

const header = "reg_no,dob,name,result,subjects\n";
fs.writeFileSync(FILE_PATH, header);

for (let i = 1; i <= 1000; i++) {
    // Generate an 11-digit register number
    const reg_no = `8222104${String(i).padStart(4, '0')}`;
    const dob = "01/01/2000";
    const name = `Student ${i}`;
    const result = Math.random() > 0.1 ? 'PASS' : 'FAIL';
    
    // Create random subjects object
    const subjects = {
        "CS101": Math.random() > 0.1 ? 'A' : 'U',
        "CS102": Math.random() > 0.1 ? 'B' : 'U'
    };
    // Stringify and escape for CSV
    const subjectsJson = JSON.stringify(subjects).replace(/"/g, '""');

    const row = `${reg_no},${dob},${name},${result},"${subjectsJson}"\n`;
    fs.appendFileSync(FILE_PATH, row);
}

console.log(`Generated ${FILE_PATH}`);
