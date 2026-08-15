/**
 * Tests for the Sheet utility, with the upsert contract as the main subject.
 *
 * Run with:  node test/Sheet.test.js
 *
 * No dependencies and no test framework — this repo has no package manifest
 * and no build step, and these tests must not need one. Only the Apps Script
 * Sheet object is stubbed; all of src/Sheet.js runs for real.
 *
 * See docs/adr/0001-upsert-writes-only-present-keys.md for why the contract is
 * shaped the way it is. These tests are its executable form.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SOURCE = path.join(__dirname, '..', 'src', 'Sheet.js');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(SOURCE, 'utf8'), sandbox);
const Sheet = sandbox.Sheet;

// --- a stand-in for a Google Sheet ----------------------------------------

/**
 * Models the parts of a Sheet the utility touches, and records every write so
 * tests can assert that an unchanged upsert really does stay silent.
 *
 * Formulas are modelled because they are the reason updates are written as
 * column runs: getValues() yields a formula's computed value, so writing that
 * value back would replace the formula with a constant.
 */
function makeSheet(values) {
  const data = values.map((row) => row.slice());
  const formulas = values.map((row) => row.map(() => null));
  const writes = [];

  const width = () => data[0].length;

  return {
    data,
    formulas,
    writes,

    setFormula(row, column, formula) {
      formulas[row - 1][column - 1] = formula;
    },
    formulaAt(row, column) {
      return formulas[row - 1][column - 1];
    },

    getDataRange: () => ({ getValues: () => data.map((row) => row.slice()) }),
    getLastRow: () => data.length,
    getLastColumn: () => width(),
    getMaxRows: () => data.length,
    getMaxColumns: () => width(),
    appendRow(row) {
      data.push(row.slice());
      formulas.push(row.map(() => null));
    },
    getRange: (row, column, numRows, numColumns) => ({
      setValues(block) {
        writes.push({ row, column, numRows, numColumns, cells: numRows * numColumns });
        for (let i = 0; i < numRows; i++) {
          const r = row - 1 + i;
          while (data.length <= r) {
            data.push(new Array(width()).fill(''));
            formulas.push(new Array(width()).fill(null));
          }
          for (let j = 0; j < numColumns; j++) {
            data[r][column - 1 + j] = block[i][j];
            // Writing a value replaces whatever formula was in the cell.
            formulas[r][column - 1 + j] = null;
          }
        }
      },
    }),
  };
}

// --- assertions -----------------------------------------------------------

let failures = 0;

function check(name, actual, expected) {
  const got = JSON.stringify(actual);
  const want = JSON.stringify(expected);
  if (got === want) {
    console.log('PASS  ' + name);
    return;
  }
  failures++;
  console.log('FAIL  ' + name + '\n        got  ' + got + '\n        want ' + want);
}

function threw(fn) {
  try {
    fn();
    return false;
  } catch (e) {
    return true;
  }
}

function group(name) {
  console.log('\n' + name);
}

// --- fixtures -------------------------------------------------------------

const HEADERS = ['Name', 'Status', 'Email', 'Notes'];

const person = (email, over) =>
  Object.assign({ Name: 'Jane', Status: 'Active', Email: email }, over || {});

// --- inserting ------------------------------------------------------------

group('Inserting');

let sheet = makeSheet([HEADERS]);
let db = Sheet.load(sheet);

check(
  'an upsert into a header-only sheet inserts every row given',
  db.upsert([person('a@example.com'), person('b@example.com')], { key: 'Email' }),
  { inserted: 2, updated: 0 }
);
check('the rows land below the header', sheet.data.length, 3);
check('a batch of inserts is a single write', sheet.writes.length, 1);
check('a column absent from the object is blank on insert', sheet.data[1][3], '');

// --- doing nothing --------------------------------------------------------

group('Doing nothing');

sheet.data[1][3] = 'typed by a human';
db = Sheet.load(sheet);
sheet.writes.length = 0;

check(
  'an upsert with identical data reports no work',
  db.upsert([person('a@example.com'), person('b@example.com')], { key: 'Email' }),
  { inserted: 0, updated: 0 }
);
check('...and performs no writes at all', sheet.writes.length, 0);
check('...leaving the human column alone', sheet.data[1][3], 'typed by a human');

// --- updating -------------------------------------------------------------

group('Updating');

db = Sheet.load(sheet);
sheet.writes.length = 0;

check(
  'a changed value updates in place',
  db.upsert([person('a@example.com', { Name: 'Jane Smith' }), person('b@example.com')], { key: 'Email' }),
  { inserted: 0, updated: 1 }
);
check('...writing one range', sheet.writes.length, 1);
check('...of exactly one cell', sheet.writes[0].cells, 1);
check('...at the column that changed', sheet.writes[0].column, 1);
check('...still leaving the human column alone', sheet.data[1][3], 'typed by a human');

