import { Link, useLocation } from "wouter";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { LayoutDashboard, AlertTriangle, ListChecks, Search, MessageSquareWarning, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const [location] = useLocation();
  const { data: summary } = useGetDashboardSummary();

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Action Items", href: "/action-items", icon: ListChecks, badge: summary?.openActionItems },
    { name: "Hazard Findings", href: "/hazard-findings", icon: AlertTriangle, badge: summary?.openHazardFindings },
    { name: "Inspection Log", href: "/inspection-log", icon: Search },
    { name: "Worker Statements", href: "/worker-statements", icon: MessageSquareWarning, badge: summary?.totalWorkerStatements },
    { name: "Import Data", href: "/import-minutes", icon: Upload },
  ];

  return (
    <div className="flex flex-col w-64 h-full min-h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border shrink-0">
      <div className="p-4 md:p-6 flex flex-col gap-1 border-b border-sidebar-border">
        <h1 className="font-bold text-lg text-sidebar-foreground uppercase tracking-wider leading-tight">
          JHSC Co-Chair Tracker
        </h1>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-primary flex-shrink-0" />
          <span className="text-sm font-semibold text-sidebar-foreground/90">Unifor Local 1285</span>
        </div>
        <p className="text-xs text-sidebar-foreground/70 mt-1 font-medium">Saputo Georgetown</p>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href} onClick={onNavigate}>
              <div
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-md transition-colors cursor-pointer group text-sm font-medium",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon
                    className={cn(
                      "w-4 h-4",
                      isActive
                        ? "text-primary"
                        : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground/80"
                    )}
                  />
                  {item.name}
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full min-w-6 text-center">
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border text-xs text-sidebar-foreground/60 space-y-1">
        <p className="font-mono text-[10px] uppercase opacity-70">OHSA s.9 | O. Reg. 297/13</p>
        <p>System Online</p>
      </div>
    </div>
  );
}
