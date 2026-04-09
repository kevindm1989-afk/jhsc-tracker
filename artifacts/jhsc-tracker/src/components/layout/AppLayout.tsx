import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "./Sidebar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const WARN_BEFORE_MS = 2 * 60 * 1000;

export default function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const { user, logout } = useAuth();

  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();
    setShowWarning(false);
    warnTimerRef.current = setTimeout(() => {
      setShowWarning(true);
    }, IDLE_TIMEOUT_MS - WARN_BEFORE_MS);
    logoutTimerRef.current = setTimeout(() => {
      logout();
    }, IDLE_TIMEOUT_MS);
  }, [clearTimers, logout]);

  useEffect(() => {
    if (!user) return;

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];

    const handleActivity = () => resetTimers();

    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    resetTimers();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      clearTimers();
    };
  }, [user, resetTimers, clearTimers]);

  return (
    <div className="flex min-h-screen bg-background w-full">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 border-0 h-full">
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="h-14 border-b bg-card flex items-center px-4 sticky top-0 z-10 gap-3">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* Mobile logo (visible only on mobile) */}
          <div className="md:hidden flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground leading-tight truncate">JHSC Co-Chair Tracker</p>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">JHSC Tracker</p>
          </div>

          {/* Desktop date */}
          <h2 className="hidden md:block text-sm font-mono text-muted-foreground uppercase tracking-widest">
            {new Date().toLocaleDateString("en-CA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </h2>

          {/* Mobile date (compact) */}
          <p className="md:hidden ml-auto text-xs text-muted-foreground font-mono shrink-0">
            {new Date().toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </header>

        <div className="p-4 md:p-6 lg:p-8 flex-1 overflow-x-hidden max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>

      <AlertDialog open={showWarning} onOpenChange={() => {}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Still there?</AlertDialogTitle>
            <AlertDialogDescription>
              You've been inactive for 13 minutes. You'll be signed out automatically in 2 minutes to keep your account secure.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={resetTimers}>Stay signed in</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
