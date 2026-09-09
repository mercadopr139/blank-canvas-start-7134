// The child's home address, confirmed as it is typed.
//
// Suggestions come from OpenStreetMap as the parent types. Picking one is the
// confirmation: it fixes the wording AND hands back the exact map pin, which
// the form saves with the registration — so a confirmed address never has to
// be geocoded afterwards. A parent can still type past the list; what they
// typed is then checked for shape before the form will submit (see
// src/lib/address.ts), and the field says so underneath in plain words.
import React, { useEffect, useRef, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { addressProblem } from "@/lib/address";

export interface AddressPin {
  lat: number;
  lng: number;
}

interface ChildPrimaryAddressFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** The pin for a picked suggestion, or null once the parent types past it. */
  onLocate?: (pin: AddressPin | null) => void;
  className?: string;
}

interface NominatimResult {
  display_name: string;
  place_id: number;
  lat: string;
  lon: string;
}

export default function ChildPrimaryAddressField({
  value,
  onChange,
  onLocate,
  className,
}: ChildPrimaryAddressFieldProps) {
  const [inputValue, setInputValue] = useState(value ?? "");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [confirmed, setConfirmed] = useState(false);
  const [touched, setTouched] = useState(false);
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
    const lat = Number(suggestion.lat);
    const lng = Number(suggestion.lon);
    const pin = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    setConfirmed(!!pin);
    onLocate?.(pin);
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

  const problem = touched ? addressProblem(inputValue) : null;

  return (
    <div ref={wrapperRef} className="relative">
      <input
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange(e.target.value);
          // Typing past a picked address un-confirms it; the pin no longer
          // matches the words.
          if (confirmed) {
            setConfirmed(false);
            onLocate?.(null);
          }
          fetchSuggestions(e.target.value);
        }}
        onBlur={() => setTouched(true)}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        onKeyDown={handleKeyDown}
        placeholder="Start typing your address, then pick it from the list"
        aria-invalid={!!problem}
        className={cn(
          "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          problem ? "border-destructive" : confirmed ? "border-emerald-500" : "border-input",
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

      {/* What the field thinks of what is in it, in the parent's words. */}
      {problem ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {problem}
        </p>
      ) : confirmed ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Address confirmed
        </p>
      ) : inputValue.trim().length > 0 ? (
        <p className="mt-1.5 text-sm text-muted-foreground">
          Pick your address from the list to confirm it.
        </p>
      ) : null}
    </div>
  );
}
