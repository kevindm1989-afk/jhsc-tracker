import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Send, Loader2, CheckCircle2, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CONCERN_OPTIONS = [
  { key: "unsafe_condition", label: "Unsafe Condition" },
  { key: "near_miss", label: "Near Miss" },
  { key: "injury_illness", label: "Injury / Illness" },
  { key: "ergonomic", label: "Ergonomic" },
  { key: "equipment", label: "Equipment" },
  { key: "housekeeping", label: "Housekeeping" },
  { key: "slip_trip_fall", label: "Slip / Trip / Fall" },
  { key: "chemical", label: "Chemical" },
  { key: "unsafe_act", label: "Unsafe Act" },
  { key: "other", label: "Other" },
];

interface Report {
  id: number;
  reportCode: string;
  employeeName: string;
  department: string;
  concernTypes: string[];
  areaLocation: string;
  incidentDate: string;
  whatHappened: string;
  submittedByName: string;
  createdAt: string;
}

const emptyForm = {
  employeeName: "",
  department: "",
  jobTitle: "",
  shift: "",
  dateReported: new Date().toISOString().slice(0, 10),
  supervisorManager: "",
  concernTypes: [] as string[],
  otherConcernType: "",
  areaLocation: "",
  incidentDate: "",
  incidentTime: "",
  equipmentTask: "",
  whatHappened: "",
  reportedToSupervisor: false,
  whoNotified: "",
  immediateActionTaken: "",
  witnesses: "",
  suggestedCorrection: "",
  employeeSignature: "",
  signatureDate: new Date().toISOString().slice(0, 10),
};

function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-2 py-2 px-3 bg-muted rounded-md mb-4">
      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">
        {number}
      </span>
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function FieldRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-start sm:items-center gap-1 sm:gap-3">
      <Label className="text-sm text-muted-foreground sm:text-right">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div>{children}</div>
    </div>
  );
}

