import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";

const LoginPage = lazy(() => import("@/pages/login"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const ActionItemsPage = lazy(() => import("@/pages/action-items"));
const HazardFindingsPage = lazy(() => import("@/pages/hazard-findings"));
const InspectionLogPage = lazy(() => import("@/pages/inspection-log"));
const WorkerStatementsPage = lazy(() => import("@/pages/worker-statements"));
const ImportMinutesPage = lazy(() => import("@/pages/import-minutes"));
const ConductInspectionPage = lazy(() => import("@/pages/conduct-inspection"));
const ManageUsersPage = lazy(() => import("@/pages/manage-users"));
const ClosedItemsLogPage = lazy(() => import("@/pages/closed-items-log"));
const MemberActionsPage = lazy(() => import("@/pages/member-actions"));
const HealthSafetyReportPage = lazy(() => import("@/pages/health-safety-report"));
const HSReportsLogPage = lazy(() => import("@/pages/hs-reports-log"));
const SuggestionsPage = lazy(() => import("@/pages/suggestions"));
const SuggestionsLogPage = lazy(() => import("@/pages/suggestions-log"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const ChangePasswordPage = lazy(() => import("@/pages/change-password"));
const RightToRefusePage = lazy(() => import("@/pages/right-to-refuse"));
const FilesPage = lazy(() => import("@/pages/files"));
const MeetingTranscriptionPage = lazy(() => import("@/pages/meeting-transcription"));
const AIAssistantPage = lazy(() => import("@/pages/ai-assistant"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
      Loading...
    </div>
  );
}

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
    return <PageLoader />;
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
    <Suspense fallback={<PageLoader />}>
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
              <Suspense fallback={<PageLoader />}>
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
                  <Route path="/suggestions-log">
                    <ProtectedRoute component={SuggestionsLogPage} permission="suggestions" />
                  </Route>
                  <Route path="/right-to-refuse">
                    <ProtectedRoute component={RightToRefusePage} />
                  </Route>
                  <Route path="/files">
                    <ProtectedRoute component={FilesPage} permission="files" />
                  </Route>
                  <Route path="/manage-users">
                    <ProtectedRoute component={ManageUsersPage} />
                  </Route>
                  <Route path="/meeting-transcription">
                    <ProtectedRoute component={MeetingTranscriptionPage} />
                  </Route>
                  <Route path="/ai-assistant">
                    <ProtectedRoute component={AIAssistantPage} />
                  </Route>
                  <Route path="/change-password">
                    <ProtectedRoute component={ChangePasswordPage} />
                  </Route>
                  <Route component={NotFound} />
                </Switch>
              </Suspense>
            </AppLayout>
          )}
        </Route>
      </Switch>
    </Suspense>
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
