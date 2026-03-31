import { useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useListWorkerStatements,
  useCreateWorkerStatement,
  useUpdateWorkerStatement,
  useDeleteWorkerStatement,
  getListWorkerStatementsQueryKey,
  WorkerStatement,
  WorkerStatementStatus,
  WorkerStatementDepartment,
  WorkerStatementShift
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
import { Plus, Search, Edit2, Trash2, ShieldAlert, LockIcon, Link as LinkIcon } from "lucide-react";
import { StatusBadge, DeptBadge } from "@/components/ui/status-badges";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  dateReceived: z.string().min(1, "Date is required"),
  shift: z.nativeEnum(WorkerStatementShift),
  department: z.nativeEnum(WorkerStatementDepartment),
  hazardType: z.string().min(2, "Type is required"),
  description: z.string().min(5, "Description is required"),
  linkedItemCode: z.string().optional().nullable(),
  status: z.nativeEnum(WorkerStatementStatus),
  notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function WorkerStatementsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkerStatement | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryParams = {
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(deptFilter !== "all" && { department: deptFilter })
  };

  const { data: items, isLoading } = useListWorkerStatements(queryParams);

  const createMutation = useCreateWorkerStatement({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkerStatementsQueryKey() });
        setIsFormOpen(false);
        toast({ title: "Statement logged" });
      }
    }
  });

  const updateMutation = useUpdateWorkerStatement({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkerStatementsQueryKey() });
        setIsFormOpen(false);
        setEditingItem(null);
        toast({ title: "Statement updated" });
      }
    }
  });

  const deleteMutation = useDeleteWorkerStatement({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkerStatementsQueryKey() });
        toast({ title: "Statement deleted", variant: "destructive" });
      }
    }
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dateReceived: new Date().toISOString().split('T')[0],
      shift: "Day",
      department: "Both",
      hazardType: "",
      description: "",
      linkedItemCode: "",
      status: "Received",
      notes: "",
    }
  });

  const handleEdit = (item: WorkerStatement) => {
    setEditingItem(item);
    form.reset({
      dateReceived: item.dateReceived,
      shift: item.shift,
      department: item.department,
      hazardType: item.hazardType,
      description: item.description,
      linkedItemCode: item.linkedItemCode || "",
      status: item.status,
      notes: item.notes || "",
    });
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingItem(null);
    form.reset({
      dateReceived: new Date().toISOString().split('T')[0],
      shift: "Day",
      department: "Both",
      hazardType: "",
      description: "",
      linkedItemCode: "",
      status: "Received",
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <LockIcon className="w-7 h-7 text-sidebar-primary" />
            Worker Statements
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Confidential health & safety concerns raised by members.</p>
        </div>
        <Button onClick={handleCreate} className="shrink-0 bg-sidebar-primary hover:bg-sidebar-primary/90 text-primary-foreground font-bold shadow-sm">
          <Plus className="w-4 h-4 mr-2" /> Log Statement
        </Button>
      </div>

      <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive-foreground">
        <ShieldAlert className="h-5 w-5 text-destructive" />
        <AlertTitle className="text-destructive font-bold uppercase tracking-wider">Confidentiality Notice</AlertTitle>
        <AlertDescription className="text-destructive/90 font-medium">
          All worker statements are tracked by statement code only. Do not record worker names, clock numbers, or identifying details in any field below.
        </AlertDescription>
      </Alert>

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
            {Object.values(WorkerStatementStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[180px] h-8 text-xs font-medium">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {Object.values(WorkerStatementDepartment).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border shadow-sm"><div className="min-w-[700px] bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50 border-b-2 border-border">
            <TableRow>
              <TableHead className="w-[100px] font-bold text-xs uppercase tracking-wider">Code</TableHead>
              <TableHead className="w-[100px] font-bold text-xs uppercase tracking-wider">Date</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">Concern details</TableHead>
              <TableHead className="w-[100px] font-bold text-xs uppercase tracking-wider">Linked To</TableHead>
              <TableHead className="w-[140px] font-bold text-xs uppercase tracking-wider">Status</TableHead>
              <TableHead className="w-[80px] text-right font-bold text-xs uppercase tracking-wider">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : items?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No statements logged.
                </TableCell>
              </TableRow>
            ) : (
              items?.map((item) => (
                <TableRow key={item.id} className="group transition-colors">
                  <TableCell className="font-mono text-xs font-bold text-sidebar-primary">
                    {item.statementCode}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {format(new Date(item.dateReceived), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium leading-snug">{item.description}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded uppercase font-bold tracking-tight border">
                          {item.hazardType}
                        </span>
                        <DeptBadge dept={item.department} />
                        <span className="text-[10px] text-muted-foreground/80 uppercase font-semibold">
                          {item.shift} Shift
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.linkedItemCode ? (
                      <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground font-semibold bg-muted/50 w-fit px-1.5 py-0.5 rounded border border-muted">
                        <LinkIcon className="w-3 h-3" />
                        {item.linkedItemCode}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" 
                        onClick={() => {
                          if(window.confirm('Permanently delete this statement?')) {
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
        <DialogContent className="max-w-2xl border-sidebar-primary/20 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase tracking-tight flex items-center gap-2 text-sidebar-primary">
              <LockIcon className="w-5 h-5" />
              {editingItem ? `Edit ${editingItem.statementCode}` : "Log Confidential Statement"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="dateReceived" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Date Received</FormLabel>
                    <FormControl><Input type="date" className="font-mono text-sm" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="shift" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Shift</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.values(WorkerStatementShift).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="department" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Department</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.values(WorkerStatementDepartment).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="hazardType" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Type / Category</FormLabel>
                  <FormControl><Input className="text-sm" placeholder="e.g. Ergonomics, Machine Guarding, Air Quality" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Concern Description</FormLabel>
                  <FormControl><Textarea className="resize-none h-24 text-sm font-medium" placeholder="Do not include worker name..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="linkedItemCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Linked Record (Optional)</FormLabel>
                    <FormControl><Input className="text-sm font-mono placeholder:font-sans" placeholder="e.g. AI-014 or HF-003" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.values(WorkerStatementStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Co-Chair Notes</FormLabel>
                  <FormControl><Textarea className="resize-none h-16 text-sm" {...field} value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter className="pt-4 border-t mt-4">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-sidebar-primary text-primary-foreground hover:bg-sidebar-primary/90 font-bold" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingItem ? 'Save Changes' : 'Log Statement'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
