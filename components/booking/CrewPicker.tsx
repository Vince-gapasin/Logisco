"use client";

import React, { useMemo } from "react";
import SelectMenu, { type SelectMenuOption } from "@/components/SelectMenu";

// Truck, driver and two helpers for a booking. Searchable lists that always
// open below the field; helpers can be "None", and one person cannot be
// both helpers.

export interface CrewTruck {
  truckID: string;
  plateNumber: string;
  model?: string | null;
  truckType?: string | null;
  capacity?: number | null;
}
export interface CrewPerson {
  employeeID: string;
  employeeName: string;
  employeeCode?: string | null;
  contact?: string | null;
}
export interface CrewChoice {
  truckPlate: string;
  driver: string;
  helper1: string;
  helper2: string;
}

const label = "block text-xs font-medium text-black mb-1";

export function truckOption(t: CrewTruck): SelectMenuOption {
  return {
    value: t.truckID,
    label: t.plateNumber,
    detail:
      [t.truckType, t.model, t.capacity ? `${Number(t.capacity).toLocaleString("en-PH")} kg` : null]
        .filter(Boolean)
        .join(" · ") || null,
  };
}

export function personOption(p: CrewPerson): SelectMenuOption {
  return {
    value: p.employeeID,
    label: p.employeeName,
    detail: [p.employeeCode, p.contact].filter(Boolean).join(" · ") || null,
  };
}

/**
 * The crew the form suggests: what was already chosen while it is still
 * free, otherwise the first free truck, driver and helpers. A helper cleared
 * to "None" on purpose stays "None".
 */
export function suggestCrew(
  current: CrewChoice,
  touched: Partial<Record<keyof CrewChoice, boolean>>,
  trucks: CrewTruck[],
  drivers: CrewPerson[],
  helpers: CrewPerson[],
): CrewChoice {
  const has = <T,>(list: T[], key: (item: T) => string, id: string) => Boolean(id) && list.some((item) => key(item) === id);
  const keep = (field: keyof CrewChoice, free: boolean) => (free || (touched[field] && current[field] === "") ? current[field] : null);

  const truckPlate = keep("truckPlate", has(trucks, (t) => t.truckID, current.truckPlate)) ?? trucks[0]?.truckID ?? "";
  const driver = keep("driver", has(drivers, (d) => d.employeeID, current.driver)) ?? drivers[0]?.employeeID ?? "";

  const taken = new Set<string>();
  const pickHelper = (field: "helper1" | "helper2") => {
    const kept = keep(field, has(helpers, (h) => h.employeeID, current[field]));
    const value = kept ?? helpers.find((h) => !taken.has(h.employeeID))?.employeeID ?? "";
    if (value) taken.add(value);
    return value;
  };
  if (current.helper2 && touched.helper2) taken.add(current.helper2);
  const helper1 = pickHelper("helper1");
  const helper2 = pickHelper("helper2");

  return { truckPlate, driver, helper1, helper2 };
}

export default function CrewPicker({
  value,
  onChange,
  trucks,
  drivers,
  helpers,
  errors = {},
  loading = false,
  required = false,
}: {
  value: CrewChoice;
  onChange: (field: keyof CrewChoice, next: string) => void;
  trucks: CrewTruck[];
  drivers: CrewPerson[];
  helpers: CrewPerson[];
  errors?: Partial<Record<keyof CrewChoice, string>>;
  loading?: boolean;
  /** Truck and driver must be chosen (assigning), rather than optional (a new booking). */
  required?: boolean;
}) {
  const truckOptions = useMemo(() => trucks.map(truckOption), [trucks]);
  const driverOptions = useMemo(() => drivers.map(personOption), [drivers]);
  const helperOptions = useMemo(() => helpers.map(personOption), [helpers]);

  const waiting = loading ? "Loading…" : undefined;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div>
        <label className={label} htmlFor="crew-truck">Truck Plate No.{required ? " *" : ""}</label>
        <SelectMenu
          id="crew-truck"
          value={value.truckPlate}
          onChange={(v) => onChange("truckPlate", v)}
          options={truckOptions}
          placeholder={waiting ?? (required ? "Select truck" : "Unassigned")}
          emptyText={waiting ?? "No truck is free"}
          searchPlaceholder="Search plate or type"
          allowNone={!required}
          noneLabel="Unassigned"
        />
        {errors.truckPlate && <p className="mt-1 text-xs text-red-600">{errors.truckPlate}</p>}
      </div>
      <div>
        <label className={label} htmlFor="crew-driver">Driver{required ? " *" : ""}</label>
        <SelectMenu
          id="crew-driver"
          value={value.driver}
          onChange={(v) => onChange("driver", v)}
          options={driverOptions}
          placeholder={waiting ?? (required ? "Select driver" : "Unassigned")}
          emptyText={waiting ?? "No driver is free"}
          searchPlaceholder="Search name or ID"
          allowNone={!required}
          noneLabel="Unassigned"
        />
        {errors.driver && <p className="mt-1 text-xs text-red-600">{errors.driver}</p>}
      </div>
      {(["helper1", "helper2"] as const).map((field, i) => {
        const other = field === "helper1" ? value.helper2 : value.helper1;
        return (
          <div key={field}>
            <label className={label} htmlFor={`crew-${field}`}>Helper #{i + 1}</label>
            <SelectMenu
              id={`crew-${field}`}
              value={value[field]}
              onChange={(v) => onChange(field, v)}
              options={helperOptions.filter((o) => o.value !== other)}
              placeholder={waiting ?? "None"}
              emptyText={waiting ?? "No helper is free"}
              searchPlaceholder="Search name or ID"
              allowNone
            />
          </div>
        );
      })}
    </div>
  );
}
