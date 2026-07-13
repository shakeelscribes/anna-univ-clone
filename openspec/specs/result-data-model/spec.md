## Purpose

TBD - Ported from result-data-model delta spec.

### Requirement: Anna University Data Schema Definition
The system SHALL define and enforce a multi-semester data schema for student results. The schema MUST represent subjects individually, including the semester they were taken, the specific subject code, the grade achieved, and the specific result status code.

#### Scenario: Structuring multi-semester results
- **WHEN** the batch ingestion process parses subject rows for a student
- **THEN** it SHALL group these subjects by student registration number into a single JSON object.
- **AND** the object MUST contain metadata (`name`, `regno`, `branch`, `dob`) and an array of `subjects`, where each subject contains `semester`, `code`, `grade`, and `result`.

### Requirement: Anna University Result Status Codes
The system SHALL support the official Anna University result status legend, recognizing status codes beyond standard PASS/FAIL.

#### Scenario: Handling specific status codes
- **WHEN** a student has a specific status code like `RA`, `WH1`, `AB`, `SA`, or `PDEB`
- **THEN** the system SHALL accurately reflect this code in the `result` field for that subject, rather than simplifying it to "FAIL".

### Requirement: Overall Result Severity Calculation
The system SHALL compute a single `overall` result status for each student based on the severity hierarchy of individual subject results.

#### Scenario: Computing overall status with multiple results
- **WHEN** generating the final JSON payload for a student
- **THEN** the system SHALL evaluate all subject results for that student
- **AND** apply a severity hierarchy (e.g., `PDEB` > `WH*` > `DIS` > `SA` > `AB` > `RA` > `PASS`) to determine the `overall` status.
- **AND** if any subject has a higher severity status (like `RA`), the overall status MUST be `RA`, even if all other subjects are `PASS`.
