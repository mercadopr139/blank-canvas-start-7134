import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { digitsOnly, formatPhoneDisplay, toE164, e164ToDisplay } from "@/lib/validators";

interface Props {
  /** E.164 value from DB (e.g. +16097804475) */
  value: string;
  /** Called with E.164 string or "" */
  onChange: (e164: string) => void;
  className?: string;
  placeholder?: string;
}

export default function ValidatedPhoneInput({ value, onChange, className, placeholder = "(609) 780-4475" }: Props) {
  const [display, setDisplay] = useState(() => e164ToDisplay(value || null));
  const [error, setError] = useState("");

  // sync when parent value changes (e.g. form reset)
  useEffect(() => {
    setDisplay(e164ToDisplay(value || null));
    setError("");
  }, [value]);

  const handleChange = (raw: string) => {
    const digits = digitsOnly(raw);
    if (digits.length > 10) return; // cap at 10 digits
    const formatted = formatPhoneDisplay(digits);
    setDisplay(formatted);

    if (digits.length === 0) {
      setError("");
      onChange("");
    } else if (digits.length === 10) {
      const e164 = toE164(digits);
      setError("");
      onChange(e164 || "");
    } else {
      setError("Invalid phone number.");
    }
  };

  return (
    <div className="space-y-1">
      <Input
        value={display}
        onChange={(e) => handleChange(e.target.value)}
        className={className}
        placeholder={placeholder}
        type="tel"
        inputMode="numeric"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
