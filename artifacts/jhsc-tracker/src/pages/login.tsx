import { useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Eye, EyeOff, UserPlus, CheckCircle2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const DEPARTMENTS = ["Warehouse", "Production", "Both", "Other"];
const SHIFTS = ["Days", "Afternoons", "Nights", "Rotating"];

const emptyReg = () => ({
  name: "",
  username: "",
  password: "",
  confirmPassword: "",
  department: "",
  shift: "",
});

export default function LoginPage() {
  const { login } = useAuth();
  const [, navigate] = useLocation();

  // Login state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Register dialog state
  const [registerOpen, setRegisterOpen] = useState(false);
  const [regForm, setRegForm] = useState(emptyReg());
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login(username.trim(), password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  function setReg(field: string, value: string) {
    setRegForm((f) => ({ ...f, [field]: value }));
    setRegError("");
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setRegError("");

    if (!regForm.name.trim() || !regForm.username.trim() || !regForm.password || !regForm.department || !regForm.shift) {
      return setRegError("All fields are required.");
    }
    if (regForm.password.length < 6) {
      return setRegError("Password must be at least 6 characters.");
    }
    if (regForm.password !== regForm.confirmPassword) {
      return setRegError("Passwords do not match.");
    }

    setRegLoading(true);
    try {
      const resp = await fetch(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: regForm.name.trim(),
          username: regForm.username.trim(),
          password: regForm.password,
          department: regForm.department,
          shift: regForm.shift,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Registration failed");
      setRegSuccess(true);
    } catch (err: any) {
      setRegError(err.message || "Registration failed");
    } finally {
      setRegLoading(false);
    }
  }

  function closeRegister() {
    setRegisterOpen(false);
    setTimeout(() => {
      setRegForm(emptyReg());
      setRegError("");
      setRegSuccess(false);
    }, 300);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-sidebar flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">JHSC Co-Chair Tracker</h1>
          <p className="text-sm text-muted-foreground font-medium">Unifor Local 1285 — Saputo Georgetown</p>
        </div>

        <Card className="border shadow-md">
          <CardHeader className="pb-2 pt-6 px-6">
            <p className="text-base font-semibold text-foreground">Sign in to your account</p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 border border-destructive/20">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full font-semibold" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setRegisterOpen(true)}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Request Access
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground font-mono uppercase tracking-wider">
          OHSA s.9 | O. Reg. 297/13
        </p>
      </div>

      {/* Registration Dialog */}
      <Dialog open={registerOpen} onOpenChange={(open) => { if (!open) closeRegister(); }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <UserPlus className="w-5 h-5 text-primary" />
              Request Access
            </DialogTitle>
          </DialogHeader>

          {regSuccess ? (
            <div className="py-6 flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="w-14 h-14 text-green-600" />
              <div>
                <p className="text-base font-semibold">Request submitted!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your registration is pending approval. You'll be able to sign in once an administrator reviews your request.
                </p>
              </div>
              <Button onClick={closeRegister} className="mt-2 w-full">Close</Button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4 py-1">
              <div className="space-y-1.5">
                <Label htmlFor="reg-name">Full Name <span className="text-destructive">*</span></Label>
                <Input
                  id="reg-name"
                  value={regForm.name}
                  onChange={(e) => setReg("name", e.target.value)}
                  placeholder="Your full name"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-dept">Department <span className="text-destructive">*</span></Label>
                  <Select value={regForm.department} onValueChange={(v) => setReg("department", v)}>
                    <SelectTrigger id="reg-dept">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-shift">Shift <span className="text-destructive">*</span></Label>
                  <Select value={regForm.shift} onValueChange={(v) => setReg("shift", v)}>
                    <SelectTrigger id="reg-shift">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIFTS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-username">Username <span className="text-destructive">*</span></Label>
                <Input
                  id="reg-username"
                  value={regForm.username}
                  onChange={(e) => setReg("username", e.target.value)}
                  placeholder="Choose a username"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-password">Password <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    id="reg-password"
                    type={showRegPassword ? "text" : "password"}
                    value={regForm.password}
                    onChange={(e) => setReg("password", e.target.value)}
                    placeholder="Min. 6 characters"
                    className="pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-confirm">Confirm Password <span className="text-destructive">*</span></Label>
                <Input
                  id="reg-confirm"
                  type="password"
                  value={regForm.confirmPassword}
                  onChange={(e) => setReg("confirmPassword", e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                />
              </div>

              {regError && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 border border-destructive/20">
                  {regError}
                </div>
              )}

              <DialogFooter className="pt-2 gap-2">
                <Button type="button" variant="outline" onClick={closeRegister} disabled={regLoading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={regLoading}>
                  {regLoading ? "Submitting…" : "Submit Request"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
