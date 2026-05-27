// Multi-owner picker. Trigger renders an overlapping avatar stack
// (up to 3 visible, then a "+N" badge); the Popover lets you click
// to toggle individual staff in/out without closing. "Clear all" in
// the footer wipes the assignment.

import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Search, X, Check } from "lucide-react";
import { colorForUserId, initialsOf, type StaffOption } from "./types";
import { displayNameFor } from "@/lib/staff";

interface Props {
  ownerUserIds: string[];
  staff: StaffOption[];
  size?: "sm" | "md";
  disabled?: boolean;
  onChange: (userIds: string[]) => void;
}

// One initials avatar. Used by both the picker rows and the stack.
// Initials are derived from `fullName` so the bubble label stays
// predictable (JS / JM / CC / AM); the tooltip uses `displayName`
// when set so two staffers sharing a first name still read distinct
// on hover.
const SingleAvatar = ({
  userId,
  fullName,
  displayName,
  size = "md",
  ring = false,
}: {
  userId: string;
  fullName: string;
  displayName?: string;
  size?: "sm" | "md";
  ring?: boolean;
}) => {
  const px = size === "sm" ? "w-5 h-5 text-[9px]" : "w-7 h-7 text-[11px]";
  return (
    <div
      className={`${px} rounded-full flex items-center justify-center font-bold text-white shadow-sm shrink-0 ${
        ring ? "ring-2 ring-neutral-900" : ""
      }`}
      style={{ background: colorForUserId(userId) }}
      title={displayName || fullName}
    >
      {initialsOf(fullName)}
    </div>
  );
};

const UnassignedAvatar = ({ size = "md" }: { size?: "sm" | "md" }) => {
  const px = size === "sm" ? "w-5 h-5 text-[9px]" : "w-7 h-7 text-[11px]";
  return (
    <div
      className={`${px} rounded-full flex items-center justify-center bg-white/[0.06] border border-dashed border-white/15 text-white/30 shrink-0`}
      title="Unassigned"
    >
      ?
    </div>
  );
};

// Public stack — used by trigger and anywhere we need to display owners.
export const OwnerStack = ({
  ownerUserIds,
  staff,
  size = "md",
}: {
  ownerUserIds: string[];
  staff: StaffOption[];
  size?: "sm" | "md";
}) => {
  if (ownerUserIds.length === 0) return <UnassignedAvatar size={size} />;

  // Preserve the order owners were assigned in (array order). Keep
  // only the ones we actually have profile rows for — a stale uuid
  // (deleted user) just drops out silently.
  const resolved = ownerUserIds
    .map((uid) => staff.find((s) => s.user_id === uid))
    .filter((s): s is StaffOption => !!s);

  if (resolved.length === 0) return <UnassignedAvatar size={size} />;

  const visible = resolved.slice(0, 3);
  const overflow = resolved.length - visible.length;
  const overlap = size === "sm" ? "-ml-1.5" : "-ml-2";
  const badgePx = size === "sm" ? "w-5 h-5 text-[9px]" : "w-7 h-7 text-[10px]";

  return (
    <div className="flex items-center">
      {visible.map((s, i) => (
        <div key={s.user_id} className={i === 0 ? "" : overlap}>
          <SingleAvatar
            userId={s.user_id}
            fullName={s.full_name}
            displayName={displayNameFor(s)}
            size={size}
            ring={resolved.length > 1}
          />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={`${badgePx} ${overlap} rounded-full flex items-center justify-center font-bold bg-neutral-700 text-white/80 ring-2 ring-neutral-900 shrink-0`}
          title={resolved.slice(3).map((s) => displayNameFor(s)).join(", ")}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};

export const OwnerPicker = ({
  ownerUserIds,
  staff,
  size = "md",
  disabled,
  onChange,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.display_name?.toLowerCase().includes(q) ?? false) ||
        (s.job_title?.toLowerCase().includes(q) ?? false),
    );
  }, [staff, search]);

  const selectedSet = useMemo(() => new Set(ownerUserIds), [ownerUserIds]);

  const toggle = (uid: string) => {
    if (selectedSet.has(uid)) {
      onChange(ownerUserIds.filter((id) => id !== uid));
    } else {
      onChange([...ownerUserIds, uid]);
    }
  };

  const triggerTitle =
    ownerUserIds.length === 0
      ? "Click to assign owners"
      : `${ownerUserIds.length} owner${ownerUserIds.length === 1 ? "" : "s"}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="rounded-full focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
          title={triggerTitle}
        >
          <OwnerStack ownerUserIds={ownerUserIds} staff={staff} size={size} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-0 bg-neutral-900 border-white/10 text-white"
      >
        <div className="p-2 border-b border-white/[0.06]">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff…"
              className="pl-7 h-7 text-xs bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600"
            />
          </div>
          {ownerUserIds.length > 0 && (
            <p className="text-[10px] text-zinc-500 mt-1.5 px-0.5">
              {ownerUserIds.length} selected · click to toggle
            </p>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-zinc-500 italic text-center py-4">
              No staff match
            </p>
          ) : (
            filtered.map((s) => {
              const active = selectedSet.has(s.user_id);
              return (
                <button
                  key={s.user_id}
                  type="button"
                  onClick={() => toggle(s.user_id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-white/[0.04] transition-colors text-left ${
                    active ? "bg-white/[0.04]" : ""
                  }`}
                >
                  <SingleAvatar
                    userId={s.user_id}
                    fullName={s.full_name}
                    displayName={displayNameFor(s)}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{displayNameFor(s)}</p>
                    {s.job_title && (
                      <p className="text-[10px] text-zinc-500 truncate">{s.job_title}</p>
                    )}
                  </div>
                  {active && (
                    <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
        {ownerUserIds.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="w-full flex items-center gap-2 px-2.5 py-2 border-t border-white/[0.06] text-xs text-zinc-400 hover:bg-white/[0.04] hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear all
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
};
