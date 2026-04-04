import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TruncatedText } from "@/components/ui/truncated-text";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  Download,
  Trash2,
  Search,
  Eye,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CATEGORIES = [
  "Inspection Reports",
  "Hazard Reports",
  "OHSA References",
  "Policies & Procedures",
  "Worker Statements",
  "Other",
];

const CATEGORY_COLORS: Record<string, string> = {
  "Inspection Reports": "bg-green-100 text-green-800",
  "Hazard Reports": "bg-red-100 text-red-800",
  "OHSA References": "bg-purple-100 text-purple-800",
  "Policies & Procedures": "bg-amber-100 text-amber-800",
  "Worker Statements": "bg-orange-100 text-orange-800",
  "Other": "bg-gray-100 text-gray-700",
};

interface AppDocument {
  id: number;
  title: string;
  description: string | null;
  category: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  objectPath: string;
  uploadedBy: string;
  createdAt: string;
}

function fileIcon(mimeType: string) {
  if (mimeType.includes("pdf") || mimeType.includes("word") || mimeType.includes("document"))
    return <FileText className="w-5 h-5 text-red-500" />;
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("spreadsheet"))
    return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
  if (mimeType.includes("image"))
    return <FileImage className="w-5 h-5 text-blue-500" />;
  return <File className="w-5 h-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categoryFilter, setCategoryFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppDocument | null>(null);

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadCategory, setUploadCategory] = useState(CATEGORIES[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  const { data: docs = [], isLoading } = useQuery<AppDocument[]>({
    queryKey: ["documents", categoryFilter],
    queryFn: async () => {
      const params = categoryFilter !== "All" ? `?category=${encodeURIComponent(categoryFilter)}` : "";
      const resp = await fetch(`${BASE}/api/documents${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to fetch documents");
      return resp.json();
    },
  });

  const filtered = docs.filter((d) =>
    d.category !== "Meeting Minutes" &&
    (search.trim() === "" ||
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.category.toLowerCase().includes(search.toLowerCase()) ||
    d.uploadedBy.toLowerCase().includes(search.toLowerCase()))
  );

  function openUpload() {
    setSelectedFile(null);
    setUploadTitle("");
    setUploadDesc("");
    setUploadCategory(CATEGORIES[0]);
    setUploadProgress("");
    setUploadOpen(true);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (!uploadTitle) setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
  }

  async function handleUpload() {
    if (!selectedFile) {
      toast({ title: "No file selected", variant: "destructive" });
      return;
    }
    if (!uploadTitle.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      // Step 1: Get presigned upload URL
      setUploadProgress("Requesting upload URL...");
      const urlResp = await fetch(`${BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: selectedFile.name,
          size: selectedFile.size,
          contentType: selectedFile.type || "application/octet-stream",
        }),
      });
      if (!urlResp.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlResp.json();

      // Step 2: Upload directly to GCS
      setUploadProgress("Uploading file...");
      const uploadResp = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": selectedFile.type || "application/octet-stream" },
        body: selectedFile,
      });
      if (!uploadResp.ok) throw new Error("File upload failed");

      // Step 3: Save metadata
      setUploadProgress("Saving record...");
      const saveResp = await fetch(`${BASE}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: uploadTitle.trim(),
          description: uploadDesc.trim() || undefined,
          category: uploadCategory,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type || "application/octet-stream",
          objectPath,
        }),
      });
      if (!saveResp.ok) {
        const err = await saveResp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save document record");
      }

      toast({ title: "Document uploaded", description: `"${uploadTitle}" added to ${uploadCategory}.` });
      setUploadOpen(false);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      setUploadProgress("");
    }
  }

  async function handleDelete(doc: AppDocument) {
    try {
      const resp = await fetch(`${BASE}/api/documents/${doc.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Delete failed");
      }
      toast({ title: "Document removed" });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  }

  function handleView(doc: AppDocument) {
    window.open(`${BASE}/api/storage${doc.objectPath}`, "_blank");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Documents</h1>
          <p className="text-muted-foreground mt-1 text-sm">Store and access safety records, forms, and references.</p>
        </div>
        <Button onClick={openUpload} className="shrink-0">
          <Upload className="w-4 h-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Document list */}
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading documents...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <p className="text-muted-foreground">
            {search || categoryFilter !== "All" ? "No documents match your search." : "No documents uploaded yet."}
          </p>
          {!search && categoryFilter === "All" && (
            <Button variant="outline" size="sm" onClick={openUpload} className="mt-2">
              <Upload className="w-4 h-4 mr-1.5" />
              Upload the first document
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((doc) => (
            <Card key={doc.id} className="border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{fileIcon(doc.mimeType)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground leading-tight">{doc.title}</p>
                        {doc.description && (
                          <TruncatedText text={doc.description} lines={2} label="Description" className="text-sm text-muted-foreground mt-0.5" />
                        )}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => handleView(doc)} title="View / Download">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleView(doc)}
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        {(user?.role === "admin" || doc.uploadedBy === user?.displayName || doc.uploadedBy === user?.username) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(doc)}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[doc.category] ?? "bg-gray-100 text-gray-700"}`}>
                        {doc.category}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">{doc.fileName}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{formatFileSize(doc.fileSize)}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">Uploaded by {doc.uploadedBy}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(open) => { if (!open && !isUploading) setUploadOpen(false); }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* File picker */}
            <div className="space-y-1.5">
              <Label>File</Label>
              <div
                className="border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    {fileIcon(selectedFile.type)}
                    <div className="text-left">
                      <p className="text-sm font-medium truncate max-w-[200px]">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Click to select a file</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, images, and more</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.xlsm,.png,.jpg,.jpeg,.txt,.csv"
                onChange={handleFileSelect}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Document title"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                value={uploadDesc}
                onChange={(e) => setUploadDesc(e.target.value)}
                placeholder="Brief description..."
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {uploadProgress && (
              <p className="text-sm text-muted-foreground text-center">{uploadProgress}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={isUploading}>Cancel</Button>
            <Button onClick={handleUpload} disabled={isUploading || !selectedFile}>
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Remove Document</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to permanently delete <strong>{deleteTarget?.title}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              Delete Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
