import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../../lib/csv-parser';

describe('RFC 4180 CSV Parser (BUG-016)', () => {
  test('should parse simple unquoted CSV correctly', () => {
    const csv = 'subject,topic,date,notes\nPhysics,Kinematics,2026-11-15,Read chapter 1\nChemistry,Atomic Structure,,';
    const rows = parseCsv(csv);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[0], ['subject', 'topic', 'date', 'notes']);
    assert.deepEqual(rows[1], ['Physics', 'Kinematics', '2026-11-15', 'Read chapter 1']);
    assert.deepEqual(rows[2], ['Chemistry', 'Atomic Structure', '', '']);
  });

  test('should handle quoted fields containing commas', () => {
    const csv = 'subject,topic,target_date,notes\n"Physics, Mechanics","Units, Dimensions and Measurements",2026-11-20,"Part 1, 2 and 3"';
    const rows = parseCsv(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[1][0], 'Physics, Mechanics');
    assert.equal(rows[1][1], 'Units, Dimensions and Measurements');
    assert.equal(rows[1][2], '2026-11-20');
    assert.equal(rows[1][3], 'Part 1, 2 and 3');
  });

  test('should handle escaped double quotes ("")', () => {
    const csv = 'roll_no,name,course\nNDA-01,"Vikram ""Ace"" Batra",NDA';
    const rows = parseCsv(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[1][0], 'NDA-01');
    assert.equal(rows[1][1], 'Vikram "Ace" Batra');
    assert.equal(rows[1][2], 'NDA');
  });

  test('should handle CRLF (Windows) and LF (Unix) line endings seamlessly', () => {
    const csv = 'a,b,c\r\n1,2,3\r\n4,5,6';
    const rows = parseCsv(csv);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[1], ['1', '2', '3']);
    assert.deepEqual(rows[2], ['4', '5', '6']);
  });

  test('should handle multiline content within quoted fields', () => {
    const csv = 'id,remarks\n1,"Line 1\nLine 2\nLine 3"';
    const rows = parseCsv(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[1][0], '1');
    assert.equal(rows[1][1], 'Line 1\nLine 2\nLine 3');
  });

  test('should preserve leading and trailing whitespace inside quoted fields per RFC 4180', () => {
    const csv = 'code,title\n1,"  Leading and Trailing Spaces  "';
    const rows = parseCsv(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[1][1], '  Leading and Trailing Spaces  ');
  });

  test('should return empty array for empty or whitespace-only CSV', () => {
    assert.deepEqual(parseCsv(''), []);
    assert.deepEqual(parseCsv('   \n  \n  '), []);
  });
});
