import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: string, className?: string }) {
  let colorClass = "bg-secondary text-secondary-foreground";
  
  switch(status) {
    case 'Open':
    case 'Received':
      colorClass = "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
      break;
    case 'In Progress':
    case 'Awaiting Response':
    case 'Under Review':
    case 'Actioned':
      colorClass = "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
      break;
    case 'Overdue':
    case 'Disputed':
      colorClass = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
      break;
    case 'Pending':
      colorClass = "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
      break;
    case 'Closed':
      colorClass = "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";
      break;
    case 'Closed & Verified':
    case 'Verified':
      colorClass = "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800";
      break;
  }

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border", colorClass, className)}>
      {status}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: string, className?: string }) {
  let colorClass = "bg-secondary text-secondary-foreground";
  
  switch(priority) {
    case 'High':
      colorClass = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
      break;
    case 'Medium':
      colorClass = "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
      break;
    case 'Low':
      colorClass = "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";
      break;
  }

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", colorClass, className)}>
      {priority}
    </span>
  );
}

export function DeptBadge({ dept, className }: { dept: string, className?: string }) {
  let colorClass = "bg-secondary text-secondary-foreground";
  let label = dept;
  
  switch(dept) {
    case 'Warehouse':
      colorClass = "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800";
      label = "WH";
      break;
    case 'Production':
      colorClass = "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800";
      label = "PROD";
      break;
    case 'Both':
      colorClass = "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800";
      label = "BOTH";
      break;
  }

  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider border", colorClass, className)}>
      {label}
    </span>
  );
}
