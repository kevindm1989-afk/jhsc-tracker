import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Pencil, Plus } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Rule {
  id: number;
  eventType: string;
  title: string;
  body: string;
  targetType: string;
  targetValue: string;
  enabled: boolean;
  createdAt: string | null;
}

const EVENT_TYPES = [
  { value: "hazard_created", label: "Hazard / Recommendation Created" },
  { value: "rtr_filed", label: "Right-to-Refuse Filed" },
  { value: "meeting_scheduled", label: "Meeting Scheduled" },
  { value: "inspection_completed", label: "Inspection Completed" },
  { value: "action_item_overdue", label: "Action Item Overdue" },
];

const ROLES = ["admin", "co-chair", "member", "worker-rep", "management"];

const EMPTY: Omit<Rule, "id" | "createdAt"> = {
  eventType: "",
  title: "",
  body: "",
  targetType: "role",
  targetValue: "",
  enabled: true,
};

export default function NotificationRulesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

  const { data: rules = [], isLoading } = useQuery<Rule[]>({
    queryKey: ["notification-rules"],
    queryFn: () =>
      fetch(`${BASE}/api/notifications/rules`, { credentials: "include" }).then((r) =>
        r.json(),
      ),
  });

  const { data: members = [] } = useQuery<{ id: number; name: string; role: string }[]>({
    queryKey: ["notification-members"],
    queryFn: () =>
      fetch(`${BASE}/api/notifications/members`, { credentials: "include" }).then((r) =>
        r.json(),
      ),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = editing
        ? `${BASE}/api/notifications/rules/${editing.id}`
        : `${BASE}/api/notifications/rules`;
      const method = editing ? "PATCH" : "POST";
      const payload = {
        ...form,
        targetValue: form.targetType === "all" ? "all" : form.targetValue,
      };
      const resp = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error("Failed to save");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-rules"] });
      setOpen(false);
      toast({ title: editing ? "Rule updated" : "Rule created" });
    },
    onError: () => toast({ title: "Error saving rule", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${BASE}/api/notifications/rules/${id}`, {
        method: "DELETE",
        credentials: "include",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-rules"] });
      toast({ title: "Rule deleted" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      fetch(`${BASE}/api/notifications/rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-rules"] }),
  });

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY });
    setOpen(true);
  }

  function openEdit(rule: Rule) {
    setEditing(rule);
    setForm({
      eventType: rule.eventType,
      title: rule.title,
      body: rule.body,
      targetType: rule.targetType,
      targetValue: rule.targetValue,
      enabled: rule.enabled,
    });
    setOpen(true);
  }

  const eventLabel = (type: string) =>
    EVENT_TYPES.find((e) => e.value === type)?.label ?? type;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Notification Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automatically send push notifications when events occur.
          </p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New Rule
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading rules...</p>
      )}

      {!isLoading && rules.length === 0 && (
        <p className="text-sm text-muted-foreground">No rules configured yet.</p>
      )}

      <div className="space-y-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="border rounded-lg p-4 flex items-start justify-between gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{rule.title}</span>
                <Badge variant="outline" className="text-xs">
                  {eventLabel(rule.eventType)}
                </Badge>
                <Badge variant="secondary" className="text-xs capitalize">
                  {rule.targetType}: {rule.targetValue}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{rule.body}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch
                checked={rule.enabled}
                onCheckedChange={(v) => toggleMutation.mutate({ id: rule.id, enabled: v })}
              />
              <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteMutation.mutate(rule.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Rule" : "New Notification Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Event Type</Label>
              <Select
                value={form.eventType}
                onValueChange={(v) => setForm((f) => ({ ...f, eventType: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select event..." />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notification Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. New Hazard Filed"
              />
            </div>

            <div>
              <Label>Notification Body</Label>
              <Input
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="e.g. A new hazard has been logged in the system"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Target Type</Label>
                <Select
                  value={form.targetType}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, targetType: v, targetValue: "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    <SelectItem value="role">By Role</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.targetType === "role" && (
                <div>
                  <Label>Role</Label>
                  <Select
                    value={form.targetValue}
                    onValueChange={(v) => setForm((f) => ({ ...f, targetValue: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {form.targetType === "individual" && (
                <div>
                  <Label>Member</Label>
                  <Select
                    value={form.targetValue}
                    onValueChange={(v) => setForm((f) => ({ ...f, targetValue: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select member..." />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.name} ({m.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {form.targetType === "all" && (
                <div className="flex items-end">
                  <span className="text-sm text-muted-foreground pb-2">
                    Sends to all registered devices
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="enabled"
                checked={form.enabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              />
              <Label htmlFor="enabled">Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={
                saveMutation.isPending ||
                !form.eventType ||
                !form.title ||
                !form.body ||
                (form.targetType !== "all" && !form.targetValue)
              }
            >
              {saveMutation.isPending ? "Saving..." : "Save Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
