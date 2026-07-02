import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, Brain, Briefcase } from 'lucide-react';

const BINARY_CHARS = ['0', '1', '░', '▒', '▓'];

const STEPS = [
    {
        num: '1',
        icon: Search,
        title: 'Search Any Asset',
        terminal: [
            { text: 'marketmind search AAPL', prefix: '$', color: 'text-gray-300' },
            { text: 'connecting to data feeds...', color: 'text-gray-500', dim: true, think: 200 },
            { text: '[OK] price data received (14ms)', color: 'text-emerald-400' },
            { text: '[OK] fundamentals loaded', color: 'text-emerald-400' },
            { text: '[OK] 24 recent news articles', color: 'text-emerald-400' },
            { text: '┌─ AAPL ─ Apple Inc. ─────┐', color: 'text-blue-400' },
            { text: '│ Price: $182.52 ▲ 1.24%  │', color: 'text-gray-300' },
            { text: '│ Market Cap: $2.84T      │', color: 'text-gray-300' },
            { text: '│ P/E: 28.4 | EPS: $6.43  │', color: 'text-gray-300' },
            { text: '└─────────────────────────┘', color: 'text-blue-400' },
        ],
        body: 'Enter a ticker to instantly surface price data, company overview, analyst ratings, key metrics, and recent news.'
    },
    {
        num: '2',
        icon: Brain,
        title: 'Analyze the AI Forecast',
        terminal: [
            { text: 'marketmind predict AAPL --sessions 7', prefix: '$', color: 'text-gray-300' },
            { text: 'loading forecasting stack...', color: 'text-gray-500', dim: true, think: 150 },
            { text: '▶ AutoARIMA ...............', color: 'text-purple-400', think: 180 },
            { text: '  accuracy: 84.6% ✓', color: 'text-gray-400' },
            { text: '▶ Random Forest ...........', color: 'text-purple-400', think: 300 },
            { text: '  accuracy: 87.3% ✓', color: 'text-gray-400' },
            { text: '▶ XGBoost .................', color: 'text-purple-400', think: 250 },
            { text: '  accuracy: 89.1% ✓', color: 'text-gray-400' },
            { text: '▶ Linear Regression .......', color: 'text-purple-400', think: 200 },
            { text: '  accuracy: 82.7% ✓', color: 'text-gray-400' },
            { text: '', color: 'text-gray-400' },
            { text: '╔═ 7-SESSION FORECAST ═════╗', color: 'text-emerald-500' },
            { text: '║  Direction: BULLISH ▲    ║', color: 'text-emerald-400' },
            { text: '║  Confidence: 84.2%       ║', color: 'text-emerald-400' },
            { text: '║  Target: $190.12 (+4.2%) ║', color: 'text-emerald-400' },
            { text: '╚══════════════════════════╝', color: 'text-emerald-500' },
        ],
        body: 'See a 7 trading-session directional prediction with per-model breakdown, confidence scoring, and full backtesting results.'
    },
    {
        num: '3',
        icon: Briefcase,
        title: 'Trade Risk-Free',
        terminal: [
            { text: 'marketmind trade buy AAPL 100', prefix: '$', color: 'text-gray-300' },
            { text: 'paper trading account: $100,000.00', color: 'text-gray-500', dim: true },
            { text: 'validating order...', color: 'text-gray-500', dim: true, think: 150 },
            { text: '[OK] Order filled @ $182.50', color: 'text-emerald-400' },
            { text: '[OK] 100 shares added to portfolio', color: 'text-emerald-400' },
            { text: ' ', color: 'text-gray-400' },
            { text: '┌─ PORTFOLIO UPDATE ──────┐', color: 'text-blue-400' },
            { text: '│ Position: AAPL x100     │', color: 'text-gray-300' },
            { text: '│ Avg Cost: $182.50       │', color: 'text-gray-300' },
            { text: '│ Market Value: $18,252   │', color: 'text-gray-300' },
            { text: '│ Day P&L: +$124.00 ▲     │', color: 'text-emerald-400' },
            { text: '│ Total P&L: +$1,247.00 ▲ │', color: 'text-emerald-400' },
            { text: '└─────────────────────────┘', color: 'text-blue-400' },
        ],
        body: 'Place paper trades to test your thesis. Track your portfolio P&L with professional performance analytics.'
    },
];

