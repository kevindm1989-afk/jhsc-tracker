import { useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useListHazardFindings,
  useCreateHazardFinding,
  useUpdateHazardFinding,
  useDeleteHazardFinding,
  getListHazardFindingsQueryKey,
  HazardFinding,
  HazardFindingStatus,
  HazardFindingDepartment,
  HazardFindingSeverity
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
import { Plus, Search, Edit2, Trash2, CalendarIcon, ShieldAlert } from "lucide-react";
import { StatusBadge, PriorityBadge, DeptBadge } from "@/components/ui/status-badges";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const formSchema = z.object({
  date: z.string().min(1, "Date is required"),
  department: z.nativeEnum(HazardFindingDepartment),
  hazardDescription: z.string().min(5, "Description is required"),
  ohsaReference: z.string().optional().nullable(),
  severity: z.nativeEnum(HazardFindingSeverity),
  recommendationDate: z.string().min(1, "Rec date is required"),
  responseDeadline: z.string().optional().nullable(),
  status: z.nativeEnum(HazardFindingStatus),
  notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function HazardFindingsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HazardFinding | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const queryParams = {
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(deptFilter !== "all" && { department: deptFilter })
  };

  const { data: items, isLoading } = useListHazardFindings(queryParams);

  const createMutation = useCreateHazardFinding({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHazardFindingsQueryKey() });
        setIsFormOpen(false);
        toast({ title: "Hazard finding recorded" });
      }
    }
  });

  const updateMutation = useUpdateHazardFinding({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHazardFindingsQueryKey() });
        setIsFormOpen(false);
        setEditingItem(null);
        toast({ title: "Hazard finding updated" });
      }
    }
  });

  const deleteMutation = useDeleteHazardFinding({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHazardFindingsQueryKey() });
        toast({ title: "Hazard finding deleted", variant: "destructive" });
      }
    }
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      department: "Production",
      hazardDescription: "",
      ohsaReference: "",
      severity: "High",
      recommendationDate: new Date().toISOString().split('T')[0],
      responseDeadline: "",
      status: "Open",
      notes: "",
    }
  });

  const handleEdit = (item: HazardFinding) => {
    setEditingItem(item);
    form.reset({
      date: item.date,
      department: item.department,
      hazardDescription: item.hazardDescription,
      ohsaReference: item.ohsaReference || "",
      severity: item.severity,
      recommendationDate: item.recommendationDate,
      responseDeadline: item.responseDeadline || "",
      status: item.status,
      notes: item.notes || "",
    });
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingItem(null);
    form.reset({
      date: new Date().toISOString().split('T')[0],
      department: "Production",
      hazardDescription: "",
      ohsaReference: "",
      severity: "High",
      recommendationDate: new Date().toISOString().split('T')[0],
      responseDeadline: "",
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="w-8 h-8 text-destructive" />
            Hazard Findings
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Formal recommendations to the employer.</p>
        </div>
        {isAdmin && (
          <Button onClick={handleCreate} className="shrink-0 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> Log Hazard
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
            {Object.values(HazardFindingStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs font-medium">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {Object.values(HazardFindingDepartment).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border shadow-sm"><div className="min-w-[800px] bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50 border-b-2 border-border">
            <TableRow>
              <TableHead className="w-[90px] font-bold text-xs uppercase tracking-wider">ID</TableHead>
              <TableHead className="w-[100px] font-bold text-xs uppercase tracking-wider">Date</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">Hazard Description & OHSA Ref</TableHead>
              <TableHead className="w-[200px] font-bold text-xs uppercase tracking-wider">Notes / Update</TableHead>
              <TableHead className="w-[120px] font-bold text-xs uppercase tracking-wider">Severity</TableHead>
              <TableHead className="w-[120px] font-bold text-xs uppercase tracking-wider">Deadline</TableHead>
              <TableHead className="w-[150px] font-bold text-xs uppercase tracking-wider">Status</TableHead>
              {isAdmin && <TableHead className="w-[80px] text-right font-bold text-xs uppercase tracking-wider">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full max-w-[180px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  {isAdmin && <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>}
                </TableRow>
              ))
            ) : items?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 8 : 7} className="h-32 text-center text-muted-foreground">
                  No hazard findings found.
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
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium leading-snug">{item.hazardDescription}</span>
                      <div className="flex items-center gap-2">
                        {item.ohsaReference && (
                          <span className="text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono px-1.5 py-0.5 rounded uppercase font-bold tracking-tight">
                            {item.ohsaReference}
                          </span>
                        )}
                        <DeptBadge dept={item.department} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground align-top">
                    {item.notes ? item.notes : <span className="text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={item.severity} />
                  </TableCell>
                  <TableCell>
                    {item.responseDeadline ? (
                      <div className="text-sm font-mono flex items-center gap-1 text-muted-foreground">
                        <CalendarIcon className="w-3 h-3" />
                        {format(new Date(item.responseDeadline), 'MMM dd')}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (window.confirm('Delete this record?')) {
                              deleteMutation.mutate({ id: item.id });
                            }
                          }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div></div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-2xl max-h-[90vh] overflow-y-auto border-sidebar-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              {editingItem ? `Edit ${editingItem.itemCode}` : "Log Hazard Finding"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Date Found</FormLabel>
                    <FormControl><Input type="date" className="font-mono text-sm" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="department" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Department</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.values(HazardFindingDepartment).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              
              <FormField control={form.control} name="hazardDescription" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Hazard Description</FormLabel>
                  <FormControl><Textarea className="resize-none h-20 text-sm" placeholder="Detailed description of the hazard..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="ohsaReference" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">OHSA Reference</FormLabel>
                    <FormControl><Input className="text-sm font-mono placeholder:font-sans" placeholder="e.g. OHSA s.25(2)(h)" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="severity" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Severity</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.values(HazardFindingSeverity).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField control={form.control} name="recommendationDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Rec. Date</FormLabel>
                    <FormControl><Input type="date" className="font-mono text-sm" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="responseDeadline" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Response Deadline</FormLabel>
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
                        {Object.values(HazardFindingStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Employer Response / Notes</FormLabel>
                  <FormControl><Textarea className="resize-none h-16 text-sm" {...field} value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter className="pt-4 border-t mt-4">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingItem ? 'Save Changes' : 'Log Hazard'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
