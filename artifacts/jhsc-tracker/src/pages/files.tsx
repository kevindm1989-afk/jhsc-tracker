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
  FolderPlus,
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

import { apiUrl, API_BASE } from "@/lib/api";

interface FolderItem {
  id: number;
  name: string;
  parentId: number | null;
  createdBy: string;
  createdAt: string;
  fileCount: number;
  subfolderCount: number;
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

interface BreadcrumbEntry {
  id: number;
  name: string;
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
  const res = await fetch(apiUrl(url), { credentials: "include", ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

function formatMeetingDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildFolderOptions(folders: FolderItem[]): { id: number; label: string }[] {
  const options: { id: number; label: string }[] = [];
  const addLevel = (parentId: number | null, prefix: string) => {
    folders
      .filter((f) => f.parentId === parentId)
      .forEach((f) => {
        options.push({ id: f.id, label: `${prefix}${f.name}` });
        addLevel(f.id, `${prefix}  › `);
      });
  };
  addLevel(null, "");
  return options;
}

export default function FilesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canAdmin = user?.role === "admin" || user?.role === "co-chair";

  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([]);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFolderId, setUploadFolderId] = useState<string>("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [meetingDate, setMeetingDate] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentFolderId = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : null;
  const topLevelFolderId = breadcrumb.length > 0 ? breadcrumb[0].id : null;

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: folders = [] } = useQuery<FolderItem[]>({
    queryKey: ["folders"],
    queryFn: () => apiFetch("/api/folder-files/folders"),
  });

  const topLevelFolders = folders.filter((f) => f.parentId === null);
  const subfolders = folders.filter((f) => f.parentId === currentFolderId);

  const { data: files = [], isLoading: filesLoading } = useQuery<FileItem[]>({
    queryKey: ["folder-files", currentFolderId],
    queryFn: () => apiFetch(`/api/folder-files/folders/${currentFolderId}/files`),
    enabled: currentFolderId !== null,
  });

  const folderOptions = buildFolderOptions(folders);

  const minutesFolder = folders.find((f) => f.parentId === null && f.name === "Minutes");
  const isMinutesDest = !!minutesFolder && uploadFolderId === String(minutesFolder.id);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const createFolderMut = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: number | null }) =>
      apiFetch("/api/folder-files/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId }),
      }),
    onSuccess: (folder: FolderItem) => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      setNewFolderOpen(false);
      setNewFolderName("");
      toast({ title: "Folder created", description: folder.name });
      if (folder.parentId !== null) {
        const parent = folders.find((f) => f.id === folder.parentId);
        if (parent) {
          const parentIdx = breadcrumb.findIndex((b) => b.id === parent.id);
          if (parentIdx !== -1) {
            setBreadcrumb((prev) => prev.slice(0, parentIdx + 1));
          }
        }
      }
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteFolderMut = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/folder-files/folders/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      const idx = breadcrumb.findIndex((b) => b.id === id);
      if (idx !== -1) setBreadcrumb((prev) => prev.slice(0, idx));
      toast({ title: "Folder deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const uploadMut = useMutation({
    mutationFn: async ({ folderId, files }: { folderId: number; files: File[] }) => {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const res = await fetch(apiUrl(`/api/folder-files/folders/${folderId}/files`), {
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
      qc.invalidateQueries({ queryKey: ["folder-files", currentFolderId] });
      toast({ title: "File deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    createFolderMut.mutate({ name: newFolderName.trim(), parentId: newFolderParentId });
  };

  const openNewFolder = (parentId: number | null = null) => {
    setNewFolderParentId(parentId);
    setNewFolderName("");
    setNewFolderOpen(true);
  };

  const handleUpload = async () => {
    if (!uploadFolderId || !uploadFiles.length) return;

    let targetFolderId = parseInt(uploadFolderId);

    if (isMinutesDest && meetingDate) {
      const folderName = formatMeetingDate(meetingDate);
      const existing = folders.find((f) => f.parentId === targetFolderId && f.name === folderName);
      if (existing) {
        targetFolderId = existing.id;
      } else {
        try {
          const created = await apiFetch("/api/folder-files/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: folderName, parentId: targetFolderId }),
          });
          await qc.invalidateQueries({ queryKey: ["folders"] });
          targetFolderId = created.id;
        } catch {
          toast({ title: "Error", description: "Could not create date subfolder", variant: "destructive" });
          return;
        }
      }
    }

    uploadMut.mutate({ folderId: targetFolderId, files: uploadFiles });
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
    a.href = apiUrl(`/api/folder-files/files/${file.storedName}?name=${encodeURIComponent(file.originalName)}`);
    a.download = file.originalName;
    a.click();
  };

  const openUploadFor = (folderId?: number) => {
    if (folderId) setUploadFolderId(String(folderId));
    setUploadOpen(true);
  };

  const navigateToFolder = (folder: FolderItem) => {
    if (folder.parentId === null) {
      setBreadcrumb([{ id: folder.id, name: folder.name }]);
    } else {
      setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }]);
    }
  };

  const navigateToBreadcrumb = (index: number) => {
    setBreadcrumb((prev) => prev.slice(0, index + 1));
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
          <Button onClick={() => openUploadFor(currentFolderId ?? undefined)} className="gap-2">
            <Upload className="w-4 h-4" />
            Upload File
          </Button>
          {canAdmin && (
            <Button variant="outline" onClick={() => openNewFolder(null)} className="gap-2">
              <Plus className="w-4 h-4" />
              New Folder
            </Button>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Sidebar — top-level folders only */}
        <div className="md:w-56 md:shrink-0 space-y-1">
          <p className="text-xs uppercase font-bold text-muted-foreground px-2 pb-1">Folders</p>
          {topLevelFolders.length === 0 && (
            <p className="text-sm text-muted-foreground px-2 py-4">No folders yet.</p>
          )}
          {topLevelFolders.map((folder) => {
            const isSelected = topLevelFolderId === folder.id;
            const totalCount = folder.fileCount + folder.subfolderCount;
            return (
              <button
                key={folder.id}
                onClick={() => navigateToFolder(folder)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left group",
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {isSelected
                    ? <FolderOpen className="w-4 h-4 shrink-0" />
                    : <Folder className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground" />}
                  <span className="truncate">{folder.name}</span>
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-muted-foreground">{totalCount || ""}</span>
                  {canAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <span
                          className="sm:opacity-0 sm:group-hover:opacity-100 p-0.5 rounded hover:bg-muted-foreground/20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToFolder(folder);
                            openNewFolder(folder.id);
                          }}
                        >
                          <FolderPlus className="w-3.5 h-3.5 mr-2" />
                          New subfolder
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete "${folder.name}" and all its contents?`))
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
            );
          })}
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px bg-border shrink-0" />
        <div className="md:hidden h-px bg-border" />

        {/* Right panel */}
        <div className="flex-1 min-w-0">
          {currentFolderId === null ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
              <Folder className="w-12 h-12 opacity-30" />
              <p className="text-sm">Select a folder to view its contents</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Breadcrumb + actions */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
                  <span
                    className="hover:text-foreground cursor-pointer transition-colors"
                    onClick={() => setBreadcrumb([])}
                  >
                    Files
                  </span>
                  {breadcrumb.map((entry, i) => (
                    <span key={entry.id} className="flex items-center gap-1">
                      <ChevronRight className="w-3.5 h-3.5" />
                      <span
                        className={cn(
                          "transition-colors",
                          i === breadcrumb.length - 1
                            ? "font-semibold text-foreground"
                            : "hover:text-foreground cursor-pointer"
                        )}
                        onClick={() => i < breadcrumb.length - 1 && navigateToBreadcrumb(i)}
                      >
                        {entry.name}
                      </span>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  {canAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openNewFolder(currentFolderId)}
                      className="gap-1.5 text-xs h-7"
                    >
                      <FolderPlus className="w-3 h-3" />
                      New Subfolder
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openUploadFor(currentFolderId)}
                    className="gap-1.5 text-xs h-7"
                  >
                    <Upload className="w-3 h-3" />
                    Upload here
                  </Button>
                </div>
              </div>

              {/* Subfolders grid */}
              {subfolders.length > 0 && (
                <div>
                  <p className="text-xs uppercase font-bold text-muted-foreground mb-2">Subfolders</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {subfolders.map((sf) => (
                      <div
                        key={sf.id}
                        className="group relative flex flex-col items-start gap-1 px-3 py-3 rounded-lg border border-border bg-card hover:bg-muted/40 hover:border-primary/30 cursor-pointer transition-colors"
                        onClick={() => navigateToFolder(sf)}
                      >
                        <div className="flex items-center gap-2 w-full min-w-0">
                          <Folder className="w-5 h-5 shrink-0 text-primary/70" />
                          <span className="text-sm font-medium truncate">{sf.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground pl-7">
                          {sf.fileCount} file{sf.fileCount !== 1 ? "s" : ""}
                          {sf.subfolderCount > 0 ? `, ${sf.subfolderCount} subfolder${sf.subfolderCount !== 1 ? "s" : ""}` : ""}
                        </span>
                        {canAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <span
                                className="absolute top-2 right-2 sm:opacity-0 sm:group-hover:opacity-100 p-0.5 rounded hover:bg-muted-foreground/20 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                              </span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigateToFolder(sf);
                                  openNewFolder(sf.id);
                                }}
                              >
                                <FolderPlus className="w-3.5 h-3.5 mr-2" />
                                New subfolder
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Delete "${sf.name}" and all its contents?`))
                                    deleteFolderMut.mutate(sf.id);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Delete subfolder
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files section */}
              <div>
                {subfolders.length > 0 && (
                  <p className="text-xs uppercase font-bold text-muted-foreground mb-2">Files</p>
                )}
                {filesLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : files.length === 0 ? (
                  <div
                    className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg text-muted-foreground gap-3 cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-colors"
                    onClick={() => openUploadFor(currentFolderId)}
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
                        <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleDownload(file)}
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          {canAdmin && (
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
            </div>
          )}
        </div>
      </div>

      {/* New Folder / Subfolder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {newFolderParentId !== null ? (
                <>
                  <FolderPlus className="w-5 h-5 text-primary" />
                  Create Subfolder
                </>
              ) : (
                <>
                  <Folder className="w-5 h-5 text-primary" />
                  Create New Folder
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {newFolderParentId !== null && (
            <p className="text-xs text-muted-foreground -mt-1">
              Inside: <span className="font-medium text-foreground">{folders.find((f) => f.id === newFolderParentId)?.name}</span>
            </p>
          )}
          <div className="py-3">
            <Input
              placeholder={newFolderParentId !== null ? "Subfolder name" : "Folder name"}
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
      <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) { setUploadFiles([]); setMeetingDate(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Upload Files
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs uppercase font-bold text-muted-foreground">Destination Folder</label>
              <Select value={uploadFolderId} onValueChange={setUploadFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a folder..." />
                </SelectTrigger>
                <SelectContent>
                  {folderOptions.map((opt) => (
                    <SelectItem key={opt.id} value={String(opt.id)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Meeting date — shown only when Minutes folder is selected */}
            {isMinutesDest && (
              <div className="space-y-1.5">
                <label className="text-xs uppercase font-bold text-muted-foreground">
                  Meeting Date <span className="text-destructive">*</span>
                </label>
                <Input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                />
                {meetingDate && (
                  <p className="text-xs text-muted-foreground">
                    File will be saved to:{" "}
                    <span className="font-medium text-foreground">
                      Minutes &rsaquo; {formatMeetingDate(meetingDate)}
                    </span>
                  </p>
                )}
              </div>
            )}

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
            <Button variant="outline" onClick={() => { setUploadOpen(false); setUploadFiles([]); setUploadFolderId(""); setMeetingDate(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadFolderId || !uploadFiles.length || uploadMut.isPending || (isMinutesDest && !meetingDate)}
            >
              {uploadMut.isPending ? "Uploading…" : `Upload ${uploadFiles.length || ""} File${uploadFiles.length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
