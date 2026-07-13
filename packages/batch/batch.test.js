const test = require('node:test');
const assert = require('node:assert');
const { generateResultJson } = require('./generator');

test('generateResultJson correctly formats output', (t) => {
    const raw = {
        reg_no: '8222104051',
        dob: '01/01/2000',
        name: 'John Doe',
        result: 'PASS',
        subjects: { "CS101": "A" }
    };
    
    const output = generateResultJson(raw);
    
    assert.strictEqual(output.metadata.regno, '8222104051');
    assert.strictEqual(output.performance.result, 'PASS');
    assert.deepStrictEqual(output.subjects, { "CS101": "A" });
});
