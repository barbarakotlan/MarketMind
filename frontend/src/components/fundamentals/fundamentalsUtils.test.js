import { MARKET_OPTIONS } from './fundamentalsUtils';

describe('fundamentals/fundamentalsUtils', () => {
    test('MARKET_OPTIONS lists the supported fundamentals markets (us/hk/cn)', () => {
        expect(MARKET_OPTIONS.map((o) => o.value)).toEqual(['us', 'hk', 'cn']);
        MARKET_OPTIONS.forEach((o) => expect(typeof o.label).toBe('string'));
    });
});
