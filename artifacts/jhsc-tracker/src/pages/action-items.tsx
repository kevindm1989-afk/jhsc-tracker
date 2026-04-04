import { useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useListActionItems,
  useCreateActionItem,
  useUpdateActionItem,
  useDeleteActionItem,
  getListActionItemsQueryKey,
  ActionItem,
  ActionItemStatus,
  ActionItemDepartment,
  ActionItemPriority
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Edit2, Trash2, CalendarIcon } from "lucide-react";
import { StatusBadge, PriorityBadge, DeptBadge } from "@/components/ui/status-badges";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  date: z.string().min(1, "Date is required"),
  department: z.nativeEnum(ActionItemDepartment),
  description: z.string().min(5, "Description is required"),
  raisedBy: z.string().min(2, "Raised by is required"),
  assignedTo: z.string().min(2, "Assigned to is required"),
  dueDate: z.string().optional().nullable(),
  priority: z.nativeEnum(ActionItemPriority),
  status: z.nativeEnum(ActionItemStatus),
  notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ActionItemsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ActionItem | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const queryParams = {
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(deptFilter !== "all" && { department: deptFilter })
  };

  const { data: items, isLoading } = useListActionItems(queryParams);

  const createMutation = useCreateActionItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListActionItemsQueryKey() });
        setIsFormOpen(false);
        toast({ title: "Action item created" });
      }
    }
  });

  const updateMutation = useUpdateActionItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListActionItemsQueryKey() });
        setIsFormOpen(false);
        setEditingItem(null);
        toast({ title: "Action item updated" });
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to save changes";
        toast({ title: "Save failed", description: msg, variant: "destructive" });
      }
    }
  });

  const deleteMutation = useDeleteActionItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListActionItemsQueryKey() });
        toast({ title: "Action item deleted", variant: "destructive" });
      }
    }
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      department: "Warehouse",
      description: "",
      raisedBy: "",
      assignedTo: "",
      dueDate: "",
      priority: "Medium",
      status: "Open",
      notes: "",
    }
  });

  const handleEdit = (item: ActionItem) => {
    setEditingItem(item);
    form.reset({
      date: item.date,
      department: item.department,
      description: item.description,
      raisedBy: item.raisedBy,
      assignedTo: item.assignedTo,
      dueDate: item.dueDate || "",
      priority: item.priority,
      status: item.status,
      notes: item.notes || "",
    });
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingItem(null);
    form.reset({
      date: new Date().toISOString().split('T')[0],
      department: "Warehouse",
      description: "",
      raisedBy: "",
      assignedTo: "",
      dueDate: "",
      priority: "Medium",
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

  const isOverdue = (dueDate: string | null | undefined, status: string) => {
    if (!dueDate || status === "Closed") return false;
    return new Date(dueDate) < new Date(new Date().setHours(0,0,0,0));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Action Items</h1>
          <p className="text-muted-foreground mt-1 text-sm">Track safety corrections and assigned tasks.</p>
        </div>
        {isAdmin && (
          <Button onClick={handleCreate} className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> Add Action Item
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
            {Object.values(ActionItemStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs font-medium">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {Object.values(ActionItemDepartment).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border shadow-sm"><div className="min-w-[700px] bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[100px] font-bold text-xs uppercase tracking-wider">ID</TableHead>
              <TableHead className="w-[100px] font-bold text-xs uppercase tracking-wider">Date</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">Description</TableHead>
              <TableHead className="w-[200px] font-bold text-xs uppercase tracking-wider">Notes / Update</TableHead>
              <TableHead className="w-[150px] font-bold text-xs uppercase tracking-wider">Assigned To</TableHead>
              <TableHead className="w-[120px] font-bold text-xs uppercase tracking-wider">Due Date</TableHead>
              <TableHead className="w-[120px] font-bold text-xs uppercase tracking-wider">Status</TableHead>
              {isAdmin && <TableHead className="w-[80px] text-right font-bold text-xs uppercase tracking-wider">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full max-w-[300px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full max-w-[180px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  {isAdmin && <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>}
                </TableRow>
              ))
            ) : items?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 8 : 7} className="h-32 text-center text-muted-foreground">
                  No action items found.
                </TableCell>
              </TableRow>
            ) : (
              items?.map((item) => {
                const overdue = isOverdue(item.dueDate, item.status);
                return (
                  <TableRow key={item.id} className={cn("group transition-colors", overdue && "bg-amber-50/50 hover:bg-amber-100/50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30")}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {item.itemCode}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {format(new Date(item.date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <PriorityBadge priority={item.priority} />
                          <DeptBadge dept={item.department} />
                        </div>
                        <span className="text-sm font-medium leading-snug">{item.description}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground align-top">
                      {item.notes ? item.notes : <span className="text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{item.assignedTo}</TableCell>
                    <TableCell>
                      {item.dueDate ? (
                        <div className={cn("text-sm font-mono flex items-center gap-1", overdue ? "text-red-600 font-bold" : "text-muted-foreground")}>
                          <CalendarIcon className="w-3 h-3" />
                          {format(new Date(item.dueDate), 'MMM dd, yyyy')}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={overdue ? "Overdue" : item.status} />
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (window.confirm('Delete this action item?')) {
                                deleteMutation.mutate({ id: item.id });
                              }
                            }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div></div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-2xl max-h-[90vh] overflow-y-auto border-sidebar-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase tracking-tight">
              {editingItem ? `Edit ${editingItem.itemCode}` : "New Action Item"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Date</FormLabel>
                    <FormControl><Input type="date" className="font-mono text-sm" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="department" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Department</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.values(ActionItemDepartment).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Description</FormLabel>
                  <FormControl><Textarea className="resize-none h-20 text-sm" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="raisedBy" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Raised By</FormLabel>
                    <FormControl><Input className="text-sm" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="assignedTo" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Assigned To</FormLabel>
                    <FormControl><Input className="text-sm" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Due Date</FormLabel>
                    <FormControl><Input type="date" className="font-mono text-sm" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.values(ActionItemPriority).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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
                        {Object.values(ActionItemStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Notes (Optional)</FormLabel>
                  <FormControl><Textarea className="resize-none h-16 text-sm" {...field} value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter className="pt-4 border-t mt-4">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-primary text-primary-foreground font-bold" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingItem ? 'Save Changes' : 'Create Item'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
