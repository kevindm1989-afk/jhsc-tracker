import { useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useListInspectionEntries,
  useCreateInspectionEntry,
  useUpdateInspectionEntry,
  useDeleteInspectionEntry,
  getListInspectionEntriesQueryKey,
  InspectionEntry,
  InspectionEntryStatus,
  InspectionEntryPriority
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Edit2, Trash2, CalendarIcon } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/ui/status-badges";
import { useToast } from "@/hooks/use-toast";

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

  const queryParams = {
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(zoneFilter !== "all" && { zone: zoneFilter })
  };

  const { data: items, isLoading } = useListInspectionEntries(queryParams);

  const createMutation = useCreateInspectionEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInspectionEntriesQueryKey() });
        setIsFormOpen(false);
        toast({ title: "Inspection entry added" });
      }
    }
  });

  const updateMutation = useUpdateInspectionEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInspectionEntriesQueryKey() });
        setIsFormOpen(false);
        setEditingItem(null);
        toast({ title: "Inspection entry updated" });
      }
    }
  });

  const deleteMutation = useDeleteInspectionEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInspectionEntriesQueryKey() });
        toast({ title: "Entry deleted", variant: "destructive" });
      }
    }
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      zone: ZONES[0],
      area: "",
      finding: "",
      priority: "Medium",
      assignedTo: "",
      followUpDate: "",
      status: "Open",
      notes: "",
    }
  });

  const handleEdit = (item: InspectionEntry) => {
    setEditingItem(item);
    form.reset({
      date: item.date,
      zone: item.zone,
      area: item.area || "",
      finding: item.finding,
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
      date: new Date().toISOString().split('T')[0],
      zone: ZONES[0],
      area: "",
      finding: "",
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Monthly Inspection Log</h1>
          <p className="text-muted-foreground mt-1 text-sm">Findings from workplace inspections across all 11 zones.</p>
        </div>
        <Button onClick={handleCreate} className="shrink-0 font-bold shadow-sm">
          <Plus className="w-4 h-4 mr-2" /> Record Finding
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 items-center bg-card p-4 rounded-md border shadow-sm">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filter:</span>
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-8 text-xs font-medium">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.values(InspectionEntryStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="w-[250px] h-8 text-xs font-medium truncate">
            <SelectValue placeholder="All Zones" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Zones</SelectItem>
            {ZONES.map(z => <SelectItem key={z} value={z}>{z.split(' - ')[0]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border shadow-sm"><div className="min-w-[700px] bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[90px] font-bold text-xs uppercase tracking-wider">ID</TableHead>
              <TableHead className="w-[90px] font-bold text-xs uppercase tracking-wider">Date</TableHead>
              <TableHead className="w-[150px] font-bold text-xs uppercase tracking-wider">Location</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">Finding</TableHead>
              <TableHead className="w-[100px] font-bold text-xs uppercase tracking-wider">Priority</TableHead>
              <TableHead className="w-[120px] font-bold text-xs uppercase tracking-wider">Status</TableHead>
              <TableHead className="w-[80px] text-right font-bold text-xs uppercase tracking-wider">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : items?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No inspection records found.
                </TableCell>
              </TableRow>
            ) : (
              items?.map((item) => (
                <TableRow key={item.id} className="group transition-colors">
                  <TableCell className="font-mono text-xs font-semibold">
                    {item.itemCode}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {format(new Date(item.date), 'MMM dd')}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {item.zone.split(' - ')[0]}
                      </span>
                      {item.area && <span className="text-sm truncate max-w-[140px]">{item.area}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium leading-snug">{item.finding}</span>
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={item.priority} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={item.status} />
                      {item.followUpDate && item.status !== 'Closed' && (
                        <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                          <CalendarIcon className="w-2.5 h-2.5" />
                          {format(new Date(item.followUpDate), 'MMM dd')}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" 
                        onClick={() => {
                          if(window.confirm('Delete this record?')) {
                            deleteMutation.mutate({ id: item.id });
                          }
                        }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div></div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl border-sidebar-border shadow-2xl">
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="text-sm truncate"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {ZONES.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              
              <div className="grid grid-cols-[1fr_2fr] gap-4">
                <FormField control={form.control} name="area" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Specific Area</FormLabel>
                    <FormControl><Input className="text-sm" placeholder="e.g. Aisle 3" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="finding" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Finding</FormLabel>
                    <FormControl><Input className="text-sm" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.values(InspectionEntryPriority).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="assignedTo" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Assigned To</FormLabel>
                    <FormControl><Input className="text-sm" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="followUpDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Follow-up Date</FormLabel>
                    <FormControl><Input type="date" className="font-mono text-sm" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.values(InspectionEntryStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
                  {editingItem ? 'Save Changes' : 'Record Finding'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
