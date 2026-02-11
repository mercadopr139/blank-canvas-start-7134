import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: object
          ) => {
            addListener: (event: string, cb: () => void) => void;
            getPlace: () => { formatted_address?: string };
          };
        };
      };
    };
  }
}

let googlePlacesPromise: Promise<void> | null = null;

function loadGooglePlaces(apiKey: string): Promise<void> {
  if (window.google?.maps?.places) return Promise.resolve();
  if (googlePlacesPromise) return googlePlacesPromise;

  googlePlacesPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return googlePlacesPromise;
}

interface ChildPrimaryAddressFieldProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function ChildPrimaryAddressField({
  value,
  onChange,
  className,
}: ChildPrimaryAddressFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(value ?? "");

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !inputRef.current) return;

    loadGooglePlaces(apiKey).then(() => {
      if (!inputRef.current || !window.google?.maps?.places) return;

      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        componentRestrictions: { country: "us" },
      });

      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        const formatted = place?.formatted_address || inputRef.current?.value || "";
        setInputValue(formatted);
        onChange(formatted);
      });
    });
  }, []);

  return (
    <input
      ref={inputRef}
      value={inputValue}
      onChange={(e) => {
        setInputValue(e.target.value);
        onChange(e.target.value);
      }}
      placeholder="Start typing an address..."
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
    />
  );
}
