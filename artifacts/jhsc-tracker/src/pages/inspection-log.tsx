import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, FileSpreadsheet, Download, ClipboardCheck, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CompletedInspection {
  id: number;
  originalName: string;
  storedName: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
  monthLabel: string;
}

function useCompletedInspections() {
  return useQuery<CompletedInspection[]>({
    queryKey: ["completed-inspections"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/inspect/completed`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    staleTime: 30 * 1000,
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseZoneFromName(name: string): string {
  const match = name.match(/Zone\s+(\d+)/i);
  return match ? `Zone ${match[1]}` : name.replace(/\.xlsx$/i, "");
}

function parseDateFromName(name: string): string {
  const match = name.match(/^([^—]+)—/);
  if (match) return match[1].trim();
  return "";
}

function MonthSection({ month, items }: { month: string; items: CompletedInspection[] }) {
  const [open, setOpen] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const { toast } = useToast();

  async function handleDownload(item: CompletedInspection) {
    if (downloadingId === item.id) return;
    setDownloadingId(item.id);
    try {
      const url = `${BASE}/api/folder-files/files/${encodeURIComponent(item.storedName)}?name=${encodeURIComponent(item.originalName)}`;
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${resp.status}`);
      }
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = item.originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span className="font-semibold text-sm">{month}</span>
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {items.length} inspection{items.length !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      {open && (
        <div className="divide-y divide-border">
          {items.map((item) => {
            const zone = parseZoneFromName(item.originalName);
            const dateLabel = parseDateFromName(item.originalName);
            const isDownloading = downloadingId === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleDownload(item)}
                disabled={isDownloading}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group text-left disabled:opacity-60"
              >
                <div className="w-8 h-8 rounded bg-green-100 dark:bg-green-950 flex items-center justify-center shrink-0">
                  {isDownloading
                    ? <Loader2 className="w-4 h-4 text-green-600 dark:text-green-400 animate-spin" />
                    : <FileSpreadsheet className="w-4 h-4 text-green-600 dark:text-green-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{zone}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateLabel && <span>{dateLabel} · </span>}
                    Submitted by {item.uploadedBy}
                    {item.sizeBytes > 0 && <span> · {formatBytes(item.sizeBytes)}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {isDownloading ? "Downloading…" : "Download"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function InspectionLogPage() {
  const { data: inspections, isLoading, error } = useCompletedInspections();

  const grouped = (inspections ?? []).reduce<Record<string, CompletedInspection[]>>((acc, item) => {
    const key = item.monthLabel;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const months = Object.keys(grouped);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-primary" />
          Inspections Conducted
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          All completed zone inspections organized by month. Click any entry to download the report.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">Failed to load inspections. Please refresh.</p>
        </div>
      ) : months.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-lg">
          <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No inspections submitted yet.</p>
          <p className="text-xs mt-1">Completed inspections will appear here after submission.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {months.map((month) => (
            <MonthSection key={month} month={month} items={grouped[month]} />
          ))}
        </div>
      )}
    </div>
  );
}
