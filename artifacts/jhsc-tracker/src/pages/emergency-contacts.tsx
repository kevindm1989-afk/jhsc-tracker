import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Mail, Plus, Edit2, Trash2, Building2, User, BookOpen } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Contact = {
  id: number;
  name: string;
  role: string;
  organization: string;
  phone: string;
  email: string;
  notes: string;
  sortOrder: number;
};

const empty = {
  name: "",
  role: "",
  organization: "",
  phone: "",
  email: "",
  notes: "",
  sortOrder: 0,
};

export default function EmergencyContactsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const canEdit = user?.role === "admin" || user?.role === "co-chair";

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [deleting, setDeleting] = useState<Contact | null>(null);

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["emergency-contacts"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/emergency-contacts`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const url = editing ? `${BASE}/api/emergency-contacts/${editing.id}` : `${BASE}/api/emergency-contacts`;
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error("Failed to save");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emergency-contacts"] });
      toast({ title: editing ? "Contact updated" : "Contact added" });
      setOpen(false);
      setEditing(null);
      setForm({ ...empty });
    },
    onError: () => toast({ title: "Error saving", variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${BASE}/api/emergency-contacts/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emergency-contacts"] });
      toast({ title: "Contact removed" });
      setDeleting(null);
    },
    onError: () => toast({ title: "Error deleting", variant: "destructive" }),
  });

  function openNew() {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  }

  function openEdit(c: Contact) {
    setEditing(c);
    setForm({ name: c.name, role: c.role, organization: c.organization, phone: c.phone, email: c.email, notes: c.notes, sortOrder: c.sortOrder });
    setOpen(true);
  }

  function field(key: keyof typeof form, val: string | number) {
    setForm(f => ({ ...f, [key]: val }));
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Phone className="h-6 w-6 text-green-600" />
          <h1 className="text-xl font-bold text-foreground">Emergency Contacts</h1>
        </div>
        {canEdit && (
          <Button onClick={openNew} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Contact
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No emergency contacts added yet.</p>
          {canEdit && <p className="text-xs text-muted-foreground">Add contacts like EMS, fire, spill response, occupational health, etc.</p>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {contacts.map(c => (
            <div key={c.id} className="border border-border rounded-xl bg-card shadow-sm p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{c.name}</p>
                  {c.role && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <User className="h-3 w-3 shrink-0" />{c.role}
                    </p>
                  )}
                  {c.organization && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3 shrink-0" />{c.organization}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleting(c)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-1 pt-1">
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Phone className="h-3.5 w-3.5 shrink-0" />{c.phone}
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0" />{c.email}
                  </a>
                )}
                {c.notes && (
                  <p className="text-xs text-muted-foreground pt-1">{c.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={v => { if (!v) { setOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Contact" : "Add Emergency Contact"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input className="mt-1" placeholder="e.g. Plant Nurse, EMS, Security" value={form.name} onChange={e => field("name", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Role / Title</label>
              <Input className="mt-1" placeholder="e.g. Occupational Health Nurse" value={form.role} onChange={e => field("role", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Organization</label>
              <Input className="mt-1" placeholder="e.g. ABC Hospital, WSIB" value={form.organization} onChange={e => field("organization", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input className="mt-1" type="tel" placeholder="(xxx) xxx-xxxx" value={form.phone} onChange={e => field("phone", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input className="mt-1" type="email" placeholder="contact@example.com" value={form.email} onChange={e => field("email", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea className="mt-1" rows={2} placeholder="Hours, when to call, etc." value={form.notes} onChange={e => field("notes", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Sort Order</label>
              <Input className="mt-1" type="number" min={0} value={form.sortOrder} onChange={e => field("sortOrder", parseInt(e.target.value) || 0)} />
              <p className="text-xs text-muted-foreground mt-1">Lower numbers appear first (0 = top)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>
              {save.isPending ? "Saving..." : editing ? "Update" : "Add Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={v => { if (!v) setDeleting(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Contact?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Remove <strong>{deleting?.name}</strong> from the emergency contacts directory?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleting && del.mutate(deleting.id)} disabled={del.isPending}>
              {del.isPending ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
