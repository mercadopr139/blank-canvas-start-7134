import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Supporter {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface Props {
  label: string;
  required?: boolean;
  value: string;
  onChange: (name: string) => void;
  onSelect: (supporter: Supporter) => void;
  placeholder?: string;
}

const SupporterAutocomplete = ({ label, required, value, onChange, onSelect, placeholder }: Props) => {
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
        .select("id, name, email, phone")
        .ilike("name", `%${trimmed}%`)
        .limit(8);
      setSuggestions(data || []);
      setOpen((data?.length ?? 0) > 0);
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
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-zinc-900 border border-white/20 rounded-md shadow-lg max-h-48 overflow-y-auto">
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
        </ul>
      )}
    </div>
  );
};

export default SupporterAutocomplete;
export type { Supporter };
