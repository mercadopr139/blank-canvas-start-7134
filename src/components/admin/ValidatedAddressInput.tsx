import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { NominatimResult, nominatimToStructured, StructuredAddress } from "@/lib/validators";

interface Props {
  /** Full display address string */
  value: string;
  /** Called with structured address when user selects a result */
  onSelect: (addr: StructuredAddress) => void;
  /** Called with raw text (for cases where user types without selecting) */
  onChange?: (raw: string) => void;
  className?: string;
  placeholder?: string;
  /** If true, require a verified selection */
  requireVerified?: boolean;
}

export default function ValidatedAddressInput({
  value,
  onSelect,
  onChange,
  className,
  placeholder = "Start typing an address…",
  requireVerified = true,
}: Props) {
  const [inputValue, setInputValue] = useState(value || "");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [verified, setVerified] = useState(!!value);
  const [touched, setTouched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value || "");
    if (value) setVerified(true);
  }, [value]);

  const fetchSuggestions = useCallback((query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=us&limit=5&q=${encodeURIComponent(query)}`,
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

  const selectSuggestion = (s: NominatimResult) => {
    const structured = nominatimToStructured(s);
    setInputValue(structured.address);
    setVerified(true);
    setShowDropdown(false);
    onSelect(structured);
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

  const showError = requireVerified && touched && inputValue.trim() && !verified;

  return (
    <div ref={wrapperRef} className="relative space-y-1">
      <Input
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setVerified(false);
          setTouched(true);
          onChange?.(e.target.value);
          fetchSuggestions(e.target.value);
        }}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        onBlur={() => setTouched(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(className, showError && "border-red-500")}
      />
      {showError && (
        <p className="text-red-400 text-xs">Please select a verified address from the suggestions.</p>
      )}
      {showDropdown && (
        <ul className="absolute z-[200] mt-1 w-full rounded-md border border-white/10 bg-zinc-900 shadow-lg max-h-60 overflow-auto">
          {suggestions.map((s, i) => (
            <li
              key={s.place_id}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm text-white hover:bg-white/10",
                i === highlightedIndex && "bg-white/10"
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
