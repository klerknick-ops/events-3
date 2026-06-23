"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { Button, Card, EmptyState, Field, Input, Spinner } from "@/components/ui";
import { Modal } from "@/components/Modal";

interface Org {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  _count: { users: number; events: number };
}

export default function PlatformPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    setOrgs(await api.get<Org[]>("/api/platform/organizations"));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Organizations</h1>
          <p className="text-sm text-ink-muted">
            Platform administration — provision customer workspaces.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>+ New organization</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-ink-muted">
          <Spinner />
        </div>
      ) : orgs.length === 0 ? (
        <EmptyState
          icon="🏢"
          title="No organizations yet"
          description="Create the first customer workspace and its admin user."
          action={<Button onClick={() => setShowForm(true)}>+ New organization</Button>}
        />
      ) : (
        <Card className="divide-y divide-base">
          {orgs.map((o) => (
            <div key={o.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-sm font-medium text-ink">{o.name}</div>
                <div className="text-xs text-ink-muted">
                  /{o.slug} · {o._count.users} users · {o._count.events} events
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {showForm ? (
        <OrgForm
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

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function OrgForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || !adminName.trim() || !adminEmail.trim()) {
      setError("All fields are required");
      return;
    }
    if (adminPassword.length < 6) {
      setError("Admin password must be at least 6 characters");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/platform/organizations", {
        name: name.trim(),
        slug: (slug || slugify(name)).trim(),
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim(),
        adminPassword,
      });
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
      title="New organization"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Creating…" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Organization name">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(slugify(e.target.value));
            }}
            placeholder="Grand Plaza Hotel"
            autoFocus
          />
        </Field>
        <Field label="Slug" hint="Used as a stable identifier.">
          <Input
            value={slug}
            onChange={(e) => {
              setSlug(slugify(e.target.value));
              setSlugEdited(true);
            }}
            placeholder="grand-plaza"
          />
        </Field>
        <div className="border-t border-base pt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            First admin user
          </div>
          <div className="space-y-3">
            <Field label="Name">
              <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
            </Field>
            <Field label="Temporary password">
              <Input
                type="text"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </Field>
          </div>
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    </Modal>
  );
}
