import { useState, useRef, useCallback } from "react";
import {
  Folder,
  FolderOpen,
  Upload,
  Trash2,
  Download,
  FileText,
  FileImage,
  File,
  Plus,
  MoreVertical,
  ChevronRight,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface FolderItem {
  id: number;
  name: string;
  createdBy: string;
  createdAt: string;
  fileCount: number;
}

interface FileItem {
  id: number;
  folderId: number;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function FileIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith("image/")) return <FileImage className={cn("text-blue-500", className)} />;
  if (mimeType === "application/pdf") return <FileText className={cn("text-red-500", className)} />;
  return <File className={cn("text-muted-foreground", className)} />;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${url}`, { credentials: "include", ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export default function FilesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin";

  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFolderId, setUploadFolderId] = useState<string>("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: folders = [] } = useQuery<FolderItem[]>({
    queryKey: ["folders"],
    queryFn: () => apiFetch("/api/folder-files/folders"),
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<FileItem[]>({
    queryKey: ["folder-files", selectedFolderId],
    queryFn: () => apiFetch(`/api/folder-files/folders/${selectedFolderId}/files`),
    enabled: selectedFolderId !== null,
  });

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const createFolderMut = useMutation({
    mutationFn: (name: string) =>
      apiFetch("/api/folder-files/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    onSuccess: (folder: FolderItem) => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      setNewFolderOpen(false);
      setNewFolderName("");
      setSelectedFolderId(folder.id);
      toast({ title: "Folder created", description: folder.name });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteFolderMut = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/folder-files/folders/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      if (selectedFolderId === id) setSelectedFolderId(null);
      toast({ title: "Folder deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const uploadMut = useMutation({
    mutationFn: async ({ folderId, files }: { folderId: number; files: File[] }) => {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const res = await fetch(`${BASE}/api/folder-files/folders/${folderId}/files`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (_data, { folderId }) => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      qc.invalidateQueries({ queryKey: ["folder-files", folderId] });
      setUploadOpen(false);
      setUploadFiles([]);
      setUploadFolderId("");
      toast({ title: "Files uploaded successfully" });
    },
    onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const deleteFileMut = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/folder-files/files/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      qc.invalidateQueries({ queryKey: ["folder-files", selectedFolderId] });
      toast({ title: "File deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    createFolderMut.mutate(newFolderName.trim());
  };

  const handleUpload = () => {
    if (!uploadFolderId || !uploadFiles.length) return;
    uploadMut.mutate({ folderId: parseInt(uploadFolderId), files: uploadFiles });
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    setUploadFiles((prev) => [...prev, ...dropped]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setUploadFiles((prev) => [...prev, ...selected]);
    e.target.value = "";
  };

  const handleDownload = (file: FileItem) => {
    const a = document.createElement("a");
    a.href = `${BASE}/api/folder-files/files/${file.storedName}?name=${encodeURIComponent(file.originalName)}`;
    a.download = file.originalName;
    a.click();
  };

  const openUploadFor = (folderId?: number) => {
    if (folderId) setUploadFolderId(String(folderId));
    setUploadOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Folder className="w-8 h-8 text-primary" />
            Files
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Organize and store JHSC documents in folders.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openUploadFor(selectedFolderId ?? undefined)} className="gap-2">
            <Upload className="w-4 h-4" />
            Upload File
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={() => setNewFolderOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              New Folder
            </Button>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-4 min-h-[500px]">
        {/* Folder list */}
        <div className="w-56 shrink-0 space-y-1">
          <p className="text-xs uppercase font-bold text-muted-foreground px-2 pb-1">Folders</p>
          {folders.length === 0 && (
            <p className="text-sm text-muted-foreground px-2 py-4">No folders yet.</p>
          )}
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => setSelectedFolderId(folder.id)}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left group",
                selectedFolderId === folder.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted text-foreground"
              )}
            >
              <span className="flex items-center gap-2 min-w-0">
                {selectedFolderId === folder.id
                  ? <FolderOpen className="w-4 h-4 shrink-0" />
                  : <Folder className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground" />}
                <span className="truncate">{folder.name}</span>
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-muted-foreground">{folder.fileCount}</span>
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <span
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted-foreground/20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                      </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete folder "${folder.name}" and all its files?`))
                            deleteFolderMut.mutate(folder.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                        Delete folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px bg-border shrink-0" />

        {/* File list */}
        <div className="flex-1 min-w-0">
          {!selectedFolderId ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
              <Folder className="w-12 h-12 opacity-30" />
              <p className="text-sm">Select a folder to view its files</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Folder header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Files</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span className="font-semibold text-foreground">{selectedFolder?.name}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => openUploadFor(selectedFolderId)} className="gap-1.5 text-xs h-7">
                  <Upload className="w-3 h-3" />
                  Upload here
                </Button>
              </div>

              {filesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
                  ))}
                </div>
              ) : files.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border rounded-lg text-muted-foreground gap-3 cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-colors"
                  onClick={() => openUploadFor(selectedFolderId)}
                >
                  <Upload className="w-8 h-8 opacity-40" />
                  <p className="text-sm">No files yet — click to upload</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-md border border-border bg-card hover:bg-muted/30 transition-colors group"
                    >
                      <FileIcon mimeType={file.mimeType} className="w-5 h-5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{file.originalName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)} · {file.uploadedBy}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleDownload(file)}
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm(`Delete "${file.originalName}"?`))
                                deleteFileMut.mutate(file.id);
                            }}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New Folder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-primary" />
              Create New Folder
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNewFolderOpen(false); setNewFolderName(""); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim() || createFolderMut.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) { setUploadFiles([]); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Upload Files
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Folder picker */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase font-bold text-muted-foreground">Destination Folder</label>
              <Select value={uploadFolderId} onValueChange={setUploadFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a folder..." />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Drop zone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-muted/30"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">
                {isDragging ? "Drop files here" : "Drag & drop files here, or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">PDF, images, Word, Excel — up to 25 MB each</p>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
            </div>

            {/* Selected files list */}
            {uploadFiles.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {uploadFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded bg-muted/40">
                    <FileIcon mimeType={f.type} className="w-4 h-4 shrink-0" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatBytes(f.size)}</span>
                    <button
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => setUploadFiles((prev) => prev.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setUploadFiles([]); setUploadFolderId(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadFolderId || !uploadFiles.length || uploadMut.isPending}
            >
              {uploadMut.isPending ? "Uploading…" : `Upload ${uploadFiles.length || ""} File${uploadFiles.length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
