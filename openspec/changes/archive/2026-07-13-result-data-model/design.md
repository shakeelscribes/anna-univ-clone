## Context

Currently, the result ingestion system parses a single row per student, extracting a pre-computed PASS/FAIL result and a flat dictionary of subjects. In reality, Anna University result records include multiple semesters per student, specific legend codes for result status (e.g., RA for Re-Appearance, WH* for withheld, AB for absent), and additional metadata (branch, exam date). The data format needs to be restructured to store semester-grouped subjects and accurately compute an overall status based on standard Anna University rules.

## Goals / Non-Goals

**Goals:**
- Ingest a subject-centric CSV format (`reg_no`, `name`, `branch`, `dob`, `semester`, `subject_code`, `grade`, `result_status`).
- Map and group subject rows by `reg_no` during the ingestion phase.
- Generate a nested JSON structure for `mock-s3` categorized by semester.
- Compute the `overall` student status accurately based on Anna University's hierarchy of result severities.
- Display the result matching the official table format, including the result legend.

**Non-Goals:**
- Live fetching of real results from Anna University systems.
- Grade calculation from raw marks (we assume the CSV input provides the official grades and result statuses).

## Decisions

**Decision 1: CSV Row-per-Subject Ingestion**
- **Rationale**: Students can have variable numbers of subjects across different semesters. A row-per-student format becomes exponentially wide and unmanageable. Row-per-subject is standard for relational database exports and easier to parse.

**Decision 2: Overall Result Severity Hierarchy**
- **Rationale**: If a student passes 5 subjects but has an "RA" (Re-Appearance) in one, the overall status is "RA". If they are "WH1" (Withheld for Malpractice), that overrides everything.
- **Hierarchy Implementation**: We will implement a scoring/priority array (e.g., `PDEB` > `WH*` > `DIS` > `SA` > `AB` > `RA` > `PASS`) to calculate the student's top-level summary.

**Decision 3: JSON Structure by Semester & Storage Path**
- **Rationale**: The frontend needs to distinguish clearly between current semester results and arrear results from previous semesters. Lumping them into one array makes frontend processing ambiguous. Additionally, the JSON payload must be saved in the object storage under a dynamic path corresponding to the student's actual current semester, not a hardcoded "1".
- **Structure**:
```json
{
  "metadata": { "name": "...", "regno": "...", "branch": "...", "dob": "..." },
  "exam": "Nov. / Dec. Examination, 2025",
  "overall": "RA",
  "results": {
    "current_semester": "07",
    "current": [
      { "code": "AI3021", "grade": "B+", "result": "PASS" }
    ],
    "arrears": [
      { "semester": "06", "code": "CS3601", "grade": "U", "result": "RA" }
    ]
  }
}
```
- **Storage Path**: `mock-s3/results/{reg_no}/{current_semester}/result.json`

## Risks / Trade-offs

- **Risk: Increased Batch Memory Usage**
  - Grouping millions of rows by `reg_no` in memory during ingestion might exceed node's heap limit if not chunked.
  - *Mitigation*: The `mock-s3` generation processes 1M students. We will need to map records using a stream and flush complete students to disk/JSON, or use an intermediate Map if memory allows (1M objects might take ~1GB RAM, which is acceptable on the 24GB Oracle VM).

- **Risk: Frontend Breaking Changes**
  - The current frontend reads `data.subjects` as an object/map. The new structure uses an array of objects.
  - *Mitigation*: Completely replace the rendering logic in `app.js` to iterate over `subjects` array and render standard HTML rows, followed by a hardcoded static image/table of the legend.
