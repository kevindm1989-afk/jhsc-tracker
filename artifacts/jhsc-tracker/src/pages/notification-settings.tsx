import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Mail, FileText, AlertTriangle, CalendarDays } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Settings = {
  notifyOnNewHSReport?: string;
  notifyOnNewIncident?: string;
  notifyOnNewMeeting?: string;
  notificationEmails?: string;
};

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin" || user?.role === "co-chair";

  const [form, setForm] = useState({
    notifyOnNewHSReport: false,
    notifyOnNewIncident: false,
    notifyOnNewMeeting: false,
    notificationEmails: "",
  });

  const { data, isLoading } = useQuery<Settings>({
    queryKey: ["notification-settings"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/notification-settings`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        notifyOnNewHSReport: data.notifyOnNewHSReport === "true",
        notifyOnNewIncident: data.notifyOnNewIncident === "true",
        notifyOnNewMeeting: data.notifyOnNewMeeting === "true",
        notificationEmails: data.notificationEmails ?? "",
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/notification-settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifyOnNewHSReport: String(form.notifyOnNewHSReport),
          notifyOnNewIncident: String(form.notifyOnNewIncident),
          notifyOnNewMeeting: String(form.notifyOnNewMeeting),
          notificationEmails: form.notificationEmails,
        }),
      });
      if (!r.ok) throw new Error("Failed to save");
      return r.json();
    },
    onSuccess: () => toast({ title: "Notification settings saved" }),
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const toggle = (key: "notifyOnNewHSReport" | "notifyOnNewIncident" | "notifyOnNewMeeting", v: boolean) => {
    setForm(f => ({ ...f, [key]: v }));
  };

  return (
    <div className="max-w-xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-2">
        <Bell className="h-6 w-6 text-blue-500" />
        <h1 className="text-xl font-bold text-foreground">Notification Settings</h1>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">Automatic Email Alerts</p>
        <p>Choose which events trigger an email notification and who receives them. Emails are sent via your configured Gmail account.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-1 border border-border rounded-xl bg-card overflow-hidden">
          <NotifRow
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
            label="New H&S Concern Report"
            description="Send an alert whenever a new health & safety concern is submitted"
            checked={form.notifyOnNewHSReport}
            onChange={v => toggle("notifyOnNewHSReport", v)}
            disabled={!isAdmin}
          />
          <hr className="border-border" />
          <NotifRow
            icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
            label="New Incident / Near-Miss"
            description="Send an alert whenever an incident or near-miss is logged"
            checked={form.notifyOnNewIncident}
            onChange={v => toggle("notifyOnNewIncident", v)}
            disabled={!isAdmin}
          />
          <hr className="border-border" />
          <NotifRow
            icon={<CalendarDays className="h-4 w-4 text-muted-foreground" />}
            label="New Meeting Scheduled"
            description="Send an alert whenever a JHSC meeting is scheduled"
            checked={form.notifyOnNewMeeting}
            onChange={v => toggle("notifyOnNewMeeting", v)}
            disabled={!isAdmin}
          />
        </div>
      )}

      {!isLoading && (
        <div className="border border-border rounded-xl bg-card p-5 space-y-3">
          <label className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Notification Recipients
          </label>
          <Input
            placeholder="email1@example.com, email2@example.com"
            value={form.notificationEmails}
            onChange={e => setForm(f => ({ ...f, notificationEmails: e.target.value }))}
            disabled={!isAdmin}
          />
          <p className="text-xs text-muted-foreground">Separate multiple addresses with commas. These addresses receive all enabled notifications above.</p>

          {isAdmin && (
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full mt-2">
              {save.isPending ? "Saving..." : "Save Settings"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function NotifRow({
  icon, label, description, checked, onChange, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex items-start gap-3 min-w-0">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} className="shrink-0" />
    </div>
  );
}
