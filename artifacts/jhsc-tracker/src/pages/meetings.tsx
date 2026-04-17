import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isAfter, isBefore, startOfDay } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays, Plus, Edit2, Trash2, ChevronDown, ChevronUp,
  MapPin, Clock, ListOrdered, X, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type AgendaItem = { item: string; notes: string };

type Meeting = {
  id: number;
  meetingCode: string;
  title: string;
  meetingType: string;
  scheduledDate: string;
  scheduledTime: string;
  location: string;
  status: string;
  agenda: AgendaItem[];
  postMeetingNotes: string | null;
  createdBy: string;
  createdAt: string;
};

const MEETING_TYPES = ["Regular", "Special", "Annual", "Emergency"];
const STATUSES = ["Scheduled", "Completed", "Cancelled"];

function typeBadge(type: string) {
  const styles: Record<string, string> = {
    Regular: "bg-blue-100 text-blue-800 border-blue-200",
    Special: "bg-purple-100 text-purple-800 border-purple-200",
    Annual: "bg-green-100 text-green-800 border-green-200",
    Emergency: "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border", styles[type] ?? "bg-muted text-muted-foreground border-border")}>
      {type}
    </span>
  );
}

function statusBadge(status: string) {
  if (status === "Scheduled") return <Badge className="bg-amber-100 text-amber-800 border border-amber-200">Scheduled</Badge>;
  if (status === "Completed") return <Badge className="bg-green-100 text-green-800 border border-green-200">Completed</Badge>;
  if (status === "Cancelled") return <Badge variant="secondary">Cancelled</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

const emptyForm = (): Partial<Meeting> & { agenda: AgendaItem[] } => ({
  title: "",
  meetingType: "Regular",
  scheduledDate: new Date().toISOString().slice(0, 10),
  scheduledTime: "09:00",
  location: "",
  status: "Scheduled",
  agenda: [],
  postMeetingNotes: "",
});

export default function MeetingsPage() {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "co-chair";
  const { toast } = useToast();
  const qc = useQueryClient();

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ["meetings"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/meetings`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load meetings");
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      fetch(`${BASE}/api/meetings`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setIsOpen(false);
      toast({ title: "Meeting scheduled" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) =>
      fetch(`${BASE}/api/meetings/${id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setIsOpen(false);
      setEditing(null);
      toast({ title: "Meeting updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${BASE}/api/meetings/${id}`, { method: "DELETE", credentials: "include" })
        .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      toast({ title: "Meeting deleted", variant: "destructive" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const today = startOfDay(new Date());
  const upcoming = meetings.filter((m) => !isBefore(parseISO(m.scheduledDate), today) && m.status !== "Cancelled");
  const past = meetings.filter((m) => isBefore(parseISO(m.scheduledDate), today) || m.status === "Cancelled");
  const displayed = tab === "upcoming" ? upcoming : past;

  const nextMeeting = upcoming[upcoming.length - 1] ?? upcoming[0];

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setIsOpen(true);
  }

  function openEdit(m: Meeting) {
    setEditing(m);
    setForm({ ...m, agenda: m.agenda ?? [] });
    setIsOpen(true);
  }

  function handleSubmit() {
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  }

  function addAgendaItem() {
    setForm((f) => ({ ...f, agenda: [...(f.agenda ?? []), { item: "", notes: "" }] }));
  }

  function removeAgendaItem(i: number) {
    setForm((f) => ({ ...f, agenda: (f.agenda ?? []).filter((_, idx) => idx !== i) }));
  }

  function updateAgendaItem(i: number, field: keyof AgendaItem, value: string) {
    setForm((f) => {
      const agenda = [...(f.agenda ?? [])];
      agenda[i] = { ...agenda[i], [field]: value };
      return { ...f, agenda };
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Meeting Schedule</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading…" : `${upcoming.length} upcoming · ${past.length} past`}
            </p>
          </div>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="shrink-0 gap-2">
            <Plus className="w-4 h-4" /> Schedule Meeting
          </Button>
        )}
      </div>

      {/* Next meeting banner */}
      {!isLoading && upcoming.length > 0 && tab === "upcoming" && (
        <div className="flex items-start gap-3 p-4 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <CalendarDays className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
              Next: {upcoming[0].title}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
              {format(parseISO(upcoming[0].scheduledDate), "EEEE, MMMM d, yyyy")} at {upcoming[0].scheduledTime} · {upcoming[0].location}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize",
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t} ({t === "upcoming" ? upcoming.length : past.length})
          </button>
        ))}
      </div>

      {/* Meeting list */}
      <div className="space-y-3">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          ))
        ) : displayed.length === 0 ? (
          <div className="border rounded-lg py-16 text-center text-muted-foreground text-sm">
            {tab === "upcoming" ? "No upcoming meetings scheduled." : "No past meetings on record."}
          </div>
        ) : (
          displayed.map((m) => {
            const expanded = expandedId === m.id;
            return (
              <div key={m.id} className="border rounded-lg overflow-hidden bg-card shadow-sm">
                {/* Row */}
                <button
                  className="w-full text-left px-4 py-4 hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : m.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-muted-foreground">{m.meetingCode}</span>
                        {typeBadge(m.meetingType)}
                        {statusBadge(m.status)}
                      </div>
                      <p className="text-base font-semibold text-foreground">{m.title}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {format(parseISO(m.scheduledDate), "EEE, MMM d, yyyy")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {m.scheduledTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {m.location}
                        </span>
                        {m.agenda.length > 0 && (
                          <span className="flex items-center gap-1">
                            <ListOrdered className="w-3 h-3" />
                            {m.agenda.length} agenda item{m.agenda.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {canManage && (
                        <>
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); openEdit(m); }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm("Delete this meeting?")) deleteMutation.mutate(m.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {expanded
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                </button>

                {/* Expanded */}
                {expanded && (
                  <div className="border-t bg-muted/20 px-4 py-4 space-y-4">
                    {m.agenda.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                          <ListOrdered className="w-3.5 h-3.5" /> Agenda
                        </p>
                        <ol className="space-y-2">
                          {m.agenda.map((a, i) => (
                            <li key={i} className="flex gap-3 text-sm">
                              <span className="font-semibold text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                              <div>
                                <p className="font-medium text-foreground">{a.item}</p>
                                {a.notes && <p className="text-muted-foreground text-xs mt-0.5">{a.notes}</p>}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {m.postMeetingNotes && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                          <ClipboardList className="w-3.5 h-3.5" /> Post-Meeting Notes
                        </p>
                        <p className="text-sm text-foreground whitespace-pre-wrap border-l-2 border-blue-300 pl-3">{m.postMeetingNotes}</p>
                      </div>
                    )}
                    {m.agenda.length === 0 && !m.postMeetingNotes && (
                      <p className="text-sm text-muted-foreground">No agenda items or notes added.</p>
                    )}
                    <p className="text-[11px] text-muted-foreground/60">Scheduled by {m.createdBy}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              {editing ? "Edit Meeting" : "Schedule a Meeting"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-muted-foreground">Meeting Title</label>
              <Input
                placeholder="e.g. Monthly JHSC Meeting — April 2026"
                value={form.title ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            {/* Type & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-muted-foreground">Meeting Type</label>
                <Select value={form.meetingType ?? "Regular"} onValueChange={(v) => setForm((f) => ({ ...f, meetingType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MEETING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-muted-foreground">Status</label>
                <Select value={form.status ?? "Scheduled"} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-muted-foreground">Date</label>
                <Input type="date" value={form.scheduledDate ?? ""} onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-muted-foreground">Time</label>
                <Input type="time" value={form.scheduledTime ?? ""} onChange={(e) => setForm((f) => ({ ...f, scheduledTime: e.target.value }))} />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-muted-foreground">Location / Room</label>
              <Input
                placeholder="e.g. Boardroom A, Room 204"
                value={form.location ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>

            {/* Agenda */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase font-bold text-muted-foreground">Agenda Items</label>
                <Button variant="outline" size="sm" onClick={addAgendaItem} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add Item
                </Button>
              </div>
              {(form.agenda ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground border rounded-md p-3 text-center">No agenda items yet. Click "Add Item" to start building the agenda.</p>
              ) : (
                <div className="space-y-2">
                  {(form.agenda ?? []).map((a, i) => (
                    <div key={i} className="flex gap-2 items-start border rounded-md p-3 bg-muted/20">
                      <span className="text-xs font-bold text-muted-foreground w-5 mt-2 shrink-0">{i + 1}.</span>
                      <div className="flex-1 space-y-1.5">
                        <Input
                          placeholder="Agenda item"
                          value={a.item}
                          onChange={(e) => updateAgendaItem(i, "item", e.target.value)}
                          className="h-8 text-sm"
                        />
                        <Input
                          placeholder="Notes (optional)"
                          value={a.notes}
                          onChange={(e) => updateAgendaItem(i, "notes", e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeAgendaItem(i)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Post-meeting notes */}
            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-muted-foreground">Post-Meeting Notes</label>
              <Textarea
                placeholder="Add notes, decisions, or outcomes after the meeting…"
                className="h-20 resize-none text-sm"
                value={form.postMeetingNotes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, postMeetingNotes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? "Save Changes" : "Schedule Meeting"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
