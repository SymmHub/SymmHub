/*
 node tests/uilib/number_field.mjs

 NumberField.js, the digit arithmetic of the number fields (the tool bars, the layer list):
  1. the digit after the caret: its power of ten (the sign and the point skipped,
     the end one digit finer than the last)
  2. the caret put back before the digit of a power, across a carry and a sign
  3. a step: rounded to the shown decimals (no float noise), within the range
  4. the shown text: fixed decimals, never "-0.000"; the decimals a value needs
  5. a sequence of steps as the field makes them: the caret stays on its digit
*/

import {
    digitUnitAt, caretBeforeUnit, stepNumber, formatNumber, formatShown, autoDecimals, decimalsOf, unitText,
} from '../../lib/uilib/NumberField.js';

let failed = 0;
function check(ok, what){
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
}
const eq = (a, b, what) => check(a === b, `${what}: ${a}${a === b ? '' : ' (expected ' + b + ')'}`);

// 1 ───────────────────────────────────────────────────────────────────────────
eq(digitUnitAt('12.345', 0), 1, 'before the 1 of 12.345: tens');
eq(digitUnitAt('12.345', 1), 0, 'before the 2: units');
eq(digitUnitAt('12.345', 2), -1, 'before the point: the first decimal');
eq(digitUnitAt('12.345', 3), -1, 'before the 3: tenths');
eq(digitUnitAt('12.345', 5), -3, 'before the 5: thousandths');
eq(digitUnitAt('12.345', 6), -4, 'at the end: one finer than the last digit');
eq(digitUnitAt('-0.50', 0), 0, 'before the sign: the first digit');
eq(digitUnitAt('-0.50', 1), 0, 'before the 0 of -0.50: units');
eq(digitUnitAt('64', 2), -1, 'end of an integer: tenths (an integer field keeps units)');
eq(digitUnitAt('64', 0), 1, 'before the 6 of 64: tens');
eq(digitUnitAt('1e-5', 0), null, 'an exponent: no digit');
eq(digitUnitAt('', 0), null, 'empty: no digit');

// 2 ───────────────────────────────────────────────────────────────────────────
eq(caretBeforeUnit('12.345', 1), 0, 'tens of 12.345: index 0');
eq(caretBeforeUnit('12.345', 0), 1, 'units: index 1');
eq(caretBeforeUnit('12.345', -1), 3, 'tenths: index 3');
eq(caretBeforeUnit('12.345', -4), 6, 'finer than shown: the end');
eq(caretBeforeUnit('5.0', 1), 0, 'tens of 5.0 (none): before the first digit');
eq(caretBeforeUnit('-5.0', 1), 1, 'tens of -5.0 (none): after the sign');
eq(caretBeforeUnit('10.0', 0), 1, 'units of 10.0 after a carry: index 1');
for (const [t, c] of [['12.345', 0], ['12.345', 1], ['12.345', 3], ['12.345', 5], ['-3.25', 1], ['0.001', 4]]) {
    eq(caretBeforeUnit(t, digitUnitAt(t, c)), c, `round trip ${t} at ${c}`);
}

// 3 ───────────────────────────────────────────────────────────────────────────
eq(stepNumber(0.1, -1, 2, 1), 0.3, '0.1 + 2 tenths: 0.3, no float noise');
eq(stepNumber(12.345, -1, 1, 3), 12.445, 'tenths of 12.345: the finer digits stay');
eq(stepNumber(9.9, -1, 1, 1), 10, 'carry 9.9 -> 10');
eq(stepNumber(0.5, 0, -1, 2), -0.5, 'through zero');
eq(stepNumber(0.95, -1, 1, 2, 0, 1), 1, 'clamped to the max');
eq(stepNumber(0.05, -1, -1, 2, 0, 1), 0, 'clamped to the min');
eq(stepNumber(0.123456789, -3, 1, 3), 0.124, 'float noise of the owner rounded to the shown decimals');
eq(stepNumber(0.5, -4, 1, 3), 0.5001, 'a finer step keeps its own decimal');

// 4 ───────────────────────────────────────────────────────────────────────────
eq(formatNumber(0.5, 3), '0.500', 'trailing zeros shown');
eq(formatNumber(-0.0001, 3), '0.000', 'no minus zero');
eq(formatNumber(12, 0), '12', 'integer');
eq(formatNumber(NaN, 2), '', 'not a number: empty');
eq(autoDecimals(0.1 + 0.2), 1, '0.1 + 0.2 needs one decimal');
eq(autoDecimals(3), 0, 'an integer needs none');
eq(autoDecimals(1.25), 2, '1.25 needs two');
eq(decimalsOf('0.12345'), 5, 'decimals typed');
eq(decimalsOf('-7'), 0, 'none typed');
eq(formatShown(0.25, 3, 5), '0.250', 'extra decimals: none shown while they are zeros');
eq(formatShown(0.2501, 3, 5), '0.2501', 'extra decimals: shown where not zero');
eq(formatShown(0.123456789, 3, 5), '0.12346', 'extra decimals: rounded to their count');
eq(formatShown(3.5, 0, 2), '3.5', 'base 0: the point only with a decimal');
eq(formatShown(3, 0, 2), '3', 'base 0: no point for a whole number');
eq(formatShown(0.5, 2, 0), '0.50', 'no extra: the base as it is');
eq(unitText(2), '100', 'the arrows step of the hundreds');
eq(unitText(0), '1', 'of the units');
eq(unitText(-3), '0.001', 'of the thousandths');

// 5 ───────────────────────────────────────────────────────────────────────────
// the field's step: the digit at the caret, the value stepped, the caret put back
{
    let v = 9.75, decimals = 2, text = formatNumber(v, decimals);
    let caret = 2;                                    // before the 7: tenths
    const p = digitUnitAt(text, caret);
    const seen = [];
    for (let i = 0; i < 4; i++) {
        v = stepNumber(v, p, 1, decimals);
        text = formatNumber(v, decimals);
        caret = caretBeforeUnit(text, p);
        seen.push(`${text}@${caret}`);
        check(digitUnitAt(text, caret) === p, `step ${i + 1}: ${text}, the caret on the tenths`);
    }
    eq(seen.join(' '), '9.85@2 9.95@2 10.05@3 10.15@3', 'tenths across the carry');
}
{
    // down through zero: the sign comes and the caret stays on the units
    let v = 1.5, text, caret;
    for (let i = 0; i < 3; i++) {
        v = stepNumber(v, 0, -1, 1);
        text = formatNumber(v, 1);
        caret = caretBeforeUnit(text, 0);
        check(digitUnitAt(text, caret) === 0, `down ${i + 1}: ${text}, the caret on the units`);
    }
    eq(text, '-1.5', 'three units down from 1.5');
}

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
