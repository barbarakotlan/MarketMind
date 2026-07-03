import { formatCurrency, formatNum, formatPercent } from './format';

describe('paper/format', () => {
    describe('formatCurrency', () => {
        test('falls back to $0.00 (not N/A) for null/undefined/NaN', () => {
            expect(formatCurrency(null)).toBe('$0.00');
            expect(formatCurrency(undefined)).toBe('$0.00');
            expect(formatCurrency(NaN)).toBe('$0.00');
        });

        test('formats as en-US currency with grouping', () => {
            expect(formatCurrency(0)).toBe('$0.00');
            expect(formatCurrency(1234.5)).toBe('$1,234.50');
            expect(formatCurrency(108432)).toBe('$108,432.00');
        });
    });

    describe('formatNum', () => {
        test('falls back to 0.00 for null/undefined/NaN', () => {
            expect(formatNum(null)).toBe('0.00');
            expect(formatNum(undefined)).toBe('0.00');
            expect(formatNum(NaN)).toBe('0.00');
        });

        test('respects the digits argument (default 2)', () => {
            expect(formatNum(3.14159)).toBe('3.14');
            expect(formatNum(3.14159, 4)).toBe('3.1416');
            expect(formatNum(5, 0)).toBe('5');
        });

        test('parses numeric strings', () => {
            expect(formatNum('12.5')).toBe('12.50');
        });
    });

    describe('formatPercent', () => {
        test('falls back to 0.00% for null/undefined/NaN', () => {
            expect(formatPercent(null)).toBe('0.00%');
            expect(formatPercent(NaN)).toBe('0.00%');
        });

        test('multiplies a ratio by 100 and appends %', () => {
            expect(formatPercent(0.1234)).toBe('12.34%');
            expect(formatPercent(0)).toBe('0.00%');
            expect(formatPercent(0.05, 1)).toBe('5.0%');
        });
    });
});
