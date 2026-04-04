import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import ActionItemsPage from "@/pages/action-items";
import HazardFindingsPage from "@/pages/hazard-findings";
import InspectionLogPage from "@/pages/inspection-log";
import WorkerStatementsPage from "@/pages/worker-statements";
import ImportMinutesPage from "@/pages/import-minutes";
import ConductInspectionPage from "@/pages/conduct-inspection";
import ManageUsersPage from "@/pages/manage-users";
import DocumentsPage from "@/pages/documents";
import ClosedItemsLogPage from "@/pages/closed-items-log";
import MemberActionsPage from "@/pages/member-actions";
import HealthSafetyReportPage from "@/pages/health-safety-report";
import HSReportsLogPage from "@/pages/hs-reports-log";
import SuggestionsPage from "@/pages/suggestions";
import ResetPasswordPage from "@/pages/reset-password";
import ChangePasswordPage from "@/pages/change-password";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function ProtectedRoute({
  component: Component,
  permission,
}: {
  component: React.ComponentType;
  permission?: string;
}) {
  const { user, isLoading, hasPermission } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <p className="text-lg font-semibold text-foreground">Access Restricted</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          You don't have permission to view this page. Contact your Co-Chair admin to request access.
        </p>
      </div>
    );
  }

  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login">
        {user ? <Redirect to="/" /> : <LoginPage />}
      </Route>

      <Route path="/reset-password">
        <ResetPasswordPage />
      </Route>

      <Route>
        {!user ? (
          <Redirect to="/login" />
        ) : (
          <AppLayout>
            <Switch>
              <Route path="/">
                <ProtectedRoute component={DashboardPage} permission="dashboard" />
              </Route>
              <Route path="/action-items">
                <ProtectedRoute component={ActionItemsPage} permission="action-items" />
              </Route>
              <Route path="/hazard-findings">
                <ProtectedRoute component={HazardFindingsPage} permission="hazard-findings" />
              </Route>
              <Route path="/inspection-log">
                <ProtectedRoute component={InspectionLogPage} permission="inspection-log" />
              </Route>
              <Route path="/conduct-inspection">
                <ProtectedRoute component={ConductInspectionPage} permission="conduct-inspection" />
              </Route>
              <Route path="/worker-statements">
                <ProtectedRoute component={WorkerStatementsPage} permission="worker-statements" />
              </Route>
              <Route path="/import-minutes">
                <ProtectedRoute component={ImportMinutesPage} permission="import-data" />
              </Route>
              <Route path="/documents">
                <ProtectedRoute component={DocumentsPage} permission="documents" />
              </Route>
              <Route path="/closed-items-log">
                <ProtectedRoute component={ClosedItemsLogPage} permission="action-items" />
              </Route>
              <Route path="/member-actions">
                <ProtectedRoute component={MemberActionsPage} permission="member-actions" />
              </Route>
              <Route path="/health-safety-report">
                <ProtectedRoute component={HealthSafetyReportPage} permission="health-safety-report" />
              </Route>
              <Route path="/hs-reports-log">
                <ProtectedRoute component={HSReportsLogPage} permission="hs-reports-log" />
              </Route>
              <Route path="/suggestions">
                <ProtectedRoute component={SuggestionsPage} permission="suggestions" />
              </Route>
              <Route path="/manage-users">
                <ProtectedRoute component={ManageUsersPage} />
              </Route>
              <Route path="/change-password">
                <ProtectedRoute component={ChangePasswordPage} />
              </Route>
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
