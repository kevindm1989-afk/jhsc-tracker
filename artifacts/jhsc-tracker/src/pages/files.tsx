import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen, Folder, FileText, Download, Trash2, Loader2, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface StoredFile {
  id: number;
  originalName: string;
  storedPath: string;
  folder: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

function getMimeIcon(mimeType: string) {
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("image")) return "🖼️";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("xlsx") || mimeType.includes("xls")) return "📊";
  if (mimeType.includes("word") || mimeType.includes("docx") || mimeType.includes("doc")) return "📝";
  return "📁";
}

// Build a folder tree from a flat list of stored files
function buildFolderTree(files: StoredFile[]) {
  const tree: Record<string, Record<string, StoredFile[]>> = {};
  for (const file of files) {
    const parts = file.folder.split(/[/\\]/);
    const top = parts[0] ?? "root";
    const sub = parts[1] ?? "";
    if (!tree[top]) tree[top] = {};
    if (!tree[top][sub]) tree[top][sub] = [];
    tree[top][sub].push(file);
  }
  return tree;
}

export default function FilesPage() {
  const { hasPermission, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin";

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [expandedTop, setExpandedTop] = useState<Set<string>>(new Set(["minutes"]));

  const { data: allFiles = [], isLoading } = useQuery<StoredFile[]>({
    queryKey: ["stored-files"],
    queryFn: () => fetch(`${BASE}/api/files`, { credentials: "include" }).then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/api/files/${id}`, { method: "DELETE", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stored-files"] }); toast({ title: "File deleted" }); },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const tree = buildFolderTree(allFiles);
  const topFolders = Object.keys(tree).sort();

  const visibleFiles = selectedFolder
    ? allFiles.filter((f) => f.folder === selectedFolder)
    : allFiles;

  const totalSize = allFiles.reduce((sum, f) => sum + f.sizeBytes, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <HardDrive className="w-8 h-8 text-primary" />
          Files
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Archived files — meeting minutes and other documents stored automatically.
          {allFiles.length > 0 && <span className="ml-2 text-xs">({allFiles.length} file{allFiles.length !== 1 ? "s" : ""}, {formatBytes(totalSize)} total)</span>}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
      ) : allFiles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground space-y-2">
            <HardDrive className="w-10 h-10 mx-auto text-muted-foreground/30" />
            <p>No files archived yet.</p>
            <p className="text-xs">Files are saved automatically when you import meeting minutes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Folder sidebar */}
          <div className="sm:w-56 shrink-0">
            <div className="border rounded-md bg-muted/10 overflow-hidden">
              <div className="px-3 py-2 border-b bg-muted/30">
                <p className="text-xs font-bold uppercase text-muted-foreground">Folders</p>
              </div>
              <div className="py-1">
                <button
                  className={cn("w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-muted/40 transition-colors", selectedFolder === null && "bg-primary/10 text-primary font-medium")}
                  onClick={() => setSelectedFolder(null)}
                >
                  <HardDrive className="w-4 h-4 shrink-0" />
                  All Files
                  <Badge className="ml-auto text-[10px] py-0 px-1 h-4">{allFiles.length}</Badge>
                </button>

                {topFolders.map((top) => {
                  const isExpanded = expandedTop.has(top);
                  const subFolders = Object.keys(tree[top]).sort();
                  const topCount = Object.values(tree[top]).flat().length;

                  return (
                    <div key={top}>
                      <button
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-muted/40 transition-colors font-medium"
                        onClick={() => setExpandedTop((prev) => {
                          const next = new Set(prev);
                          if (next.has(top)) next.delete(top); else next.add(top);
                          return next;
                        })}
                      >
                        {isExpanded ? <FolderOpen className="w-4 h-4 text-yellow-500 shrink-0" /> : <Folder className="w-4 h-4 text-yellow-500 shrink-0" />}
                        <span className="capitalize truncate">{top}</span>
                        <Badge className="ml-auto text-[10px] py-0 px-1 h-4 shrink-0">{topCount}</Badge>
                      </button>

                      {isExpanded && subFolders.map((sub) => {
                        const folderPath = sub ? `${top}/${sub}` : top;
                        const count = tree[top][sub].length;
                        return (
                          <button
                            key={sub}
                            className={cn("w-full text-left pl-8 pr-3 py-1.5 text-xs flex items-center gap-2 hover:bg-muted/40 transition-colors", selectedFolder === folderPath && "bg-primary/10 text-primary font-medium")}
                            onClick={() => setSelectedFolder(folderPath)}
                          >
                            <Folder className="w-3 h-3 shrink-0 text-yellow-400" />
                            <span className="truncate">{sub || top}</span>
                            <Badge className="ml-auto text-[10px] py-0 px-1 h-4 shrink-0">{count}</Badge>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* File list */}
          <div className="flex-1 min-w-0">
            <div className="border rounded-md overflow-hidden">
              <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
                <p className="text-xs font-bold uppercase text-muted-foreground flex-1">
                  {selectedFolder ? selectedFolder : "All Files"} — {visibleFiles.length} file{visibleFiles.length !== 1 ? "s" : ""}
                </p>
              </div>

              {visibleFiles.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No files in this folder.</div>
              ) : (
                <div className="divide-y">
                  {visibleFiles.map((file) => (
                    <div key={file.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors">
                      <span className="text-xl shrink-0">{getMimeIcon(file.mimeType)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.originalName}</p>
                        <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                          <span>{file.folder}</span>
                          <span>·</span>
                          <span>{formatBytes(file.sizeBytes)}</span>
                          <span>·</span>
                          <span>{formatDate(file.uploadedAt)}</span>
                          <span>·</span>
                          <span>by {file.uploadedBy}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <a
                          href={`${BASE}/api/files/serve/${file.id}`}
                          download={file.originalName}
                          className="inline-flex"
                        >
                          <Button size="sm" variant="outline" className="h-7 px-2">
                            <Download className="w-3 h-3" />
                          </Button>
                        </a>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => { if (confirm("Delete this file?")) deleteMutation.mutate(file.id); }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
