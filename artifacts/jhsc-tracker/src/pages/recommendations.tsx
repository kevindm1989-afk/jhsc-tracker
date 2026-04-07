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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit2, FileWarning, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Recommendation = {
  id: number;
  recCode: string;
  dateIssued: string;
  ohsaAuthority: string;
  description: string;
  linkedHazardCode: string | null;
  responseDeadline: string;
  responseReceived: string;
  responseOutcome: string;
  escalationStatus: string;
  notes: string | null;
  status: string;
};

const ESCALATION_OPTIONS = ["None", "Pending Ministry Contact", "Escalated to MOL", "Resolved by MOL"];
const RESPONSE_OUTCOME_OPTIONS = ["Pending", "Accepted", "Partially Accepted", "Rejected", "Under Review"];

function statusBadge(rec: Recommendation) {
  const today = new Date().toISOString().slice(0, 10);
  if (rec.escalationStatus === "Escalated to MOL")
    return <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-semibold">Escalated</Badge>;
  if (rec.responseReceived === "Yes" && rec.responseOutcome === "Accepted")
    return <Badge className="bg-green-100 text-green-800 border-green-300 font-semibold"><CheckCircle2 className="w-3 h-3 mr-1" />Accepted</Badge>;
  if (rec.responseReceived === "Yes" && rec.responseOutcome === "Rejected")
    return <Badge className="bg-red-100 text-red-800 border-red-300 font-semibold">Rejected</Badge>;
  if (rec.responseReceived === "Yes")
    return <Badge variant="secondary">Responded</Badge>;
  if (rec.responseDeadline < today)
    return <Badge className="bg-red-100 text-red-800 border-red-300 font-semibold"><AlertTriangle className="w-3 h-3 mr-1" />Overdue</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 font-semibold"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
}

const emptyForm = (): Partial<Recommendation> => ({
  dateIssued: new Date().toISOString().slice(0, 10),
  ohsaAuthority: "",
  description: "",
  linkedHazardCode: "",
  responseDeadline: "",
  responseReceived: "No",
  responseOutcome: "Pending",
  escalationStatus: "None",
  notes: "",
});

export default function RecommendationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEditable = user?.role === "admin" || user?.role === "worker-rep";

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Recommendation | null>(null);
  const [form, setForm] = useState(emptyForm());

  const { data: items, isLoading } = useQuery<Recommendation[]>({
    queryKey: ["recommendations"],
    queryFn: () => fetch(`${BASE}/api/recommendations`, { credentials: "include" }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => fetch(`${BASE}/api/recommendations`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recommendations"] }); setIsOpen(false); toast({ title: "Recommendation logged" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => fetch(`${BASE}/api/recommendations/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recommendations"] }); setIsOpen(false); setEditing(null); toast({ title: "Recommendation updated" }); },
  });

  const handleCreate = () => { setEditing(null); setForm(emptyForm()); setIsOpen(true); };
  const handleEdit = (item: Recommendation) => { setEditing(item); setForm({ ...item }); setIsOpen(true); };

  const handleSubmit = () => {
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const overdue = items?.filter(r => r.responseDeadline < new Date().toISOString().slice(0, 10) && r.responseReceived !== "Yes").length || 0;
  const pending = items?.filter(r => r.responseReceived === "No" && r.responseDeadline >= new Date().toISOString().slice(0, 10)).length || 0;
  const escalated = items?.filter(r => r.escalationStatus === "Escalated to MOL").length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileWarning className="w-8 h-8 text-amber-600" />
            Recommendations Register
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">OHSA s.9(20) — Formal JHSC recommendations to management.</p>
        </div>
        {isEditable && (
          <Button onClick={handleCreate} className="bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0">
            <Plus className="w-4 h-4 mr-2" /> New Recommendation
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700 font-medium">Overdue</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-red-700 font-mono">{overdue}</div></CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-yellow-700 font-medium">Awaiting Response</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-yellow-700 font-mono">{pending}</div></CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-purple-700 font-medium">Escalated to MOL</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-purple-700 font-mono">{escalated}</div></CardContent>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-md border shadow-sm">
        <div className="min-w-[900px] bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50 border-b-2 border-border">
              <TableRow>
                <TableHead className="font-bold text-xs uppercase tracking-wider w-[90px]">Code</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider w-[100px]">Date</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Description & OHSA Authority</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider w-[110px]">Deadline</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider w-[130px]">Escalation</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider w-[130px]">Status</TableHead>
                {isEditable && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(isEditable ? 7 : 6).fill(0).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isEditable ? 7 : 6} className="h-32 text-center text-muted-foreground">
                    No recommendations on record.
                  </TableCell>
                </TableRow>
              ) : (
                items?.map((item) => (
                  <TableRow key={item.id} className="group">
                    <TableCell className="font-mono text-xs font-semibold">{item.recCode}</TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">{format(new Date(item.dateIssued), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{item.description}</p>
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{item.ohsaAuthority}</span>
                      {item.linkedHazardCode && <span className="text-[10px] text-muted-foreground ml-2">→ {item.linkedHazardCode}</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{format(new Date(item.responseDeadline), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      {item.escalationStatus !== "None" ? (
                        <span className="text-xs text-purple-700 font-medium">{item.escalationStatus}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(item)}</TableCell>
                    {isEditable && (
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEdit(item)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase tracking-tight flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-amber-600" />
              {editing ? `Edit ${editing.recCode}` : "New Recommendation"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-muted-foreground">Date Issued</label>
                <Input type="date" value={form.dateIssued || ""} onChange={e => setForm(f => ({ ...f, dateIssued: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-muted-foreground">Response Deadline</label>
                <Input type="date" value={form.responseDeadline || ""} onChange={e => setForm(f => ({ ...f, responseDeadline: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-muted-foreground">OHSA Authority</label>
              <Input placeholder="e.g. OHSA s.9(20)(a)" value={form.ohsaAuthority || ""} onChange={e => setForm(f => ({ ...f, ohsaAuthority: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-muted-foreground">Description / Recommendation</label>
              <Textarea className="h-24 resize-none" value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-muted-foreground">Linked Hazard Code (optional)</label>
              <Input placeholder="e.g. HF-012" value={form.linkedHazardCode || ""} onChange={e => setForm(f => ({ ...f, linkedHazardCode: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-muted-foreground">Response Received</label>
                <Select value={form.responseReceived || "No"} onValueChange={v => setForm(f => ({ ...f, responseReceived: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="Yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-muted-foreground">Response Outcome</label>
                <Select value={form.responseOutcome || "Pending"} onValueChange={v => setForm(f => ({ ...f, responseOutcome: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESPONSE_OUTCOME_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-muted-foreground">Escalation Status</label>
              <Select value={form.escalationStatus || "None"} onValueChange={v => setForm(f => ({ ...f, escalationStatus: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESCALATION_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-muted-foreground">Notes</label>
              <Textarea className="h-20 resize-none" value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Save Changes" : "Log Recommendation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
