import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { API_ENDPOINTS, apiRequest } from '../config/api';

/**
 * Autocomplete input for ticker search.
 * Dropdown is rendered via a React portal so it never overlaps sibling elements.
 *
 * Props:
 *   value    - controlled input value (string)
 *   onChange - called with new string on every keystroke
 *   onSelect - called with chosen symbol when user picks a suggestion
 *   market   - exchange filter passed to the search API (e.g. 'us', 'hk', 'cn')
 *   placeholder, className - forwarded to <input>
 */
const TickerAutocompleteInput = ({ value, onChange, onSelect, market = 'us', placeholder, className }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [suppressDropdown, setSuppressDropdown] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
    const [lastInputMethod, setLastInputMethod] = useState(null);

    const inputRef = useRef(null);
    const debounceRef = useRef(null);
    const id = useId();
    const listboxId = `${id}-listbox`;
    const activeOptionId = highlightedIndex >= 0 ? `${id}-option-${highlightedIndex}` : undefined;

    const showDropdown = isFocused && value.trim().length >= 2 && !suppressDropdown;

    // Recalculate portal position whenever dropdown opens or window resizes/scrolls
    const updatePos = useCallback(() => {
        if (!inputRef.current) return;
        const rect = inputRef.current.getBoundingClientRect();
        setDropdownPos({
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
            width: rect.width,
        });
    }, []);

    useEffect(() => {
        if (showDropdown) updatePos();
    }, [showDropdown, updatePos]);

    useEffect(() => {
        if (!showDropdown) return;
        window.addEventListener('scroll', updatePos, true);
        window.addEventListener('resize', updatePos);
        return () => {
            window.removeEventListener('scroll', updatePos, true);
            window.removeEventListener('resize', updatePos);
        };
    }, [showDropdown, updatePos]);

    // Fetch suggestions from Finnhub on every debounced keystroke
    useEffect(() => {
        const q = value.trim();
        if (q.length < 2) {
            setSuggestions([]);
            setIsLoading(false);
            return;
        }

        clearTimeout(debounceRef.current);
        setIsLoading(true);
        setHighlightedIndex(-1);
        setLastInputMethod(null);

        debounceRef.current = setTimeout(async () => {
            try {
                const data = await apiRequest(API_ENDPOINTS.SEARCH_SYMBOLS(q, market));
                setSuggestions(Array.isArray(data) ? data.slice(0, 8) : []);
            } catch (_) {
                setSuggestions([]);
            } finally {
                setIsLoading(false);
            }
        }, 400);

        return () => clearTimeout(debounceRef.current);
    }, [value, market]);

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

    const dropdown = showDropdown && ReactDOM.createPortal(
        <ul
            id={listboxId}
            role="listbox"
            onMouseLeave={() => { setHighlightedIndex(-1); setLastInputMethod(null); }}
            style={{ position: 'absolute', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
            className="rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden dark:bg-gray-800 dark:border-gray-600"
        >
            {isLoading && (
                <li className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-2">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Searching...
                </li>
            )}
            {!isLoading && suggestions.length === 0 && (
                <li role="option" aria-selected="false" className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                    No results for &ldquo;{value}&rdquo;
                </li>
            )}
            {!isLoading && suggestions.map((s, idx) => (
                <li
                    key={s.symbol}
                    id={`${id}-option-${idx}`}
                    role="option"
                    aria-selected={idx === highlightedIndex}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(s.symbol); }}
                    onMouseEnter={() => { setLastInputMethod('mouse'); setHighlightedIndex(idx); }}
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
            ))}
            {!isLoading && suggestions.length > 0 && (
                <li className="px-4 py-1.5 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700 flex items-center gap-1">
                    {lastInputMethod === 'keyboard'
                        ? <><span>↑↓</span> to navigate · <span>↵</span> searches highlighted</>
                        : <><span>↵</span> searches typed · click searches highlighted</>}
                </li>
            )}
        </ul>,
        document.body
    );

    return (
        <>
            <input
                ref={inputRef}
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
            {dropdown}
        </>
    );
};

export default TickerAutocompleteInput;
