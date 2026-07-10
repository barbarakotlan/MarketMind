import { renderHook, act, waitFor } from '@testing-library/react';
import { learningModules, getTotalChapters } from '../../data/content';
import useGettingStartedProgress from './useGettingStartedProgress';

const STORAGE_KEY = 'marketmind_course_progress';

beforeAll(() => {
    // jsdom doesn't implement scrollTo; navigation helpers call it.
    window.scrollTo = vi.fn();
});

beforeEach(() => {
    localStorage.clear();
});

describe('useGettingStartedProgress', () => {
    test('loads saved progress from localStorage on mount', async () => {
        const firstChapterId = learningModules[0].chapters[0].id;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ [firstChapterId]: true }));

        const { result } = renderHook(() => useGettingStartedProgress());

        await waitFor(() => expect(result.current.completedChapters).toBe(1));
        expect(result.current.progress[firstChapterId]).toBe(true);
    });

    test('toggleChapterComplete flips completion and persists to localStorage', async () => {
        const { result } = renderHook(() => useGettingStartedProgress());
        const id = learningModules[0].chapters[0].id;

        act(() => result.current.toggleChapterComplete(id));
        expect(result.current.progress[id]).toBe(true);
        await waitFor(() =>
            expect(JSON.parse(localStorage.getItem(STORAGE_KEY))[id]).toBe(true),
        );

        act(() => result.current.toggleChapterComplete(id));
        expect(result.current.progress[id]).toBe(false);
    });

    test('courseProgress reflects completed / total chapters', () => {
        const { result } = renderHook(() => useGettingStartedProgress());

        expect(result.current.totalChapters).toBe(getTotalChapters());
        expect(result.current.courseProgress).toBe(0);

        act(() => result.current.toggleChapterComplete(learningModules[0].chapters[0].id));
        expect(result.current.courseProgress).toBe(Math.round((1 / getTotalChapters()) * 100));
    });

    test('module 0 is always unlocked; a later module needs >=50% of the prior module', () => {
        const { result } = renderHook(() => useGettingStartedProgress());

        expect(result.current.isModuleUnlocked(0)).toBe(true);
        expect(result.current.isModuleUnlocked(1)).toBe(false);

        const chapters = learningModules[0].chapters;
        const needed = Math.ceil(chapters.length * 0.5);
        act(() => {
            for (let i = 0; i < needed; i++) result.current.toggleChapterComplete(chapters[i].id);
        });

        expect(result.current.isModuleUnlocked(1)).toBe(true);
    });

    test('getModuleProgress computes a per-module percentage', () => {
        const { result } = renderHook(() => useGettingStartedProgress());
        const mod = learningModules[0];

        expect(result.current.getModuleProgress(mod)).toBe(0);
        act(() => result.current.toggleChapterComplete(mod.chapters[0].id));
        expect(result.current.getModuleProgress(mod)).toBe(
            Math.round((1 / mod.chapters.length) * 100),
        );
    });

    test('navigation sets and clears the immersive module/chapter view', () => {
        const { result } = renderHook(() => useGettingStartedProgress());
        const mod = learningModules[0];
        const chapter = mod.chapters[0];

        expect(result.current.isImmersive).toBe(false);

        act(() => result.current.navigateToChapter(mod, chapter));
        expect(result.current.selectedModule).toBe(mod);
        expect(result.current.selectedChapter).toBe(chapter);
        expect(result.current.isImmersive).toBe(true);

        // backToModuleOverview clears only the chapter, staying in the module.
        act(() => result.current.backToModuleOverview());
        expect(result.current.selectedChapter).toBe(null);
        expect(result.current.selectedModule).toBe(mod);

        // backToModules exits the module entirely.
        act(() => result.current.backToModules());
        expect(result.current.selectedModule).toBe(null);
        expect(result.current.isImmersive).toBe(false);
    });
});
