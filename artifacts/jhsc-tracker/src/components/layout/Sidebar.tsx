import { useState } from "react";
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
  CheckCheck,
  ClipboardList,
  ShieldAlert,
  ScrollText,
  Lightbulb,
  KeyRound,
  GripVertical,
  ArrowUpDown,
  ShieldX,
  Folder,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavOrder, DEFAULT_NAV_ORDER } from "@/hooks/use-nav-order";
import { NAV_CONFIGS } from "@/lib/nav-config";

interface SidebarProps {
  onNavigate?: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  permission: string | null;
  badge?: number;
  adminOnly?: boolean;
  workerRepOnly?: boolean;
}

const ICON_MAP: Record<string, React.ElementType> = {
  "/": LayoutDashboard,
  "/action-items": ListChecks,
  "/closed-items-log": CheckCheck,
  "/member-actions": ClipboardList,
  "/health-safety-report": ShieldAlert,
  "/hs-reports-log": ScrollText,
  "/hazard-findings": AlertTriangle,
  "/inspection-log": Search,
  "/conduct-inspection": ClipboardCheck,
  "/worker-statements": MessageSquareWarning,
  "/suggestions": Lightbulb,
  "/suggestions-log": ScrollText,
  "/right-to-refuse": ShieldX,
  "/files": Folder,
  "/import-minutes": Upload,
  "/manage-users": Users,
};

const ALL_NAV_ITEMS: NavItem[] = NAV_CONFIGS.map((c) => ({
  ...c,
  icon: ICON_MAP[c.href] ?? LayoutDashboard,
}));

// ─── Sortable nav item ────────────────────────────────────────────────────────

interface SortableNavItemProps {
  item: NavItem;
  isActive: boolean;
  badge?: number;
  reorderMode: boolean;
  onNavigate?: () => void;
}

function SortableNavItem({ item, isActive, badge, reorderMode, onNavigate }: SortableNavItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.href,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2.5 rounded-md transition-colors text-sm font-medium group",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          reorderMode && "cursor-default select-none"
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {reorderMode ? (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-sidebar-foreground/40 hover:text-sidebar-foreground/70 shrink-0 touch-none"
              tabIndex={-1}
            >
              <GripVertical className="w-4 h-4" />
            </button>
          ) : (
            <item.icon
              className={cn(
                "w-4 h-4 shrink-0",
                isActive ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground/80"
              )}
            />
          )}
          {reorderMode ? (
            <span className="truncate">{item.name}</span>
          ) : (
            <Link href={item.href} onClick={onNavigate} className="flex-1 min-w-0">
              <span className="truncate block">{item.name}</span>
            </Link>
          )}
        </div>
        {!reorderMode && badge !== undefined && badge > 0 && (
          <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full min-w-6 text-center shrink-0">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export default function Sidebar({ onNavigate }: SidebarProps) {
  const [location] = useLocation();
  const { data: summary } = useGetDashboardSummary();
  const { user, logout, hasPermission } = useAuth();
  const { order, saveOrder } = useNavOrder();
  const [reorderMode, setReorderMode] = useState(false);

  const isAdmin = user?.role === "admin";
  const isCoChair = user?.role === "co-chair";
  const isWorkerRep = user?.role === "worker-rep";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Build badge map
  const badges: Record<string, number | undefined> = {
    "/action-items": summary?.openActionItems,
    "/hazard-findings": summary?.openHazardFindings,
    "/worker-statements": summary?.totalWorkerStatements,
  };

  // Sort items by stored order, filter by permission
  const sortedItems = [...order, ...DEFAULT_NAV_ORDER.filter((h) => !order.includes(h))]
    .map((href) => ALL_NAV_ITEMS.find((item) => item.href === href))
    .filter((item): item is NavItem => {
      if (!item) return false;
      if (item.adminOnly && !isAdmin) return false;
      if (item.workerRepOnly && !isAdmin && !isCoChair && !isWorkerRep) return false;
      if (item.permission === null) return true;
      return hasPermission(item.permission);
    });

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Operate on the full visible list (handles pages added after the stored order was saved)
    const visibleHrefs = sortedItems.map((i) => i.href);
    const oldIndex = visibleHrefs.indexOf(active.id as string);
    const newIndex = visibleHrefs.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(visibleHrefs, oldIndex, newIndex);
    // Merge: reordered visible pages first, then any stored pages not currently visible
    const newOrder = [...reordered, ...order.filter((h) => !reordered.includes(h))];
    saveOrder(newOrder);
  }

  return (
    <div className="flex flex-col w-64 h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border shrink-0">
      <div className="p-4 md:p-6 flex flex-col gap-1 border-b border-sidebar-border">
        <h1 className="font-bold text-lg text-sidebar-foreground uppercase tracking-wider leading-tight">
          JHSC Co-Chair Tracker
        </h1>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-primary flex-shrink-0" />
          <span className="text-sm font-semibold text-sidebar-foreground/90">Joint Health &amp; Safety Committee</span>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {isAdmin && (
          <div className="pb-2">
            <button
              onClick={() => setReorderMode((v) => !v)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                reorderMode
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/30"
              )}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {reorderMode ? "Done Reordering" : "Reorder Pages"}
            </button>
          </div>
        )}

        {reorderMode ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortedItems.map((i) => i.href)} strategy={verticalListSortingStrategy}>
              {sortedItems.map((item) => (
                <SortableNavItem
                  key={item.href}
                  item={item}
                  isActive={isActive(item.href)}
                  badge={badges[item.href]}
                  reorderMode={reorderMode}
                  onNavigate={onNavigate}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          sortedItems.map((item) => (
            <SortableNavItem
              key={item.href}
              item={item}
              isActive={isActive(item.href)}
              badge={badges[item.href]}
              reorderMode={false}
              onNavigate={onNavigate}
            />
          ))
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
              {user?.role === "admin" ? "Admin" : user?.role === "worker-rep" ? "Worker Rep" : "Member"} · @{user?.username}
            </p>
          </div>
        </div>
        <Link href="/change-password" onClick={onNavigate}>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 text-xs h-8"
          >
            <KeyRound className="w-3.5 h-3.5 mr-2" />
            Change Password
          </Button>
        </Link>
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