export default function HealthSafetyReportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastCode, setLastCode] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Report[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const set = (field: keyof typeof emptyForm, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const toggleConcern = (key: string) => {
    setForm((f) => {
      const has = f.concernTypes.includes(key);
      return {
        ...f,
        concernTypes: has
          ? f.concernTypes.filter((k) => k !== key)
          : [...f.concernTypes, key],
      };
    });
  };

  const validate = () => {
    const required: Array<[keyof typeof emptyForm, string]> = [
      ["employeeName", "Employee Name"],
      ["department", "Department"],
      ["jobTitle", "Job Title"],
      ["shift", "Shift"],
      ["dateReported", "Date Reported"],
      ["supervisorManager", "Supervisor / Manager"],
      ["areaLocation", "Area / Location"],
      ["incidentDate", "Incident Date"],
      ["incidentTime", "Time"],
      ["whatHappened", "What Happened / Concern"],
      ["employeeSignature", "Employee Signature"],
      ["signatureDate", "Signature Date"],
    ];
    for (const [field, label] of required) {
      if (!form[field]) {
        toast({ title: `${label} is required`, variant: "destructive" });
        return false;
      }
    }
    if (form.concernTypes.length === 0) {
      toast({ title: "Select at least one type of concern", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/health-safety-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setLastCode(data.report.reportCode);
      setSubmitted(true);
    } catch {
      toast({ title: "Failed to submit report", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewReport = () => {
    setForm({
      ...emptyForm,
      dateReported: new Date().toISOString().slice(0, 10),
      signatureDate: new Date().toISOString().slice(0, 10),
    });
    setSubmitted(false);
    setLastCode("");
  };

  const loadHistory = async () => {
    if (showHistory) { setShowHistory(false); return; }
    setHistoryLoading(true);
    try {
      const res = await fetch(`${BASE}/api/health-safety-reports`, { credentials: "include" });
      setHistory(await res.json());
      setShowHistory(true);
    } catch {
      toast({ title: "Failed to load history", variant: "destructive" });
    } finally {
      setHistoryLoading(false);
    }
  };

  const deleteReport = async (id: number) => {
    if (!confirm("Delete this report?")) return;
    try {
      await fetch(`${BASE}/api/health-safety-reports/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      setHistory((h) => h.filter((r) => r.id !== id));
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center space-y-5 px-4">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-9 h-9 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Report Submitted</h2>
        <p className="text-muted-foreground">
          Your concern report <span className="font-mono font-semibold text-foreground">{lastCode}</span> has been saved and emailed to the Co-Chair with the completed form attached.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={handleNewReport} className="gap-2">
            <Plus className="w-4 h-4" /> Submit Another Report
          </Button>
          <Button variant="outline" onClick={loadHistory} disabled={historyLoading} className="gap-2">
            {historyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
            View History
          </Button>
        </div>
        {showHistory && (
          <div className="text-left mt-6 space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Submitted Reports
            </h3>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reports yet.</p>
            ) : (
              history.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-3 border rounded-md p-3 bg-card">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold font-mono text-foreground">{r.reportCode}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.employeeName} · {r.department}</p>
                    <p className="text-xs text-muted-foreground">{r.incidentDate} · {r.areaLocation}</p>
                  </div>
                  {(user?.role === "admin" || user?.role === "co-chair") && (
                    <Button variant="ghost" size="sm" onClick={() => deleteReport(r.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
          <ShieldAlert className="w-5 h-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Health &amp; Safety Concern Report</h1>
          <p className="text-sm text-muted-foreground">
            Joint Health &amp; Safety Committee
          </p>
        </div>
      </div>

      {/* Section 1 – Employee Details */}
      <div className="space-y-3">
        <SectionHeader number={1} title="Employee / Report Details" />
        <div className="space-y-3 pl-1">
          <FieldRow label="Name" required>
            <Input value={form.employeeName} onChange={(e) => set("employeeName", e.target.value)} placeholder="Full name" />
          </FieldRow>
          <FieldRow label="Department" required>
            <Input value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. Packaging" />
          </FieldRow>
          <FieldRow label="Job Title" required>
            <Input value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} placeholder="e.g. Operator" />
          </FieldRow>
          <FieldRow label="Shift" required>
            <Input value={form.shift} onChange={(e) => set("shift", e.target.value)} placeholder="e.g. Days / Afternoons / Nights" />
          </FieldRow>
          <FieldRow label="Date Reported" required>
            <Input type="date" value={form.dateReported} onChange={(e) => set("dateReported", e.target.value)} />
          </FieldRow>
          <FieldRow label="Supervisor / Manager" required>
            <Input value={form.supervisorManager} onChange={(e) => set("supervisorManager", e.target.value)} placeholder="Name of your supervisor" />
          </FieldRow>
        </div>
      </div>

      {/* Section 2 – Type of Concern */}
      <div className="space-y-3">
        <SectionHeader number={2} title="Type of Health & Safety Concern" />
        <div className="grid grid-cols-2 gap-2 pl-1">
          {CONCERN_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md border cursor-pointer transition-colors text-sm",
                form.concernTypes.includes(opt.key)
                  ? "border-primary bg-primary/5 text-foreground font-medium"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted/40"
              )}
            >
              <Checkbox
                checked={form.concernTypes.includes(opt.key)}
                onCheckedChange={() => toggleConcern(opt.key)}
              />
              {opt.label}
            </label>
          ))}
        </div>
        {form.concernTypes.includes("other") && (
          <div className="pl-1">
            <Input
              value={form.otherConcernType}
              onChange={(e) => set("otherConcernType", e.target.value)}
              placeholder="Describe the other concern type…"
            />
          </div>
        )}
      </div>

      {/* Section 3 – Location / Date / Time */}
      <div className="space-y-3">
        <SectionHeader number={3} title="Location / Date / Time" />
        <div className="space-y-3 pl-1">
          <FieldRow label="Area / Location" required>
            <Input value={form.areaLocation} onChange={(e) => set("areaLocation", e.target.value)} placeholder="e.g. Line 3 – Packaging Hall" />
          </FieldRow>
          <FieldRow label="Date" required>
            <Input type="date" value={form.incidentDate} onChange={(e) => set("incidentDate", e.target.value)} />
          </FieldRow>
          <FieldRow label="Time" required>
            <Input type="time" value={form.incidentTime} onChange={(e) => set("incidentTime", e.target.value)} />
          </FieldRow>
          <FieldRow label="Equipment / Task">
            <Input value={form.equipmentTask} onChange={(e) => set("equipmentTask", e.target.value)} placeholder="Optional – equipment or task involved" />
          </FieldRow>
        </div>
      </div>

      {/* Section 4 – What Happened */}
      <div className="space-y-3">
        <SectionHeader number={4} title="What Happened / Concern" />
        <Textarea
          value={form.whatHappened}
          onChange={(e) => set("whatHappened", e.target.value)}
          placeholder="Describe the incident, hazard, or concern in detail…"
          rows={5}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground text-right">{form.whatHappened.length} characters</p>
      </div>

      {/* Section 5 – Immediate Action */}
      <div className="space-y-3">
        <SectionHeader number={5} title="Immediate Action" />
        <div className="space-y-3 pl-1">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-md border bg-card">
            <Checkbox
              id="reported-to-sup"
              checked={form.reportedToSupervisor}
              onCheckedChange={(v) => set("reportedToSupervisor", !!v)}
            />
            <label htmlFor="reported-to-sup" className="text-sm cursor-pointer">
              Reported to supervisor
            </label>
          </div>
          <FieldRow label="Who was notified">
            <Input value={form.whoNotified} onChange={(e) => set("whoNotified", e.target.value)} placeholder="Name(s) of people notified" />
          </FieldRow>
          <FieldRow label="Action taken">
            <Input value={form.immediateActionTaken} onChange={(e) => set("immediateActionTaken", e.target.value)} placeholder="Describe immediate actions taken" />
          </FieldRow>
        </div>
      </div>

      {/* Section 6 – Witnesses / Corrective Action */}
      <div className="space-y-3">
        <SectionHeader number={6} title="Witnesses / Corrective Action" />
        <div className="space-y-3 pl-1">
          <FieldRow label="Witnesses">
            <Input value={form.witnesses} onChange={(e) => set("witnesses", e.target.value)} placeholder="Names of any witnesses" />
          </FieldRow>
          <FieldRow label="Suggested correction">
            <Input value={form.suggestedCorrection} onChange={(e) => set("suggestedCorrection", e.target.value)} placeholder="Recommend a corrective action" />
          </FieldRow>
        </div>
      </div>

      {/* Section 7 – Signature */}
      <div className="space-y-3">
        <SectionHeader number={7} title="Employee Signature" />
        <div className="space-y-3 pl-1">
          <FieldRow label="Signature" required>
            <Input
              value={form.employeeSignature}
              onChange={(e) => set("employeeSignature", e.target.value)}
              placeholder="Type your full name as your signature"
            />
          </FieldRow>
          <FieldRow label="Date" required>
            <Input type="date" value={form.signatureDate} onChange={(e) => set("signatureDate", e.target.value)} />
          </FieldRow>
        </div>
      </div>

      {/* Submit */}
      <div className="border-t pt-5 flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Submitting this form will save the report and automatically email a completed copy to the JHSC Co-Chair.
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={handleSubmit} disabled={submitting} className="gap-2 min-w-[160px]">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Submit Report
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={loadHistory}
            disabled={historyLoading}
            className="gap-2 text-muted-foreground"
          >
            {historyLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : showHistory ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {showHistory ? "Hide" : "Previous Reports"}
          </Button>
        </div>

        {showHistory && (
          <div className="mt-3 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Submitted Reports
            </h3>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reports yet.</p>
            ) : (
              history.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-3 border rounded-md p-3 bg-card">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold font-mono text-foreground">{r.reportCode}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.employeeName} · {r.department}</p>
                    <p className="text-xs text-muted-foreground">{r.incidentDate} · {r.areaLocation}</p>
                  </div>
                  {(user?.role === "admin" || user?.role === "co-chair") && (
                    <Button variant="ghost" size="sm" onClick={() => deleteReport(r.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
