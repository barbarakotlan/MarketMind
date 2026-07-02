import { useState, useEffect } from 'react';

// --- SCROLL PROGRESS HOOK ---
const useScrollProgress = (ref) => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const handleScroll = () => {
            const scrollTop = element.scrollTop;
            const scrollHeight = element.scrollHeight - element.clientHeight;
            const scrollProgress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
            setProgress(Math.min(100, Math.max(0, scrollProgress)));
        };

        element.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();

        return () => element.removeEventListener('scroll', handleScroll);
    }, [ref]);

    return progress;
};

export default useScrollProgress;
