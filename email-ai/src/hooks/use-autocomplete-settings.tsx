import { useState, useEffect } from 'react';

export function useAutocompleteSettings() {
  const [isAutocompleteEnabled, setIsAutocompleteEnabled] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('email-autocomplete-enabled');
    if (saved !== null) {
      setIsAutocompleteEnabled(JSON.parse(saved));
    }
  }, []);

  // Save to localStorage when changed
  const toggleAutocomplete = (enabled: boolean) => {
    setIsAutocompleteEnabled(enabled);
    localStorage.setItem('email-autocomplete-enabled', JSON.stringify(enabled));
  };

  return {
    isAutocompleteEnabled,
    toggleAutocomplete,
  };
} 