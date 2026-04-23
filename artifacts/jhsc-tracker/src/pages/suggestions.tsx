import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, Send, Loader2, CheckCircle2, Plus, ChevronDown, ChevronUp, Trash2, ShieldCheck } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Suggestion {
  id: number;
  suggestionCode: string;
  employeeName: string;
  department: string;
  shift: string;
  dateSubmitted: string;
  dateObserved: string;
  priorityLevel: string;
  locationOfConcern: string;
  description: string;
  proposedSolution: string;
  submittedByName: string;
  createdAt: string;
}

const emptyForm = {
  employeeName: "",
  department: "",
  shift: "",
  dateSubmitted: new Date().toISOString().slice(0, 10),
  dateObserved: "",
  priorityLevel: "medium" as "high" | "medium" | "low",
  locationOfConcern: "",
  description: "",
  proposedSolution: "",
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

function FieldRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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

const PRIORITY_OPTIONS: Array<{ value: "high" | "medium" | "low"; label: string; color: string }> = [
  { value: "high", label: "High", color: "border-red-400 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300" },
  { value: "medium", label: "Medium", color: "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" },
  { value: "low", label: "Low", color: "border-green-400 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300" },
];

export default function SuggestionsPage() {
  const { user } = useAuth();
  const canSeeIdentity = user?.role === "admin" || user?.role === "co-chair" || user?.role === "worker-rep";
  const { toast } = useToast();
  const [form, setForm] = useState({ ...emptyForm });
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastCode, setLastCode] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Suggestion[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const set = (field: keyof typeof emptyForm, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const validate = () => {
    const required: Array<[keyof typeof emptyForm, string]> = [
      ...(!isAnonymous ? [["employeeName", "Employee Name"] as [keyof typeof emptyForm, string]] : []),
      ["department", "Department"],
      ["shift", "Scheduled Shift"],
      ["dateSubmitted", "Date Submitted"],
      ["dateObserved", "Date Observed"],
      ["locationOfConcern", "Location of Concern"],
      ["description", "Description of Suggestion"],
      ["proposedSolution", "Proposed Solution"],
    ];
    for (const [field, label] of required) {
      if (!form[field]) {
        toast({ title: `${label} is required`, variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, isAnonymous }),
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setLastCode(data.suggestion.suggestionCode);
      setSubmitted(true);
    } catch {
      toast({ title: "Failed to submit suggestion", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNew = () => {
    setForm({ ...emptyForm, dateSubmitted: new Date().toISOString().slice(0, 10) });
    setSubmitted(false);
    setLastCode("");
  };

  const loadHistory = async () => {
    if (showHistory) { setShowHistory(false); return; }
    setHistoryLoading(true);
    try {
      const res = await fetch(`${BASE}/api/suggestions`, { credentials: "include" });
      setHistory(await res.json());
      setShowHistory(true);
    } catch {
      toast({ title: "Failed to load history", variant: "destructive" });
    } finally {
      setHistoryLoading(false);
    }
  };

  const deleteSuggestion = async (id: number) => {
    if (!confirm("Delete this suggestion?")) return;
    try {
      await fetch(`${BASE}/api/suggestions/${id}`, { method: "DELETE", credentials: "include" });
      setHistory((h) => h.filter((s) => s.id !== id));
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
        <h2 className="text-2xl font-bold text-foreground">Suggestion Submitted</h2>
        <p className="text-muted-foreground">
          Your suggestion <span className="font-mono font-semibold text-foreground">{lastCode}</span> has been saved and emailed to the Co-Chair with the completed form attached.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={handleNew} className="gap-2">
            <Plus className="w-4 h-4" /> Submit Another
          </Button>
          <Button variant="outline" onClick={loadHistory} disabled={historyLoading} className="gap-2">
            {historyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
            View History
          </Button>
        </div>
        {showHistory && (
          <div className="text-left mt-6 space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Submitted Suggestions</h3>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No suggestions yet.</p>
            ) : (
              history.map((s) => (
                <div key={s.id} className="flex items-start justify-between gap-3 border rounded-md p-3 bg-card">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold font-mono text-foreground">{s.suggestionCode}</p>
                    <p className="text-xs text-muted-foreground truncate">{canSeeIdentity ? `${s.employeeName} · ` : ""}{s.department}</p>
                    <p className="text-xs text-muted-foreground">{s.dateObserved} · {s.locationOfConcern}</p>
                  </div>
                  {user?.role === "admin" && (
                    <Button variant="ghost" size="sm" onClick={() => deleteSuggestion(s.id)}>
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
        <div className="w-10 h-10 rounded-md bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Employee Suggestions Form</h1>
          <p className="text-sm text-muted-foreground">
            Joint Health &amp; Safety Committee
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/40">
        This form is confidential and will be reviewed by the Joint Health and Safety Committee. For questions, contact your JHSC representative.
      </p>

      {/* Section 1 – Employee Information */}
      <div className="space-y-3">
        <SectionHeader number={1} title="Employee Information" />
        <div className="space-y-3 pl-1">
          {/* Anonymous toggle */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer"
              checked={isAnonymous}
              onChange={(e) => {
                setIsAnonymous(e.target.checked);
                if (e.target.checked) set("employeeName", "");
              }}
            />
            <span className="text-sm text-foreground font-medium">Submit anonymously</span>
          </label>
          {isAnonymous && (
            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
              <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Your name will not be stored or visible to anyone if you choose anonymous. No identifying information is recorded.</span>
            </div>
          )}
          {!isAnonymous && (
            <FieldRow label="Employee Name" required>
              <Input value={form.employeeName} onChange={(e) => set("employeeName", e.target.value)} placeholder="Full name" />
            </FieldRow>
          )}
          <FieldRow label="Date Submitted" required>
            <Input type="date" value={form.dateSubmitted} onChange={(e) => set("dateSubmitted", e.target.value)} />
          </FieldRow>
          <FieldRow label="Department / Work Area" required>
            <Input value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. Packaging" />
          </FieldRow>
          <FieldRow label="Scheduled Shift" required>
            <Input value={form.shift} onChange={(e) => set("shift", e.target.value)} placeholder="e.g. Days / Afternoons / Nights" />
          </FieldRow>
        </div>
      </div>

      {/* Section 2 – Suggestion Details */}
      <div className="space-y-3">
        <SectionHeader number={2} title="Suggestion Details" />
        <div className="space-y-3 pl-1">
          <FieldRow label="Date Observed" required>
            <Input type="date" value={form.dateObserved} onChange={(e) => set("dateObserved", e.target.value)} />
          </FieldRow>

          <FieldRow label="Priority Level" required>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set("priorityLevel", opt.value)}
                  className={`flex-1 py-1.5 text-sm font-semibold rounded-md border-2 transition-colors ${
                    form.priorityLevel === opt.value
                      ? opt.color + " border-current"
                      : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </FieldRow>

          <FieldRow label="Location of Concern" required>
            <Input value={form.locationOfConcern} onChange={(e) => set("locationOfConcern", e.target.value)} placeholder="e.g. Line 3 – Packaging Hall" />
          </FieldRow>
        </div>
      </div>

      {/* Section 3 – Description */}
      <div className="space-y-3">
        <SectionHeader number={3} title="Description of Suggestion / Concern" />
        <Textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Describe your suggestion or concern in detail…"
          rows={5}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground text-right">{form.description.length} characters</p>
      </div>

      {/* Section 4 – Proposed Solution */}
      <div className="space-y-3">
        <SectionHeader number={4} title="Proposed Solution / Recommendation" />
        <Textarea
          value={form.proposedSolution}
          onChange={(e) => set("proposedSolution", e.target.value)}
          placeholder="Describe your recommended solution or improvement…"
          rows={4}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground text-right">{form.proposedSolution.length} characters</p>
      </div>

      {/* Submit */}
      <div className="border-t pt-5 flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Submitting this form will save your suggestion and automatically email a completed copy to the JHSC Co-Chair.
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={handleSubmit} disabled={submitting} className="gap-2 min-w-[160px]">
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
            ) : (
              <><Send className="w-4 h-4" /> Submit Suggestion</>
            )}
          </Button>
          <Button variant="ghost" onClick={loadHistory} disabled={historyLoading} className="gap-2 text-muted-foreground">
            {historyLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : showHistory ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {showHistory ? "Hide" : "Previous Suggestions"}
          </Button>
        </div>

        {showHistory && (
          <div className="mt-3 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Submitted Suggestions</h3>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No suggestions yet.</p>
            ) : (
              history.map((s) => (
                <div key={s.id} className="flex items-start justify-between gap-3 border rounded-md p-3 bg-card">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold font-mono text-foreground">{s.suggestionCode}</p>
                    <p className="text-xs text-muted-foreground truncate">{canSeeIdentity ? `${s.employeeName} · ` : ""}{s.department} · {s.shift}</p>
                    <p className="text-xs text-muted-foreground">{s.dateObserved} · {s.locationOfConcern} · <span className="capitalize">{s.priorityLevel}</span> priority</p>
                  </div>
                  {user?.role === "admin" && (
                    <Button variant="ghost" size="sm" onClick={() => deleteSuggestion(s.id)}>
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
