"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/apiClient";
import type { BookingCrewView } from "@/app/lib/bookingView";
import type { CrewPerson, CrewTruck } from "@/components/booking/CrewPicker";

// Trucks and crew that can be put on a booking: whoever is free on the date,
// plus whoever is already on this booking's trip - they show as busy
// precisely because of it, and must stay selectable when re-assigning.

interface CurrentAssignment {
  truckID?: string | null;
  truckPlate?: string | null;
  truckModel?: string | null;
  crews?: BookingCrewView[];
}

export interface AssignableCrew {
  trucks: CrewTruck[];
  drivers: CrewPerson[];
  helpers: CrewPerson[];
  loading: boolean;
  error: string;
}

function addIfMissing<T, K extends keyof T>(list: T[], key: K, record: T | null): T[] {
  return record && record[key] && !list.some((item) => item[key] === record[key]) ? [...list, record] : list;
}

export function useAssignableCrew(date: string, enabled: boolean, current?: CurrentAssignment): AssignableCrew {
  const [state, setState] = useState<{ key: string; trucks: CrewTruck[]; drivers: CrewPerson[]; helpers: CrewPerson[]; error: string } | null>(null);
  const day = date || new Date().toISOString().split("T")[0];
  const key = `${day}|${current?.truckID ?? ""}`;

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    apiFetch<{ data: { trucks: CrewTruck[]; drivers: CrewPerson[]; helpers: CrewPerson[] } }>(
      `/api/dispatch/available-resources?date=${day}`,
      { cache: "no-store" },
    )
      .then((res) => {
        if (!live) return;
        const crews = current?.crews ?? [];
        const driver = crews.find((c) => c.role === "Driver" && c.employeeID);
        let helpers = res.data?.helpers ?? [];
        for (const crew of crews.filter((c) => c.role.startsWith("Helper") && c.employeeID)) {
          helpers = addIfMissing(helpers, "employeeID", { employeeID: crew.employeeID!, employeeName: crew.name });
        }
        setState({
          key,
          trucks: addIfMissing(
            res.data?.trucks ?? [],
            "truckID",
            current?.truckID
              ? { truckID: current.truckID, plateNumber: current.truckPlate || "Current truck", model: current.truckModel || null }
              : null,
          ),
          drivers: addIfMissing(
            res.data?.drivers ?? [],
            "employeeID",
            driver ? { employeeID: driver.employeeID!, employeeName: driver.name } : null,
          ),
          helpers,
          error: "",
        });
      })
      .catch((e: unknown) => {
        if (live) setState({ key, trucks: [], drivers: [], helpers: [], error: e instanceof Error ? e.message : "Failed to load available crew." });
      });
    return () => {
      live = false;
    };
    // current is read when the date or trip changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, day, key]);

  const ready = state?.key === key ? state : null;
  return {
    trucks: ready?.trucks ?? [],
    drivers: ready?.drivers ?? [],
    helpers: ready?.helpers ?? [],
    loading: enabled && !ready,
    error: ready?.error ?? "",
  };
}
