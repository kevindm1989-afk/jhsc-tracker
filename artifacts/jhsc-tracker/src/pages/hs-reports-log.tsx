import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ShieldAlert,
  Search,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CONCERN_LABELS: Record<string, string> = {
  unsafe_condition: "Unsafe Condition",
  near_miss: "Near Miss",
  injury_illness: "Injury / Illness",
  ergonomic: "Ergonomic",
  equipment: "Equipment",
  housekeeping: "Housekeeping",
  slip_trip_fall: "Slip/Trip/Fall",
  chemical: "Chemical",
  unsafe_act: "Unsafe Act",
  other: "Other",
};

const CONCERN_COLORS: Record<string, string> = {
  unsafe_condition: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  near_miss: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  injury_illness: "bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  ergonomic: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  equipment: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  housekeeping: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  slip_trip_fall: "bg-orange-200 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200",
  chemical: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  unsafe_act: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

interface HSReport {
  id: number;
  reportCode: string;
  employeeName: string;
  department: string;
  jobTitle: string;
  shift: string;
  dateReported: string;
  supervisorManager: string;
  concernTypes: string[];
  otherConcernType: string | null;
  areaLocation: string;
  incidentDate: string;
  incidentTime: string;
  equipmentTask: string | null;
  whatHappened: string;
  reportedToSupervisor: boolean;
  whoNotified: string | null;
  immediateActionTaken: string | null;
  witnesses: string | null;
  suggestedCorrection: string | null;
  employeeSignature: string;
  signatureDate: string;
  submittedByName: string;
  createdAt: string;
}

const ALL_CONCERNS = Object.keys(CONCERN_LABELS);

function ConcernBadge({ type }: { type: string }) {
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap",
        CONCERN_COLORS[type] ?? CONCERN_COLORS.other
      )}
    >
      {CONCERN_LABELS[type] ?? type}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground w-44 flex-shrink-0">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

export default function HSReportsLogPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<HSReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterConcern, setFilterConcern] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deletingReport, setDeletingReport] = useState<HSReport | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/health-safety-reports`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      setReports(await res.json());
    } catch {
      toast({ title: "Failed to load reports", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deletingReport) return;
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}/api/health-safety-reports/${deletingReport.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      setReports((r) => r.filter((x) => x.id !== deletingReport.id));
      if (expandedId === deletingReport.id) setExpandedId(null);
      toast({ title: `Report ${deletingReport.reportCode} deleted` });
    } catch {
      toast({ title: "Failed to delete report", variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeletingReport(null);
    }
  };

  const filtered = reports.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.reportCode.toLowerCase().includes(q) ||
      r.employeeName.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q) ||
      r.areaLocation.toLowerCase().includes(q) ||
      r.whatHappened.toLowerCase().includes(q) ||
      r.submittedByName.toLowerCase().includes(q);
    const matchConcern =
      filterConcern === "all" || (r.concernTypes as string[]).includes(filterConcern);
    return matchSearch && matchConcern;
  });

  const fmtDate = (d: string) => {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
          <ShieldAlert className="w-5 h-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground">H&amp;S Concern Reports Log</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${reports.length} report${reports.length !== 1 ? "s" : ""} submitted`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, department, location, description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <select
          value={filterConcern}
          onChange={(e) => setFilterConcern(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Concern Types</option>
          {ALL_CONCERNS.map((k) => (
            <option key={k} value={k}>{CONCERN_LABELS[k]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[110px]">Report #</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead className="hidden md:table-cell">Dept / Shift</TableHead>
              <TableHead>Concern Type(s)</TableHead>
              <TableHead className="hidden lg:table-cell">Location</TableHead>
              <TableHead className="hidden sm:table-cell">Date</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {reports.length === 0 ? "No reports have been submitted yet." : "No reports match your search."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const expanded = expandedId === r.id;
                return (
                  <>
                    <TableRow
                      key={r.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/40 transition-colors",
                        expanded && "bg-muted/30"
                      )}
                      onClick={() => setExpandedId(expanded ? null : r.id)}
                    >
                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        {r.reportCode}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium text-foreground leading-tight">{r.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{r.jobTitle}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-sm text-foreground">{r.department}</p>
                        <p className="text-xs text-muted-foreground">{r.shift}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(r.concernTypes as string[]).slice(0, 2).map((t) => (
                            <ConcernBadge key={t} type={t} />
                          ))}
                          {(r.concernTypes as string[]).length > 2 && (
                            <span className="text-xs text-muted-foreground self-center">
                              +{(r.concernTypes as string[]).length - 2}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-foreground">
                        {r.areaLocation}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground whitespace-nowrap">
                        {fmtDate(r.incidentDate)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setExpandedId(expanded ? null : r.id)}
                          >
                            {expanded
                              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </Button>
                          {user?.role === "admin" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setDeletingReport(r)}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded detail row */}
                    {expanded && (
                      <TableRow key={`${r.id}-detail`} className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={7} className="py-4 px-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                            {/* Left column */}
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Employee Details</p>
                              <DetailRow label="Supervisor / Manager" value={r.supervisorManager} />
                              <DetailRow label="Date Reported" value={fmtDate(r.dateReported)} />
                              <DetailRow label="Submitted via app by" value={r.submittedByName} />

                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-2">Incident</p>
                              <DetailRow label="Location" value={r.areaLocation} />
                              <DetailRow label="Date &amp; Time" value={`${fmtDate(r.incidentDate)} at ${r.incidentTime}`} />
                              <DetailRow label="Equipment / Task" value={r.equipmentTask} />

                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-2">All Concern Types</p>
                              <div className="flex flex-wrap gap-1.5">
                                {(r.concernTypes as string[]).map((t) => (
                                  <ConcernBadge key={t} type={t} />
                                ))}
                                {r.otherConcernType && (
                                  <span className="text-sm text-muted-foreground">({r.otherConcernType})</span>
                                )}
                              </div>
                            </div>

                            {/* Right column */}
                            <div className="space-y-2 mt-4 md:mt-0">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">What Happened</p>
                              <p className="text-sm text-foreground whitespace-pre-wrap border-l-2 border-orange-300 pl-3">
                                {r.whatHappened}
                              </p>

                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-2">Immediate Action</p>
                              <DetailRow label="Reported to supervisor" value={r.reportedToSupervisor ? "Yes" : "No"} />
                              <DetailRow label="Who was notified" value={r.whoNotified} />
                              <DetailRow label="Action taken" value={r.immediateActionTaken} />

                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-2">Witnesses &amp; Correction</p>
                              <DetailRow label="Witnesses" value={r.witnesses} />
                              <DetailRow label="Suggested correction" value={r.suggestedCorrection} />

                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-2">Signature</p>
                              <DetailRow label="Employee signature" value={r.employeeSignature} />
                              <DetailRow label="Signed on" value={fmtDate(r.signatureDate)} />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary footer */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          Showing {filtered.length} of {reports.length} report{reports.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingReport} onOpenChange={(o) => !o && setDeletingReport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report {deletingReport?.reportCode}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the H&amp;S Concern Report submitted by{" "}
              <strong>{deletingReport?.employeeName}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete Report"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
