import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { isValidEmail } from "@/lib/validators";

interface Props {
  value: string;
  onChange: (email: string) => void;
  className?: string;
  placeholder?: string;
}

export default function ValidatedEmailInput({ value, onChange, className, placeholder = "name@domain.com" }: Props) {
  const [local, setLocal] = useState(value || "");
  const [error, setError] = useState("");

  useEffect(() => {
    setLocal(value || "");
    setError("");
  }, [value]);

  const handleChange = (raw: string) => {
    setLocal(raw);
    onChange(raw.trim().toLowerCase());
    if (raw.trim() && !isValidEmail(raw)) {
      setError("Invalid email address.");
    } else {
      setError("");
    }
  };

  const handleBlur = () => {
    const trimmed = local.trim().toLowerCase();
    setLocal(trimmed);
    onChange(trimmed);
    if (trimmed && !isValidEmail(trimmed)) {
      setError("Invalid email address.");
    } else {
      setError("");
    }
  };

  return (
    <div className="space-y-1">
      <Input
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        className={className}
        placeholder={placeholder}
        type="email"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
