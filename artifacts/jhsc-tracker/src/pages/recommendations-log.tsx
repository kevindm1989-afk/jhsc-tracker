import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Paperclip, Trash2, Download, Loader2, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface RecLog {
  id: number;
  recCode: string;
  title: string;
  description?: string;
  recommendationDate: string;
  dueDate?: string;
  status: string;
  assignedTo?: string;
  outcome?: string;
  createdBy: string;
  createdAt: string;
}

interface Attachment {
  id: number;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-blue-100 text-blue-800 border-blue-200",
  "In Progress": "bg-yellow-100 text-yellow-800 border-yellow-200",
  Accepted: "bg-green-100 text-green-800 border-green-200",
  Rejected: "bg-red-100 text-red-800 border-red-200",
  Closed: "bg-gray-100 text-gray-700 border-gray-300",
};

const STATUSES = ["Open", "In Progress", "Accepted", "Rejected", "Closed"];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RecommendationsLogPage() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canEdit = hasPermission("hazard-findings");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RecLog | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [attachFiles, setAttachFiles] = useState<FileList | null>(null);
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);

  const form = useForm({
    defaultValues: {
      title: "",
      description: "",
      recommendationDate: new Date().toISOString().slice(0, 10),
      dueDate: "",
      status: "Open",
      assignedTo: "",
      outcome: "",
    },
  });

  const { data: items = [], isLoading } = useQuery<RecLog[]>({
    queryKey: ["recommendations-log"],
    queryFn: () => fetch(`${BASE}/api/recommendations-log`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: attachments = {} } = useQuery<Record<number, Attachment[]>>({
    queryKey: ["recommendations-log-attachments", expandedId],
    enabled: expandedId !== null,
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/recommendations-log/${expandedId}/attachments`, { credentials: "include" });
      const data = await res.json();
      return { [expandedId!]: data };
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: any) => {
      const fd = new FormData();
      Object.entries(values).forEach(([k, v]) => { if (v) fd.append(k, v as string); });
      if (attachFiles) Array.from(attachFiles).forEach((f) => fd.append("files", f));
      const r = await fetch(`${BASE}/api/recommendations-log`, { method: "POST", credentials: "include", body: fd });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recommendations-log"] });
      setIsFormOpen(false);
      setAttachFiles(null);
      form.reset();
      toast({ title: "Recommendation logged" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      fetch(`${BASE}/api/recommendations-log/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recommendations-log"] });
      setIsFormOpen(false);
      setEditingItem(null);
      toast({ title: "Recommendation updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/api/recommendations-log/${id}`, { method: "DELETE", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recommendations-log"] }); toast({ title: "Deleted" }); },
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: async ({ id, files }: { id: number; files: FileList }) => {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      const r = await fetch(`${BASE}/api/recommendations-log/${id}/attachments`, { method: "POST", credentials: "include", body: fd });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recommendations-log-attachments"] });
      setUploadingFor(null);
      toast({ title: "Files attached" });
    },
    onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  function openNew() {
    setEditingItem(null);
    form.reset({ title: "", description: "", recommendationDate: new Date().toISOString().slice(0, 10), dueDate: "", status: "Open", assignedTo: "", outcome: "" });
    setAttachFiles(null);
    setIsFormOpen(true);
  }

  function openEdit(item: RecLog) {
    setEditingItem(item);
    form.reset({
      title: item.title,
      description: item.description || "",
      recommendationDate: item.recommendationDate,
      dueDate: item.dueDate || "",
      status: item.status,
      assignedTo: item.assignedTo || "",
      outcome: item.outcome || "",
    });
    setIsFormOpen(true);
  }

  function onSubmit(values: any) {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-primary" />
            Recommendations Log
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Track formal JHSC recommendations with supporting documents.</p>
        </div>
        {canEdit && (
          <Button onClick={openNew} className="shrink-0 font-bold">
            <Plus className="w-4 h-4 mr-2" /> Log Recommendation
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
      ) : items.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-8 text-center text-muted-foreground">No recommendations logged yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="border-sidebar-border shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-muted-foreground">{item.recCode}</span>
                      <Badge className={cn("text-[10px] font-bold border", STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-700 border-gray-300")}>{item.status}</Badge>
                    </div>
                    <CardTitle
                      className="text-base font-semibold mt-1 cursor-pointer hover:underline"
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    >
                      {item.title}
                    </CardTitle>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>Date: {item.recommendationDate}</span>
                      {item.dueDate && <span>Due: {item.dueDate}</span>}
                      {item.assignedTo && <span>Assigned: {item.assignedTo}</span>}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => openEdit(item)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this entry?")) deleteMutation.mutate(item.id); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>

              {expandedId === item.id && (
                <CardContent className="pt-0 px-4 pb-4 space-y-3">
                  {item.description && <p className="text-sm text-muted-foreground border-t pt-3">{item.description}</p>}
                  {item.outcome && <p className="text-sm"><span className="font-semibold">Outcome:</span> {item.outcome}</p>}

                  {/* Attachments */}
                  <div className="border rounded-md p-3 space-y-2 bg-muted/20">
                    <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1"><Paperclip className="w-3 h-3" /> Attached Files</p>
                    {(attachments[item.id] ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">No files attached.</p>
                    ) : (
                      <div className="space-y-1">
                        {(attachments[item.id] ?? []).map((att) => (
                          <div key={att.id} className="flex items-center gap-2 text-xs">
                            <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="flex-1 truncate">{att.fileName}</span>
                            <span className="text-muted-foreground shrink-0">{formatBytes(att.fileSizeBytes)}</span>
                            <a
                              href={`${BASE}/api/attachments/file/${att.filePath}`}
                              download={att.fileName}
                              className="text-primary hover:underline shrink-0"
                            >
                              <Download className="w-3 h-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                    {canEdit && (
                      <div className="flex items-center gap-2 pt-1">
                        <Input
                          type="file"
                          multiple
                          className="text-xs h-8"
                          onChange={(e) => { if (e.target.files?.length) setUploadingFor(item.id); setAttachFiles(e.target.files); }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={uploadAttachmentMutation.isPending || uploadingFor !== item.id || !attachFiles}
                          onClick={() => { if (attachFiles) uploadAttachmentMutation.mutate({ id: item.id, files: attachFiles }); }}
                        >
                          {uploadAttachmentMutation.isPending && uploadingFor === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Upload"}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-xl max-h-[90vh] overflow-y-auto border-sidebar-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              {editingItem ? `Edit ${editingItem.recCode}` : "Log Recommendation"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <FormField control={form.control} name="title" rules={{ required: "Title is required" }} render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Title / Subject</FormLabel>
                  <FormControl><Input className="text-sm" placeholder="Brief description of the recommendation" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Details (optional)</FormLabel>
                  <FormControl><Textarea className="resize-none h-20 text-sm" placeholder="Full description, OHSA references, context..." {...field} /></FormControl>
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="recommendationDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Date Issued</FormLabel>
                    <FormControl><Input type="date" className="font-mono text-sm" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Response Due (optional)</FormLabel>
                    <FormControl><Input type="date" className="font-mono text-sm" {...field} value={field.value || ""} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="assignedTo" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Assigned To (optional)</FormLabel>
                    <FormControl><Input className="text-sm" placeholder="Management contact..." {...field} value={field.value || ""} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="outcome" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Outcome / Response (optional)</FormLabel>
                  <FormControl><Textarea className="resize-none h-16 text-sm" placeholder="Management response or outcome..." {...field} value={field.value || ""} /></FormControl>
                </FormItem>
              )} />

              {!editingItem && (
                <div className="border rounded-md p-3 space-y-2 bg-muted/20">
                  <p className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-1"><Paperclip className="w-3 h-3" /> Attach Files (optional)</p>
                  <Input type="file" multiple className="text-sm" onChange={(e) => setAttachFiles(e.target.files)} />
                  <p className="text-[10px] text-muted-foreground">Any file type up to 20 MB each — documents, photos, PDFs, spreadsheets.</p>
                </div>
              )}

              <DialogFooter className="pt-4 border-t mt-2">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                <Button type="submit" className="font-bold" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editingItem ? "Save Changes" : "Log Recommendation"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
