import {
    formatLargeNumber,
    formatNum,
    formatCurrency,
    formatSignedPercent,
} from './format';

describe('search/format', () => {
    describe('formatLargeNumber', () => {
        test('returns N/A for falsy or non-numeric input', () => {
            expect(formatLargeNumber(0)).toBe('N/A');
            expect(formatLargeNumber(null)).toBe('N/A');
            expect(formatLargeNumber(undefined)).toBe('N/A');
            expect(formatLargeNumber(NaN)).toBe('N/A');
            expect(formatLargeNumber('abc')).toBe('N/A');
        });

        test('abbreviates at the trillion/billion/million boundaries', () => {
            expect(formatLargeNumber(2.84e12)).toBe('2.84T');
            expect(formatLargeNumber(1e12)).toBe('1.00T');
            expect(formatLargeNumber(1e9)).toBe('1.00B');
            expect(formatLargeNumber(1.5e6)).toBe('1.50M');
        });

        test('just below a boundary uses the smaller unit', () => {
            expect(formatLargeNumber(999e6)).toBe('999.00M');
        });

        test('values below a million are grouped, not abbreviated', () => {
            expect(formatLargeNumber(12345)).toBe('12,345');
        });
    });

    describe('formatNum', () => {
        test('returns N/A for null/undefined/NaN', () => {
            expect(formatNum(null)).toBe('N/A');
            expect(formatNum(undefined)).toBe('N/A');
            expect(formatNum(NaN)).toBe('N/A');
        });

        test('formats to two decimals, 0 included', () => {
            expect(formatNum(0)).toBe('0.00');
            expect(formatNum(3.14159)).toBe('3.14');
            expect(formatNum(-2.5)).toBe('-2.50');
        });

        test('appends % when isPercent is true', () => {
            expect(formatNum(12.5, true)).toBe('12.50%');
        });
    });

    describe('formatCurrency', () => {
        test('returns N/A (not $0.00) for null/undefined/NaN', () => {
            expect(formatCurrency(null)).toBe('N/A');
            expect(formatCurrency(undefined)).toBe('N/A');
            expect(formatCurrency(NaN)).toBe('N/A');
        });

        test('prefixes $ with two decimals', () => {
            expect(formatCurrency(0)).toBe('$0.00');
            expect(formatCurrency(182.5)).toBe('$182.50');
        });
    });

    describe('formatSignedPercent', () => {
        test('returns N/A for null/undefined/NaN', () => {
            expect(formatSignedPercent(null)).toBe('N/A');
            expect(formatSignedPercent(NaN)).toBe('N/A');
        });

        test('adds a leading + for zero and positive, - stays for negative', () => {
            expect(formatSignedPercent(0)).toBe('+0.00%');
            expect(formatSignedPercent(1.234)).toBe('+1.23%');
            expect(formatSignedPercent(-4.2)).toBe('-4.20%');
        });
    });
});
