import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, FileSpreadsheet, Download, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface MinutesFile {
  id: number;
  originalName: string;
  storedName: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
  meetingDate: string;
}

function useMinutesLog() {
  return useQuery<MinutesFile[]>({
    queryKey: ["minutes-log"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/folder-files/minutes-log`, { credentials: "include" });
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

export default function MinutesLogPage() {
  const { data: minutes, isLoading, error } = useMinutesLog();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const { toast } = useToast();

  async function handleDownload(item: MinutesFile) {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" />
          Minutes Log
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          All imported meeting minutes. Click any entry to download.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">Failed to load minutes. Please refresh.</p>
        </div>
      ) : !minutes?.length ? (
        <div className="text-center py-16 text-muted-foreground border rounded-lg">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No minutes imported yet.</p>
          <p className="text-xs mt-1">Imported meeting minutes will appear here.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden divide-y divide-border">
          {minutes.map((item) => {
            const isDownloading = downloadingId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleDownload(item)}
                disabled={isDownloading}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group text-left disabled:opacity-60"
              >
                <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
                  {isDownloading
                    ? <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                    : <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.meetingDate}</p>
                  <p className="text-xs text-muted-foreground">
                    Imported by {item.uploadedBy}
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
