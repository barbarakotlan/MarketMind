import React, { useState, useRef, useEffect } from 'react';
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
    const debounceRef = useRef(null);

    // Show the dropdown whenever the input is focused and has 2+ characters
    const showDropdown = isFocused && value.trim().length >= 2;

    useEffect(() => {
        const q = value.trim().toUpperCase();
        if (q.length < 2) {
            setSuggestions([]);
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

        setSuggestions(staticMatches);

        // Tier 2: fall back to Finnhub if static list is sparse
        if (staticMatches.length < 3) {
            clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(async () => {
                try {
                    const data = await apiRequest(API_ENDPOINTS.SEARCH_SYMBOLS(value));
                    if (data.length > 0) {
                        const staticSymbols = new Set(staticMatches.map(t => t.symbol));
                        const apiOnly = data.filter(t => !staticSymbols.has(t.symbol));
                        const merged = [...staticMatches, ...apiOnly].sort(sortByRelevance).slice(0, 8);
                        setSuggestions(merged);
                    }
                } catch (_) {}
            }, 350);
        }

        return () => clearTimeout(debounceRef.current);
    }, [value]);

    const handleSelect = (symbol) => {
        setIsFocused(false);
        setSuggestions([]);
        if (onSelect) onSelect(symbol);
    };

    return (
        <>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value.toUpperCase())}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                placeholder={placeholder}
                className={className}
                autoComplete="off"
            />
            {showDropdown && (
                <ul className="absolute top-full left-0 right-0 z-20 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
                    {suggestions.length > 0 ? (
                        suggestions.map((s) => (
                            <li
                                key={s.symbol}
                                onMouseDown={() => handleSelect(s.symbol)}
                                className="px-4 py-2.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                            >
                                <span className="font-bold text-gray-900 dark:text-white text-sm">{s.symbol}</span>
                                <span className="text-gray-500 dark:text-gray-400 text-sm truncate">{s.name}</span>
                            </li>
                        ))
                    ) : (
                        <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                            No results found for &ldquo;{value}&rdquo;
                        </li>
                    )}
                </ul>
            )}
        </>
    );
};

export default TickerAutocompleteInput;
