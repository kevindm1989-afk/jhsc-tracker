import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import AppLayout from "@/components/layout/AppLayout";
import DashboardPage from "@/pages/dashboard";
import ActionItemsPage from "@/pages/action-items";
import HazardFindingsPage from "@/pages/hazard-findings";
import InspectionLogPage from "@/pages/inspection-log";
import WorkerStatementsPage from "@/pages/worker-statements";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/action-items" component={ActionItemsPage} />
        <Route path="/hazard-findings" component={HazardFindingsPage} />
        <Route path="/inspection-log" component={InspectionLogPage} />
        <Route path="/worker-statements" component={WorkerStatementsPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
