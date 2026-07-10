import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { learningModules, getTotalChapters } from '../../data/content';

// --- CHAPTER SEARCH COMPONENT ---
const ChapterSearch = ({ onSelectResult, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const searchResults = [];
        const lowerQuery = query.toLowerCase();

        learningModules.forEach(module => {
            module.chapters.forEach(chapter => {
                const matchTitle = chapter.title.toLowerCase().includes(lowerQuery);
                const matchContent = chapter.content.some(el => 
                    el.text?.toLowerCase().includes(lowerQuery) ||
                    el.items?.some(item => item.toLowerCase().includes(lowerQuery))
                );

                if (matchTitle || matchContent) {
                    searchResults.push({
                        module,
                        chapter,
                        type: matchTitle ? 'title' : 'content'
                    });
                }
            });
        });

        setResults(searchResults.slice(0, 8));
    }, [query]);

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="ui-panel-elevated w-full max-w-2xl mx-4 overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
                    <Search className="w-5 h-5 text-gray-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search chapters, topics, or keywords..."
                        className="flex-1 bg-transparent text-lg outline-none text-mm-text-primary placeholder:text-mm-text-tertiary"
                    />
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
                
                <div className="max-h-96 overflow-y-auto">
                    {results.length > 0 ? (
                        results.map(({ module, chapter, type }, idx) => (
                            <button
                                key={`${module.id}-${chapter.id}-${idx}`}
                                onClick={() => {
                                    onSelectResult(module, chapter);
                                    onClose();
                                }}
                                className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors"
                            >
                                <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                                    <span>{module.title.replace(/Module \d+: /, '')}</span>
                                    {type === 'title' && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">Title Match</span>}
                                </div>
                                <h4 className="font-semibold text-gray-900 dark:text-white">{chapter.title}</h4>
                            </button>
                        ))
                    ) : query.trim() ? (
                        <div className="p-8 text-center text-gray-500">
                            No results found for "{query}"
                        </div>
                    ) : (
                        <div className="p-8 text-center text-gray-400">
                            Type to search across all {getTotalChapters()} chapters...
                        </div>
                    )}
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 flex items-center justify-between">
                    <span>{results.length} results</span>
                    <div className="flex items-center gap-1">
                        <span>Press</span>
                        <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border">ESC</kbd>
                        <span>to close</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChapterSearch;
