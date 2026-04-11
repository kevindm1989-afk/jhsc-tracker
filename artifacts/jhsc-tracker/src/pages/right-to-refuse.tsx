import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit2, ShieldX, Lock, AlertTriangle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type RightToRefuse = {
  id: number;
  refuseCode: string;
  workerName: string;
  refusalDate: string;
  refusalTime: string;
  zone: string;
  hazardDescription: string;
  supervisorNotified: boolean;
  supervisorName: string | null;
  jhscRepNotified: boolean;
  inspectorCalled: boolean;
  molFileNumber: string | null;
  outcome: string;
  notes: string | null;
  lockedAt: string | null;
};

const ZONES = ["Zone 1 — Receiving", "Zone 2 — Cold Storage", "Zone 3 — Production", "Zone 4 — Packaging", "Zone 5 — Shipping", "Zone 6 — Maintenance", "Zone 7 — Office/Admin"];
const OUTCOMES = ["Ongoing", "Resolved — Hazard Corrected", "Resolved — Worker Returned", "MOL Order Issued", "Arbitration"];

function outcomeBadge(outcome: string) {
  if (outcome === "Ongoing") return <Badge className="bg-red-100 text-red-800 border-red-300"><AlertTriangle className="w-3 h-3 mr-1" />Ongoing</Badge>;
  if (outcome.startsWith("Resolved")) return <Badge className="bg-green-100 text-green-800 border-green-300">Resolved</Badge>;
  return <Badge variant="secondary">{outcome}</Badge>;
}

function isLocked(record: RightToRefuse): boolean {
  if (!record.lockedAt) return false;
  return new Date() > new Date(record.lockedAt);
}

const emptyForm = (): Partial<RightToRefuse> => ({
  workerName: "",
  refusalDate: new Date().toISOString().slice(0, 10),
  refusalTime: new Date().toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false }),
  zone: "Zone 3 — Production",
  hazardDescription: "",
  supervisorNotified: false,
  supervisorName: "",
  jhscRepNotified: false,
  inspectorCalled: false,
  molFileNumber: "",
  outcome: "Ongoing",
  notes: "",
});