// ── Step terminals with orchestrated typing ──────────────────────────────────
function StepTerminals() {
    const [activeStep, setActiveStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState(new Set());
    const [hasStarted, setHasStarted] = useState(false);

    useEffect(() => {
        // Start sequence when component enters viewport
        const timer = setTimeout(() => {
            setHasStarted(true);
            setActiveStep(0);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const handleStepComplete = (stepIndex) => {
        setCompletedSteps(prev => new Set([...prev, stepIndex]));
        if (stepIndex < STEPS.length - 1) {
            setTimeout(() => {
                setActiveStep(stepIndex + 1);
            }, 300);
        }
    };

    return (
        <div className="relative">
            <div className="grid md:grid-cols-3 gap-6 relative">
                {STEPS.map(({ num, icon: Icon, title, terminal, body }, index) => {
                    const isActive = activeStep === index;
                    const isCompleted = completedSteps.has(index);
                    const showTerminal = isActive || isCompleted;

                    return (
                        <motion.div
                            key={num}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.15, type: 'spring', stiffness: 100 }}
                            className="relative"
                        >
                            {/* Step indicator with pulse */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all duration-500 ${
                                    isCompleted
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : isActive
                                            ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30'
                                            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400'
                                }`}>
                                    {isActive && (
                                        <span className="absolute inset-0 rounded-xl bg-blue-500 animate-ping opacity-20" />
                                    )}
                                    {isCompleted ? (
                                        <motion.span 
                                            initial={{ scale: 0 }} 
                                            animate={{ scale: 1 }} 
                                            className="text-lg"
                                        >
                                            ✓
                                        </motion.span>
                                    ) : (
                                        <Icon className="w-5 h-5" />
                                    )}
                                </div>
                                <div>
                                    <span className="text-xs font-mono text-gray-500">step_{num}.sh</span>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
                                </div>
                            </div>

                            {/* Terminal window with CRT effect */}
                            <div className={`relative bg-gray-950 rounded-xl overflow-hidden border transition-all duration-500 ${
                                isActive
                                    ? 'border-blue-500/60 shadow-2xl shadow-blue-500/20 scale-[1.02]'
                                    : isCompleted
                                        ? 'border-emerald-500/40 shadow-lg'
                                        : 'border-gray-800/60 opacity-80'
                            }`}>
                                {/* CRT scanlines overlay */}
                                <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                                    style={{
                                        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)'
                                    }}
                                />
                                
                                {/* Subtle glow when active */}
                                {isActive && (
                                    <div className="absolute inset-0 bg-blue-500/5 pointer-events-none" />
                                )}

                                {/* Terminal header */}
                                <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800">
                                    <div className="flex gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-red-500/90" />
                                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/90" />
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/90" />
                                    </div>
                                    <span className="text-[10px] text-gray-600 font-mono ml-2 truncate">
                                        user@marketmind:~/{num === '1' ? 'search' : num === '2' ? 'predict' : 'trade'}
                                    </span>
                                </div>

                                {/* Terminal content */}
                                <div className="p-4 h-40 overflow-hidden relative">
                                    {hasStarted && showTerminal ? (
                                        <TerminalTyper
                                            lines={terminal}
                                            isActive={isActive}
                                            onComplete={() => handleStepComplete(index)}
                                        />
                                    ) : (
                                        <div className="text-gray-700 font-mono text-xs flex items-center h-full justify-center">
                                            <span className="animate-pulse">_</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Description */}
                            <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="mt-3 text-sm text-gray-500 dark:text-gray-400 leading-relaxed"
                            >
                                {body}
                            </motion.p>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Terminal typewriter component with binary decode for output only ─────────
function TerminalTyper({ lines, isActive, onComplete }) {
    const [completedLines, setCompletedLines] = useState([]);
    const [currentLineIndex, setCurrentLineIndex] = useState(0);
    const [currentChar, setCurrentChar] = useState(0);
    const [decodedText, setDecodedText] = useState('');
    const [mode, setMode] = useState('idle'); // 'idle' | 'typing' | 'thinking' | 'decoding' | 'done'
    const [showCursor, setShowCursor] = useState(true);
    const scrollRef = useRef(null);
    const processingRef = useRef(false);

    // Auto-scroll to follow content
    useEffect(() => {
        if (scrollRef.current && mode !== 'done') {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [completedLines, currentChar, decodedText, mode]);

    // Autoscroll up/down after completion
    useEffect(() => {
        if (mode !== 'done' || !scrollRef.current) return;
        
        const container = scrollRef.current;
        const maxScroll = container.scrollHeight - container.clientHeight;
        if (maxScroll <= 0) return;

        let direction = 1;
        let scrollPos = maxScroll;
        
        const autoScroll = setInterval(() => {
            scrollPos += direction * 0.5;
            if (scrollPos >= maxScroll) {
                scrollPos = maxScroll;
                direction = -1;
            } else if (scrollPos <= 0) {
                scrollPos = 0;
                direction = 1;
            }
            container.scrollTop = scrollPos;
        }, 50);

        return () => clearInterval(autoScroll);
    }, [mode]);

    // Start animation when active
    useEffect(() => {
        if (!isActive || mode !== 'idle' || completedLines.length > 0) return;
        
        const startTimer = setTimeout(() => {
            const firstLine = lines[0];
            processingRef.current = false;
            if (firstLine.prefix) {
                setMode('typing');
            } else {
                setMode('decoding');
            }
        }, 150);
        
        return () => clearTimeout(startTimer);
    }, [isActive, mode, completedLines.length, lines]);

    // Handle typing mode
    useEffect(() => {
        if (mode !== 'typing' || currentLineIndex >= lines.length || processingRef.current) return;

        const line = lines[currentLineIndex];
        
        if (currentChar < line.text.length) {
            const timer = setTimeout(() => {
                setCurrentChar(prev => prev + 1);
            }, 12);
            return () => clearTimeout(timer);
        } else {
            // Finished typing this command
            processingRef.current = true;
            setCompletedLines(prev => [...prev, { ...line, displayText: line.text }]);
            setCurrentChar(0);
            
            const nextLine = lines[currentLineIndex + 1];
            if (!nextLine) {
                setMode('done');
                onComplete?.();
                return;
            }
            
            setCurrentLineIndex(prev => prev + 1);
            processingRef.current = false;
            
            if (nextLine.think) {
                setMode('thinking');
                setTimeout(() => {
                    setMode('decoding');
                }, nextLine.think);
            } else {
                setMode('decoding');
            }
        }
    }, [mode, currentChar, currentLineIndex, lines, onComplete]);

    // Handle decoding mode
    useEffect(() => {
        if (mode !== 'decoding' || currentLineIndex >= lines.length || processingRef.current) return;

        processingRef.current = true;
        const line = lines[currentLineIndex];
        
        // Skip empty lines
        if (!line.text || line.text.trim() === '') {
            setCompletedLines(prev => [...prev, { ...line, displayText: ' ' }]);
            setDecodedText('');
            processingRef.current = false;
            
            const nextLine = lines[currentLineIndex + 1];
            if (!nextLine) {
                setMode('done');
                onComplete?.();
                return;
            }
            
            setCurrentLineIndex(prev => prev + 1);
            
            if (nextLine.prefix) {
                setMode('typing');
            } else if (nextLine.think) {
                setMode('thinking');
                setTimeout(() => setMode('decoding'), nextLine.think);
            } else {
                setMode('decoding');
            }
            return;
        }

        const text = line.text;
        const chars = text.split('');
        
        let fillIndex = 0;
        let decodeIndex = 0;
        let isCancelled = false;
        
        // Phase 1: Fill with binary
        const fillInterval = setInterval(() => {
            if (isCancelled) return;
            
            if (fillIndex > chars.length) {
                clearInterval(fillInterval);
                // Phase 2: Decode to text
                const decodeInterval = setInterval(() => {
                    if (isCancelled) {
                        clearInterval(decodeInterval);
                        return;
                    }
                    
                    if (decodeIndex > chars.length) {
                        clearInterval(decodeInterval);
                        // Line complete
                        setCompletedLines(prev => [...prev, { ...line, displayText: text }]);
                        setDecodedText('');
                        processingRef.current = false;
                        
                        const nextLine = lines[currentLineIndex + 1];
                        if (!nextLine) {
                            setMode('done');
                            onComplete?.();
                            return;
                        }
                        
                        setCurrentLineIndex(prev => prev + 1);
                        
                        if (nextLine.prefix) {
                            setMode('typing');
                        } else if (nextLine.think) {
                            setMode('thinking');
                            setTimeout(() => setMode('decoding'), nextLine.think);
                        } else {
                            setMode('decoding');
                        }
                        return;
                    }
                    
                    const partial = chars.map((char, i) => 
                        i < decodeIndex ? char : BINARY_CHARS[Math.floor(Math.random() * BINARY_CHARS.length)]
                    ).join('');
                    setDecodedText(partial);
                    decodeIndex++;
                }, 4);
                return;
            }
            
            const binary = chars.map((_, i) => 
                i < fillIndex ? BINARY_CHARS[Math.floor(Math.random() * BINARY_CHARS.length)] : ''
            ).join('');
            setDecodedText(binary);
            fillIndex++;
        }, 3);

        return () => {
            isCancelled = true;
            clearInterval(fillInterval);
        };
    }, [mode, currentLineIndex, lines, onComplete]);

    // Cursor blink
    useEffect(() => {
        const cursorInterval = setInterval(() => {
            setShowCursor(prev => !prev);
        }, 600);
        return () => clearInterval(cursorInterval);
    }, []);

    const currentLine = lines[currentLineIndex];
    const isTyping = mode === 'typing';
    const isDecoding = mode === 'decoding';

    return (
        <div ref={scrollRef} className="font-mono text-[11px] leading-5 h-full overflow-y-auto scrollbar-hide">
            {/* Completed lines */}
            {completedLines.map((line, i) => (
                <div key={i} className={`${line.color} ${line.dim ? 'opacity-60' : ''}`}>
                    {line.prefix && <span className="text-gray-600 mr-2">{line.prefix}</span>}
                    {line.displayText || line.text}
                </div>
            ))}
            
            {/* Current line being processed */}
            {currentLineIndex < lines.length && isActive && mode !== 'done' && (
                <div className={currentLine?.color}>
                    {currentLine?.prefix && (
                        <span className="text-gray-600 mr-2">{currentLine.prefix}</span>
                    )}
                    
                    {isTyping ? (
                        <>
                            {currentLine.text.slice(0, currentChar)}
                            <span 
                                className={`inline-block w-2 h-4 ml-0.5 align-middle transition-opacity duration-100 ${
                                    showCursor ? 'bg-emerald-500' : 'bg-transparent'
                                }`}
                            />
                        </>
                    ) : isDecoding ? (
                        <>
                            {decodedText}
                            <span 
                                className={`inline-block w-2 h-4 ml-0.5 align-middle transition-opacity duration-100 ${
                                    showCursor ? 'bg-emerald-500' : 'bg-transparent'
                                }`}
                            />
                        </>
                    ) : mode === 'thinking' ? (
                        <span className="inline-flex gap-0.5 ml-1">
                            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                    ) : null}
                </div>
            )}
        </div>
    );
}

export default StepTerminals;
