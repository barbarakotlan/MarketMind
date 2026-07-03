import { useState, useEffect, useCallback } from 'react';
import { learningModules, getTotalChapters } from '../../data/content';

// --- PROGRESS STORAGE UTILITIES ---
const STORAGE_KEY = 'marketmind_course_progress';

const loadProgress = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : {};
    } catch {
        return {};
    };
};

const saveProgress = (progress) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
        // Silently fail if localStorage is unavailable
    }
};

export default function useGettingStartedProgress() {
    const [activeTab, setActiveTab] = useState('learn');
    const [selectedModule, setSelectedModule] = useState(null);
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [progress, setProgress] = useState({});
    const [showSearch, setShowSearch] = useState(false);
    const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

    // Load progress on mount
    useEffect(() => {
        setProgress(loadProgress());
    }, []);

    // Save progress when it changes
    useEffect(() => {
        if (Object.keys(progress).length > 0) {
            saveProgress(progress);
        }
    }, [progress]);

    // Toggle chapter completion
    const toggleChapterComplete = useCallback((chapterId) => {
        setProgress(prev => ({
            ...prev,
            [chapterId]: !prev[chapterId]
        }));
    }, []);

    // Navigate back to modules
    const backToModules = () => {
        setSelectedModule(null);
        setSelectedChapter(null);
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Robust check to ensure we don't hijack typing in search or quiz inputs
            const activeTag = document.activeElement?.tagName.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea' || e.isComposing) {
                // Let Escape bubble up to close search even if input is focused
                if (e.key === 'Escape' && showSearch) {
                    setShowSearch(false);
                }
                return; 
            }

            // Global Shortcuts
            if (e.key === '/' && !showSearch) {
                e.preventDefault();
                setShowSearch(true);
                return;
            }

            if (e.key === '?' && !showKeyboardHelp && !showSearch) {
                e.preventDefault();
                setShowKeyboardHelp(true);
                return;
            }
            
            if (e.key === 'Escape') {
                e.preventDefault();
                if (showSearch) setShowSearch(false);
                else if (showKeyboardHelp) setShowKeyboardHelp(false);
                else if (selectedChapter) setSelectedChapter(null);
                else if (selectedModule) backToModules();
                return;
            }

            // Chapter-Specific Shortcuts
            if (!selectedChapter || !selectedModule || showSearch || showKeyboardHelp) return;

            const currentIdx = selectedModule.chapters.findIndex(ch => ch.id === selectedChapter.id);

            switch (e.key.toLowerCase()) {
                case 'arrowleft':
                case 'k':
                    e.preventDefault();
                    if (currentIdx > 0) {
                        setSelectedChapter(selectedModule.chapters[currentIdx - 1]);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                    break;
                case 'arrowright':
                case 'j':
                    e.preventDefault();
                    if (currentIdx < selectedModule.chapters.length - 1) {
                        setSelectedChapter(selectedModule.chapters[currentIdx + 1]);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                    break;
                case 'm': // Replaced Spacebar with M to protect native page scrolling
                    e.preventDefault();
                    toggleChapterComplete(selectedChapter.id);
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedChapter, selectedModule, showSearch, showKeyboardHelp, toggleChapterComplete]);

    // Calculate stats
    const totalChapters = getTotalChapters();
    const completedChapters = Object.values(progress).filter(Boolean).length;
    const courseProgress = Math.round((completedChapters / totalChapters) * 100);

    // Check if module is unlocked
    const isModuleUnlocked = (moduleIndex) => {
        if (moduleIndex === 0) return true;
        const prevModule = learningModules[moduleIndex - 1];
        const prevModuleChapters = prevModule.chapters;
        const completedInPrev = prevModuleChapters.filter(ch => progress[ch.id]).length;
        return completedInPrev >= Math.ceil(prevModuleChapters.length * 0.5);
    };

    // Calculate module progress
    const getModuleProgress = (module) => {
        const completed = module.chapters.filter(ch => progress[ch.id]).length;
        return Math.round((completed / module.chapters.length) * 100);
    };

    // Navigate to chapter
    const navigateToChapter = (module, chapter) => {
        setSelectedModule(module);
        setSelectedChapter(chapter);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Navigate back to module overview
    const backToModuleOverview = () => {
        setSelectedChapter(null);
    };

    // Determine if we're in an immersive view (inside a module)
    const isImmersive = selectedModule !== null;


    return {
        activeTab, backToModuleOverview, backToModules, completedChapters,
        courseProgress, getModuleProgress, isImmersive, isModuleUnlocked,
        navigateToChapter, progress, selectedChapter, selectedModule,
        setActiveTab, setSelectedModule, setShowKeyboardHelp, setShowSearch,
        showKeyboardHelp, showSearch, toggleChapterComplete, totalChapters,
    };
}
