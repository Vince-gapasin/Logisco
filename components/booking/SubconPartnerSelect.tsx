"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/apiClient";
import SelectMenu from "@/components/SelectMenu";

// The active sub-contractors, by id so the trip is linked to the partner.
// Some screens offered two invented partners ("FastLogistics",
// "SpeedyTransit"); a new partner is added under Clients & Partners.
export default function SubconPartnerSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [partners, setPartners] = useState<{ value: string; label: string; detail?: string | null }[] | null>(null);

  useEffect(() => {
    let live = true;
    apiFetch<{ data: { subConID: string; companyName: string; contactNumber?: string | null; isActive?: boolean | null }[] }>("/api/subcontractors")
      .then((res) => {
        if (!live) return;
        const active = (res.data ?? []).filter((p) => p.isActive !== false);
        setPartners(active.map((p) => ({ value: p.subConID, label: p.companyName, detail: p.contactNumber ?? null })));
      })
      .catch(() => live && setPartners([]));
    return () => {
      live = false;
    };
  }, []);

  return (
    <SelectMenu
      id={id}
      value={value}
      onChange={onChange}
      options={partners ?? []}
      placeholder={partners ? "Select partner" : "Loading…"}
      emptyText={partners ? "No active partners. Add one under Clients & Partners." : "Loading…"}
      searchPlaceholder="Search company"
      disabled={!partners}
    />
  );
}
