// Owner picker — small initials avatar that opens a Popover with a
// searchable list of active staff. Click an option to assign; click
// the "Unassign" footer to clear. Reused everywhere an Agenda item
// shows its owner.

import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { colorForUserId, initialsOf, type StaffOption } from "./types";

interface Props {
  ownerUserId: string | null;
  staff: StaffOption[];
  size?: "sm" | "md";
  disabled?: boolean;
  onChange: (userId: string | null) => void;
}

export const OwnerAvatar = ({
  userId,
  fullName,
  size = "md",
}: {
  userId: string | null;
  fullName: string | null;
  size?: "sm" | "md";
}) => {
  const px = size === "sm" ? "w-5 h-5 text-[9px]" : "w-7 h-7 text-[11px]";
  if (!userId || !fullName) {
    return (
      <div
        className={`${px} rounded-full flex items-center justify-center bg-white/[0.06] border border-dashed border-white/15 text-white/30`}
        title="Unassigned"
      >
        ?
      </div>
    );
  }
  return (
    <div
      className={`${px} rounded-full flex items-center justify-center font-bold text-white shadow-sm`}
      style={{ background: colorForUserId(userId) }}
      title={fullName}
    >
      {initialsOf(fullName)}
    </div>
  );
};

export const OwnerPicker = ({
  ownerUserId,
  staff,
  size = "md",
  disabled,
  onChange,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const currentOwner = staff.find((s) => s.user_id === ownerUserId) || null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.job_title?.toLowerCase().includes(q) ?? false),
    );
  }, [staff, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="rounded-full focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
          title={currentOwner ? `Owner: ${currentOwner.full_name}` : "Click to assign owner"}
        >
          <OwnerAvatar
            userId={ownerUserId}
            fullName={currentOwner?.full_name ?? null}
            size={size}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-0 bg-neutral-900 border-white/10 text-white"
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
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-zinc-500 italic text-center py-4">
              No staff match
            </p>
          ) : (
            filtered.map((s) => {
              const active = s.user_id === ownerUserId;
              return (
                <button
                  key={s.user_id}
                  type="button"
                  onClick={() => {
                    onChange(s.user_id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-white/[0.04] transition-colors text-left ${
                    active ? "bg-white/[0.04]" : ""
                  }`}
                >
                  <OwnerAvatar userId={s.user_id} fullName={s.full_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{s.full_name}</p>
                    {s.job_title && (
                      <p className="text-[10px] text-zinc-500 truncate">{s.job_title}</p>
                    )}
                  </div>
                  {active && <span className="text-[10px] text-zinc-500">current</span>}
                </button>
              );
            })
          )}
        </div>
        {ownerUserId && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-2 border-t border-white/[0.06] text-xs text-zinc-400 hover:bg-white/[0.04] hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Unassign
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
};