export default function RightToRefusePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<RightToRefuse | null>(null);
  const [form, setForm] = useState(emptyForm());

  const { data: items, isLoading } = useQuery<RightToRefuse[]>({
    queryKey: ["right-to-refuse"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/right-to-refuse`, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Error ${r.status}`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => fetch(`${BASE}/api/right-to-refuse`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["right-to-refuse"] }); setIsOpen(false); toast({ title: "Right-to-Refuse logged" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => fetch(`${BASE}/api/right-to-refuse/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error); }); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["right-to-refuse"] }); setIsOpen(false); setEditing(null); toast({ title: "Record updated" }); },
    onError: (e: any) => toast({ title: "Cannot update", description: e.message, variant: "destructive" }),
  });

  const handleCreate = () => { setEditing(null); setForm(emptyForm()); setIsOpen(true); };
  const handleEdit = (item: RightToRefuse) => { setEditing(item); setForm({ ...item }); setIsOpen(true); };
  const handleSubmit = () => {
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const ongoing = items?.filter(r => r.outcome === "Ongoing").length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldX className="w-8 h-8 text-red-600" />
            Right to Refuse Tracker
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">OHSA s.43 — Worker right to refuse unsafe work. Confidential — Worker Co-Chair only.</p>
        </div>
        <Button onClick={handleCreate} className="bg-red-600 hover:bg-red-700 text-white font-bold shrink-0">
          <Plus className="w-4 h-4 mr-2" /> Log Refusal
        </Button>
      </div>

      {ongoing > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-md bg-red-50 border border-red-200">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span className="text-sm font-semibold text-red-800">{ongoing} active right-to-refuse situation{ongoing !== 1 ? "s" : ""} requiring attention.</span>
        </div>
      )}

      <div className="rounded-md border shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50 border-b-2 border-border">
              <TableRow>
                <TableHead className="font-bold text-xs uppercase tracking-wider w-[80px] hidden sm:table-cell">Code</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider w-[80px] hidden md:table-cell">Date</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Worker / Hazard</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider hidden md:table-cell">Notified</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider w-[120px]">Outcome</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No right-to-refuse records on file.</TableCell>
                </TableRow>
              ) : (
                items?.map((item) => (
                  <TableRow key={item.id} className="group">
                    <TableCell className="font-mono text-xs font-semibold hidden sm:table-cell">{item.refuseCode}</TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground hidden md:table-cell">{format(new Date(item.refusalDate), 'MMM d')}<br /><span className="text-xs">{item.refusalTime}</span></TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 sm:hidden">
                          <span className="font-mono text-[10px] text-muted-foreground">{item.refuseCode}</span>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(item.refusalDate), 'MMM d')}</span>
                        </div>
                        <p className="text-sm font-semibold">{item.workerName}</p>
                        <span className="text-xs text-muted-foreground">{item.zone}</span>
                        <span className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.hazardDescription}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                        {item.supervisorNotified && <span>✓ Supervisor</span>}
                        {item.jhscRepNotified && <span>✓ JHSC Rep</span>}
                        {item.inspectorCalled && <span>✓ MOL Inspector</span>}
                      </div>
                    </TableCell>
                    <TableCell>{outcomeBadge(item.outcome)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {isLocked(item) && <Lock className="w-3 h-3 text-muted-foreground" />}
                        {!isLocked(item) && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={() => handleEdit(item)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase tracking-tight flex items-center gap-2">
              <ShieldX className="w-5 h-5 text-red-600" />
              {editing ? `Edit ${editing.refuseCode}` : "Log Right-to-Refuse"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-muted-foreground">Refusal Date</label>
                <Input type="date" value={form.refusalDate || ""} onChange={e => setForm(f => ({ ...f, refusalDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-muted-foreground">Time</label>
                <Input type="time" value={form.refusalTime || ""} onChange={e => setForm(f => ({ ...f, refusalTime: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-muted-foreground">Worker Name (kept confidential)</label>
              <Input value={form.workerName || ""} onChange={e => setForm(f => ({ ...f, workerName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-muted-foreground">Zone / Area</label>
              <Select value={form.zone || ""} onValueChange={v => setForm(f => ({ ...f, zone: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ZONES.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-muted-foreground">Hazard Description</label>
              <Textarea className="h-20 resize-none" value={form.hazardDescription || ""} onChange={e => setForm(f => ({ ...f, hazardDescription: e.target.value }))} />
            </div>
            <div className="space-y-3 border rounded-md p-4 bg-muted/30">
              <p className="text-xs uppercase font-bold text-muted-foreground">Notifications</p>
              <div className="flex items-center gap-3">
                <Checkbox id="sup" checked={!!form.supervisorNotified} onCheckedChange={c => setForm(f => ({ ...f, supervisorNotified: !!c }))} />
                <Label htmlFor="sup" className="text-sm">Supervisor notified</Label>
              </div>
              {form.supervisorNotified && (
                <Input className="ml-6 h-8 text-sm w-60" placeholder="Supervisor name" value={form.supervisorName || ""} onChange={e => setForm(f => ({ ...f, supervisorName: e.target.value }))} />
              )}
              <div className="flex items-center gap-3">
                <Checkbox id="jhsc" checked={!!form.jhscRepNotified} onCheckedChange={c => setForm(f => ({ ...f, jhscRepNotified: !!c }))} />
                <Label htmlFor="jhsc" className="text-sm">JHSC Rep notified</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="mol" checked={!!form.inspectorCalled} onCheckedChange={c => setForm(f => ({ ...f, inspectorCalled: !!c }))} />
                <Label htmlFor="mol" className="text-sm">MOL Inspector called</Label>
              </div>
              {form.inspectorCalled && (
                <Input className="ml-6 h-8 text-sm w-60" placeholder="MOL file number" value={form.molFileNumber || ""} onChange={e => setForm(f => ({ ...f, molFileNumber: e.target.value }))} />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-muted-foreground">Outcome</label>
              <Select value={form.outcome || "Ongoing"} onValueChange={v => setForm(f => ({ ...f, outcome: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-muted-foreground">Notes</label>
              <Textarea className="h-16 resize-none" value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            {editing && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                This record locks automatically 24 hours after creation.
              </p>
            )}
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white font-bold" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Save Changes" : "Log Refusal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
