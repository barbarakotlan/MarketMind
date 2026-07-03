import { fmtBig, currencyPrefix, metricToneClass, sectionTitleClass } from './format';

describe('fundamentals/format', () => {
    describe('fmtBig', () => {
        test('returns an em dash for missing/sentinel/non-numeric values', () => {
            expect(fmtBig(null)).toBe('—');
            expect(fmtBig(undefined)).toBe('—');
            expect(fmtBig('N/A')).toBe('—');
            expect(fmtBig('None')).toBe('—');
            expect(fmtBig('not-a-number')).toBe('—');
        });

        test('abbreviates by magnitude using the absolute value', () => {
            expect(fmtBig(2.84e12)).toBe('2.84T');
            expect(fmtBig(1e9)).toBe('1.00B');
            expect(fmtBig(1e6)).toBe('1.00M');
            expect(fmtBig(-2e12)).toBe('-2.00T');
        });

        test('parses numeric strings', () => {
            expect(fmtBig('1500000')).toBe('1.50M');
        });

        test('applies the prefix and groups sub-million values with two decimals', () => {
            expect(fmtBig(1234.5)).toBe('1,234.50');
            expect(fmtBig(2.84e12, 'HK$')).toBe('HK$2.84T');
        });
    });

    describe('currencyPrefix', () => {
        test('maps known currencies, case-insensitively', () => {
            expect(currencyPrefix('HKD')).toBe('HK$');
            expect(currencyPrefix('hkd')).toBe('HK$');
            expect(currencyPrefix('CNY')).toBe('CN¥');
            expect(currencyPrefix('USD')).toBe('$');
        });

        test('defaults to $ for unknown/empty/null', () => {
            expect(currencyPrefix('EUR')).toBe('$');
            expect(currencyPrefix('')).toBe('$');
            expect(currencyPrefix(null)).toBe('$');
            expect(currencyPrefix(undefined)).toBe('$');
        });
    });

    test('metricToneClass maps tone keys to classes and sectionTitleClass is a string', () => {
        expect(metricToneClass.accent).toBe('text-mm-accent-primary');
        expect(metricToneClass.positive).toBe('text-mm-positive');
        expect(Object.keys(metricToneClass)).toEqual(['accent', 'positive', 'warning', 'tertiary']);
        expect(typeof sectionTitleClass).toBe('string');
    });
});
