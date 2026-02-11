import React, { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ChildPrimaryAddressFieldProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

interface NominatimResult {
  display_name: string;
  place_id: number;
}

export default function ChildPrimaryAddressField({
  value,
  onChange,
  className,
}: ChildPrimaryAddressFieldProps) {
  const [inputValue, setInputValue] = useState(value ?? "");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback((query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&countrycodes=us&limit=5&q=${encodeURIComponent(query)}`,
          { headers: { "Accept-Language": "en" } }
        );
        const data: NominatimResult[] = await res.json();
        setSuggestions(data);
        setShowDropdown(data.length > 0);
        setHighlightedIndex(-1);
      } catch {
        setSuggestions([]);
      }
    }, 350);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSuggestion = (suggestion: NominatimResult) => {
    setInputValue(suggestion.display_name);
    onChange(suggestion.display_name);
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[highlightedIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange(e.target.value);
          fetchSuggestions(e.target.value);
        }}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        onKeyDown={handleKeyDown}
        placeholder="Start typing an address..."
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
      />
      {showDropdown && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border border-input bg-background shadow-lg max-h-60 overflow-auto">
          {suggestions.map((s, i) => (
            <li
              key={s.place_id}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                i === highlightedIndex && "bg-accent text-accent-foreground"
              )}
              onMouseDown={() => selectSuggestion(s)}
            >
              {s.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
