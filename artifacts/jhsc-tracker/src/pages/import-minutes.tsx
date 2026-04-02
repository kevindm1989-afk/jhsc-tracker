import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle,
  Users, MapPin, SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ─── Minutes types ───────────────────────────────────────────────────────────

interface ParsedActionItem {
  date: string;
  department: string;
  description: string;
  raisedBy: string;
  assignedTo: string;
  priority: string;
  status: string;
  notes?: string;
  source: "New Business" | "Old Business" | "Closed Items";
}

interface ParsedHazardFinding {
  date: string;
  department: string;
  hazardDescription: string;
  severity: string;
  status: string;
  responseDeadline?: string | null;
  notes?: string;
}

interface ParsedAttendee {
  name: string;
  representation: string;
  role: string;
  present: boolean;
}

interface ParsedZone {
  zone: string;
  inspector: string;
  status: string;
}

interface MinutesPreview {
  meetingDate: string;
  facility: string;
  quorumMet: string;
  attendees: ParsedAttendee[];
  zones: ParsedZone[];
  actionItems: ParsedActionItem[];
  hazardFindings: ParsedHazardFinding[];
}

interface MinutesResult {
  success: boolean;
  meetingDate: string;
  facility: string;
  imported: { actionItems: number; hazardFindings: number };
  skipped: { actionItems: number; hazardFindings: number };
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const priorityColors: Record<string, string> = {
  High: "bg-red-100 text-red-800 border-red-200",
  Medium: "bg-amber-100 text-amber-800 border-amber-200",
  Low: "bg-green-100 text-green-800 border-green-200",
};

const statusColors: Record<string, string> = {
  "In Progress": "bg-blue-100 text-blue-800 border-blue-200",
  Open: "bg-slate-100 text-slate-800 border-slate-200",
  Closed: "bg-green-100 text-green-800 border-green-200",
};

const sourceColors: Record<string, string> = {
  "New Business": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Old Business": "bg-purple-100 text-purple-800 border-purple-200",
  "Closed Items": "bg-green-100 text-green-800 border-green-200",
};

// ─── Shared upload area component ────────────────────────────────────────────

function UploadArea({
  file,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  fileInputRef,
  onFileChange,
  hint,
}: {
  file: File | null;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hint: string;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      className={cn(
        "border-2 border-dashed rounded-lg p-8 sm:p-12 text-center cursor-pointer transition-colors",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/30"
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xlsm,.xls"
        className="hidden"
        onChange={onFileChange}
      />
      <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
      {file ? (
        <div>
          <p className="font-semibold text-foreground">{file.name}</p>
          <p className="text-sm text-muted-foreground mt-1">{(file.size / 1024).toFixed(1)} KB — click to change</p>
        </div>
      ) : (
        <div>
          <p className="font-medium text-foreground">Drop your file here</p>
          <p className="text-sm text-muted-foreground mt-1">{hint}</p>
        </div>
      )}
    </div>
  );
}

// ─── Minutes tab ──────────────────────────────────────────────────────────────

function MinutesTab() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MinutesPreview | null>(null);
  const [result, setResult] = useState<MinutesResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.match(/\.(xlsx|xlsm|xls)$/i)) {
      setError("Please upload an Excel file (.xlsx, .xlsm, or .xls)");
      return;
    }
    setFile(f);
    setPreview(null);
    setResult(null);
    setError(null);
    setIsPreviewing(true);
    try {
      const formData = new FormData();
      formData.append("file", f);
      const resp = await fetch(`${BASE}/api/import/minutes?preview=true`, { method: "POST", body: formData });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${resp.status}`);
      }
      setPreview(await resp.json());
    } catch (e: any) {
      setError(e.message || "Failed to parse file");
    } finally {
      setIsPreviewing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleImport = async () => {
    if (!file) return;
    setIsImporting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch(`${BASE}/api/import/minutes`, { method: "POST", body: formData });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${resp.status}`);
      }
      const data: MinutesResult = await resp.json();
      setResult(data);
      setPreview(null);
      queryClient.invalidateQueries();
      toast({ title: "Import complete", description: `${data.imported.actionItems} action items and ${data.imported.hazardFindings} hazard findings imported.` });
    } catch (e: any) {
      setError(e.message || "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-5">
      {result && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-600 shrink-0" />
              <div>
                <p className="font-bold text-green-900 text-lg">Import Successful</p>
                <p className="text-sm text-green-700">{result.meetingDate} — {result.facility}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Action Items Imported", val: result.imported.actionItems, cls: "text-green-700" },
                { label: "Hazard Findings Imported", val: result.imported.hazardFindings, cls: "text-green-700" },
                { label: "Action Items Skipped", val: result.skipped.actionItems, cls: "text-muted-foreground" },
                { label: "Hazard Findings Skipped", val: result.skipped.hazardFindings, cls: "text-muted-foreground" },
              ].map(({ label, val, cls }) => (
                <div key={label} className="bg-white rounded-md border border-green-200 p-3 text-center">
                  <p className={cn("text-2xl font-bold", cls)}>{val}</p>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={reset}>Import Another File</Button>
          </CardContent>
        </Card>
      )}

      {!result && (
        <UploadArea
          file={file}
          isDragging={isDragging}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          fileInputRef={fileInputRef}
          onFileChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          hint="or click to browse — .xlsx, .xlsm supported"
        />
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
          <XCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {isPreviewing && (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </CardContent>
        </Card>
      )}

      {preview && !result && (
        <div className="space-y-4">
          <Card className="border-sidebar-border shadow-sm">
            <CardHeader className="bg-muted/30 pb-3 border-b">
              <CardTitle className="text-base font-bold uppercase tracking-wide flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-primary" />
                Meeting Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div><p className="text-xs font-bold uppercase text-muted-foreground mb-1">Meeting Date</p><p className="font-medium">{preview.meetingDate || "—"}</p></div>
              <div><p className="text-xs font-bold uppercase text-muted-foreground mb-1">Facility</p><p className="font-medium">{preview.facility || "—"}</p></div>
              <div><p className="text-xs font-bold uppercase text-muted-foreground mb-1">Quorum Met</p><p className="font-medium capitalize">{preview.quorumMet || "—"}</p></div>
            </CardContent>
          </Card>

          {preview.attendees.length > 0 && (
            <Card className="border-sidebar-border shadow-sm">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Attendance ({preview.attendees.filter(a => a.present).length}/{preview.attendees.length} Present)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="flex flex-wrap gap-2">
                  {preview.attendees.map((a, i) => (
                    <div key={i} className={cn("flex items-center gap-1.5 px-2 py-1 rounded text-xs border", a.present ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200 opacity-60")}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", a.present ? "bg-green-500" : "bg-slate-400")} />
                      <span className="font-medium">{a.name}</span>
                      <span className="text-muted-foreground">{a.role}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {preview.zones.length > 0 && (
            <Card className="border-sidebar-border shadow-sm">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Inspection Zones ({preview.zones.length} zones)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {preview.zones.map((z, i) => (
                    <div key={i} className="bg-muted/50 rounded p-2 text-xs text-center border">
                      <p className="font-bold">{z.zone}</p>
                      <p className="text-muted-foreground">{z.inspector}</p>
                      <p className="text-green-600 font-medium">{z.status}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-sidebar-border shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Action Items to Import ({preview.actionItems.length})
                </CardTitle>
                <div className="flex gap-2 flex-wrap">
                  {(["New Business", "Old Business", "Closed Items"] as const).map(src => {
                    const count = preview.actionItems.filter(a => a.source === src).length;
                    return count > 0 ? (
                      <span key={src} className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", sourceColors[src])}>
                        {src}: {count}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
              <CardDescription className="text-xs flex items-center gap-1 mt-1">
                <SkipForward className="w-3 h-3" />
                Items already in the tracker (matched by description) will be skipped.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-72 overflow-y-auto">
                {preview.actionItems.map((item, i) => (
                  <div key={i} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-sm hover:bg-muted/30">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", sourceColors[item.source])}>{item.source}</span>
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", priorityColors[item.priority])}>{item.priority}</span>
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", statusColors[item.status])}>{item.status}</span>
                    </div>
                    <span className="font-medium text-foreground leading-snug min-w-0 truncate" title={item.description}>{item.description}</span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-auto hidden sm:block">→ {item.assignedTo}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {preview.hazardFindings.length > 0 && (
            <Card className="border-destructive/20 shadow-sm">
              <CardHeader className="pb-3 border-b bg-destructive/5">
                <CardTitle className="text-sm font-bold uppercase tracking-wide flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  Hazard Findings / Recommendations ({preview.hazardFindings.length})
                </CardTitle>
                <CardDescription className="text-xs flex items-center gap-1 mt-1">
                  <SkipForward className="w-3 h-3" />
                  Findings already in the tracker will be skipped.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-60 overflow-y-auto">
                  {preview.hazardFindings.map((hf, i) => (
                    <div key={i} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-sm hover:bg-muted/30">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", priorityColors[hf.severity])}>{hf.severity}</span>
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", statusColors[hf.status])}>{hf.status}</span>
                      </div>
                      <span className="font-medium text-foreground leading-snug min-w-0 line-clamp-2">{hf.hazardDescription}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button onClick={handleImport} disabled={isImporting} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm">
              <Upload className="w-4 h-4 mr-2" />
              {isImporting ? "Importing..." : `Import ${preview.actionItems.length} Action Items + ${preview.hazardFindings.length} Hazard Findings`}
            </Button>
            <Button variant="outline" onClick={reset} disabled={isImporting}>Cancel</Button>
          </div>
        </div>
      )}

      {!file && !isPreviewing && !error && !result && (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="p-6 text-center text-sm text-muted-foreground space-y-2">
            <p className="font-medium">How it works</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs mt-3">
              <div className="space-y-1"><p className="font-bold text-foreground">1. Upload</p><p>Drop your JHSC meeting minutes .xlsm or .xlsx file above.</p></div>
              <div className="space-y-1"><p className="font-bold text-foreground">2. Preview</p><p>Review the action items and hazard findings that will be imported.</p></div>
              <div className="space-y-1"><p className="font-bold text-foreground">3. Confirm</p><p>Duplicates are skipped automatically — safe to re-import any time.</p></div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ImportDataPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Import Data</h1>
        <p className="text-muted-foreground mt-1 text-sm">Upload JHSC meeting minutes to sync records into the tracker.</p>
      </div>
      <MinutesTab />
    </div>
  );
}
