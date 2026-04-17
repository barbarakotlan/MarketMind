// components/AutocompleteSearch.js
import React, { useState, useEffect } from 'react';
import { SearchIcon } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api';

/**
 * Custom hook to debounce rapid state changes (e.g., fast typing).
 * This prevents excessive API calls by delaying the state update until 
 * a specified period of inactivity has elapsed.
 *
 * @param {any} value - The state variable to be debounced.
 * @param {number} delay - The debounce delay in milliseconds.
 * @returns {any} The debounced value, which updates only after the specified delay.
 */
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        // Set a timeout to update the debounced value after the delay
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        
        // Cleanup function clears the timeout if the value or delay changes
        // before the delay period finishes. This resets the timer.
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

/**
 * AutocompleteSearch Component
 * 
 * Provides an input field with real-time, debounced API autosuggestion functionality 
 * for financial symbols/tickers. It dynamically displays a dropdown of results based on user input.
 *
 * @component
 * @param {Object} props - React props.
 * @param {Function} props.onSearch - Callback function invoked when a user submits a search or clicks a suggestion.
 * @returns {JSX.Element} A controlled form containing a search input and a dynamic dropdown menu.
 */
const AutocompleteSearch = ({ onSearch }) => {
    // Current raw input value controlled by the user typing
    const [query, setQuery] = useState('');
    // Array holding the API-fetched symbol suggestions
    const [suggestions, setSuggestions] = useState([]);
    // Boolean flag to dictate dropdown visibility
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    // Apply debounce hook to avoid spamming the backend parser logic
    const debouncedQuery = useDebounce(query, 300);

    // Effect mapping to the debounced state to trigger actual API requests
    useEffect(() => {
        // If the input is empty or too short, reset state aggressively and bail
        if (!debouncedQuery || debouncedQuery.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        /**
         * Asynchronously request partial matches from the backend endpoint
         * configured for symbol lookup processing.
         */
        const fetchSuggestions = async () => {
            try {
                // Submit authenticated request to the custom search endpoint
                const data = await apiRequest(API_ENDPOINTS.SEARCH_SYMBOLS(debouncedQuery));
                
                // Truncate to maximum 8 responses to avoid overwhelming the view height
                setSuggestions(data.slice(0, 8));
                setShowSuggestions(data.length > 0);
            } catch (err) {
                // Silently reset UI state on lookup failures while logging internals for developer context
                console.error('Autocomplete fetch error:', err);
                setSuggestions([]);
                setShowSuggestions(false);
            }
        };

        fetchSuggestions();
    }, [debouncedQuery]);

    // Input Change Handler: normalizes input to strictly upper-case ticker symbols
    const handleInputChange = (e) => {
        setQuery(e.target.value.toUpperCase());
    };

    // Auto-complete suggestion selection handler
    const handleSuggestionClick = (suggestion) => {
        // Automatically populate input with chosen selection
        setQuery(suggestion.symbol);
        setShowSuggestions(false); // Snap the dropdown shut
        
        // Trigger generic upstream handler to execute full navigation or state loading
        if (onSearch) onSearch(suggestion.symbol);
    };

    // Normal form submission handler (e.g. from pressing physical 'Enter' key)
    const handleSubmit = (e) => {
        e.preventDefault(); // Suspend default HTML form redirect behaviors
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
                // Toggle display state open on re-focusing the element providing context remains valid
                onFocus={() => query.length > 1 && suggestions.length && setShowSuggestions(true)}
                // Timeout mitigates premature closing race condition where blur fires before the onMouseDown registers
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Search symbol..."
                className="ui-input py-4 pl-12 pr-28 text-lg"
                autoComplete="off" // Prevent native browser autocomplete hijacking our dropdown overlap
            />
            <button
                type="submit"
                className="ui-button-primary absolute right-0 top-0 h-full rounded-l-none rounded-r-control px-6 py-4"
            >
                Search
            </button>

            {/* Conditionally render pop-over using safe checks */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 overflow-hidden rounded-card border border-mm-border bg-mm-surface shadow-elevated animate-fade-in">
                    <ul className="divide-y divide-mm-border">
                        {suggestions.map((s) => (
                            <li
                                key={s.symbol}
                                // Binding interaction to mousedown rather than click bypasses the blur cancellation window
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

