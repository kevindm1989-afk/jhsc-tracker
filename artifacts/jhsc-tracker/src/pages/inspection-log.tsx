import { useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useListInspectionEntries,
  useCreateInspectionEntry,
  useUpdateInspectionEntry,
  useDeleteInspectionEntry,
  useVerifyInspectionEntry,
  getListInspectionEntriesQueryKey,
  InspectionEntry,
  InspectionEntryStatus,
  InspectionEntryPriority,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Edit2, Trash2, CheckCircle2 } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/ui/status-badges";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
type UserInfo = { id: number; displayName: string; username: string; role: string };

const ZONES = [
  "Zone 1 — Process / Production",
  "Zone 2 — Tank Gallery / Labs",
  "Zone 3 — Basement / Raw Milk Receiving",
  "Zone 4 — Employee Facilities",
  "Zone 5 — Exterior Building",
  "Zone 6 — Cold Warehouse",
  "Zone 7 — WH #2 / Case Wash",
  "Zone 8 — Maintenance / Boiler / Ammonia",
  "Zone 9 — Caser Stacker / Chain System",
  "Zone 10 — Warehouse #1",
  "Zone 11 — Maintenance Boiler / Hot Water",
];

const formSchema = z.object({
  date: z.string().min(1, "Date is required"),
  zone: z.string().min(1, "Zone is required"),
  area: z.string().optional().nullable(),
  finding: z.string().min(3, "Finding is required"),
  correctiveAction: z.string().optional().nullable(),
  inspector: z.string().optional().nullable(),
  priority: z.nativeEnum(InspectionEntryPriority),
  assignedTo: z.string().optional().nullable(),
  followUpDate: z.string().optional().nullable(),
  status: z.nativeEnum(InspectionEntryStatus),
  notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function InspectionLogPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InspectionEntry | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: currentUser } = useQuery<UserInfo>({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/auth/me`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const isAdmin = currentUser?.role === "admin";
  const isWorkerRep = currentUser?.role === "worker-rep";

  const queryParams = {
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(zoneFilter !== "all" && { zone: zoneFilter }),
  };

  const { data: items, isLoading } = useListInspectionEntries(queryParams);

  const createMutation = useCreateInspectionEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInspectionEntriesQueryKey() });
        setIsFormOpen(false);
        toast({ title: "Inspection entry added" });
      },
    },
  });

  const updateMutation = useUpdateInspectionEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInspectionEntriesQueryKey() });
        setIsFormOpen(false);
        setEditingItem(null);
        toast({ title: "Inspection entry updated" });
      },
    },
  });

  const deleteMutation = useDeleteInspectionEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInspectionEntriesQueryKey() });
        toast({ title: "Entry deleted", variant: "destructive" });
      },
    },
  });

  const verifyMutation = useVerifyInspectionEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInspectionEntriesQueryKey() });
        toast({ title: "Finding verified" });
      },
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      zone: ZONES[0],
      area: "",
      finding: "",
      correctiveAction: "",
      inspector: "",
      priority: "Medium",
      assignedTo: "",
      followUpDate: "",
      status: "Open",
      notes: "",
    },
  });

  const handleEdit = (item: InspectionEntry) => {
    setEditingItem(item);
    form.reset({
      date: item.date,
      zone: item.zone,
      area: item.area || "",
      finding: item.finding,
      correctiveAction: item.correctiveAction || "",
      inspector: item.inspector || "",
      priority: item.priority,
      assignedTo: item.assignedTo || "",
      followUpDate: item.followUpDate || "",
      status: item.status,
      notes: item.notes || "",
    });
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingItem(null);
    form.reset({
      date: new Date().toISOString().split("T")[0],
      zone: ZONES[0],
      area: "",
      finding: "",
      correctiveAction: "",
      inspector: "",
      priority: "Medium",
      assignedTo: "",
      followUpDate: "",
      status: "Open",
      notes: "",
    });
    setIsFormOpen(true);
  };

  const onSubmit = (data: FormValues) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate({ data });
    }
  };

  const canVerify = (item: InspectionEntry) => {
    if (item.status !== "Pending") return false;
    if (isAdmin || isWorkerRep) return true;
    if (!item.inspector || !currentUser) return false;
    return item.inspector.trim().toLowerCase() === currentUser.displayName.trim().toLowerCase();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Monthly Inspection Log</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Findings from workplace inspections. Pending items require verification by the inspector.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={handleCreate} className="shrink-0 font-bold shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> Record Finding
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center bg-card p-4 rounded-md border shadow-sm">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filter:</span>
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs font-medium">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.values(InspectionEntryStatus).map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="w-full sm:w-[250px] h-9 text-xs font-medium truncate">
            <SelectValue placeholder="All Zones" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Zones</SelectItem>
            {ZONES.map(z => (
              <SelectItem key={z} value={z}>{z}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border shadow-sm">
        <div className="min-w-[800px] bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[80px] font-bold text-xs uppercase tracking-wider">ID</TableHead>
                <TableHead className="w-[80px] font-bold text-xs uppercase tracking-wider">Date</TableHead>
                <TableHead className="w-[130px] font-bold text-xs uppercase tracking-wider">Zone / Area</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Finding & Corrective Action</TableHead>
                <TableHead className="w-[110px] font-bold text-xs uppercase tracking-wider">Inspector</TableHead>
                <TableHead className="w-[90px] font-bold text-xs uppercase tracking-wider">Priority</TableHead>
                <TableHead className="w-[100px] font-bold text-xs uppercase tracking-wider">Status</TableHead>
                <TableHead className="w-[110px] text-right font-bold text-xs uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <TableRow key={i}>
                      {Array(8).fill(0).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
              ) : items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    No inspection records found.
                  </TableCell>
                </TableRow>
              ) : (
                items?.map(item => (
                  <TableRow key={item.id} className="group transition-colors">
                    <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                      {item.itemCode}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {format(new Date(item.date), "MMM dd")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground leading-tight">
                          {item.zone.split(" — ")[0]}
                        </span>
                        {item.area && (
                          <span className="text-xs text-muted-foreground truncate max-w-[120px]">{item.area}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium leading-snug">{item.finding}</span>
                        {item.correctiveAction && (
                          <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 border-l-2 border-muted-foreground/30">
                            <span className="font-semibold uppercase tracking-wider text-[10px]">Corrective Action: </span>
                            {item.correctiveAction}
                          </div>
                        )}
                        {item.verifiedAt && item.verifiedBy && (
                          <div className="text-[10px] text-teal-600 dark:text-teal-400 flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="w-3 h-3" />
                            Verified by {item.verifiedBy} · {format(new Date(item.verifiedAt), "MMM dd, yyyy")}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.inspector ? (
                        <span className="text-xs font-medium">{item.inspector}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={item.priority} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {canVerify(item) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs font-semibold border-teal-500 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950"
                            disabled={verifyMutation.isPending}
                            onClick={() => verifyMutation.mutate({ id: item.id })}
                          >
                            Verify
                          </Button>
                        )}
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEdit(item)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                if (window.confirm("Delete this record?")) {
                                  deleteMutation.mutate({ id: item.id });
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-2xl max-h-[90vh] overflow-y-auto border-sidebar-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase tracking-tight">
              {editingItem ? `Edit ${editingItem.itemCode}` : "Record Finding"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Inspection Date</FormLabel>
                    <FormControl><Input type="date" className="font-mono text-sm" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="zone" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Zone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="text-sm truncate"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {ZONES.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="area" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Specific Area</FormLabel>
                    <FormControl><Input className="text-sm" placeholder="e.g. Aisle 3" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="inspector" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Inspector Name</FormLabel>
                    <FormControl><Input className="text-sm" placeholder="Name of inspector" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="finding" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Finding</FormLabel>
                  <FormControl><Input className="text-sm" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="correctiveAction" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Corrective Action</FormLabel>
                  <FormControl>
                    <Textarea className="resize-none h-16 text-sm" placeholder="Describe the corrective action taken or required..." {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.values(InspectionEntryPriority).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.values(InspectionEntryStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="assignedTo" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Assigned To</FormLabel>
                    <FormControl><Input className="text-sm" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="followUpDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Follow-up Date</FormLabel>
                    <FormControl><Input type="date" className="font-mono text-sm" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Notes</FormLabel>
                  <FormControl><Textarea className="resize-none h-16 text-sm" {...field} value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter className="pt-4 border-t mt-4">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                <Button type="submit" className="font-bold" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingItem ? "Save Changes" : "Record Finding"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
