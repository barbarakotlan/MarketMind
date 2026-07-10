import React, { useRef } from 'react';
import { ShieldAlert, CheckCircle, Clock, Square } from 'lucide-react';
import useScrollProgress from './useScrollProgress';

// --- CHAPTER CONTENT COMPONENT ---
const ChapterContent = ({ chapter, isCompleted, onToggleComplete }) => {
    const contentRef = useRef(null);
    const scrollProgress = useScrollProgress(contentRef);
    const minutesLeft = Math.max(1, Math.round((chapter.estimatedMinutes || 20) * (1 - scrollProgress / 100)));

    return (
        <div className="relative">
            {/* Reading Progress Bar */}
            <div className="sticky top-0 z-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-6">
                <div 
                    className="h-full bg-blue-500 transition-all duration-150 ease-out"
                    style={{ width: `${scrollProgress}%` }}
                />
            </div>

            {/* Reading Stats */}
            <div className="flex items-center justify-between mb-6 text-sm">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>{chapter.estimatedMinutes || 20} min read</span>
                    {scrollProgress > 0 && (
                        <>
                            <span className="text-gray-300 dark:text-gray-600">•</span>
                            <span className="text-blue-600 font-medium">~{minutesLeft} min left</span>
                        </>
                    )}
                </div>
                <div className="text-gray-400 dark:text-gray-500 text-xs">
                    {Math.round(scrollProgress)}% read
                </div>
            </div>

            {/* Content */}
            <div 
                ref={contentRef}
                className="prose prose-lg max-w-none text-gray-900 dark:text-gray-100 max-h-[calc(100vh-300px)] overflow-y-auto pr-4"
                style={{ scrollbarWidth: 'thin' }}
            >
                {chapter.content.map((el, index) => {
                    switch (el.type) {
                        case 'paragraph':
                            return <p key={index} className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">{el.text}</p>;
                        case 'heading':
                            return <h3 key={index} className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4 flex items-center gap-2">{el.text}</h3>;
                        case 'list':
                            return (
                                <ul key={index} className="list-disc list-outside space-y-2 text-gray-600 dark:text-gray-300 ml-5 mb-6">
                                    {el.items.map((li, i) => (
                                        <li key={i} className="leading-relaxed">
                                            {li.split(':').length > 1 ? (
                                                <>
                                                    <span className="font-semibold text-gray-900 dark:text-white">{li.split(':')[0]}:</span>
                                                    {li.split(':').slice(1).join(':')}
                                                </>
                                            ) : li}
                                        </li>
                                    ))}
                                </ul>
                            );
                        case 'note':
                            return (
                                <div key={index} className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 p-4 my-6 rounded-r-lg">
                                    <div className="flex items-start gap-3">
                                        <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                        <p className="text-sm text-amber-800 dark:text-amber-200">{el.text}</p>
                                    </div>
                                </div>
                            );
                        default:
                            return null;
                    }
                })}
                
                {/* Spacer for FAB */}
                <div className="h-24" />
            </div>

            {/* Floating Action Button for Completion */}
            <div className="fixed bottom-8 right-8 z-50">
                <button
                    onClick={onToggleComplete}
                    className={`flex items-center gap-2 px-5 py-3 rounded-full shadow-lg transition-all transform hover:scale-105 ${
                        isCompleted 
                            ? 'bg-gray-100 text-green-600 border border-green-200 shadow-gray-200/50' 
                            : 'bg-blue-600 text-white shadow-blue-600/30 hover:bg-blue-700'
                    }`}
                >
                    {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    <span className="font-medium text-sm">
                        {isCompleted ? 'Done' : 'Complete'}
                    </span>
                    {!isCompleted && <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">M</span>}
                </button>
            </div>
        </div>
    );
};

export default ChapterContent;
