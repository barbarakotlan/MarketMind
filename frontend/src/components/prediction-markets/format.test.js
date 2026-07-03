import {
    formatCurrency,
    formatPercent,
    formatProbability,
    formatProbabilityDelta,
} from './format';

describe('prediction-markets/format', () => {
    describe('formatCurrency', () => {
        test('falls back to $0.00 for null/undefined/NaN', () => {
            expect(formatCurrency(null)).toBe('$0.00');
            expect(formatCurrency(NaN)).toBe('$0.00');
        });

        test('formats as en-US currency', () => {
            expect(formatCurrency(1234.5)).toBe('$1,234.50');
        });
    });

    describe('formatPercent', () => {
        test('falls back to 0.00% for null/undefined/NaN', () => {
            expect(formatPercent(null)).toBe('0.00%');
            expect(formatPercent(NaN)).toBe('0.00%');
        });

        test('signs the value (a raw percentage, not a ratio)', () => {
            expect(formatPercent(0)).toBe('+0.00%');
            expect(formatPercent(4.2)).toBe('+4.20%');
            expect(formatPercent(-1.5)).toBe('-1.50%');
        });
    });

    describe('formatProbability', () => {
        test('renders a 0-1 price as a one-decimal percentage', () => {
            expect(formatProbability(0.732)).toBe('73.2%');
            expect(formatProbability(0)).toBe('0.0%');
            expect(formatProbability(null)).toBe('0.0%');
            expect(formatProbability(1)).toBe('100.0%');
        });
    });

    describe('formatProbabilityDelta', () => {
        test('signs the delta and labels it in points', () => {
            expect(formatProbabilityDelta(0.05)).toBe('+5.0 pts');
            expect(formatProbabilityDelta(-0.021)).toBe('-2.1 pts');
            expect(formatProbabilityDelta(0)).toBe('+0.0 pts');
            expect(formatProbabilityDelta(null)).toBe('+0.0 pts');
        });
    });
});
