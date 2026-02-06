import { useEffect, useMemo, useState } from "react";

function extractYouTubeId(urlOrId: string): string | null {
  const raw = (urlOrId || "").trim();
  if (!raw) return null;

  // If pasted just the 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  try {
    const url = new URL(raw);
    // youtu.be/<id>
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    // youtube.com/watch?v=<id>
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

    // youtube.com/embed/<id> or /shorts/<id>
    const parts = url.pathname.split("/").filter(Boolean);
    const embedIndex = parts.indexOf("embed");
    const shortsIndex = parts.indexOf("shorts");
    const candidate =
      embedIndex >= 0
        ? parts[embedIndex + 1]
        : shortsIndex >= 0
        ? parts[shortsIndex + 1]
        : null;
    return candidate && /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

interface AutoYouTubeBoxProps {
  storageKey: string;
  label?: string;
}

export function AutoYouTubeBox({ storageKey, label = "Video" }: AutoYouTubeBoxProps) {
  const [url, setUrl] = useState("");

  // Load saved
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setUrl(saved);
  }, [storageKey]);

  // Save on change
  useEffect(() => {
    localStorage.setItem(storageKey, url);
  }, [storageKey, url]);

  const videoId = useMemo(() => extractYouTubeId(url), [url]);
  const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-lg bg-neutral-800/50">
        <div className="aspect-video w-full">
          {embedUrl ? (
            <iframe
              className="h-full w-full"
              src={embedUrl}
              title={label}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-neutral-400 text-sm">
              Video coming soon
            </div>
          )}
        </div>
      </div>
      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-medium text-neutral-500">
          Paste YouTube link
        </label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm text-white placeholder:text-neutral-500 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-600"
        />
      </div>
    </div>
  );
}
