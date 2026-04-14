import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Pencil, Trash2, ShieldCheck, User, Clock, CheckCircle2, XCircle, Inbox, Mail } from "lucide-react";
import { PERMISSION_LABELS, ALL_PERMISSIONS } from "@/lib/nav-config";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AppUser {
  id: number;
  username: string;
  displayName: string;
  email?: string;
  role: string;
  permissions: string[];
  createdAt: string;
}

interface Registration {
  id: number;
  name: string;
  username: string;
  email: string;
  department: string;
  shift: string;
  status: string;
  reviewNote: string | null;
  createdAt: string;
}

interface UserFormData {
  username: string;
  displayName: string;
  email: string;
  password: string;
  role: "admin" | "co-chair" | "member" | "worker-rep" | "management";
  permissions: string[];
}

const emptyForm = (): UserFormData => ({
  username: "",
  displayName: "",
  email: "",
  password: "",
  role: "member",
  permissions: [...ALL_PERMISSIONS],
});

export default function ManageUsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<AppUser | null>(null);
  const [sendingResetId, setSendingResetId] = useState<number | null>(null);

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [regsLoading, setRegsLoading] = useState(true);
  const [approvingReg, setApprovingReg] = useState<Registration | null>(null);
  const [approvePerms, setApprovePerms] = useState<string[]>([...ALL_PERMISSIONS]);
  const [decliningReg, setDecliningReg] = useState<Registration | null>(null);
  const [declineNote, setDeclineNote] = useState("");
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  async function loadUsers() {
    setIsLoading(true);
    try {
      const resp = await fetch(`${BASE}/api/users`, { credentials: "include" });
      if (resp.ok) setUsers(await resp.json());
    } finally {
      setIsLoading(false);
    }
  }

  async function loadRegistrations() {
    setRegsLoading(true);
    try {
      const resp = await fetch(`${BASE}/api/registrations`, { credentials: "include" });
      if (resp.ok) setRegistrations(await resp.json());
    } finally {
      setRegsLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    loadRegistrations();
  }, []);

  async function handleSendReset(u: AppUser) {
    if (!window.confirm(`Send a password reset email to ${u.displayName}?`)) return;
    setSendingResetId(u.id);
    try {
      const resp = await fetch(`${BASE}/api/users/${u.id}/send-reset-email`, {
        method: "POST",
        credentials: "include",
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to send");
      toast({ title: "Reset email sent", description: `A password reset link was sent to ${u.displayName}.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Could not send reset email", variant: "destructive" });
    } finally {
      setSendingResetId(null);
    }
  }

  function openApprove(reg: Registration) {
    setApprovingReg(reg);
    setApprovePerms([...ALL_PERMISSIONS]);
  }

  function toggleApprovePermission(p: string) {
    setApprovePerms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function handleApproveConfirm() {
    if (!approvingReg) return;
    setReviewingId(approvingReg.id);
    try {
      const resp = await fetch(`${BASE}/api/registrations/${approvingReg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "approve", permissions: approvePerms }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || "Failed to approve");
      toast({ title: "Access granted", description: `${approvingReg.name} can now sign in.` });
      setApprovingReg(null);
      await Promise.all([loadRegistrations(), loadUsers()]);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setReviewingId(null);
    }
  }

  async function handleDeclineConfirm() {
    if (!decliningReg) return;
    setReviewingId(decliningReg.id);
    try {
      const resp = await fetch(`${BASE}/api/registrations/${decliningReg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "decline", reviewNote: declineNote.trim() || undefined }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || "Failed to decline");
      toast({ title: "Request declined" });
      setDecliningReg(null);
      setDeclineNote("");
      await loadRegistrations();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setReviewingId(null);
    }
  }

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Admin access required.
      </div>
    );
  }

  function openCreate() {
    setForm(emptyForm());
    setEditingUser(null);
    setDialogMode("create");
  }

  function openEdit(u: AppUser) {
    setForm({
      username: u.username,
      displayName: u.displayName,
      email: u.email ?? "",
      password: "",
      role: u.role as "admin" | "co-chair" | "member" | "worker-rep" | "management",
      permissions: [...u.permissions],
    });
    setEditingUser(u);
    setDialogMode("edit");
  }

  function togglePermission(p: string) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(p)
        ? prev.permissions.filter((x) => x !== p)
        : [...prev.permissions, p],
    }));
  }

  async function handleSave() {
    if (!form.displayName.trim()) {
      toast({ title: "Display name required", variant: "destructive" });
      return;
    }
    if (dialogMode === "create" && !form.password) {
      toast({ title: "Password required", variant: "destructive" });
      return;
    }
    if (dialogMode === "create" && !form.username.trim()) {
      toast({ title: "Username required", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      let resp: Response;
      if (dialogMode === "create") {
        resp = await fetch(`${BASE}/api/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(form),
        });
      } else {
        const payload: Record<string, any> = {
          displayName: form.displayName,
          email: form.email.trim() || "",
          role: form.role,
          permissions: form.permissions,
        };
        if (form.password) payload.password = form.password;
        resp = await fetch(`${BASE}/api/users/${editingUser!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      }

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Save failed");
      }

      toast({ title: dialogMode === "create" ? "User created" : "User updated" });
      setDialogMode(null);
      await loadUsers();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(u: AppUser) {
    try {
      const resp = await fetch(`${BASE}/api/users/${u.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Delete failed");
      }
      toast({ title: "User removed" });
      setDeleteConfirm(null);
      await loadUsers();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Manage Users</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Add worker members and set their app permissions.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Pending Access Requests */}
      {(() => {
        const pending = registrations.filter((r) => r.status === "pending");
        const declined = registrations.filter((r) => r.status === "declined");
        const visible = [...pending, ...declined];
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Inbox className="w-4 h-4" />
                Access Requests
                {pending.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                    {pending.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {regsLoading ? (
                <div className="px-6 py-4 text-sm text-muted-foreground">Loading…</div>
              ) : visible.length === 0 ? (
                <div className="px-6 py-4 text-sm text-muted-foreground">No registration requests yet.</div>
              ) : (
                <div className="divide-y divide-border">
                  {visible.map((reg) => (
                    <div key={reg.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{reg.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">@{reg.username}</span>
                          {reg.status === "pending" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              <Clock className="w-2.5 h-2.5" /> Pending
                            </span>
                          )}
                          {reg.status === "declined" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-800">
                              <XCircle className="w-2.5 h-2.5" /> Declined
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {reg.email && <span>{reg.email} · </span>}{reg.department} · {reg.shift} · {new Date(reg.createdAt).toLocaleDateString("en-CA")}
                        </div>
                        {reg.reviewNote && (
                          <div className="text-xs text-muted-foreground italic mt-0.5">Note: {reg.reviewNote}</div>
                        )}
                      </div>
                      {reg.status === "pending" && (
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                            disabled={reviewingId === reg.id}
                            onClick={() => openApprove(reg)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-destructive text-destructive hover:bg-destructive/10"
                            disabled={reviewingId === reg.id}
                            onClick={() => { setDecliningReg(reg); setDeclineNote(""); }}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">User Accounts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">Loading...</div>
          ) : users.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">No users found.</div>
          ) : (
            <div className="divide-y divide-border">
              {users.map((u) => (
                <div key={u.id} className="flex items-start justify-between p-4 gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-sidebar flex items-center justify-center shrink-0">
                      {u.role === "admin" ? (
                        <ShieldCheck className="w-4 h-4 text-primary" />
                      ) : u.role === "co-chair" ? (
                        <ShieldCheck className="w-4 h-4 text-green-500" />
                      ) : u.role === "worker-rep" ? (
                        <ShieldCheck className="w-4 h-4 text-blue-500" />
                      ) : (
                        <User className="w-4 h-4 text-sidebar-foreground/70" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{u.displayName}</span>
                        {u.role === "admin" && (
                          <Badge variant="default" className="text-[10px] px-1.5">Admin</Badge>
                        )}
                        {u.role === "co-chair" && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">Worker Co-Chair</Badge>
                        )}
                        {u.role === "worker-rep" && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">Worker Rep</Badge>
                        )}
                        {u.role === "member" && (
                          <Badge variant="secondary" className="text-[10px] px-1.5">Member</Badge>
                        )}
                        {u.id === currentUser?.id && (
                          <Badge variant="outline" className="text-[10px] px-1.5">You</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">@{u.username}</p>
                      {(u.role === "member" || u.role === "worker-rep") && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {u.permissions.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">No permissions assigned</span>
                          ) : (
                            u.permissions.map((p) => (
                              <span key={p} className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                                {PERMISSION_LABELS[p] ?? p}
                              </span>
                            ))
                          )}
                        </div>
                      )}
                      {u.role === "admin" && (
                        <span className="text-xs text-muted-foreground mt-1 block">System administration only</span>
                      )}
                      {u.role === "co-chair" && (
                        <span className="text-xs text-muted-foreground mt-1 block">Full access to all JHSC modules</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      title="Send password reset email"
                      onClick={() => handleSendReset(u)}
                      disabled={sendingResetId === u.id}
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => setDeleteConfirm(u)}
                      disabled={u.id === currentUser?.id}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => { if (!open) setDialogMode(null); }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogMode === "create" ? "Add New User" : `Edit — ${editingUser?.displayName}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {dialogMode === "create" && (
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="e.g. jsmith"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">Lowercase letters, numbers, underscores only</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="e.g. Jane Smith"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email Address <span className="text-muted-foreground font-normal">(for password reset)</span></Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="e.g. jsmith@example.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{dialogMode === "create" ? "Password" : "New Password (leave blank to keep current)"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={dialogMode === "create" ? "Min. 6 characters" : "Leave blank to keep current"}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as "admin" | "co-chair" | "member" | "worker-rep" | "management" }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (system administration only)</SelectItem>
                  <SelectItem value="co-chair">Worker Co-Chair (full module access)</SelectItem>
                  <SelectItem value="worker-rep">Worker Rep (custom permissions)</SelectItem>
                  <SelectItem value="management">Management (cannot view Worker Statements/RTR)</SelectItem>
                  <SelectItem value="member">Member (custom permissions)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.role === "member" || form.role === "worker-rep") && (
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="border rounded-md divide-y">
                  {ALL_PERMISSIONS.map((p) => (
                    <div key={p} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50" onClick={() => togglePermission(p)}>
                      <span onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={form.permissions.includes(p)}
                          onCheckedChange={() => togglePermission(p)}
                        />
                      </span>
                      <span className="text-sm">{PERMISSION_LABELS[p]}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => setForm((f) => ({ ...f, permissions: [...ALL_PERMISSIONS] }))}
                  >
                    Select all
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => setForm((f) => ({ ...f, permissions: [] }))}
                  >
                    Clear all
                  </button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : dialogMode === "create" ? "Create User" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Remove User</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to remove <strong>{deleteConfirm?.displayName}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Remove User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Registration — set permissions dialog */}
      <Dialog open={approvingReg !== null} onOpenChange={(open) => { if (!open) setApprovingReg(null); }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Approve — {approvingReg?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Choose which pages <strong>{approvingReg?.name}</strong> will have access to.
            </p>
            <div className="rounded-md border divide-y divide-border">
              {ALL_PERMISSIONS.map((p) => (
                <div key={p} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/40" onClick={() => toggleApprovePermission(p)}>
                  <span onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={approvePerms.includes(p)}
                      onCheckedChange={() => toggleApprovePermission(p)}
                    />
                  </span>
                  <span className="text-sm">{PERMISSION_LABELS[p]}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                className="text-xs text-primary underline"
                onClick={() => setApprovePerms([...ALL_PERMISSIONS])}
              >
                Select all
              </button>
              <span className="text-xs text-muted-foreground">·</span>
              <button
                type="button"
                className="text-xs text-primary underline"
                onClick={() => setApprovePerms([])}
              >
                Clear all
              </button>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApprovingReg(null)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={reviewingId === approvingReg?.id}
              onClick={handleApproveConfirm}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {reviewingId === approvingReg?.id ? "Approving…" : "Grant Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline Registration Dialog */}
      <Dialog open={decliningReg !== null} onOpenChange={(open) => { if (!open) { setDecliningReg(null); setDeclineNote(""); } }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Decline Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Decline access request from <strong>{decliningReg?.name}</strong>?
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="decline-note">Note (optional)</Label>
              <Textarea
                id="decline-note"
                value={declineNote}
                onChange={(e) => setDeclineNote(e.target.value)}
                placeholder="Reason for declining…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDecliningReg(null); setDeclineNote(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reviewingId === decliningReg?.id}
              onClick={handleDeclineConfirm}
            >
              Decline Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
