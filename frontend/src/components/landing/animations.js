// Shared framer-motion animation variants for the landing page sections.

export const blurUp = {
    hidden: { opacity: 0, filter: 'blur(10px)', y: 18 },
    show: {
        opacity: 1,
        filter: 'blur(0px)',
        y: 0,
        transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
    },
};

export const blurIn = {
    hidden: { opacity: 0, filter: 'blur(12px)', scale: 0.97 },
    show: {
        opacity: 1,
        filter: 'blur(0px)',
        scale: 1,
        transition: { duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] },
    },
};

export const stagger = (delay = 0.08) => ({
    hidden: {},
    show: { transition: { staggerChildren: delay, delayChildren: 0.05 } },
});

export const viewportOnce = { once: true, margin: '-60px' };
