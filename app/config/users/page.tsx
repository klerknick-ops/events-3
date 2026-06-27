"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import type { UserAccount } from "@/lib/types";
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type Role } from "@/lib/permissions";
import { useMe } from "@/components/MeProvider";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
} from "@/components/ui";
import { Modal } from "@/components/Modal";

export default function UsersPage() {
  const { permissions, user: me } = useMe();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserAccount | null>(null);

  async function load() {
    setLoading(true);
    setUsers(await api.get<UserAccount[]>("/api/users"));
    setLoading(false);
  }
  useEffect(() => {
    if (permissions.MANAGE_USERS) load();
    else setLoading(false);
  }, [permissions.MANAGE_USERS]);

  if (!permissions.MANAGE_USERS) {
    return (
      <EmptyState
        icon="🔒"
        title="Admins only"
        description="You need the Admin role to manage user accounts."
      />
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          Staff accounts and their access level.
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          + New user
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-ink-muted">
          <Spinner />
        </div>
      ) : (
        <Card className="divide-y divide-base">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{u.name}</span>
                  {!u.active ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-ink-muted">
                      inactive
                    </span>
                  ) : null}
                  {u.id === me?.id ? (
                    <span className="rounded bg-accent px-1.5 py-0.5 text-xs text-brand-700 dark:bg-brand-600/20 dark:text-brand-300">
                      you
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-ink-muted">
                  {u.email} · {ROLE_LABELS[u.role]}
                  {u.title ? ` · ${u.title}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditing(u);
                    setShowForm(true);
                  }}
                >
                  Edit
                </Button>
                {u.id !== me?.id && u.active ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (confirm(`Deactivate ${u.name}?`)) {
                        await api.del(`/api/users/${u.id}`);
                        load();
                      }
                    }}
                  >
                    Deactivate
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      )}

      {showForm ? (
        <UserForm
          user={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function UserForm({
  user,
  onClose,
  onSaved,
}: {
  user: UserAccount | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "STAFF");
  const [title, setTitle] = useState(user?.title ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [active, setActive] = useState(user?.active ?? true);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return setError("Name is required");
    if (!user && !email.trim()) return setError("Email is required");
    if (!user && password.length < 6)
      return setError("Password must be at least 6 characters");
    setSaving(true);
    setError(null);
    try {
      if (user) {
        await api.patch(`/api/users/${user.id}`, {
          name: name.trim(),
          role,
          title: title.trim() || null,
          phone: phone.trim() || null,
          active,
          ...(password ? { password } : {}),
        });
      } else {
        await api.post("/api/users", {
          name: name.trim(),
          email: email.trim(),
          role,
          title: title.trim() || null,
          phone: phone.trim() || null,
          password,
        });
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={user ? "Edit user" : "New user"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!!user}
          />
        </Field>
        <Field label="Role" hint={ROLE_DESCRIPTIONS[role]}>
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Job title" hint="Used in the email signature.">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event Manager" />
          </Field>
          <Field label="Direct phone" hint="Used in the email signature.">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+31 6 1234 5678" />
          </Field>
        </div>
        <Field
          label={user ? "Reset password (optional)" : "Password"}
          hint={user ? "Leave blank to keep the current password." : undefined}
        >
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        {user ? (
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-base"
            />
            Active account
          </label>
        ) : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    </Modal>
  );
}
