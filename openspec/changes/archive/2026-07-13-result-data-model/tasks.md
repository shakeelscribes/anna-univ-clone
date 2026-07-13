## 1. Batch Data Generation & Ingestion

- [x] 1.1 Update `packages/batch/generate-mock-data.js` to output mock data in the new row-per-subject format with semesters, real subject codes, grades, and status codes.
- [x] 1.2 Rewrite `packages/batch/ingestion.js` to parse the new CSV format and group subjects by `reg_no` using an intermediate Map or stream.
- [x] 1.3 Update `packages/batch/generator.js` to map the grouped data into the semester-structured JSON payload.
- [x] 1.4 Implement the overall result calculation logic in `generator.js` using the severity hierarchy (`PDEB` > `WH*` > `DIS` > `SA` > `AB` > `RA` > `PASS`).
- [x] 1.5 Fix `packages/batch/index.js` to remove the hardcoded `SEMESTER = '1'` and fix the undefined ingestion log bug.
- [x] 1.6 Update `packages/batch/generator.js` to split subjects into `results.current` and `results.arrears` based on the highest semester, and return the `current_semester` to `index.js` for dynamic path generation.

## 2. API Validation

- [x] 2.1 Verify `packages/result-api/index.js` handles and correctly forwards the new JSON structure to the frontend without any mapping errors.

## 3. Frontend UI Restructuring

- [x] 3.1 Update `packages/frontend/index.html` to add the result legend (WHI, RA, etc.) below the results table.
- [x] 3.2 Update `packages/frontend/app.js` to parse the new semester-grouped JSON array instead of the old flat `subjects` object.
- [x] 3.3 Modify the frontend table rendering to include the "Semester" column and properly render distinct status codes (e.g., RA, WH1) matching the official format.
- [x] 3.4 Update `packages/frontend/app.js` to render the split `current` vs `arrears` data model accurately.
