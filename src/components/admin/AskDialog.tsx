// The back end's own "Are you sure?" and "What should it be called?"
// A browser's built-in pop-ups do not match the NLA theme (Josh, 2026-10-17),
// so no screen uses them. This hook gives a page a themed dialog it can
// await like a question:
//
//   const { ask, dialog } = useAsk();
//   if (!(await ask.confirm({ title: "Remove this folder?", body: "…", danger: true }))) return;
//   const name = await ask.prompt({ title: "New grant", fields: [{ key: "funder", label: "Funder" }] });
//   …and render {dialog} once anywhere in the page.
import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const NLA_RED = "#bf0f3e";

export interface ConfirmAsk {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** A red confirm button, for removals. */
  danger?: boolean;
}

export interface PromptField {
  key: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}
export interface PromptAsk {
  title: string;
  body?: ReactNode;
  fields: PromptField[];
  confirmLabel?: string;
}

type Pending =
  | { kind: "confirm"; ask: ConfirmAsk; resolve: (ok: boolean) => void }
  | { kind: "prompt"; ask: PromptAsk; resolve: (values: Record<string, string> | null) => void };

export const useAsk = () => {
  const [pending, setPending] = useState<Pending | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const firstInput = useRef<HTMLInputElement>(null);

  const confirm = useCallback((ask: ConfirmAsk) => new Promise<boolean>((resolve) => setPending({ kind: "confirm", ask, resolve })), []);
  const prompt = useCallback((ask: PromptAsk) => new Promise<Record<string, string> | null>((resolve) => {
    setValues(Object.fromEntries(ask.fields.map((f) => [f.key, f.defaultValue ?? ""])));
    setPending({ kind: "prompt", ask, resolve });
  }), []);

  const close = (result: boolean | Record<string, string> | null) => {
    if (!pending) return;
    if (pending.kind === "confirm") pending.resolve(result === true);
    else pending.resolve(result && typeof result === "object" ? result : null);
    setPending(null);
  };

  const missing = pending?.kind === "prompt" ? pending.ask.fields.some((f) => f.required !== false && !(values[f.key] ?? "").trim()) : false;

  const dialog = (
    <Dialog open={!!pending} onOpenChange={(open) => { if (!open) close(null); }}>
      <DialogContent className="bg-[#1a1a2e] border-white/10 text-white" onOpenAutoFocus={(e) => { if (pending?.kind === "prompt") { e.preventDefault(); firstInput.current?.focus(); } }}>
        <DialogHeader>
          <DialogTitle>{pending?.ask.title}</DialogTitle>
          {pending?.ask.body && <DialogDescription className="text-white/60">{pending.ask.body}</DialogDescription>}
        </DialogHeader>
        {pending?.kind === "prompt" && (
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); if (!missing) close(values); }}
          >
            {pending.ask.fields.map((f, i) => (
              <div key={f.key}>
                <label className="text-sm text-white/60" htmlFor={`ask-${f.key}`}>{f.label}{f.required === false && <span className="text-white/30"> (optional)</span>}</label>
                <Input
                  id={`ask-${f.key}`}
                  ref={i === 0 ? firstInput : undefined}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="mt-1 bg-white/10 border-white/20 text-white"
                />
              </div>
            ))}
          </form>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => close(null)} className="border-white/20 text-white bg-transparent hover:bg-white/10 hover:text-white">
            {pending?.kind === "confirm" ? (pending.ask.cancelLabel ?? "Cancel") : "Cancel"}
          </Button>
          <Button
            onClick={() => close(pending?.kind === "confirm" ? true : values)}
            disabled={missing}
            className={pending?.kind === "confirm" && pending.ask.danger ? "bg-red-600 hover:bg-red-700 text-white" : "text-white hover:opacity-90"}
            style={pending?.kind === "confirm" && pending.ask.danger ? undefined : { backgroundColor: NLA_RED }}
          >
            {pending?.ask.confirmLabel ?? (pending?.kind === "confirm" ? "Yes" : "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { ask: { confirm, prompt }, dialog };
};
