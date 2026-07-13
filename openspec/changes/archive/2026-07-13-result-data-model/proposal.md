## Why

The current data model for student results stores a flat list of subjects and pre-calculated grades for a single semester (PASS/FAIL). However, Anna University's real format includes multi-semester records (current and arrear exams), specific subject codes, distinct status codes (e.g., RA, WH*, AB), and branch/exam details. To handle real-world scenarios and accurately represent student results, the data model and ingestion pipeline must be restructured.

## What Changes

- Change CSV ingestion to process one row per subject instead of one row per student.
- Add support for calculating overall result status from Anna University's specific legend codes (PASS, RA, WH*, etc.).
- Restructure the JSON data model in `mock-s3` to group results by semester and store comprehensive metadata (branch, exam name, dob).
- Update the result API to return this new JSON structure.
- **BREAKING**: Modify the frontend to display results grouped by semester, matching the authentic Anna University format.
- Add legend decoding display to the frontend table.

## Capabilities

### New Capabilities
- `result-data-model`: Defines the schema for multi-semester results, the standard Anna University status codes, and the logic to compute overall status.

### Modified Capabilities
- `result-api`: Update the JSON format requirements to handle arrays of subjects with semesters.

## Impact

- `packages/batch/ingestion.js`: Total rewrite of the parser.
- `packages/batch/generator.js`: New JSON mapping logic.
- `packages/batch/generate-mock-data.js`: Needs to generate data matching the new multi-semester subject format.
- `packages/result-api/index.js`: Ensure it passes the new structured JSON to the frontend.
- `packages/frontend/`: HTML and JS must be updated to parse and render multi-semester result objects and append the status legend.