db = Sheet.load(sheet);
sheet.writes.length = 0;
db.upsert([{ Email: 'a@example.com', Name: 'Jane Doe', Status: 'Away' }], { key: 'Email' });
check('adjacent changed columns become one range', sheet.writes.map((w) => w.numColumns), [2]);

db = Sheet.load(sheet);
sheet.writes.length = 0;
db.upsert([{ Email: 'a@example.com', Name: 'Jane Roe', Notes: 'overwritten' }], { key: 'Email' });
check('columns either side of an unchanged one become two ranges', sheet.writes.length, 2);
check('...and neither spans the gap', sheet.writes.map((w) => w.numColumns), [1, 1]);

// --- formulas -------------------------------------------------------------

group('Formulas');

sheet = makeSheet([HEADERS, ['Jane', 'Active', 'a@example.com', 'computed']]);
sheet.setFormula(2, 4, '=UPPER(A2)');
db = Sheet.load(sheet);

db.upsert([{ Email: 'a@example.com', Name: 'Changed', Status: 'Away' }], { key: 'Email' });
check(
  'a formula in an untargeted cell survives an upsert beside it',
  sheet.formulaAt(2, 4),
  '=UPPER(A2)'
);
check('...while the targeted cells did change', sheet.data[1][0], 'Changed');

sheet = makeSheet([HEADERS, ['Jane', 'Active', 'a@example.com', 'computed']]);
sheet.setFormula(2, 2, '=IF(TRUE,"Active","")');
db = Sheet.load(sheet);
db.upsert([{ Email: 'a@example.com', Name: 'Changed', Notes: 'also changed' }], { key: 'Email' });
check(
  'a formula between two changed columns survives',
  sheet.formulaAt(2, 2),
  '=IF(TRUE,"Active","")'
);

// --- clearing -------------------------------------------------------------

group('Clearing');

sheet = makeSheet([HEADERS, ['Jane', 'Active', 'a@example.com', 'keep me']]);
db = Sheet.load(sheet);
sheet.writes.length = 0;

check(
  'a column passed with an empty value is cleared',
  db.upsert([{ Email: 'a@example.com', Status: '' }], { key: 'Email' }),
  { inserted: 0, updated: 1 }
);
check('...writing one cell', sheet.writes[0].cells, 1);
check('...emptying it', sheet.data[1][1], '');
check('...leaving the key alone', sheet.data[1][2], 'a@example.com');
check('...and the human column alone', sheet.data[1][3], 'keep me');

db = Sheet.load(sheet);
db.upsert([person('a@example.com')], { key: 'Email' });
check('a later upsert restores the cleared value', sheet.data[1][1], 'Active');

// --- repeated keys --------------------------------------------------------

group('Repeated keys');

sheet = makeSheet([HEADERS]);
db = Sheet.load(sheet);

check(
  'the same key twice in one batch inserts once',
  db.upsert([person('c@example.com'), person('c@example.com', { Name: 'Second' })], { key: 'Email' }),
  { inserted: 1, updated: 0 }
);
check('...producing one row', sheet.data.length, 2);
check('...carrying the later values', sheet.data[1][0], 'Second');

// --- the in-memory snapshot -----------------------------------------------

group('The in-memory snapshot');

sheet = makeSheet([HEADERS]);
db = Sheet.load(sheet);
db.upsert([person('d@example.com')], { key: 'Email' });
check('reading all rows includes what was just upserted', db.all().length, 1);
check('...with the right key', db.all()[0].Email, 'd@example.com');

db.append({ Name: 'Ann', Status: 'Active', Email: 'e@example.com', Notes: '' });
check('reading all rows includes what was just appended', db.all().length, 2);

db.upsert([{ Email: 'e@example.com', Status: 'Away' }], { key: 'Email' });
check('an appended row can then be upserted', sheet.data[2][1], 'Away');

// --- misuse ---------------------------------------------------------------

group('Misuse');

db = Sheet.load(makeSheet([HEADERS]));
check('an upsert with no key option fails', threw(() => db.upsert([person('f@example.com')], {})), true);
check('an upsert with no options at all fails', threw(() => db.upsert([person('f@example.com')])), true);
check(
  'a key column that is not a header fails',
  threw(() => db.upsert([person('f@example.com')], { key: 'Missing' })),
  true
);
check(
  'a row with no value for the key column fails',
  threw(() => db.upsert([person('')], { key: 'Email' })),
  true
);

// --- a single object ------------------------------------------------------

group('Convenience');

sheet = makeSheet([HEADERS]);
db = Sheet.load(sheet);
check(
  'a bare object is accepted as well as an array',
  db.upsert(person('g@example.com'), { key: 'Email' }),
  { inserted: 1, updated: 0 }
);

// --- result ---------------------------------------------------------------

console.log(failures === 0 ? '\nall green' : '\n' + failures + ' FAILED');
process.exit(failures === 0 ? 0 : 1);
