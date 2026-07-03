import { MARKET_OPTIONS, isUsAsset } from './searchUtils';

describe('search/searchUtils', () => {
    test('MARKET_OPTIONS lists us/hk/cn/all with labels', () => {
        expect(MARKET_OPTIONS.map((o) => o.value)).toEqual(['us', 'hk', 'cn', 'all']);
        MARKET_OPTIONS.forEach((o) => expect(typeof o.label).toBe('string'));
    });

    describe('isUsAsset', () => {
        test('treats missing assets as US (default market)', () => {
            expect(isUsAsset(null)).toBe(true);
            expect(isUsAsset(undefined)).toBe(true);
        });

        test('is true only when market is exactly "US"', () => {
            expect(isUsAsset({ market: 'US' })).toBe(true);
            expect(isUsAsset({ market: 'HK' })).toBe(false);
            expect(isUsAsset({ market: 'us' })).toBe(false);
            expect(isUsAsset({})).toBe(false);
        });
    });
});
