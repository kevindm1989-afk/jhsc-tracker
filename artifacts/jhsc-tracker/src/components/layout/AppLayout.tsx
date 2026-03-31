import { ReactNode, useState } from "react";
import Sidebar from "./Sidebar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background w-full">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 border-0">
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
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Unifor Local 1285</p>
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
    </div>
  );
}
