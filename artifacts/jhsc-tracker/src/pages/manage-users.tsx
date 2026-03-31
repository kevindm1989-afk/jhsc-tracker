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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Pencil, Trash2, ShieldCheck, User } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PERMISSION_LABELS: Record<string, string> = {
  "dashboard": "Dashboard",
  "action-items": "Action Items",
  "hazard-findings": "Hazard Findings",
  "inspection-log": "Inspection Log",
  "conduct-inspection": "Conduct Inspection",
  "worker-statements": "Worker Statements",
  "import-data": "Import Data",
};
const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS);

interface AppUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
  permissions: string[];
  createdAt: string;
}

interface UserFormData {
  username: string;
  displayName: string;
  password: string;
  role: "admin" | "member";
  permissions: string[];
}

const emptyForm = (): UserFormData => ({
  username: "",
  displayName: "",
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

  async function loadUsers() {
    setIsLoading(true);
    try {
      const resp = await fetch(`${BASE}/api/users`, { credentials: "include" });
      if (resp.ok) setUsers(await resp.json());
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

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
      password: "",
      role: u.role as "admin" | "member",
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
                      ) : (
                        <User className="w-4 h-4 text-sidebar-foreground/70" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{u.displayName}</span>
                        <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-[10px] px-1.5">
                          {u.role === "admin" ? "Admin" : "Member"}
                        </Badge>
                        {u.id === currentUser?.id && (
                          <Badge variant="outline" className="text-[10px] px-1.5">You</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">@{u.username}</p>
                      {u.role === "member" && (
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
                        <span className="text-xs text-muted-foreground mt-1 block">Full access to all modules</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
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
        <DialogContent className="max-w-md">
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
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as "admin" | "member" }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (full access)</SelectItem>
                  <SelectItem value="member">Member (custom permissions)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === "member" && (
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="border rounded-md divide-y">
                  {ALL_PERMISSIONS.map((p) => (
                    <label key={p} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={form.permissions.includes(p)}
                        onCheckedChange={() => togglePermission(p)}
                      />
                      <span className="text-sm">{PERMISSION_LABELS[p]}</span>
                    </label>
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
        <DialogContent className="max-w-sm">
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
    </div>
  );
}
