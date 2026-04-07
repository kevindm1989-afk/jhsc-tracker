import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit2, FileText, Download, Mail, Trash2, CheckCircle2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Attendee = { name: string; title: string };
type AgendaItem = { topic: string; notes: string };
type ActionItem = { title: string; assignedTo: string; dueDate: string };

type MeetingMinutes = {
  id: number;
  minutesCode: string;
  meetingDate: string;
  meetingType: string;
  managementAttendees: Attendee[];
  workerAttendees: Attendee[];
  agendaItems: AgendaItem[];
  motions: string[];
  decisions: string | null;
  actionItems: ActionItem[];
  nextMeetingDate: string | null;
  workerCoChairSigned: boolean;
  managementCoChairSigned: boolean;
  emailedAt: string | null;
};

const MEETING_TYPES = ["Regular Monthly", "Emergency", "Special", "Inspection Follow-Up"];

const emptyForm = (): Partial<MeetingMinutes> => ({
  meetingDate: new Date().toISOString().slice(0, 10),
  meetingType: "Regular Monthly",
  managementAttendees: [],
  workerAttendees: [],
  agendaItems: [],
  motions: [],
  decisions: "",
  actionItems: [],
  nextMeetingDate: "",
  workerCoChairSigned: false,
  managementCoChairSigned: false,
});

function AttendeeList({ label, value, onChange }: { label: string; value: Attendee[]; onChange: (v: Attendee[]) => void }) {
  const add = () => onChange([...value, { name: "", title: "" }]);
  const update = (i: number, field: keyof Attendee, v: string) => { const n = [...value]; n[i] = { ...n[i], [field]: v }; onChange(n); };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs uppercase font-bold text-muted-foreground">{label}</label>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={add}><Plus className="w-3 h-3 mr-1" />Add</Button>
      </div>
      {value.map((a, i) => (
        <div key={i} className="flex gap-2">
          <Input placeholder="Name" className="h-8 text-sm" value={a.name} onChange={e => update(i, "name", e.target.value)} />
          <Input placeholder="Title/Role" className="h-8 text-sm" value={a.title} onChange={e => update(i, "title", e.target.value)} />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>
        </div>
      ))}
    </div>
  );
}

function AgendaList({ value, onChange }: { value: AgendaItem[]; onChange: (v: AgendaItem[]) => void }) {
  const add = () => onChange([...value, { topic: "", notes: "" }]);
  const update = (i: number, field: keyof AgendaItem, v: string) => { const n = [...value]; n[i] = { ...n[i], [field]: v }; onChange(n); };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs uppercase font-bold text-muted-foreground">Agenda Items</label>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={add}><Plus className="w-3 h-3 mr-1" />Add Item</Button>
      </div>
      {value.map((a, i) => (
        <div key={i} className="border rounded-md p-3 space-y-2 bg-muted/20">
          <div className="flex gap-2">
            <span className="text-xs font-bold text-muted-foreground pt-2 w-4 shrink-0">{i + 1}.</span>
            <Input placeholder="Agenda topic" className="h-8 text-sm" value={a.topic} onChange={e => update(i, "topic", e.target.value)} />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>
          </div>
          <Textarea placeholder="Discussion notes..." className="h-14 resize-none text-sm ml-6" value={a.notes} onChange={e => update(i, "notes", e.target.value)} />
        </div>
      ))}
    </div>
  );
}

function ActionItemList({ value, onChange }: { value: ActionItem[]; onChange: (v: ActionItem[]) => void }) {
  const add = () => onChange([...value, { title: "", assignedTo: "", dueDate: "" }]);
  const update = (i: number, field: keyof ActionItem, v: string) => { const n = [...value]; n[i] = { ...n[i], [field]: v }; onChange(n); };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs uppercase font-bold text-muted-foreground">Action Items from Minutes</label>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={add}><Plus className="w-3 h-3 mr-1" />Add</Button>
      </div>
      {value.map((a, i) => (
        <div key={i} className="flex gap-2">
          <Input placeholder="Action" className="h-8 text-sm flex-1" value={a.title} onChange={e => update(i, "title", e.target.value)} />
          <Input placeholder="Assigned to" className="h-8 text-sm w-36" value={a.assignedTo} onChange={e => update(i, "assignedTo", e.target.value)} />
          <Input type="date" className="h-8 text-sm w-36 font-mono" value={a.dueDate} onChange={e => update(i, "dueDate", e.target.value)} />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>
        </div>
      ))}
    </div>
  );
}

