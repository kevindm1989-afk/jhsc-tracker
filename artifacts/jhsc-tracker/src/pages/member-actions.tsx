import { useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useListMemberActions,
  useCreateMemberAction,
  useUpdateMemberAction,
  useDeleteMemberAction,
  getListMemberActionsQueryKey,
  MemberAction,
  MemberActionType,
  UpdateMemberActionStatus,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface UserSummary {
  id: number;
  displayName: string;
  username: string;
  role: string;
}

function useUsers() {
  return useQuery<UserSummary[]>({
    queryKey: ["users-list"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/users`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60 * 1000,
  });
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, ClipboardList, CheckCircle2, Clock, Circle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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

const ACTION_TYPE_LABELS: Record<string, string> = {
  "zone-inspection": "Zone Inspection",
  "inspect-spill-kits": "Inspect Spill Kits",
  "inspect-first-aid-kits": "Inspect First Aid Kits",
  "inspect-eye-saline": "Inspect Eye Saline Bottles",
  "verify-closed-items": "Verify Closed Items",
  "other": "Other",
};

const ZONES = Array.from({ length: 11 }, (_, i) => i + 1);

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: "Pending", icon: Circle, className: "text-muted-foreground border-muted-foreground/40" },
  "in-progress": { label: "In Progress", icon: Clock, className: "text-blue-600 border-blue-300 bg-blue-50" },
  completed: { label: "Completed", icon: CheckCircle2, className: "text-green-600 border-green-300 bg-green-50" },
};

const formSchema = z.object({
  title: z.string().min(3, "Title is required"),
  type: z.nativeEnum(MemberActionType),
  assignedToUserId: z.coerce.number().min(1, "Assignee is required"),
  zone: z.coerce.number().nullable().optional(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  relatedItemCode: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function MemberActionsPage() {
  const { user } = useAuth();
  const canAdmin = user?.role === "admin" || user?.role === "co-chair";

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MemberAction | null>(null);
  const [deletingItem, setDeletingItem] = useState<MemberAction | null>(null);
  const [quickStatusItem, setQuickStatusItem] = useState<MemberAction | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: actions, isLoading } = useListMemberActions();
  const { data: users } = useUsers();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListMemberActionsQueryKey() });

  const createMutation = useCreateMemberAction({
    mutation: { onSuccess: () => { invalidate(); setIsFormOpen(false); toast({ title: "Action created" }); } },
  });
  const updateMutation = useUpdateMemberAction({
    mutation: { onSuccess: () => { invalidate(); setIsFormOpen(false); setEditingItem(null); setQuickStatusItem(null); toast({ title: "Action updated" }); } },
  });
  const deleteMutation = useDeleteMemberAction({
    mutation: { onSuccess: () => { invalidate(); setDeletingItem(null); toast({ title: "Action deleted" }); } },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      type: MemberActionType["zone-inspection"],
      assignedToUserId: 0,
      zone: null,
      dueDate: null,
      notes: null,
      relatedItemCode: null,
    },
  });

  const watchedType = form.watch("type");
  const watchedZone = form.watch("zone");

  const openCreate = () => {
    setEditingItem(null);
    form.reset({ title: "", type: MemberActionType["zone-inspection"], assignedToUserId: 0, zone: null, dueDate: null, notes: null, relatedItemCode: null });
    setIsFormOpen(true);
  };

  const openEdit = (item: MemberAction) => {
    setEditingItem(item);
    form.reset({
      title: item.title,
      type: item.type as MemberActionType,
      assignedToUserId: item.assignedToUserId,
      zone: (item as any).zone ?? null,
      dueDate: item.dueDate ?? null,
      notes: item.notes ?? null,
      relatedItemCode: item.relatedItemCode ?? null,
    });
    setIsFormOpen(true);
  };

  const onSubmit = (values: FormValues) => {
    const payload = {
      ...values,
      zone: values.type === MemberActionType["zone-inspection"] ? (values.zone ?? null) : null,
      dueDate: values.dueDate || null,
      notes: values.notes || null,
      relatedItemCode: values.relatedItemCode || null,
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  };

  const updateStatus = (item: MemberAction, status: string) => {
    updateMutation.mutate({ id: item.id, data: { status: status as UpdateMemberActionStatus } });
  };

  const myActions = canAdmin ? (actions ?? []) : (actions ?? []).filter((a) => a.assignedToUserId === user?.id);
  const filtered = myActions.filter((a) => statusFilter === "all" || a.status === statusFilter);

  const isOverdue = (item: MemberAction) =>
    item.dueDate && item.status !== "completed" && new Date(item.dueDate) < new Date();

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Member Actions
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {canAdmin ? "Assign and track tasks for committee members" : "Your assigned tasks"}
          </p>
        </div>
        {canAdmin && (
          <Button onClick={openCreate} size="sm" className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Assign Action
          </Button>
        )}
      </div>

      {/* Summary cards */}
      {myActions.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {(["pending", "in-progress", "completed"] as const).map((s) => {
            const count = myActions.filter((a) => a.status === s).length;
            const cfg = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-all",
                  statusFilter === s ? "ring-2 ring-primary" : "hover:bg-muted/50"
                )}
              >
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{cfg.label}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {["all", "pending", "in-progress", "completed"].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(s)}
            className="capitalize text-xs"
          >
            {s === "all" ? "All" : STATUS_CONFIG[s].label}
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Code</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-36 hidden sm:table-cell">Type</TableHead>
              <TableHead className="w-32 hidden md:table-cell">Assigned To</TableHead>
              <TableHead className="w-28 hidden md:table-cell">Due Date</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length > 0 ? (
              filtered.map((item) => {
                const cfg = STATUS_CONFIG[item.status];
                const overdue = isOverdue(item);
                return (
                  <TableRow key={item.id} className={cn("group", overdue && "bg-red-50/50")}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.actionCode}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{item.title}</p>
                      <div className="sm:hidden text-xs text-muted-foreground mt-0.5">
                        {ACTION_TYPE_LABELS[item.type]}
                      </div>
                      <div className="md:hidden text-xs text-muted-foreground">
                        {item.assignedToName}
                        {item.dueDate && (
                          <span className={cn("ml-2", overdue && "text-destructive font-medium")}>
                            Due {format(new Date(item.dueDate), "MMM d")}
                          </span>
                        )}
                      </div>
                      {item.relatedItemCode && (
                        <span className="text-xs text-muted-foreground font-mono">→ {item.relatedItemCode}</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="text-xs font-normal">
                        {ACTION_TYPE_LABELS[item.type]}
                        {item.type === "zone-inspection" && (item as any).zone ? ` — Zone ${(item as any).zone}` : ""}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{item.assignedToName}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {item.dueDate ? (
                        <span className={cn(overdue && "text-destructive font-medium")}>
                          {format(new Date(item.dueDate), "MMM d, yyyy")}
                          {overdue && <span className="ml-1 text-[10px]">(overdue)</span>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {canAdmin ? (
                        <Select
                          value={item.status}
                          onValueChange={(val) => updateStatus(item, val)}
                        >
                          <SelectTrigger className={cn("h-7 text-xs border rounded-full px-2 w-auto gap-1", cfg.className)}>
                            <cfg.icon className="w-3 h-3 shrink-0" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className={cn("inline-flex items-center gap-1.5 text-xs font-medium border rounded-full px-2.5 py-1", cfg.className)}>
                          <cfg.icon className="w-3 h-3 shrink-0" />
                          {cfg.label}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!canAdmin && item.status !== "completed" && (
                          <Button
                            size="sm"
                            className="h-7 text-xs px-2 bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => updateStatus(item, "completed")}
                            disabled={updateMutation.isPending}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Mark Complete
                          </Button>
                        )}
                        {canAdmin && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeletingItem(item)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  {statusFilter !== "all"
                    ? `No ${STATUS_CONFIG[statusFilter]?.label.toLowerCase()} actions.`
                    : canAdmin
                    ? "No actions assigned yet. Use the button above to assign one."
                    : "No actions have been assigned to you yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit Dialog (admin only) */}
      {canAdmin && (
        <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) { setIsFormOpen(false); setEditingItem(null); } }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Action" : "Assign Action to Member"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl><Input placeholder="e.g. Conduct zone 3 inspection" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Action Type</FormLabel>
                        <Select onValueChange={(val) => { field.onChange(val); form.setValue("zone", null); }} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="zone-inspection">Zone Inspection</SelectItem>
                            <SelectItem value="inspect-spill-kits">Inspect Spill Kits</SelectItem>
                            <SelectItem value="inspect-first-aid-kits">Inspect First Aid Kits</SelectItem>
                            <SelectItem value="inspect-eye-saline">Inspect Eye Saline Bottles</SelectItem>
                            <SelectItem value="verify-closed-items">Verify Closed Items</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="assignedToUserId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign To</FormLabel>
                        <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {(users ?? [])
                              .filter((u) => ["co-chair", "worker-rep", "management"].includes(u.role))
                              .map((u) => (
                                <SelectItem key={u.id} value={String(u.id)}>{u.displayName}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {watchedType === MemberActionType["zone-inspection"] && (
                  <FormField
                    control={form.control}
                    name="zone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zone <span className="text-destructive">*</span></FormLabel>
                        <Select
                          onValueChange={(val) => {
                            field.onChange(Number(val));
                            const current = form.getValues("title");
                            if (!current || /^Zone \d+ Inspection$/.test(current)) {
                              form.setValue("title", `Zone ${val} Inspection`);
                            }
                          }}
                          value={field.value ? String(field.value) : ""}
                        >
                          <FormControl><SelectTrigger><SelectValue placeholder="Select zone (1–11)" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {ZONES.map((z) => (
                              <SelectItem key={z} value={String(z)}>Zone {z}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="relatedItemCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Related Item Code</FormLabel>
                        <FormControl><Input placeholder="e.g. CI-001, IL-005" {...field} value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl><Textarea {...field} value={field.value ?? ""} rows={3} placeholder="Additional instructions..." /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingItem ? "Save Changes" : "Assign Action"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Action?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-medium">{deletingItem?.actionCode} — {deletingItem?.title}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingItem && deleteMutation.mutate({ id: deletingItem.id })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
