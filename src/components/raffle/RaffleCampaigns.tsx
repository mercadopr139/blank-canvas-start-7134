// Campaigns — one per fundraiser. Holds the rules every batch inherits: what a
// ticket costs, what the prize is, when the money is due.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Ticket, Pencil, Trophy, Loader2, ArrowRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RaffleCampaign, money, describePricing } from "@/lib/raffle";

const NLA_RED = "#bf0f3e";

const blank = () => ({
  name: "",
  kind: "",
  ticket_price: "5",
  bundle_qty: "",
  bundle_price: "",
  prize: "",
  goal_amount: "",
  due_date: "",
  draw_date: "",
  notes: "",
});

const RaffleCampaigns = ({ onOpen }: { onOpen: (c: RaffleCampaign) => void }) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState<RaffleCampaign | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(blank());

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["raffle-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raffle_campaigns" as never)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as RaffleCampaign[]) || [];
    },
  });

  // Money already in, per campaign, so a card can show progress without opening
  // the ledger.
  const { data: raised = {} } = useQuery({
    queryKey: ["raffle-campaign-raised"],
    queryFn: async () => {
      const { data } = await supabase
        .from("raffle_payments" as never)
        .select("campaign_id, amount");
      const rows = (data as unknown as { campaign_id: string; amount: number }[]) || [];
      const out: Record<string, number> = {};
      rows.forEach((r) => { out[r.campaign_id] = (out[r.campaign_id] || 0) + Number(r.amount); });
      return out;
    },
  });

  const openCreate = () => {
    setForm(blank());
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (c: RaffleCampaign) => {
    setForm({
      name: c.name,
      kind: c.kind,
      ticket_price: String(c.ticket_price ?? ""),
      bundle_qty: c.bundle_qty != null ? String(c.bundle_qty) : "",
      bundle_price: c.bundle_price != null ? String(c.bundle_price) : "",
      prize: c.prize ?? "",
      goal_amount: c.goal_amount != null ? String(c.goal_amount) : "",
      due_date: c.due_date ?? "",
      draw_date: c.draw_date ?? "",
      notes: c.notes ?? "",
    });
    setEditing(c);
    setCreating(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        kind: form.kind,
        ticket_price: Number(form.ticket_price) || 0,
        // Both or neither — a half-filled bundle is refused by the database
        // and would only ever be a slip of the hand.
        bundle_qty: bundleOk ? Number(form.bundle_qty) : null,
        bundle_price: bundleOk ? Number(form.bundle_price) : null,
        prize: form.prize.trim() || null,
        goal_amount: form.goal_amount ? Number(form.goal_amount) : null,
        due_date: form.due_date || null,
        draw_date: form.draw_date || null,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase
          .from("raffle_campaigns" as never)
          .update(payload as never)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("raffle_campaigns" as never)
          .insert({ ...payload, created_by: user?.email ?? null } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["raffle-campaigns"] });
      setCreating(false);
      toast.success(editing ? "Campaign updated." : "Campaign created.");
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't save that."),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "closed" }) => {
      const { error } = await supabase
        .from("raffle_campaigns" as never)
        .update({ status } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["raffle-campaigns"] }),
  });

  const bundleOk =
    Number(form.bundle_qty) > 1 && form.bundle_price !== "" && Number(form.bundle_price) >= 0;
  const bundleHalfDone =
    (form.bundle_qty !== "" || form.bundle_price !== "") && !bundleOk;

  // Deleting a campaign takes every ticket, return and payment under it. That
  // is not a thing to do by mis-clicking, so the name has to be typed.
  const [deleting, setDeleting] = useState<RaffleCampaign | null>(null);
  const [confirmName, setConfirmName] = useState("");

  const destroy = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("raffle_campaigns" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["raffle-campaigns"] });
      qc.invalidateQueries({ queryKey: ["raffle-campaign-raised"] });
      setDeleting(null);
      setConfirmName("");
      toast.success("Campaign deleted.");
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't delete that."),
  });

  const canSave =
    form.name.trim().length > 1 && Number(form.ticket_price) >= 0 && !bundleHalfDone;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-neutral-400">
          A campaign is one fundraiser. Everything a youth is given hangs off it.
        </p>
        <Button onClick={openCreate} className="text-white font-bold" style={{ backgroundColor: NLA_RED }}>
          <Plus className="w-4 h-4 mr-1.5" /> New campaign
        </Button>
      </div>

      {isLoading ? (
        <p className="text-neutral-500 py-8 text-center">Loading…</p>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 text-neutral-600">
          <Ticket className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No campaigns yet. Create one to start issuing tickets.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {campaigns.map((c) => {
            const inTotal = raised[c.id] || 0;
            const goalPct = c.goal_amount ? Math.min(100, (inTotal / c.goal_amount) * 100) : null;
            return (
              <div
                key={c.id}
                className={`rounded-xl border p-4 space-y-3 ${
                  c.status === "closed"
                    ? "border-neutral-800 bg-neutral-900/50 opacity-70"
                    : "border-neutral-800 bg-neutral-900"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-white truncate">{c.name}</h3>
                      {c.kind && (
                        <Badge className="bg-white/10 text-white/70 border-white/15 text-[10px]">{c.kind}</Badge>
                      )}
                      {c.status === "closed" && (
                        <Badge className="bg-neutral-700/40 text-neutral-300 border-neutral-600 text-[10px]">Closed</Badge>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {describePricing({ ticketPrice: Number(c.ticket_price), bundleQty: c.bundle_qty, bundlePrice: c.bundle_price })}
                      {c.due_date && ` · due ${c.due_date}`}
                      {c.draw_date && ` · drawn ${c.draw_date}`}
                    </p>
                  </div>
                  <div className="flex items-center shrink-0">
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => openEdit(c)}
                      className="text-neutral-500 hover:text-white h-8 w-8"
                      aria-label={`Edit ${c.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => { setDeleting(c); setConfirmName(""); }}
                      className="text-neutral-600 hover:text-red-400 h-8 w-8"
                      aria-label={`Delete ${c.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {c.prize && (
                  <p className="text-sm text-neutral-300 flex items-start gap-2">
                    <Trophy className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
                    <span>{c.prize}</span>
                  </p>
                )}

                <div>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-bold text-white">{money(inTotal)}</span>
                    {c.goal_amount ? (
                      <span className="text-neutral-500 text-xs">of {money(c.goal_amount)}</span>
                    ) : (
                      <span className="text-neutral-500 text-xs">collected</span>
                    )}
                  </div>
                  {goalPct !== null && (
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${goalPct}%`, backgroundColor: NLA_RED }} />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    onClick={() => onOpen(c)}
                    className="flex-1 bg-white text-black hover:bg-white/90 font-bold h-9"
                  >
                    Open ledger <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setStatus.mutate({ id: c.id, status: c.status === "active" ? "closed" : "active" })}
                    className="bg-transparent border-neutral-700 text-neutral-400 hover:text-white h-9"
                  >
                    {c.status === "active" ? "Close" : "Reopen"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!deleting} onOpenChange={(o) => { if (!o) { setDeleting(null); setConfirmName(""); } }}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription className="text-neutral-400">
              This takes every ticket issued, every stub returned and every payment recorded under this campaign
              with it, for every youth. Money already posted to the revenue ledger stays there — reverse it in
              Revenue if you need to.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label className="text-xs text-neutral-400">
              Type <span className="text-white font-semibold">{deleting?.name}</span> to confirm
            </Label>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="mt-1 bg-neutral-800 border-neutral-700 text-white"
            />
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => { setDeleting(null); setConfirmName(""); }}
              className="text-neutral-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={() => deleting && destroy.mutate(deleting.id)}
              disabled={confirmName.trim() !== deleting?.name || destroy.isPending}
              className="bg-red-600 hover:bg-red-500 text-white font-bold"
            >
              {destroy.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit campaign" : "New campaign"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-neutral-400">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ireland Trip Raffle 2026"
                className="mt-1 bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-neutral-400">Cause</Label>
                <Input
                  value={form.kind}
                  onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                  placeholder="USA Boxing Nationals travel"
                  className="mt-1 bg-neutral-800 border-neutral-700 text-white"
                />
              </div>
              <div>
                <Label className="text-xs text-neutral-400">Price per ticket</Label>
                <Input
                  type="number" min="0" step="0.5"
                  value={form.ticket_price}
                  onChange={(e) => setForm((f) => ({ ...f, ticket_price: e.target.value }))}
                  className="mt-1 bg-neutral-800 border-neutral-700 text-white"
                />
              </div>
            </div>

            {/* The bundle rate. Optional, but when it's set it drives what a
                youth owes — pricing 50 tickets at the single rate when they
                were all sold five-for-twenty would invent a debt. */}
            <div className="rounded-lg border border-neutral-800 bg-black/30 p-3">
              <Label className="text-xs text-neutral-400">Bundle deal (optional)</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  type="number" min="2" step="1"
                  value={form.bundle_qty}
                  onChange={(e) => setForm((f) => ({ ...f, bundle_qty: e.target.value }))}
                  placeholder="5"
                  className="w-20 bg-neutral-800 border-neutral-700 text-white"
                />
                <span className="text-sm text-neutral-500">tickets for</span>
                <Input
                  type="number" min="0" step="0.5"
                  value={form.bundle_price}
                  onChange={(e) => setForm((f) => ({ ...f, bundle_price: e.target.value }))}
                  placeholder="20"
                  className="w-24 bg-neutral-800 border-neutral-700 text-white"
                />
              </div>
              <p className={`text-xs mt-1.5 ${bundleHalfDone ? "text-amber-400" : "text-neutral-500"}`}>
                {bundleHalfDone
                  ? "Fill in both boxes, or clear them both."
                  : bundleOk
                  ? `Sells at ${describePricing({
                      ticketPrice: Number(form.ticket_price) || 0,
                      bundleQty: Number(form.bundle_qty),
                      bundlePrice: Number(form.bundle_price),
                    })}`
                  : "Leave blank if every ticket is the same price."}
              </p>
            </div>

            <div>
              <Label className="text-xs text-neutral-400">Prize</Label>
              <Input
                value={form.prize}
                onChange={(e) => setForm((f) => ({ ...f, prize: e.target.value }))}
                placeholder="55&quot; TV"
                className="mt-1 bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-neutral-400">Goal</Label>
                <Input
                  type="number" min="0"
                  value={form.goal_amount}
                  onChange={(e) => setForm((f) => ({ ...f, goal_amount: e.target.value }))}
                  placeholder="10000"
                  className="mt-1 bg-neutral-800 border-neutral-700 text-white"
                />
              </div>
              <div>
                <Label className="text-xs text-neutral-400">Money due</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                  className="mt-1 bg-neutral-800 border-neutral-700 text-white"
                />
              </div>
              <div>
                <Label className="text-xs text-neutral-400">Draw date</Label>
                <Input
                  type="date"
                  value={form.draw_date}
                  onChange={(e) => setForm((f) => ({ ...f, draw_date: e.target.value }))}
                  className="mt-1 bg-neutral-800 border-neutral-700 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-neutral-400">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="mt-1 bg-neutral-800 border-neutral-700 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)} className="text-neutral-400 hover:text-white">
              Cancel
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={!canSave || save.isPending}
              className="text-white font-bold"
              style={{ backgroundColor: NLA_RED }}
            >
              {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RaffleCampaigns;
