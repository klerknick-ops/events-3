"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { Select } from "@/components/ui";

interface AssignableUser {
  id: string;
  name: string;
}

// Cached list of assignable users (shared across all OwnerSelect instances).
let cache: AssignableUser[] | null = null;

// Dropdown for assigning an owner (from the org's active users). Used for lead
// emails (manual owner) and event assignees.
export function OwnerSelect({
  value,
  onChange,
  placeholder = "Unassigned",
}: {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  placeholder?: string;
}) {
  const [users, setUsers] = useState<AssignableUser[]>(cache ?? []);

  useEffect(() => {
    if (cache) return;
    api
      .get<AssignableUser[]>("/api/users/assignable")
      .then((u) => {
        cache = u;
        setUsers(u);
      })
      .catch(() => setUsers([]));
  }, []);

  return (
    <Select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{placeholder}</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </Select>
  );
}
