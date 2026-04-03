import { Link, useLocation } from "wouter";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import {
  LayoutDashboard,
  AlertTriangle,
  ListChecks,
  Search,
  MessageSquareWarning,
  Upload,
  ClipboardCheck,
  Users,
  LogOut,
  ShieldCheck,
  User,
  FolderOpen,
  CheckCheck,
  ClipboardList,
  ShieldAlert,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const [location] = useLocation();
  const { data: summary } = useGetDashboardSummary();
  const { user, logout, hasPermission } = useAuth();

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, permission: "dashboard" },
    { name: "Action Items", href: "/action-items", icon: ListChecks, permission: "action-items", badge: summary?.openActionItems },
    { name: "Closed Items Log", href: "/closed-items-log", icon: CheckCheck, permission: "action-items" },
    { name: "Member Actions", href: "/member-actions", icon: ClipboardList, permission: "member-actions" },
    { name: "Conduct A H&S Report", href: "/health-safety-report", icon: ShieldAlert, permission: "health-safety-report" },
    { name: "H&S Reports Log", href: "/hs-reports-log", icon: ScrollText, permission: "hs-reports-log" },
    { name: "Hazard Findings", href: "/hazard-findings", icon: AlertTriangle, permission: "hazard-findings", badge: summary?.openHazardFindings },
    { name: "Inspection Log", href: "/inspection-log", icon: Search, permission: "inspection-log" },
    { name: "Conduct Inspection", href: "/conduct-inspection", icon: ClipboardCheck, permission: "conduct-inspection" },
    { name: "Worker Statements", href: "/worker-statements", icon: MessageSquareWarning, permission: "worker-statements", badge: summary?.totalWorkerStatements },
    { name: "Import Data", href: "/import-minutes", icon: Upload, permission: "import-data" },
    { name: "Documents", href: "/documents", icon: FolderOpen, permission: "documents" },
  ].filter((item) => item.permission === null || hasPermission(item.permission));

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <div className="flex flex-col w-64 h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border shrink-0">
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
          const active = isActive(item.href);
          return (
            <Link key={item.name} href={item.href} onClick={onNavigate}>
              <div
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-md transition-colors cursor-pointer group text-sm font-medium",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon
                    className={cn(
                      "w-4 h-4",
                      active
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

        {/* Admin: Manage Users */}
        {user?.role === "admin" && (
          <>
            <div className="pt-2 pb-1 px-3">
              <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-semibold">
                Admin
              </p>
            </div>
            <Link href="/manage-users" onClick={onNavigate}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer group text-sm font-medium",
                  isActive("/manage-users")
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Users
                  className={cn(
                    "w-4 h-4",
                    isActive("/manage-users")
                      ? "text-primary"
                      : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground/80"
                  )}
                />
                Manage Users
              </div>
            </Link>
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-md bg-sidebar-accent/30 mb-2">
          <div className="w-7 h-7 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
            {user?.role === "admin" ? (
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            ) : (
              <User className="w-3.5 h-3.5 text-sidebar-foreground/70" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.displayName}</p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate font-mono">
              {user?.role === "admin" ? "Admin" : "Member"} · @{user?.username}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 text-xs h-8"
          onClick={() => logout()}
        >
          <LogOut className="w-3.5 h-3.5 mr-2" />
          Sign Out
        </Button>
        <p className="mt-2 text-[10px] text-sidebar-foreground/40 font-mono uppercase tracking-wider px-1">
          OHSA s.9 | O. Reg. 297/13
        </p>
      </div>
    </div>
  );
}
