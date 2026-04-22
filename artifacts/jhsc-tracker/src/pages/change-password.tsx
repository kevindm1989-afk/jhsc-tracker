import { useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Eye, EyeOff, KeyRound, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ChangePasswordPage() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDeleteAccount() {
    setIsDeleting(true);
    try {
      const resp = await fetch(`${BASE}/api/account`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || "Failed to delete account");
      }
      toast({
        title: "Account deleted",
        description: "Your account and personal records have been removed.",
      });
      window.location.href = `${BASE}/login`;
    } catch (err: any) {
      toast({
        title: "Could not delete account",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return setError("All fields are required.");
    }
    if (newPassword.length < 6) {
      return setError("New password must be at least 6 characters.");
    }
    if (newPassword !== confirmPassword) {
      return setError("New passwords do not match.");
    }
    if (currentPassword === newPassword) {
      return setError("New password must be different from your current password.");
    }

    setIsLoading(true);
    try {
      const resp = await fetch(`${BASE}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to change password");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Change Password
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Update your login password. You will need your current password to confirm.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cp-current">Current Password</Label>
              <div className="relative">
                <Input
                  id="cp-current"
                  type={showPasswords ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Your current password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPasswords((v) => !v)}
                  tabIndex={-1}
                >
                  {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-new">New Password</Label>
              <Input
                id="cp-new"
                type={showPasswords ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-confirm">Confirm New Password</Label>
              <Input
                id="cp-confirm"
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Updating…" : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-sm mt-6 border-destructive/40">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Delete My Account
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently remove your account and the personal information linked to it.
            JHSC committee records (suggestions, reports, member actions) will be kept
            for statutory compliance but your name will be removed from them. Anonymous
            submissions are not affected.
          </p>
        </CardHeader>
        <CardContent>
          <AlertDialog
            onOpenChange={(open) => {
              if (!open) setConfirmText("");
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                Delete my account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This cannot be undone. Your login, chat messages, and push
                  notification subscriptions will be deleted. Your name will be
                  removed from any suggestions, safety reports, and member
                  actions you submitted, but the records themselves will be
                  retained for OHSA compliance.
                  <br /><br />
                  Type <strong>DELETE</strong> below to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                autoComplete="off"
              />
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={confirmText !== "DELETE" || isDeleting}
                  onClick={(e) => {
                    e.preventDefault();
                    handleDeleteAccount();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? "Deleting…" : "Permanently delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
