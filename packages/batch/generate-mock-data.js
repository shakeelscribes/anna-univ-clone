const fs = require('fs');
const path = require('path');

// Generate 100,000 students to keep file size manageable for testing,
// but enough to demonstrate scale (will produce ~700,000 rows).
const TOTAL_STUDENTS = 100000;
const OUTPUT_FILE = path.join(__dirname, 'mock_results.csv');

const stream = fs.createWriteStream(OUTPUT_FILE);

console.log(`Generating mock data for ${TOTAL_STUDENTS} students in row-per-subject format...`);
console.time('GenerationTime');

// Write new CSV Header
stream.write('reg_no,name,branch,dob,semester,subject_code,grade,result_status\n');

const BASE_REG_NO = 951822100000;
const BRANCH = 'B.E. Computer Science and Engineering';

// Current semester subjects
const SEM_7_SUBJECTS = ['AI3021', 'CS3711', 'GE3752', 'GE3791', 'NM1051', 'OEN351'];

// Possible grades and their corresponding realistic result statuses
const GRADES = [
  { grade: 'O', status: 'PASS' },
  { grade: 'A+', status: 'PASS' },
  { grade: 'A', status: 'PASS' },
  { grade: 'B+', status: 'PASS' },
  { grade: 'B', status: 'PASS' },
  { grade: 'C', status: 'PASS' },
  { grade: 'U', status: 'RA' },
  { grade: '', status: 'AB' }, // Absent
  { grade: '', status: 'SA' }, // Shortage of Attendance
  { grade: '', status: 'WHI' } // Withheld
];

function getRandomGrade() {
  // Weighted random: Mostly passes, some RAs, few absents/withheld
  const rand = Math.random();
  if (rand < 0.05) return GRADES[0]; // O
  if (rand < 0.15) return GRADES[1]; // A+
  if (rand < 0.35) return GRADES[2]; // A
  if (rand < 0.60) return GRADES[3]; // B+
  if (rand < 0.80) return GRADES[4]; // B
  if (rand < 0.90) return GRADES[5]; // C
  if (rand < 0.97) return GRADES[6]; // U (RA)
  if (rand < 0.98) return GRADES[7]; // AB
  if (rand < 0.99) return GRADES[8]; // SA
  return GRADES[9]; // WHI
}

function getRandomDOB() {
  const year = 2000 + Math.floor(Math.random() * 4);
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

let i = 0;
function writeData() {
  let ok = true;
  do {
    const regNo = BASE_REG_NO + i;
    const name = `Student_${i}`;
    const dob = getRandomDOB();
    
    let rowsStr = '';

    // Generate rows for current semester (07)
    for (const sub of SEM_7_SUBJECTS) {
      const g = getRandomGrade();
      rowsStr += `${regNo},${name},${BRANCH},${dob},07,${sub},${g.grade},${g.status}\n`;
    }

    // 20% chance the student has an arrear from a past semester
    if (Math.random() < 0.20) {
      const pastSem = ['04', '05', '06'][Math.floor(Math.random() * 3)];
      const pastSub = pastSem === '04' ? 'CS3452' : pastSem === '05' ? 'MA3591' : 'CCS358';
      // Arrears have higher chance of failing again
      const g = Math.random() < 0.5 ? {grade: 'U', status: 'RA'} : {grade: 'E', status: 'PASS'}; // E is older grade, let's use B
      const arrearGrade = Math.random() < 0.5 ? {grade: 'U', status: 'RA'} : {grade: 'B', status: 'PASS'};
      rowsStr += `${regNo},${name},${BRANCH},${dob},${pastSem},${pastSub},${arrearGrade.grade},${arrearGrade.status}\n`;
    }
    
    i++;
    if (i === TOTAL_STUDENTS) {
      stream.write(rowsStr, () => {
        console.timeEnd('GenerationTime');
        console.log(`Successfully generated data for ${TOTAL_STUDENTS} students to ${OUTPUT_FILE}`);
        stream.end();
      });
    } else {
      ok = stream.write(rowsStr);
    }
  } while (i < TOTAL_STUDENTS && ok);
  
  if (i < TOTAL_STUDENTS) {
    stream.once('drain', writeData);
  }
}

writeData();
