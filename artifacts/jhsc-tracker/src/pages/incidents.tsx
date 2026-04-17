import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Plus, Edit2, Trash2, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Incident = {
  id: number;
  incidentCode: string;
  incidentType: string;
  incidentDate: string;
  incidentTime: string;
  location: string;
  description: string;
  injuredPerson: string;
  bodyPartAffected: string;
  witnesses: string;
  immediateAction: string;
  reportedTo: string;
  status: string;
  createdBy: string;
  createdAt: string;
};

const INCIDENT_TYPES = ["Incident", "Near-Miss", "Property Damage", "First Aid", "Medical Aid"];
const STATUSES = ["Open", "Under Investigation", "Resolved", "Closed"];

const TYPE_COLORS: Record<string, string> = {
  "Incident": "bg-red-100 text-red-800 border-red-200",
  "Near-Miss": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Property Damage": "bg-orange-100 text-orange-800 border-orange-200",
  "First Aid": "bg-blue-100 text-blue-800 border-blue-200",
  "Medical Aid": "bg-purple-100 text-purple-800 border-purple-200",
};

const STATUS_COLORS: Record<string, string> = {
  "Open": "bg-red-100 text-red-700 border-red-200",
  "Under Investigation": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Resolved": "bg-green-100 text-green-700 border-green-200",
  "Closed": "bg-slate-100 text-slate-600 border-slate-200",
};

const empty = {
  incidentType: "Near-Miss",
  incidentDate: "",
  incidentTime: "",
  location: "",
  description: "",
  injuredPerson: "",
  bodyPartAffected: "",
  witnesses: "",
  immediateAction: "",
  reportedTo: "",
  status: "Open",
};

export default function IncidentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const canEdit = user?.role === "admin" || user?.role === "co-chair";

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Incident | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Incident | null>(null);

  const { data: incidents = [], isLoading } = useQuery<Incident[]>({
    queryKey: ["incidents"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/incidents`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const url = editing ? `${BASE}/api/incidents/${editing.id}` : `${BASE}/api/incidents`;
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error("Failed to save");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      toast({ title: editing ? "Incident updated" : "Incident logged" });
      setOpen(false);
      setEditing(null);
      setForm({ ...empty });
    },
    onError: () => toast({ title: "Error saving", variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${BASE}/api/incidents/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      toast({ title: "Incident deleted" });
      setDeleting(null);
    },
    onError: () => toast({ title: "Error deleting", variant: "destructive" }),
  });

  function openNew() {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  }

  function openEdit(inc: Incident) {
    setEditing(inc);
    setForm({
      incidentType: inc.incidentType,
      incidentDate: inc.incidentDate,
      incidentTime: inc.incidentTime,
      location: inc.location,
      description: inc.description,
      injuredPerson: inc.injuredPerson,
      bodyPartAffected: inc.bodyPartAffected,
      witnesses: inc.witnesses,
      immediateAction: inc.immediateAction,
      reportedTo: inc.reportedTo,
      status: inc.status,
    });
    setOpen(true);
  }

  function field(key: keyof typeof form, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          <h1 className="text-xl font-bold text-foreground">Incident / Near-Miss Log</h1>
        </div>
        <Button onClick={openNew} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Log Incident
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <ClipboardList className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No incidents logged yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map(inc => {
            const isExp = expanded === inc.id;
            return (
              <div key={inc.id} className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
                <button
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors"
                  onClick={() => setExpanded(isExp ? null : inc.id)}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="font-mono text-xs text-muted-foreground">{inc.incidentCode}</span>
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded border", TYPE_COLORS[inc.incidentType] ?? "bg-muted text-muted-foreground border-border")}>
                        {inc.incidentType}
                      </span>
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded border", STATUS_COLORS[inc.status] ?? "bg-muted text-muted-foreground border-border")}>
                        {inc.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{inc.location || "No location"}</p>
                    <p className="text-xs text-muted-foreground">
                      {inc.incidentDate ? format(parseISO(inc.incidentDate), "MMMM d, yyyy") : ""}
                      {inc.incidentTime ? ` at ${inc.incidentTime}` : ""}
                      {" · "}Logged by {inc.createdBy}
                    </p>
                  </div>
                  {isExp ? <ChevronUp className="h-4 w-4 text-muted-foreground mt-1 shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />}
                </button>

                {isExp && (
                  <div className="px-4 pb-4 pt-1 border-t border-border space-y-3">
                    <Detail label="Description" value={inc.description} />
                    <Detail label="Injured Person" value={inc.injuredPerson} />
                    <Detail label="Body Part Affected" value={inc.bodyPartAffected} />
                    <Detail label="Witnesses" value={inc.witnesses} />
                    <Detail label="Immediate Action" value={inc.immediateAction} />
                    <Detail label="Reported To" value={inc.reportedTo} />
                    {canEdit && (
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEdit(inc)}>
                          <Edit2 className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10" onClick={() => setDeleting(inc)}>
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={v => { if (!v) { setOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Incident" : "Log Incident / Near-Miss"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Type</label>
              <Select value={form.incidentType} onValueChange={v => field("incidentType", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{INCIDENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Date *</label>
                <Input type="date" className="mt-1" value={form.incidentDate} onChange={e => field("incidentDate", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Time</label>
                <Input type="time" className="mt-1" value={form.incidentTime} onChange={e => field("incidentTime", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Location</label>
              <Input className="mt-1" placeholder="Where did this occur?" value={form.location} onChange={e => field("location", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Description *</label>
              <Textarea className="mt-1" rows={3} placeholder="Describe what happened..." value={form.description} onChange={e => field("description", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Injured / Involved Person</label>
              <Input className="mt-1" placeholder="Name (if applicable)" value={form.injuredPerson} onChange={e => field("injuredPerson", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Body Part Affected</label>
              <Input className="mt-1" placeholder="e.g. Left hand, Back" value={form.bodyPartAffected} onChange={e => field("bodyPartAffected", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Witnesses</label>
              <Input className="mt-1" placeholder="Names of witnesses" value={form.witnesses} onChange={e => field("witnesses", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Immediate Action Taken</label>
              <Textarea className="mt-1" rows={2} placeholder="What was done right away?" value={form.immediateAction} onChange={e => field("immediateAction", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Reported To</label>
              <Input className="mt-1" placeholder="Supervisor / Manager name" value={form.reportedTo} onChange={e => field("reportedTo", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={form.status} onValueChange={v => field("status", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!form.incidentDate || !form.description || save.isPending}>
              {save.isPending ? "Saving..." : editing ? "Update" : "Log Incident"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={v => { if (!v) setDeleting(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Incident?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete <strong>{deleting?.incidentCode}</strong>. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleting && del.mutate(deleting.id)} disabled={del.isPending}>
              {del.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm text-foreground whitespace-pre-wrap">{value}</p>
    </div>
  );
}
