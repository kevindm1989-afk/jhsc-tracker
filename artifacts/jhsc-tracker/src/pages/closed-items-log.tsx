import { useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useListClosedItems,
  useCreateClosedItem,
  useUpdateClosedItem,
  useDeleteClosedItem,
  useVerifyClosedItem,
  getListClosedItemsQueryKey,
  ClosedItem,
  ClosedItemDepartment,
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
import { Plus, Search, Edit2, Trash2, CheckCheck } from "lucide-react";
import { DeptBadge, StatusBadge } from "@/components/ui/status-badges";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { TruncatedText } from "@/components/ui/truncated-text";
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

const formSchema = z.object({
  date: z.string().min(1, "Date is required"),
  department: z.nativeEnum(ClosedItemDepartment),
  description: z.string().min(5, "Description is required"),
  assignedTo: z.string().min(2, "Assigned to is required"),
  closedDate: z.string().optional().nullable(),
  meetingDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ClosedItemsLogPage() {
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClosedItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<ClosedItem | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isWorkerRep = user?.role === "worker-rep";

  const queryParams = {
    ...(deptFilter !== "all" && { department: deptFilter }),
    ...(searchText.length > 1 && { search: searchText }),
  };

  const { data: items, isLoading } = useListClosedItems(queryParams);

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: getListClosedItemsQueryKey() });
  };

  const createMutation = useCreateClosedItem({
    mutation: {
      onSuccess: () => {
        invalidateList();
        setIsFormOpen(false);
        toast({ title: "Closed item created" });
      },
    },
  });

  const updateMutation = useUpdateClosedItem({
    mutation: {
      onSuccess: () => {
        invalidateList();
        setIsFormOpen(false);
        setEditingItem(null);
        toast({ title: "Closed item updated" });
      },
    },
  });

  const deleteMutation = useDeleteClosedItem({
    mutation: {
      onSuccess: () => {
        invalidateList();
        setDeletingItem(null);
        toast({ title: "Closed item deleted" });
      },
    },
  });

  const verifyMutation = useVerifyClosedItem({
    mutation: {
      onSuccess: () => {
        invalidateList();
        toast({ title: "Item verified", description: "Marked as verified." });
      },
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      department: ClosedItemDepartment.Both,
      description: "",
      assignedTo: "",
      closedDate: null,
      meetingDate: null,
      notes: null,
    },
  });

  const openCreate = () => {
    setEditingItem(null);
    form.reset({
      date: new Date().toISOString().split("T")[0],
      department: ClosedItemDepartment.Both,
      description: "",
      assignedTo: "",
      closedDate: null,
      meetingDate: null,
      notes: null,
    });
    setIsFormOpen(true);
  };

  const openEdit = (item: ClosedItem) => {
    setEditingItem(item);
    form.reset({
      date: item.date,
      department: item.department as ClosedItemDepartment,
      description: item.description,
      assignedTo: item.assignedTo,
      closedDate: item.closedDate ?? null,
      meetingDate: item.meetingDate ?? null,
      notes: item.notes ?? null,
    });
    setIsFormOpen(true);
  };

  const onSubmit = (values: FormValues) => {
    const payload = {
      ...values,
      closedDate: values.closedDate || null,
      meetingDate: values.meetingDate || null,
      notes: values.notes || null,
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <CheckCheck className="w-5 h-5 text-primary" />
            Closed Items Log
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Items resolved and closed — imported from meeting minutes
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} size="sm" className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Add Closed Item
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search descriptions..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            <SelectItem value="Warehouse">Warehouse</SelectItem>
            <SelectItem value="Production">Production</SelectItem>
            <SelectItem value="Both">Both</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Code</TableHead>
              <TableHead className="w-24">Date</TableHead>
              <TableHead className="w-28">Department</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-48">Notes</TableHead>
              <TableHead className="w-32">Assigned To</TableHead>
              <TableHead className="w-28">Closed Date</TableHead>
              <TableHead className="hidden w-28">Meeting Date</TableHead>
              <TableHead className="w-24">Status</TableHead>
              {(isAdmin || isWorkerRep) && <TableHead className="w-24 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: (isAdmin || isWorkerRep) ? 10 : 9 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : items && items.length > 0 ? (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{item.itemCode}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {format(new Date(item.date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell><DeptBadge dept={item.department} /></TableCell>
                  <TableCell className="text-sm max-w-xs">
                    <TruncatedText text={item.description} lines={2} label="Description" />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[12rem]">
                    {item.notes ? (
                      <TruncatedText text={item.notes} lines={2} label="Notes" className="text-muted-foreground" />
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{item.assignedTo}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {item.closedDate ? format(new Date(item.closedDate), "MMM d, yyyy") : <span className="text-muted-foreground/60">—</span>}
                  </TableCell>
                  <TableCell className="hidden text-sm whitespace-nowrap text-muted-foreground">
                    {item.meetingDate ?? <span className="text-muted-foreground/60">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <StatusBadge status="Closed" />
                      {(item as any).verifiedAt && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          ✓ {(item as any).verifiedBy} · {format(new Date((item as any).verifiedAt), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  {(isAdmin || isWorkerRep) && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!(item as any).verifiedAt && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2 text-teal-700 border-teal-300 hover:bg-teal-50"
                            onClick={() => verifyMutation.mutate({ id: item.id })}
                            disabled={verifyMutation.isPending}
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
                              onClick={() => openEdit(item)}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeletingItem(item)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={(isAdmin || isWorkerRep) ? 10 : 9} className="h-32 text-center text-muted-foreground">
                  No closed items found.{" "}
                  {deptFilter !== "all" || searchText
                    ? "Try clearing the filters."
                    : "Import minutes with a Closed Items sheet to populate this log."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) { setIsFormOpen(false); setEditingItem(null); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Closed Item" : "Add Closed Item"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Warehouse">Warehouse</SelectItem>
                          <SelectItem value="Production">Production</SelectItem>
                          <SelectItem value="Both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned To</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="closedDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Closed Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="meetingDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meeting Date / Ref</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Jan 2025" {...field} value={field.value ?? ""} />
                      </FormControl>
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
                    <FormControl>
                      <Textarea {...field} value={field.value ?? ""} rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : editingItem ? "Save Changes" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Closed Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-medium">{deletingItem?.itemCode}</span> from the log. This cannot be undone.
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
