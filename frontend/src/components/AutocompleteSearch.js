// components/AutocompleteSearch.js
import React, { useState, useEffect } from 'react';
import { SearchIcon } from 'lucide-react';

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
                const res = await fetch(`http://127.0.0.1:5001/search-symbols?q=${debouncedQuery}`);
                const data = await res.json();
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
                <SearchIcon className="w-6 h-6 text-gray-400" />
            </div>
            <input
                type="text"
                value={query}
                onChange={handleInputChange}
                onFocus={() => query.length > 1 && suggestions.length && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Search symbol..."
                className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                autoComplete="off"
            />
            <button
                type="submit"
                className="absolute top-0 right-0 h-full px-6 py-4 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 transition-colors"
            >
                Search
            </button>

            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden animate-fade-in">
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {suggestions.map((s) => (
                            <li
                                key={s.symbol}
                                onMouseDown={() => handleSuggestionClick(s)}
                                className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                <span className="font-bold text-gray-900 dark:text-white">{s.symbol}</span>
                                <span className="ml-3 text-gray-600 dark:text-gray-400">{s.name}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </form>
    );
};

export default AutocompleteSearch;
