import { resolveAuthConfiguration } from './index';

describe('resolveAuthConfiguration', () => {
    test('allows explicit local auth in development without a Clerk key', () => {
        expect(resolveAuthConfiguration({ authMode: 'local', nodeEnv: 'development' })).toEqual({
            mode: 'local',
            error: null,
        });
    });

    test('rejects local auth in production', () => {
        expect(resolveAuthConfiguration({ authMode: 'local', nodeEnv: 'production' }).error).toMatch(
            /disabled in production/i
        );
    });

    test('requires a publishable key in Clerk mode', () => {
        expect(resolveAuthConfiguration({ authMode: 'clerk', nodeEnv: 'development' }).error).toMatch(
            /VITE_CLERK_PUBLISHABLE_KEY/
        );
    });

    test('accepts Clerk mode when a publishable key is configured', () => {
        expect(
            resolveAuthConfiguration({
                authMode: 'clerk',
                publishableKey: 'pk_test_example',
                nodeEnv: 'production',
            })
        ).toEqual({ mode: 'clerk', error: null });
    });
});