export default function MeetingMinutesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEditable = user?.role === "admin" || user?.role === "worker-rep";

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<MeetingMinutes | null>(null);
  const [form, setForm] = useState<Partial<MeetingMinutes>>(emptyForm());
  const [emailInput, setEmailInput] = useState("");
  const [emailDialogId, setEmailDialogId] = useState<number | null>(null);

  const { data: items, isLoading } = useQuery<MeetingMinutes[]>({
    queryKey: ["meeting-minutes"],
    queryFn: () => fetch(`${BASE}/api/meeting-minutes`, { credentials: "include" }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => fetch(`${BASE}/api/meeting-minutes`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meeting-minutes"] }); setIsOpen(false); toast({ title: "Meeting minutes saved" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => fetch(`${BASE}/api/meeting-minutes/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meeting-minutes"] }); setIsOpen(false); setEditing(null); toast({ title: "Meeting minutes updated" }); },
  });

  const emailMutation = useMutation({
    mutationFn: ({ id, email }: any) => fetch(`${BASE}/api/meeting-minutes/${id}/email`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientEmail: email }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meeting-minutes"] }); setEmailDialogId(null); toast({ title: "Minutes emailed successfully" }); },
    onError: () => toast({ title: "Email failed", variant: "destructive" }),
  });

  const handleCreate = () => { setEditing(null); setForm(emptyForm()); setIsOpen(true); };
  const handleEdit = (item: MeetingMinutes) => { setEditing(item); setForm({ ...item }); setIsOpen(true); };
  const handleSubmit = () => {
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const downloadPDF = (item: MeetingMinutes) => {
    window.open(`${BASE}/api/meeting-minutes/${item.id}/pdf`, "_blank");
  };

  const f = form as any;
  const setF = (field: string, v: any) => setForm(prev => ({ ...prev, [field]: v }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="w-8 h-8 text-blue-600" />
            Meeting Minutes
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">OHSA s.9(33) — JHSC meeting records. Generate and email PDF minutes.</p>
        </div>
        {isEditable && (
          <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shrink-0">
            <Plus className="w-4 h-4 mr-2" /> New Minutes
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border shadow-sm">
        <div className="min-w-[800px] bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50 border-b-2 border-border">
              <TableRow>
                <TableHead className="font-bold text-xs uppercase tracking-wider w-[90px]">Code</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider w-[110px]">Date</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Type</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Signatures</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider w-[80px]">Emailed</TableHead>
                <TableHead className="w-[140px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(6).fill(0).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No meeting minutes recorded.</TableCell>
                </TableRow>
              ) : (
                items?.map((item) => (
                  <TableRow key={item.id} className="group">
                    <TableCell className="font-mono text-xs font-semibold">{item.minutesCode}</TableCell>
                    <TableCell className="text-sm tabular-nums">{format(new Date(item.meetingDate), 'MMMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{item.meetingType}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {item.workerCoChairSigned ? (
                          <span className="text-xs text-green-700 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> Worker</span>
                        ) : <span className="text-xs text-muted-foreground">Worker pending</span>}
                        {item.managementCoChairSigned ? (
                          <span className="text-xs text-green-700 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> Mgmt</span>
                        ) : <span className="text-xs text-muted-foreground">Mgmt pending</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.emailedAt ? (
                        <span className="text-xs text-green-700"><CheckCircle2 className="w-3 h-3 inline mr-0.5" />{format(new Date(item.emailedAt), 'MMM d')}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Download PDF" onClick={() => downloadPDF(item)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {isEditable && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Email PDF" onClick={() => { setEmailDialogId(item.id); setEmailInput(""); }}>
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => handleEdit(item)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Email dialog */}
      <Dialog open={emailDialogId !== null} onOpenChange={() => setEmailDialogId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="w-4 h-4" /> Email PDF Minutes</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Enter the recipient email address for the meeting minutes PDF.</p>
            <Input type="email" placeholder="recipient@example.com" value={emailInput} onChange={e => setEmailInput(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogId(null)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold" onClick={() => { if (emailDialogId) emailMutation.mutate({ id: emailDialogId, email: emailInput }); }} disabled={!emailInput || emailMutation.isPending}>
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              {editing ? `Edit ${editing.minutesCode}` : "Record Meeting Minutes"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-muted-foreground">Meeting Date</label>
                <Input type="date" value={f.meetingDate || ""} onChange={e => setF("meetingDate", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-muted-foreground">Meeting Type</label>
                <Select value={f.meetingType || "Regular Monthly"} onValueChange={v => setF("meetingType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MEETING_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <AttendeeList label="Management Attendees" value={f.managementAttendees || []} onChange={v => setF("managementAttendees", v)} />
            <AttendeeList label="Worker Attendees" value={f.workerAttendees || []} onChange={v => setF("workerAttendees", v)} />
            <AgendaList value={f.agendaItems || []} onChange={v => setF("agendaItems", v)} />

            <div className="space-y-2">
              <label className="text-xs uppercase font-bold text-muted-foreground">Motions Made</label>
              {(f.motions || []).map((m: string, i: number) => (
                <div key={i} className="flex gap-2">
                  <Input className="h-8 text-sm" value={m} onChange={e => { const n = [...(f.motions || [])]; n[i] = e.target.value; setF("motions", n); }} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setF("motions", (f.motions || []).filter((_: any, idx: number) => idx !== i))}><Trash2 className="w-3 h-3" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setF("motions", [...(f.motions || []), ""])}><Plus className="w-3 h-3 mr-1" />Add Motion</Button>
            </div>

            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-muted-foreground">Decisions Reached</label>
              <Textarea className="h-20 resize-none" value={f.decisions || ""} onChange={e => setF("decisions", e.target.value)} />
            </div>

            <ActionItemList value={f.actionItems || []} onChange={v => setF("actionItems", v)} />

            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-muted-foreground">Next Meeting Date</label>
              <Input type="date" className="w-48" value={f.nextMeetingDate || ""} onChange={e => setF("nextMeetingDate", e.target.value)} />
            </div>

            <div className="space-y-3 border rounded-md p-4 bg-muted/20">
              <p className="text-xs uppercase font-bold text-muted-foreground">Signatures</p>
              <div className="flex items-center gap-3">
                <Checkbox id="wsig" checked={!!f.workerCoChairSigned} onCheckedChange={c => setF("workerCoChairSigned", !!c)} />
                <Label htmlFor="wsig" className="text-sm">Worker Co-Chair signed</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="msig" checked={!!f.managementCoChairSigned} onCheckedChange={c => setF("managementCoChairSigned", !!c)} />
                <Label htmlFor="msig" className="text-sm">Management Co-Chair signed</Label>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Save Changes" : "Save Minutes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
