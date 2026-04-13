import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* ── Curated quick-pick palette ── */
const COLOR_OPTIONS = [
  { label: "Red", hex: "#ef4444" },
  { label: "Blue", hex: "#3b82f6" },
  { label: "Orange", hex: "#f97316" },
  { label: "Green", hex: "#22c55e" },
  { label: "Purple", hex: "#a78bfa" },
  { label: "Yellow", hex: "#eab308" },
  { label: "Teal", hex: "#14b8a6" },
  { label: "Pink", hex: "#ec4899" },
  { label: "White", hex: "#e4e4e7" },
];

const RECENT_KEY = "focusarea-recent-colors";
const MAX_RECENT = 6;

/* ── Color conversions ── */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function isValidHex(hex: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
}

/* ── Recent colors persistence ── */
function getRecentColors(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function addRecentColor(hex: string) {
  const recent = getRecentColors().filter((c) => c.toLowerCase() !== hex.toLowerCase());
  recent.unshift(hex.toLowerCase());
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

/* ── Component ── */
interface Props {
  value: string;
  onChange: (hex: string) => void;
}

const FullColorPicker = ({ value, onChange }: Props) => {
  const [hsv, setHsv] = useState<[number, number, number]>(() => {
    const rgb = hexToRgb(value);
    return rgbToHsv(...rgb);
  });
  const [hexInput, setHexInput] = useState(value);
  const [rgbInput, setRgbInput] = useState(() => hexToRgb(value));
  const [recentColors, setRecentColors] = useState(getRecentColors);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingSV = useRef(false);
  const draggingHue = useRef(false);

  const SV_W = 280, SV_H = 160, HUE_W = 280, HUE_H = 14;

  // Sync internal state when value prop changes externally
  useEffect(() => {
    const rgb = hexToRgb(value);
    const newHsv = rgbToHsv(...rgb);
    setHsv(newHsv);
    setHexInput(value);
    setRgbInput(rgb);
  }, [value]);

  // Draw SV canvas whenever hue changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;

    // White-to-hue horizontal gradient
    const gradH = ctx.createLinearGradient(0, 0, w, 0);
    gradH.addColorStop(0, "#fff");
    const [r, g, b] = hsvToRgb(hsv[0], 1, 1);
    gradH.addColorStop(1, `rgb(${r},${g},${b})`);
    ctx.fillStyle = gradH;
    ctx.fillRect(0, 0, w, h);

    // Transparent-to-black vertical gradient
    const gradV = ctx.createLinearGradient(0, 0, 0, h);
    gradV.addColorStop(0, "rgba(0,0,0,0)");
    gradV.addColorStop(1, "#000");
    ctx.fillStyle = gradV;
    ctx.fillRect(0, 0, w, h);
  }, [hsv[0]]);

  const commitColor = useCallback((h: number, s: number, v: number) => {
    const rgb = hsvToRgb(h, s, v);
    const hex = rgbToHex(...rgb);
    setHsv([h, s, v]);
    setHexInput(hex);
    setRgbInput(rgb);
    onChange(hex);
  }, [onChange]);

  const handleSVPointer = useCallback((e: React.PointerEvent | PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    commitColor(hsv[0], x, 1 - y);
  }, [hsv[0], commitColor]);

  const handleHuePointer = useCallback((e: React.PointerEvent | PointerEvent) => {
    const target = (e.currentTarget || e.target) as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    commitColor(x * 360, hsv[1], hsv[2]);
  }, [hsv[1], hsv[2], commitColor]);

  // Pointer event handlers for SV canvas
  const onSVDown = (e: React.PointerEvent) => {
    draggingSV.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleSVPointer(e);
  };
  const onSVMove = (e: React.PointerEvent) => { if (draggingSV.current) handleSVPointer(e); };
  const onSVUp = () => { draggingSV.current = false; };

  // Pointer event handlers for hue slider
  const onHueDown = (e: React.PointerEvent) => {
    draggingHue.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleHuePointer(e);
  };
  const onHueMove = (e: React.PointerEvent) => { if (draggingHue.current) handleHuePointer(e); };
  const onHueUp = () => { draggingHue.current = false; };

  const handleHexChange = (val: string) => {
    setHexInput(val);
    if (isValidHex(val)) {
      const rgb = hexToRgb(val);
      const newHsv = rgbToHsv(...rgb);
      setHsv(newHsv);
      setRgbInput(rgb);
      onChange(val.toLowerCase());
    }
  };

  const handleRgbChange = (idx: number, val: string) => {
    const num = parseInt(val) || 0;
    const clamped = Math.max(0, Math.min(255, num));
    const newRgb: [number, number, number] = [...rgbInput] as [number, number, number];
    newRgb[idx] = clamped;
    setRgbInput(newRgb);
    const newHsv = rgbToHsv(...newRgb);
    setHsv(newHsv);
    const hex = rgbToHex(...newRgb);
    setHexInput(hex);
    onChange(hex);
  };

  const selectColor = (hex: string) => {
    onChange(hex);
    const rgb = hexToRgb(hex);
    setHsv(rgbToHsv(...rgb));
    setHexInput(hex);
    setRgbInput(rgb);
  };

  // Save to recent on blur
  const saveToRecent = () => {
    if (isValidHex(hexInput)) {
      addRecentColor(hexInput);
      setRecentColors(getRecentColors());
    }
  };

  // SV cursor position
  const svCursorX = hsv[1] * 100;
  const svCursorY = (1 - hsv[2]) * 100;
  const hueCursorX = (hsv[0] / 360) * 100;

  return (
    <div className="space-y-3">
      <Label className="text-white/70 text-xs">Brand Color</Label>

      {/* Recent colors */}
      {recentColors.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-white/30 uppercase tracking-wider">Recent</span>
          <div className="flex gap-1.5">
            {recentColors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => selectColor(c)}
                className={`w-7 h-7 rounded-md border-2 transition-all ${
                  value.toLowerCase() === c.toLowerCase()
                    ? "border-white scale-110"
                    : "border-transparent hover:border-white/30"
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quick picks */}
      <div className="space-y-1">
        <span className="text-[10px] text-white/30 uppercase tracking-wider">Quick Picks</span>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => selectColor(c.hex)}
              className={`w-7 h-7 rounded-md border-2 transition-all ${
                value.toLowerCase() === c.hex.toLowerCase()
                  ? "border-white scale-110"
                  : "border-transparent hover:border-white/30"
              }`}
              style={{ backgroundColor: c.hex }}
              title={c.label}
            />
          ))}
        </div>
      </div>

      {/* SV Canvas */}
      <div className="relative rounded-lg overflow-hidden cursor-crosshair" style={{ width: SV_W, height: SV_H }}>
        <canvas
          ref={canvasRef}
          width={SV_W}
          height={SV_H}
          onPointerDown={onSVDown}
          onPointerMove={onSVMove}
          onPointerUp={onSVUp}
          onLostPointerCapture={onSVUp}
          className="block"
        />
        {/* Cursor */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${svCursorX}%`,
            top: `${svCursorY}%`,
            backgroundColor: value,
          }}
        />
      </div>

      {/* Hue slider */}
      <div
        className="relative rounded-full cursor-pointer"
        style={{
          width: HUE_W,
          height: HUE_H,
          background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        }}
        onPointerDown={onHueDown}
        onPointerMove={onHueMove}
        onPointerUp={onHueUp}
        onLostPointerCapture={onHueUp}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
          style={{
            left: `${hueCursorX}%`,
            backgroundColor: rgbToHex(...hsvToRgb(hsv[0], 1, 1)),
          }}
        />
      </div>

      {/* Hex + RGB inputs + swatch preview */}
      <div className="flex items-end gap-3">
        {/* Current color swatch */}
        <div
          className="w-10 h-10 rounded-lg border border-white/10 shrink-0"
          style={{ backgroundColor: value }}
        />
        <div className="space-y-1 flex-1">
          <span className="text-[10px] text-white/30 uppercase tracking-wider">Hex</span>
          <Input
            value={hexInput}
            onChange={(e) => handleHexChange(e.target.value)}
            onBlur={saveToRecent}
            className="bg-white/5 border-white/10 text-white h-8 text-xs font-mono"
            placeholder="#ef4444"
          />
        </div>
        <div className="flex gap-1.5">
          {(["R", "G", "B"] as const).map((ch, i) => (
            <div key={ch} className="space-y-1 w-12">
              <span className="text-[10px] text-white/30 uppercase tracking-wider">{ch}</span>
              <Input
                type="number"
                min={0}
                max={255}
                value={rgbInput[i]}
                onChange={(e) => handleRgbChange(i, e.target.value)}
                onBlur={saveToRecent}
                className="bg-white/5 border-white/10 text-white h-8 text-xs font-mono px-1.5 text-center"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Live card preview */}
      <div className="space-y-1">
        <span className="text-[10px] text-white/30 uppercase tracking-wider">Preview</span>
        <div
          className="rounded-xl border-2 p-4 flex items-center gap-3"
          style={{
            borderColor: value,
            background: `linear-gradient(145deg, ${value}1f 0%, ${value}08 100%)`,
          }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: `${value}18`, color: value }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Focus Area</p>
            <p className="text-[10px] text-zinc-500">Subtitle preview</p>
          </div>
          <span className="text-xs font-semibold" style={{ color: value }}>
            Open →
          </span>
        </div>
      </div>
    </div>
  );
};

export default FullColorPicker;
