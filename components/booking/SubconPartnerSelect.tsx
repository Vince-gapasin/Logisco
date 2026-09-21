"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/apiClient";
import SelectMenu from "@/components/SelectMenu";

// The active sub-contractors, loaded when the list is first shown. Some
// screens offered two invented partners ("FastLogistics", "SpeedyTransit").
export default function SubconPartnerSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [partners, setPartners] = useState<{ value: string; label: string }[] | null>(null);

  useEffect(() => {
    let live = true;
    apiFetch<{ data: { companyName: string; isActive?: boolean | null }[] }>("/api/subcontractors")
      .then((res) => {
        if (!live) return;
        const active = (res.data ?? []).filter((p) => p.isActive !== false);
        setPartners([...active.map((p) => ({ value: p.companyName, label: p.companyName })), { value: "Other", label: "Other" }]);
      })
      .catch(() => live && setPartners([{ value: "Other", label: "Other" }]));
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
      emptyText={partners ? "No active sub-contractors" : "Loading…"}
      searchPlaceholder="Search company"
      disabled={!partners}
    />
  );
}
