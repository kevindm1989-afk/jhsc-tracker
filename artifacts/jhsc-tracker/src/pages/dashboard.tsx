import { useGetDashboardSummary, useGetDashboardOverdue, useGetDashboardClosedThisPeriod } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, ListChecks, CheckCircle2, MessageSquareWarning, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, isValid } from "date-fns";
import { TruncatedText } from "@/components/ui/truncated-text";
import { useLocation } from "wouter";

function safeFmt(dateStr: string | null | undefined, fmt: string, fallback = "—"): string {
  if (!dateStr) return fallback;
  const isoCandidate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? parseISO(dateStr)
    : new Date(dateStr);
  return isValid(isoCandidate) ? format(isoCandidate, fmt) : dateStr;
}

export default function DashboardPage() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: overdueItems, isLoading: isLoadingOverdue } = useGetDashboardOverdue();
  const { data: closedPeriod, isLoading: isLoadingClosed } = useGetDashboardClosedThisPeriod();
  const [, navigate] = useLocation();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Facility safety overview and compliance tracking.</p>
      </div>

      {/* Summary Cards — clickable */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard 
          title="Overdue Items" 
          value={summary?.overdueCount} 
          icon={AlertTriangle} 
          isLoading={isLoadingSummary}
          valueClass={summary?.overdueCount && summary.overdueCount > 0 ? "text-destructive" : ""}
        />
        <StatCard 
          title="Open Actions" 
          value={summary?.openActionItems} 
          icon={ListChecks} 
          isLoading={isLoadingSummary}
          onClick={() => navigate("/action-items")}
        />
        <StatCard 
          title="Recommendations" 
          value={summary?.openHazardFindings} 
          icon={Clock} 
          isLoading={isLoadingSummary}
          onClick={() => navigate("/hazard-findings")}
        />
        <StatCard 
          title="Worker Statements" 
          value={summary?.totalWorkerStatements} 
          icon={MessageSquareWarning} 
          isLoading={isLoadingSummary}
          onClick={() => navigate("/worker-statements")}
        />
        <StatCard
          title="H&S Reports"
          value={(summary as any)?.totalHSReports}
          icon={ShieldAlert}
          isLoading={isLoadingSummary}
          onClick={() => navigate("/hs-reports-log")}
        />
        <StatCard 
          title="Closed This Period" 
          value={summary?.closedThisMonth} 
          icon={CheckCircle2} 
          isLoading={isLoadingSummary}
          valueClass="text-green-600"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Overdue Items Panel */}
        <Card className="border-destructive/20 shadow-sm">
          <CardHeader className="bg-destructive/5 pb-4 border-b border-destructive/10">
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Urgent & Overdue
            </CardTitle>
            <CardDescription>Items requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingOverdue ? (
              <div className="p-4 space-y-4">
                {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : overdueItems?.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No overdue items.
              </div>
            ) : (
              <div className="divide-y">
                {overdueItems?.map((item) => (
                  <div key={item.itemCode} className="p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="font-mono bg-destructive/10 text-destructive border-destructive/20 rounded-sm">
                            {item.itemCode}
                          </Badge>
                          {item.priority && (
                            <Badge variant={item.priority === 'High' ? 'destructive' : 'secondary'} className="text-[10px] uppercase rounded-sm">
                              {item.priority}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium leading-snug">{item.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-destructive flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />
                          {item.dueDate ? safeFmt(item.dueDate, 'MMM d, yyyy', 'No due date') : "No due date"}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mt-1">
                          {item.module.replace('-', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Closed / Completed Items (This Period) Panel */}
        <Card className="border-green-500/20 shadow-sm">
          <CardHeader className="bg-green-500/5 pb-4 border-b border-green-500/10">
            <CardTitle className="text-lg flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5" />
              Completed / Closed Items (This Period)
            </CardTitle>
            <CardDescription>
              {closedPeriod?.meetingDate
                ? `From minutes dated ${safeFmt(closedPeriod.meetingDate, 'MMMM d, yyyy')}`
                : "Items closed in the most recent minutes import"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingClosed ? (
              <div className="p-4 space-y-4">
                {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !closedPeriod?.items?.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No closed items found. Import minutes to populate this section.
              </div>
            ) : (
              <div className="divide-y">
                {closedPeriod.items.map((item) => (
                  <div key={item.itemCode} className="p-4 flex flex-col gap-2 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate('/closed-items-log')}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="font-mono rounded-sm text-xs border-green-500/30 text-green-700 bg-green-500/10">
                            {item.itemCode}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] uppercase rounded-sm font-semibold tracking-wider">
                            {item.department}
                          </Badge>
                        </div>
                        <TruncatedText text={item.description} lines={2} label="Description" className="text-sm font-medium leading-snug text-foreground/80" />
                        {item.assignedTo && (
                          <p className="text-xs text-muted-foreground mt-1">Assigned to: {item.assignedTo}</p>
                        )}
                      </div>
                      {item.closedDate && (
                        <div className="text-right shrink-0">
                          <span className="text-xs text-green-700 block font-mono">
                            {item.closedDate ? safeFmt(item.closedDate, 'MMM d') : ''}
                          </span>
                          <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider block mt-1">
                            closed
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  isLoading,
  valueClass = "",
  onClick,
}: { 
  title: string; 
  value?: number; 
  icon: any; 
  isLoading: boolean;
  valueClass?: string;
  onClick?: () => void;
}) {
  return (
    <Card className={`shadow-sm border-border/60 transition-all ${onClick ? "cursor-pointer hover:border-primary/40 hover:shadow-md" : ""}`} onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="w-4 h-4 text-muted-foreground/50" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className={`text-3xl font-bold font-mono ${valueClass}`}>{value || 0}</div>
        )}
      </CardContent>
    </Card>
  );
}
