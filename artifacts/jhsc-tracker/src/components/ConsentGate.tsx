import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Shows a blocking modal whenever the signed-in user has not yet accepted
 * the current privacy policy version. Required for PIPEDA-compliant
 * meaningful consent — the user must affirmatively agree before continuing.
 */
export default function ConsentGate() {
  const { user, refreshUser, logout } = useAuth();
  const { toast } = useToast();
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  const needsConsent =
    !user.consentAcceptedAt ||
    user.consentVersion !== user.currentPolicyVersion;

  if (!needsConsent) return null;

  const isUpdate = !!user.consentAcceptedAt && user.consentVersion !== user.currentPolicyVersion;

  async function handleAccept() {
    if (!accepted) return;
    setSubmitting(true);
    try {
      const resp = await fetch(`${BASE}/api/account/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accept: true }),
      });
      if (!resp.ok) throw new Error("Failed to record consent");
      await refreshUser();
      toast({ title: "Thank you", description: "Your acceptance has been recorded." });
    } catch (err: any) {
      toast({
        title: "Could not record consent",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open onOpenChange={() => {}}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {isUpdate ? "Updated Privacy Policy" : "Privacy Notice & Consent"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                Before continuing, please review and accept the Privacy Policy
                for <strong>JHSC Advisor</strong>.
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>This app is operated <strong>independently</strong> by the Worker Co-Chair of the Joint Health &amp; Safety Committee.</li>
                <li>It is <strong>not</strong> affiliated with, endorsed by, or operated by any employer or union.</li>
                <li>Use of this app is <strong>voluntary</strong>. You will not be disciplined for choosing not to use it.</li>
                <li>Your data is used only to support the JHSC's statutory functions under the Occupational Health and Safety Act.</li>
                <li>You can withdraw consent at any time by deleting your account from the Change Password page.</li>
              </ul>
              <p>
                <a
                  href="/privacy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Read the full Privacy Policy →
                </a>
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label className="flex items-start gap-2 mt-2 cursor-pointer">
          <Checkbox
            id="consent-accept"
            checked={accepted}
            onCheckedChange={(v) => setAccepted(v === true)}
            disabled={submitting}
            className="mt-0.5"
          />
          <span className="text-sm">
            I have read and I voluntarily accept the Privacy Policy. I
            understand this app is operated independently of my employer.
          </span>
        </label>

        <AlertDialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => logout()}
            disabled={submitting}
          >
            Decline &amp; sign out
          </Button>
          <Button
            type="button"
            onClick={handleAccept}
            disabled={!accepted || submitting}
          >
            {submitting ? "Saving…" : "Accept & Continue"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
