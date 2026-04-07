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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit2, Trash2, CalendarIcon, ShieldAlert, Eye, EyeOff } from "lucide-react";
import { StatusBadge, PriorityBadge, DeptBadge } from "@/components/ui/status-badges";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const ZONES = ["Zone 1 — Receiving", "Zone 2 — Cold Storage", "Zone 3 — Production", "Zone 4 — Packaging", "Zone 5 — Shipping", "Zone 6 — Maintenance", "Zone 7 — Office/Admin"];

const RISK_LEVELS = [1, 2, 3, 4, 5];

function riskColor(score: number | null | undefined) {
  if (!score) return "bg-gray-100 text-gray-700";
  if (score >= 20) return "bg-red-600 text-white";
  if (score >= 12) return "bg-orange-500 text-white";
  if (score >= 6) return "bg-yellow-400 text-gray-900";
  return "bg-green-100 text-green-800";
}

function riskLabel(score: number | null | undefined) {
  if (!score) return "—";
  if (score >= 20) return `${score} Critical`;
  if (score >= 12) return `${score} High`;
  if (score >= 6) return `${score} Medium`;
  return `${score} Low`;
}

const formSchema = z.object({
  date: z.string().min(1, "Date is required"),
  department: z.nativeEnum(HazardFindingDepartment),
  zone: z.string().optional().nullable(),
  hazardDescription: z.string().min(5, "Description is required"),
  ohsaReference: z.string().optional().nullable(),
  severity: z.nativeEnum(HazardFindingSeverity),
  riskLikelihood: z.coerce.number().min(1).max(5).optional().nullable(),
  riskSeverity: z.coerce.number().min(1).max(5).optional().nullable(),
  recommendationDate: z.string().min(1, "Rec date is required"),
  responseDeadline: z.string().optional().nullable(),
  status: z.nativeEnum(HazardFindingStatus),
  isAnonymous: z.boolean().optional(),
  submitterName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function HazardFindingsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HazardFinding | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isWorkerRep = user?.role === "worker-rep";
  const canEdit = isAdmin || isWorkerRep;

  const queryParams = {
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(deptFilter !== "all" && { department: deptFilter })
  };

  const { data: allItems, isLoading } = useListHazardFindings(queryParams);

  const items = allItems?.filter((item: any) =>
    zoneFilter === "all" || item.zone === zoneFilter
  );

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
      zone: "",
      hazardDescription: "",
      ohsaReference: "",
      severity: "High",
      riskLikelihood: null,
      riskSeverity: null,
      recommendationDate: new Date().toISOString().split('T')[0],
      responseDeadline: "",
      status: "Open",
      isAnonymous: false,
      submitterName: "",
      notes: "",
    }
  });

  const watchLikelihood = form.watch("riskLikelihood");
  const watchRiskSeverity = form.watch("riskSeverity");
  const watchAnonymous = form.watch("isAnonymous");
  const riskScore = watchLikelihood && watchRiskSeverity ? watchLikelihood * watchRiskSeverity : null;

  const handleEdit = (item: HazardFinding) => {
    setEditingItem(item);
    form.reset({
      date: item.date,
      department: item.department,
      zone: (item as any).zone || "",
      hazardDescription: item.hazardDescription,
      ohsaReference: item.ohsaReference || "",
      severity: item.severity,
      riskLikelihood: (item as any).riskLikelihood || null,
      riskSeverity: (item as any).riskSeverity || null,
      recommendationDate: item.recommendationDate,
      responseDeadline: item.responseDeadline || "",
      status: item.status,
      isAnonymous: (item as any).isAnonymous || false,
      submitterName: (item as any).submitterName || "",
      notes: item.notes || "",
    });
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingItem(null);
    form.reset({
      date: new Date().toISOString().split('T')[0],
      department: "Production",
      zone: "",
      hazardDescription: "",
      ohsaReference: "",
      severity: "High",
      riskLikelihood: null,
      riskSeverity: null,
      recommendationDate: new Date().toISOString().split('T')[0],
      responseDeadline: "",
      status: "Open",
      isAnonymous: false,
      submitterName: "",
      notes: "",
    });
    setIsFormOpen(true);
  };

  const onSubmit = (data: FormValues) => {
    const payload = {
      ...data,
      riskScore: data.riskLikelihood && data.riskSeverity ? data.riskLikelihood * data.riskSeverity : null,
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="w-8 h-8 text-destructive" />
            Recommendations
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Formal recommendations to the employer. Includes risk matrix scoring.</p>
        </div>
        {canEdit && (
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
          <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs font-medium">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.values(HazardFindingStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs font-medium">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {Object.values(HazardFindingDepartment).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="w-full sm:w-[200px] h-9 text-xs font-medium">
            <SelectValue placeholder="All Zones" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Zones</SelectItem>
            {ZONES.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border shadow-sm"><div className="min-w-[900px] bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50 border-b-2 border-border">
            <TableRow>
              <TableHead className="w-[90px] font-bold text-xs uppercase tracking-wider">ID</TableHead>
              <TableHead className="w-[90px] font-bold text-xs uppercase tracking-wider">Date</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">Hazard Description & OHSA Ref</TableHead>
              <TableHead className="w-[100px] font-bold text-xs uppercase tracking-wider">Risk Score</TableHead>
              <TableHead className="w-[110px] font-bold text-xs uppercase tracking-wider">Severity</TableHead>
              <TableHead className="w-[100px] font-bold text-xs uppercase tracking-wider">Deadline</TableHead>
              <TableHead className="w-[130px] font-bold text-xs uppercase tracking-wider">Status</TableHead>
              {canEdit && <TableHead className="w-[80px] text-right font-bold text-xs uppercase tracking-wider">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  {Array(canEdit ? 8 : 7).fill(0).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))
            ) : items?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 8 : 7} className="h-32 text-center text-muted-foreground">
                  No recommendations found.
                </TableCell>
              </TableRow>
            ) : (
              items?.map((item) => (
                <TableRow key={item.id} className="group transition-colors">
                  <TableCell className="font-mono text-xs font-semibold">
                    {item.itemCode}
                    {(item as any).isAnonymous && (
                      <span title="Anonymous submission"><EyeOff className="w-3 h-3 text-muted-foreground mt-0.5" /></span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {format(new Date(item.date), 'MMM dd')}
                    {(item as any).zone && <div className="text-[10px] text-muted-foreground truncate max-w-[80px]">{(item as any).zone.split(' — ')[0]}</div>}
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
                      {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(item as any).riskScore ? (
                      <span className={`text-xs font-bold px-2 py-1 rounded font-mono ${riskColor((item as any).riskScore)}`}>
                        {riskLabel((item as any).riskScore)}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
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
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (window.confirm('Delete this record?')) {
                                deleteMutation.mutate({ id: item.id });
                              }
                            }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
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

              <FormField control={form.control} name="zone" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Zone / Area (optional)</FormLabel>
                  <Select onValueChange={v => field.onChange(v === "none" ? "" : v)} value={field.value || "none"}>
                    <FormControl><SelectTrigger className="text-sm"><SelectValue placeholder="Select zone..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">No specific zone</SelectItem>
                      {ZONES.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              
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

              {/* Risk Matrix */}
              <div className="border rounded-md p-4 space-y-3 bg-muted/20">
                <p className="text-xs uppercase font-bold text-muted-foreground">Risk Matrix (Likelihood × Severity = Score)</p>
                <div className="grid grid-cols-3 gap-4 items-end">
                  <FormField control={form.control} name="riskLikelihood" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Likelihood (1-5)</FormLabel>
                      <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value ? String(field.value) : ""}>
                        <FormControl><SelectTrigger className="text-sm h-9"><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {RISK_LEVELS.map(n => <SelectItem key={n} value={String(n)}>{n} — {["Rare","Unlikely","Possible","Likely","Almost Certain"][n-1]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="riskSeverity" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Impact (1-5)</FormLabel>
                      <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value ? String(field.value) : ""}>
                        <FormControl><SelectTrigger className="text-sm h-9"><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {RISK_LEVELS.map(n => <SelectItem key={n} value={String(n)}>{n} — {["Negligible","Minor","Moderate","Major","Critical"][n-1]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Score</p>
                    <span className={`text-sm font-bold px-3 py-1.5 rounded font-mono ${riskColor(riskScore)}`}>
                      {riskScore ? riskLabel(riskScore) : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Anonymous submission */}
              <div className="border rounded-md p-4 space-y-3 bg-muted/20">
                <p className="text-xs uppercase font-bold text-muted-foreground">Submission</p>
                <FormField control={form.control} name="isAnonymous" render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div>
                      <FormLabel className="text-sm font-medium">Submit anonymously</FormLabel>
                      <p className="text-xs text-muted-foreground">Worker identity will not be recorded</p>
                    </div>
                  </FormItem>
                )} />
                {!watchAnonymous && (
                  <FormField control={form.control} name="submitterName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Submitted by (optional)</FormLabel>
                      <FormControl><Input className="text-sm h-8" placeholder="Worker name" {...field} value={field.value || ""} /></FormControl>
                    </FormItem>
                  )} />
                )}
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
