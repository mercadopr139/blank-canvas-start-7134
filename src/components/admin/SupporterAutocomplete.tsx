import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Supporter {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address?: string | null;
  supporter_category?: string | null;
  primary_revenue_stream?: string | null;
  status?: string | null;
  relationship_owner?: string | null;
  story?: string | null;
}

interface Props {
  label: string;
  required?: boolean;
  value: string;
  onChange: (name: string) => void;
  onSelect: (supporter: Supporter) => void;
  onCreateNew?: () => void;
  placeholder?: string;
}

const SupporterAutocomplete = ({ label, required, value, onChange, onSelect, onCreateNew, placeholder }: Props) => {
  const [suggestions, setSuggestions] = useState<Supporter[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("supporters")
        .select("id, name, email, phone, address, supporter_category, primary_revenue_stream, status, relationship_owner, story")
        .ilike("name", `%${trimmed}%`)
        .limit(8);
      const sorted = (data || []).sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(trimmed.toLowerCase());
        const bStarts = b.name.toLowerCase().startsWith(trimmed.toLowerCase());
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.name.localeCompare(b.name);
      });
      setSuggestions(sorted);
      setOpen(true);
    }, 200);
    return () => clearTimeout(timeout);
  }, [value]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="space-y-1 relative" ref={containerRef}>
      <Label className="text-white/70">{label}{required ? " *" : ""}</Label>
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        placeholder={placeholder}
        className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-zinc-900 border border-white/20 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {onCreateNew && (
            <li
              className="px-3 py-2 cursor-pointer hover:bg-white/10 text-sm border-b border-white/10"
              onMouseDown={(e) => {
                e.preventDefault();
                onCreateNew();
                setOpen(false);
              }}
            >
              <span className="text-green-400 font-medium">+ Create New Supporter</span>
            </li>
          )}
          {suggestions.map((s) => (
            <li
              key={s.id}
              className="px-3 py-2 cursor-pointer hover:bg-white/10 text-sm"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(s);
                onChange(s.name);
                setOpen(false);
              }}
            >
              <span className="text-white font-medium">{s.name}</span>
              {s.email && <span className="text-white/50 ml-2 text-xs">{s.email}</span>}
              {s.phone && <span className="text-white/40 ml-2 text-xs">{s.phone}</span>}
            </li>
          ))}
          {suggestions.length === 0 && !onCreateNew && (
            <li className="px-3 py-2 text-sm text-white/40">No matches</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default SupporterAutocomplete;
export type { Supporter };
