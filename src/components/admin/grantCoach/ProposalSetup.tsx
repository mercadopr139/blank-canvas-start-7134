// The proposal's setup (Josh, 2026-11-12): for a grant delivered as a written
// proposal, who it goes to, the subject line and who signs it. Typed once on
// the folder; the page prints them on the proposal's first page. Blanks are
// filled from the folder (the funder, the name, the ask) and the Vault's
// authorized signer until Josh types over them.
import { useState } from "react";
import { ChevronDown, ChevronRight, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import type { ProposalSetup as Setup } from "@/lib/grantCoach/proposal";

export default function ProposalSetup({ setup, onSave }: { setup: Setup; onSave: (next: Setup) => Promise<void> | void }) {
  const [open, setOpen] = useState(!setup.to_name.trim());
  const ready = !!setup.to_name.trim() && !!setup.signer.trim();
  const field = (key: keyof Setup, label: string, placeholder: string, multiline = false) => {
    const Comp = multiline ? Textarea : Input;
    return (
      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-wide text-white/45">{label}</span>
        <Comp
          key={setup[key]}
          defaultValue={setup[key]}
          placeholder={placeholder}
          onBlur={(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { if (e.target.value.trim() !== setup[key].trim()) void onSave({ ...setup, [key]: e.target.value.trim() }); }}
          {...(multiline ? { rows: 3 } : {})}
          className="mt-1 bg-neutral-950 border-white/15 text-white text-[13px]"
        />
      </label>
    );
  };

  return (
    <div className="py-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-start gap-2 text-left">
        {open ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-white/50" /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-white/50" />}
        <Mail className="w-4 h-4 mt-0.5 shrink-0" style={{ color: GC_BLUE }} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white">The proposal — who it goes to, who signs</span>
          <span className="block text-[11px] text-white/45">
            {ready ? `To ${setup.to_name}${setup.to_org ? `, ${setup.to_org}` : ""} · signed ${setup.signer} · printed on the first page` : "the addressee, the subject line and the signature on the printed proposal"}
          </span>
        </span>
        {!ready && <span className="shrink-0 text-[11px] font-semibold text-amber-300">Fill in</span>}
      </button>
      {open && (
        <div className="mt-2 pl-6 grid gap-3 sm:grid-cols-2">
          {field("to_name", "To — name", "Jim Lutz")}
          {field("to_title", "Their title", "President")}
          {field("to_org", "Organization", "Avalon Lions Charities Foundation")}
          {field("to_address", "Address", "P.O. Box 365\nAvalon, NJ 08202", true)}
          {field("subject", "Subject line (the Re: line)", "FY 2026–2027 Special Grants Program — request for $20,000")}
          {field("signer", "Signed by — name, title", "Josh Mercado, President")}
          <p className="sm:col-span-2 text-[11px] text-white/40">The rows below are the proposal's sections, printed in order under the funder's headings. Upload rows become enclosures. Saves when you click away.</p>
        </div>
      )}
    </div>
  );
}
