import { useState, useEffect } from 'react';

/**
 * A hook that returns a debounced version of the provided value.
 * Use this for debouncing input values or other states.
 * 
 * @param value The value to be debounced
 * @param delay The wait time in milliseconds
 */
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
}
