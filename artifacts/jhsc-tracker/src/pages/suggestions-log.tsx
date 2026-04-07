import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { TruncatedText } from "@/components/ui/truncated-text";
import {
  Lightbulb, Trash2, Search, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-green-100 text-green-800 border-green-200",
};

function PriorityBadge({ level }: { level: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border capitalize", PRIORITY_STYLES[level] ?? "bg-muted text-muted-foreground border-border")}>
      {level}
    </span>
  );
}

function ExpandedRow({ s }: { s: Suggestion }) {
  return (
    <div className="px-4 py-4 bg-muted/30 border-t space-y-3 text-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description of Suggestion / Concern</p>
          <p className="text-foreground whitespace-pre-wrap leading-relaxed">{s.description}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Proposed Solution / Recommendation</p>
          <p className="text-foreground whitespace-pre-wrap leading-relaxed">{s.proposedSolution}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 pt-2 border-t text-xs text-muted-foreground">
        <span><span className="font-medium">Date Observed:</span> {s.dateObserved}</span>
        <span><span className="font-medium">Date Submitted:</span> {s.dateSubmitted}</span>
        <span><span className="font-medium">Submitted by:</span> {s.submittedByName}</span>
        <span><span className="font-medium">Logged:</span> {new Date(s.createdAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}</span>
      </div>
    </div>
  );
}

export default function SuggestionsLogPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canAdmin = user?.role === "admin" || user?.role === "co-chair";

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/suggestions`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setSuggestions(data))
      .catch(() => toast({ title: "Failed to load suggestions", variant: "destructive" }))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleDelete(id: number) {
    if (!confirm("Delete this suggestion permanently?")) return;
    setDeletingId(id);
    try {
      const resp = await fetch(`${BASE}/api/suggestions/${id}`, { method: "DELETE", credentials: "include" });
      if (!resp.ok) throw new Error();
      setSuggestions((s) => s.filter((x) => x.id !== id));
      if (expandedId === id) setExpandedId(null);
      toast({ title: "Suggestion deleted" });
    } catch {
      toast({ title: "Failed to delete suggestion", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = suggestions.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      s.suggestionCode.toLowerCase().includes(q) ||
      s.employeeName.toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q) ||
      s.locationOfConcern.toLowerCase().includes(q);
    const matchesPriority = priorityFilter === "all" || s.priorityLevel === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const counts = {
    high: suggestions.filter((s) => s.priorityLevel === "high").length,
    medium: suggestions.filter((s) => s.priorityLevel === "medium").length,
    low: suggestions.filter((s) => s.priorityLevel === "low").length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-yellow-100 flex items-center justify-center shrink-0">
            <Lightbulb className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Suggestions Log</h1>
            <p className="text-sm text-muted-foreground">
              {canAdmin ? "All submitted employee suggestions" : "Your submitted suggestions"}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["high", "medium", "low"] as const).map((p) => (
            <div key={p} className={cn("px-2.5 py-1 rounded-md border text-xs font-semibold", PRIORITY_STYLES[p])}>
              {counts[p]} {p.charAt(0).toUpperCase() + p.slice(1)}
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name, code, department, location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
          {search && (
            <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch("")}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {[
            { label: "All", value: "all" },
            { label: "High", value: "high" },
            { label: "Medium", value: "medium" },
            { label: "Low", value: "low" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPriorityFilter(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                priorityFilter === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-muted-foreground/40"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        {/* Desktop header */}
        <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_1fr_auto_auto_auto] gap-3 px-4 py-2.5 bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span className="w-24">Code</span>
          <span>Employee</span>
          <span>Department / Shift</span>
          <span>Location</span>
          <span className="w-16 text-center">Priority</span>
          <span className="w-24 text-center">Submitted</span>
          {canAdmin && <span className="w-8" />}
        </div>

        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {suggestions.length === 0
              ? "No suggestions have been submitted yet."
              : "No suggestions match your filters."}
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((s) => {
              const expanded = expandedId === s.id;
              return (
                <div key={s.id}>
                  {/* Row */}
                  <button
                    className="w-full text-left hidden sm:grid grid-cols-[auto_1fr_1fr_1fr_auto_auto_auto] gap-3 px-4 py-3 hover:bg-muted/30 transition-colors items-center"
                    onClick={() => setExpandedId(expanded ? null : s.id)}
                  >
                    <span className="w-24 font-mono text-xs font-semibold text-foreground">{s.suggestionCode}</span>
                    <span className="text-sm text-foreground truncate">{s.employeeName}</span>
                    <span className="text-sm text-muted-foreground truncate">{s.department} · {s.shift}</span>
                    <TruncatedText text={s.locationOfConcern} lines={1} label="Location" className="text-sm text-muted-foreground" />
                    <span className="w-16 flex justify-center"><PriorityBadge level={s.priorityLevel} /></span>
                    <span className="w-24 text-xs text-muted-foreground text-center">{s.dateSubmitted}</span>
                    {canAdmin && (
                      <span className="w-8 flex justify-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          disabled={deletingId === s.id}
                          onClick={() => handleDelete(s.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </span>
                    )}
                  </button>

                  {/* Mobile row */}
                  <button
                    className="w-full text-left sm:hidden px-4 py-3 hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedId(expanded ? null : s.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono text-xs font-bold text-foreground">{s.suggestionCode}</span>
                          <PriorityBadge level={s.priorityLevel} />
                        </div>
                        <p className="text-sm text-foreground font-medium truncate">{s.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{s.department} · {s.shift}</p>
                        <p className="text-xs text-muted-foreground">{s.locationOfConcern} · {s.dateSubmitted}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {canAdmin && (
                          <span onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              disabled={deletingId === s.id}
                              onClick={() => handleDelete(s.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </span>
                        )}
                        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {expanded && <ExpandedRow s={s} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!isLoading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          Showing {filtered.length} of {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
