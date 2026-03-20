import React, { useState, useRef, useEffect, useId } from 'react';
import STATIC_TICKERS from '../data/tickers.json';
import { API_ENDPOINTS, apiRequest } from '../config/api';

/**
 * Drop-in autocomplete input for ticker search.
 * Renders as a fragment (input + dropdown) so it fits inside any parent
 * div with position:relative — the existing search icon and layout are preserved.
 *
 * Props:
 *   value        - controlled input value (string)
 *   onChange     - called with the new string on every keystroke
 *   onSelect     - called with the chosen symbol when user picks a suggestion
 *   placeholder  - input placeholder text
 *   className    - className forwarded to the <input>
 */
const TickerAutocompleteInput = ({ value, onChange, onSelect, placeholder, className }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [isFocused, setIsFocused] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [suppressDropdown, setSuppressDropdown] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const debounceRef = useRef(null);
    const [lastInputMethod, setLastInputMethod] = useState(null); // 'keyboard' | 'mouse'
    const id = useId();

    // Show the dropdown whenever the input is focused and has 2+ characters
    const showDropdown = isFocused && value.trim().length >= 2 && !suppressDropdown;

    const listboxId = `${id}-listbox`;
    const activeOptionId = highlightedIndex >= 0 ? `${id}-option-${highlightedIndex}` : undefined;

    useEffect(() => {
        const q = value.trim().toUpperCase();
        if (q.length < 2) {
            setSuggestions([]);
            setIsLoadingMore(false);
            return;
        }

        const sortByRelevance = (a, b) => {
            const score = (t) => {
                const s = t.symbol.toUpperCase();
                if (s === q) return 0;
                if (s.startsWith(q)) return 1;
                return 2;
            };
            return score(a) - score(b);
        };

        const staticMatches = STATIC_TICKERS.filter(t =>
            t.symbol.startsWith(q) || t.name.toUpperCase().startsWith(q)
        ).sort(sortByRelevance).slice(0, 8);

        setHighlightedIndex(-1);
        setLastInputMethod(null);
        setSuggestions(staticMatches);

        // Tier 2: fall back to Finnhub if static list is sparse
        if (staticMatches.length < 3) {
            clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(async () => {
                // Only show spinner after debounce settles, not during typing
                setIsLoadingMore(true);
                try {
                    const data = await apiRequest(API_ENDPOINTS.SEARCH_SYMBOLS(value));
                    if (data.length > 0) {
                        const staticSymbols = new Set(staticMatches.map(t => t.symbol));
                        const apiOnly = data.filter(t => !staticSymbols.has(t.symbol));
                        const merged = [...staticMatches, ...apiOnly].sort(sortByRelevance).slice(0, 8);
                        setSuggestions(merged);
                    }
                } catch (_) {}
                setIsLoadingMore(false);
            }, 350);
        } else {
            setIsLoadingMore(false);
        }

        return () => clearTimeout(debounceRef.current);
    }, [value]);

    const handleSelect = (symbol) => {
        setHighlightedIndex(-1);
        setLastInputMethod(null);
        setIsFocused(false);
        if (onSelect) onSelect(symbol);
    };

    const handleKeyDown = (e) => {
        if (!showDropdown || suggestions.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setLastInputMethod('keyboard');
            setHighlightedIndex(i => Math.min(i + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setLastInputMethod('keyboard');
            setHighlightedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && lastInputMethod === 'keyboard' && highlightedIndex >= 0) {
            e.preventDefault();
            handleSelect(suggestions[highlightedIndex].symbol);
        } else if (e.key === 'Enter') {
            setIsFocused(false);
        } else if (e.key === 'Escape') {
            setSuppressDropdown(true);
        }
    };

    const hintText = lastInputMethod === 'keyboard'
        ? <><span>↑↓</span> to navigate · <span>↵</span> searches highlighted</>
        : <><span>↵</span> searches typed · click searches highlighted</>;

    return (
        <>
            <input
                type="text"
                role="combobox"
                aria-expanded={showDropdown}
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-activedescendant={activeOptionId}
                value={value}
                onChange={(e) => { setSuppressDropdown(false); setIsFocused(true); onChange(e.target.value.toUpperCase()); }}
                onFocus={() => { setIsFocused(true); setHighlightedIndex(-1); setSuppressDropdown(false); setLastInputMethod(null); }}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={className}
                autoComplete="off"
            />
            {showDropdown && (
                <ul
                    id={listboxId}
                    role="listbox"
                    onMouseLeave={() => { setHighlightedIndex(-1); setLastInputMethod(null); }}
                    className="absolute top-full left-0 right-0 z-20 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden"
                >
                    {suggestions.length > 0 ? (
                        suggestions.map((s, idx) => (
                            <li
                                key={s.symbol}
                                id={`${id}-option-${idx}`}
                                role="option"
                                aria-selected={idx === highlightedIndex}
                                onMouseDown={(e) => { e.preventDefault(); handleSelect(s.symbol); }}
                                onMouseEnter={() => { setLastInputMethod('mouse'); setHighlightedIndex(idx); }}
                                onMouseMove={() => { if (lastInputMethod !== 'mouse') { setLastInputMethod('mouse'); setHighlightedIndex(idx); } }}
                                className={`px-4 py-2.5 cursor-pointer flex items-center gap-3 border-l-2 ${
                                    idx === highlightedIndex && lastInputMethod === 'keyboard'
                                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500'
                                        : idx === highlightedIndex
                                        ? 'bg-gray-100 dark:bg-gray-700 border-transparent'
                                        : 'border-transparent'
                                }`}
                            >
                                <span className="font-bold text-gray-900 dark:text-white text-sm">{s.symbol}</span>
                                <span className="text-gray-500 dark:text-gray-400 text-sm truncate">{s.name}</span>
                            </li>
                        ))
                    ) : !isLoadingMore ? (
                        <li role="option" aria-selected="false" className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                            No results found for &ldquo;{value}&rdquo;
                        </li>
                    ) : null}
                    {isLoadingMore && (
                        <li className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-2">
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            Searching more results...
                        </li>
                    )}
                    <li className="px-4 py-1.5 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700 flex items-center gap-1">
                        {hintText}
                    </li>
                </ul>
            )}
        </>
    );
};

export default TickerAutocompleteInput;
