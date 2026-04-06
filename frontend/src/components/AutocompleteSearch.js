// components/AutocompleteSearch.js
import React, { useState, useEffect } from 'react';
import { SearchIcon } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api';

// Debounce hook
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

const AutocompleteSearch = ({ onSearch }) => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const debouncedQuery = useDebounce(query, 300);

    useEffect(() => {
        if (!debouncedQuery || debouncedQuery.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        const fetchSuggestions = async () => {
            try {
                const data = await apiRequest(API_ENDPOINTS.SEARCH_SYMBOLS(debouncedQuery));
                setSuggestions(data.slice(0, 8));
                setShowSuggestions(data.length > 0);
            } catch (err) {
                console.error('Autocomplete fetch error:', err);
                setSuggestions([]);
                setShowSuggestions(false);
            }
        };

        fetchSuggestions();
    }, [debouncedQuery]);

    const handleInputChange = (e) => {
        setQuery(e.target.value.toUpperCase());
    };

    const handleSuggestionClick = (suggestion) => {
        setQuery(suggestion.symbol);
        setShowSuggestions(false);
        if (onSearch) onSearch(suggestion.symbol);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (onSearch) onSearch(query);
    };

    return (
        <form onSubmit={handleSubmit} className="relative w-full">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                <SearchIcon className="w-6 h-6 text-mm-text-tertiary" />
            </div>
            <input
                type="text"
                value={query}
                onChange={handleInputChange}
                onFocus={() => query.length > 1 && suggestions.length && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Search symbol..."
                className="ui-input py-4 pl-12 pr-28 text-lg"
                autoComplete="off"
            />
            <button
                type="submit"
                className="ui-button-primary absolute right-0 top-0 h-full rounded-l-none rounded-r-control px-6 py-4"
            >
                Search
            </button>

            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 overflow-hidden rounded-card border border-mm-border bg-mm-surface shadow-elevated animate-fade-in">
                    <ul className="divide-y divide-mm-border">
                        {suggestions.map((s) => (
                            <li
                                key={s.symbol}
                                onMouseDown={() => handleSuggestionClick(s)}
                                className="cursor-pointer px-4 py-3 text-left hover:bg-mm-surface-subtle"
                            >
                                <span className="font-semibold text-mm-text-primary">{s.symbol}</span>
                                <span className="ml-3 text-mm-text-secondary">{s.name}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </form>
    );
};

export default AutocompleteSearch;
