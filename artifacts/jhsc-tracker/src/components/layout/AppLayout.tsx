import { ReactNode } from "react";
import Sidebar from "./Sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background w-full">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card flex items-center px-6 sticky top-0 z-10">
          <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
            {new Date().toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </h2>
        </header>
        <div className="p-6 md:p-8 flex-1 overflow-x-hidden max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
