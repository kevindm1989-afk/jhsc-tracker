import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Calendar, Mail } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ReminderSettings = {
  inspectionDay?: string;
  reminderLeadDays?: string;
  coChairEmail1?: string;
  coChairEmail2?: string;
  enabled?: string;
};

export default function InspectionReminderPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin" || user?.role === "co-chair";

  const [form, setForm] = useState({
    inspectionDay: "15",
    reminderLeadDays: "5",
    coChairEmail1: "",
    coChairEmail2: "",
    enabled: false,
  });

  const { data, isLoading } = useQuery<ReminderSettings>({
    queryKey: ["inspection-schedule"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/inspection-schedule`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        inspectionDay: data.inspectionDay ?? "15",
        reminderLeadDays: data.reminderLeadDays ?? "5",
        coChairEmail1: data.coChairEmail1 ?? "",
        coChairEmail2: data.coChairEmail2 ?? "",
        enabled: data.enabled === "true",
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/inspection-schedule`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionDay: form.inspectionDay,
          reminderLeadDays: form.reminderLeadDays,
          coChairEmail1: form.coChairEmail1,
          coChairEmail2: form.coChairEmail2,
          enabled: String(form.enabled),
        }),
      });
      if (!r.ok) throw new Error("Failed to save");
      return r.json();
    },
    onSuccess: () => toast({ title: "Reminder settings saved" }),
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const leadDays = parseInt(form.reminderLeadDays) || 5;
  const day = parseInt(form.inspectionDay) || 15;

  function ordinal(n: number) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  return (
    <div className="max-w-xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-2">
        <Bell className="h-6 w-6 text-amber-500" />
        <h1 className="text-xl font-bold text-foreground">Inspection Reminder</h1>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium mb-1">How this works</p>
        <p>The system automatically emails a reminder to the co-chairs before the monthly inspection date. Configure the day of the month the inspection occurs, how many days in advance to send the reminder, and which emails to notify.</p>
        <p className="mt-2 text-xs italic">OHSA s.9(26) requires at least one inspection per month of every part of the workplace.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-5 border border-border rounded-xl bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Enable Email Reminders</p>
              <p className="text-xs text-muted-foreground mt-0.5">Turn on to send automatic reminders</p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))}
              disabled={!isAdmin}
            />
          </div>

          <hr className="border-border" />

          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Inspection Day of Month
            </label>
            <Input
              className="mt-1 max-w-[120px]"
              type="number"
              min={1}
              max={28}
              value={form.inspectionDay}
              onChange={e => setForm(f => ({ ...f, inspectionDay: e.target.value }))}
              disabled={!isAdmin}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Inspection is scheduled for the <strong>{ordinal(day)}</strong> of each month
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Send Reminder How Many Days Before?</label>
            <Input
              className="mt-1 max-w-[120px]"
              type="number"
              min={1}
              max={14}
              value={form.reminderLeadDays}
              onChange={e => setForm(f => ({ ...f, reminderLeadDays: e.target.value }))}
              disabled={!isAdmin}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Reminder email will be sent <strong>{leadDays} day{leadDays !== 1 ? "s" : ""}</strong> before the inspection
            </p>
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Recipient Email 1
            </label>
            <Input
              className="mt-1"
              type="email"
              placeholder="cochair@example.com"
              value={form.coChairEmail1}
              onChange={e => setForm(f => ({ ...f, coChairEmail1: e.target.value }))}
              disabled={!isAdmin}
            />
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Recipient Email 2 (optional)
            </label>
            <Input
              className="mt-1"
              type="email"
              placeholder="manager@example.com"
              value={form.coChairEmail2}
              onChange={e => setForm(f => ({ ...f, coChairEmail2: e.target.value }))}
              disabled={!isAdmin}
            />
          </div>

          {isAdmin && (
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
              {save.isPending ? "Saving..." : "Save Settings"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
