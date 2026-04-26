import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, ShieldAlert, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface HeaderResult {
  header: string;
  value: string | null;
  status: "PASS" | "FAIL";
  description: string;
}

interface SecurityReport {
  score: { passed: number; total: number };
  results: HeaderResult[];
  checkedAt: string;
}

export default function SecurityHealthPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/health/security`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data: SecurityReport = await res.json();
      setReport(data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to run security check");
      toast({ title: "Check failed", description: err?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  if (user?.role !== "admin") {
    return (
      <div className="p-8 text-center text-muted-foreground">
        This page is restricted to administrators.
      </div>
    );
  }

  const allPass = report && report.score.passed === report.score.total;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-[#1a2744]" />
          <div>
            <h1 className="text-2xl font-bold text-[#1a2744]">Security Headers</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Verifies that all required HTTP security headers are present and correctly configured.
            </p>
          </div>
        </div>
        <Button
          onClick={runCheck}
          disabled={loading}
          variant="outline"
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Checking…" : "Run Check"}
        </Button>
      </div>

      {/* Score banner */}
      {report && (
        <div
          className={`rounded-lg px-5 py-4 flex items-center gap-4 ${
            allPass
              ? "bg-green-50 border border-green-200"
              : "bg-amber-50 border border-amber-200"
          }`}
        >
          {allPass ? (
            <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
          ) : (
            <ShieldAlert className="h-8 w-8 text-amber-600 shrink-0" />
          )}
          <div>
            <p className={`text-lg font-semibold ${allPass ? "text-green-800" : "text-amber-800"}`}>
              {report.score.passed}/{report.score.total} headers passing
            </p>
            <p className={`text-sm ${allPass ? "text-green-700" : "text-amber-700"}`}>
              {allPass
                ? "All security headers are present and correctly configured."
                : `${report.score.total - report.score.passed} header${report.score.total - report.score.passed !== 1 ? "s" : ""} need attention.`}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-muted-foreground">Checked at</p>
            <p className="text-xs font-medium">
              {new Date(report.checkedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !report && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !report && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Header cards */}
      {report && (
        <div className="space-y-3">
          {report.results.map((result) => (
            <Card
              key={result.header}
              className={`border ${
                result.status === "PASS"
                  ? "border-green-200 bg-green-50/50"
                  : "border-red-200 bg-red-50/50"
              }`}
            >
              <CardHeader className="pb-2 pt-4 px-5">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold font-mono text-[#1a2744]">
                    {result.header}
                  </CardTitle>
                  <Badge
                    className={
                      result.status === "PASS"
                        ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-100"
                        : "bg-red-100 text-red-800 border-red-300 hover:bg-red-100"
                    }
                    variant="outline"
                  >
                    {result.status === "PASS" ? (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    ) : (
                      <XCircle className="h-3 w-3 mr-1" />
                    )}
                    {result.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-1.5">
                <p className="text-xs text-muted-foreground">{result.description}</p>
                {result.value ? (
                  <p className="text-xs font-mono bg-white/80 border rounded px-2 py-1 break-all text-gray-700">
                    {result.value}
                  </p>
                ) : (
                  <p className="text-xs italic text-red-600">Header not present in response</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
