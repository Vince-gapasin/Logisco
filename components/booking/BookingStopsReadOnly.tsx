"use client";

import React from "react";
import { CheckCircle2, Clock, Info, X } from "lucide-react";

// A booking's pickups and deliveries, as recorded when it was made. Shown
// read-only on the assign and re-assign screens: those only change the crew,
// and edits to these tables were never saved. A client's warehouses and
// branches are kept under Clients & Partners.

export interface ReadOnlyPickup {
  warehouseName?: string;
  warehouseAddress?: string;
  contactPerson?: string;
  contactNumber?: string;
  pickupTime?: string;
  quantity?: string;
  stopStatus?: string;
}
export interface ReadOnlyDelivery {
  branchName?: string;
  deliveryAddress?: string;
  contactPerson?: string;
  contactNumber?: string;
  deliveryTime?: string;
  quantity?: string;
  stopStatus?: string;
}

const th = "p-2.5 border-r border-slate-200";
const td = "p-2.5 border-r border-slate-200 bg-slate-50 font-medium text-slate-700 align-top";

const badge =
  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs sm:text-[10px] font-bold uppercase tracking-wider whitespace-nowrap";

// Delivered, on the way, or still to come. A stop nobody has reached yet is
// not a failure, so it is stated rather than marked in red.
function StatusBadge({ status }: { status?: string }) {
  const current = status || "Pending";
  const normalized = current.toLowerCase();

  if (normalized === "in progress") {
    return (
      <span className={`${badge} bg-blue-100 text-blue-700`}>
        <Clock className="w-3 h-3" /> {current}
      </span>
    );
  }

  if (normalized.includes("deliver") || normalized === "completed" || normalized === "complete") {
    return (
      <span className={`${badge} bg-emerald-100 text-emerald-800`}>
        <CheckCircle2 className="w-3 h-3" /> {current}
      </span>
    );
  }

  return (
    <span className={`${badge} bg-slate-100 text-slate-600`}>
      <X className="w-3 h-3" /> {current}
    </span>
  );
}

function Empty({ columns, text }: { columns: number; text: string }) {
  return (
    <tr>
      <td colSpan={columns} className="p-4 text-center text-slate-500 italic bg-slate-50">
        {text}
      </td>
    </tr>
  );
}

/** One stop as a card, below laptop width, where the seven-column table cannot fit. */
function StopCard({
  index,
  name,
  rows,
  status,
}: {
  index: number;
  name?: string;
  rows: [string, string | undefined][];
  status?: string | null;
}) {
  return (
    <div className="border border-slate-200 rounded-lg bg-slate-50 p-3 text-xs">
      <div className="flex items-start justify-between gap-2 pb-2 mb-2 border-b border-slate-200">
        <p className="font-semibold text-slate-900 text-sm wrap-break-word">
          <span className="text-slate-500 font-medium mr-1">{index}.</span>
          {name || "—"}
        </p>
        {status !== null && <StatusBadge status={status} />}
      </div>
      <dl className="space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[40%_60%] gap-2">
            <dt className="text-slate-500 font-medium">{label}</dt>
            <dd className="font-medium text-slate-700 wrap-break-word">{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function BookingStopsReadOnly({
  pickups,
  deliveries,
  showStatus = false,
  showEditNote = true,
}: {
  pickups: ReadOnlyPickup[];
  deliveries: ReadOnlyDelivery[];
  showStatus?: boolean;
  /** Where to change an address. Pointless on a trip that has already run. */
  showEditNote?: boolean;
}) {
  const extra = showStatus ? 1 : 0;

  return (
    <>
      {showEditNote && (
      <p className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        Pickup and delivery addresses are fixed once a booking is made. To change a client&apos;s warehouses or
        branches, edit the client under Clients &amp; Partners.
      </p>
      )}

      <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
        <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
          2. Pickup Addresses
        </div>
        <div className="lg:hidden space-y-2">
          {pickups.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-500 italic bg-slate-50 rounded-lg">No pickup recorded for this booking.</p>
          ) : (
            pickups.map((row, idx) => (
              <StopCard
                key={idx}
                index={idx + 1}
                name={row.warehouseName}
                status={showStatus ? row.stopStatus : null}
                rows={[
                  ["Address", row.warehouseAddress],
                  ["Contact Person", row.contactPerson],
                  ["Contact Number", row.contactNumber],
                  ["Pick Up Time", row.pickupTime],
                  ["Quantity", row.quantity],
                ]}
              />
            ))
          )}
        </div>
        <div className="hidden lg:block overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs min-w-150">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                <th className={`${th} w-10 text-center`}></th>
                <th className={`${th} w-[20%]`}>Warehouse Name</th>
                <th className={`${th} w-[25%]`}>Address</th>
                <th className={`${th} w-[15%]`}>Contact Person</th>
                <th className={`${th} w-[15%]`}>Contact Number</th>
                <th className={`${th} w-[12%]`}>Pick Up Time</th>
                <th className={`${th} w-20 text-center`}>Quantity</th>
                {showStatus && <th className="p-2.5 text-center w-[10%]">Status</th>}
              </tr>
            </thead>
            <tbody>
              {pickups.length === 0 ? (
                <Empty columns={7 + extra} text="No pickup recorded for this booking." />
              ) : (
                pickups.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className={`${td} text-center`}>{idx + 1}</td>
                    <td className={td}>{row.warehouseName || "—"}</td>
                    <td className={td}>{row.warehouseAddress || "—"}</td>
                    <td className={td}>{row.contactPerson || "—"}</td>
                    <td className={td}>{row.contactNumber || "—"}</td>
                    <td className={td}>{row.pickupTime || "—"}</td>
                    <td className={`${td} text-center`}>{row.quantity || "—"}</td>
                    {showStatus && (
                      <td className="p-2.5 text-center bg-slate-50 align-top">
                        <StatusBadge status={row.stopStatus} />
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
        <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
          3. Delivery Address
        </div>
        <div className="lg:hidden space-y-2">
          {deliveries.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-500 italic bg-slate-50 rounded-lg">No delivery recorded for this booking.</p>
          ) : (
            deliveries.map((row, idx) => (
              <StopCard
                key={idx}
                index={idx + 1}
                name={row.branchName}
                status={showStatus ? row.stopStatus : null}
                rows={[
                  ["Delivery Address", row.deliveryAddress],
                  ["Contact Person", row.contactPerson],
                  ["Contact Number", row.contactNumber],
                  ["Delivery Time", row.deliveryTime],
                  ["Quantity", row.quantity],
                ]}
              />
            ))
          )}
        </div>
        <div className="hidden lg:block overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs min-w-150">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                <th className={`${th} w-10 text-center`}></th>
                <th className={`${th} w-[20%]`}>Branch Name</th>
                <th className={`${th} w-[25%]`}>Delivery Address</th>
                <th className={`${th} w-[15%]`}>Contact Person</th>
                <th className={`${th} w-[15%]`}>Contact Number</th>
                <th className={`${th} w-[12%]`}>Delivery Time</th>
                <th className={`${th} w-20 text-center`}>Quantity</th>
                {showStatus && <th className="p-2.5 text-center w-[10%]">Stop Status</th>}
              </tr>
            </thead>
            <tbody>
              {deliveries.length === 0 ? (
                <Empty columns={7 + extra} text="No delivery recorded for this booking." />
              ) : (
                deliveries.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className={`${td} text-center`}>{idx + 1}</td>
                    <td className={td}>{row.branchName || "—"}</td>
                    <td className={td}>{row.deliveryAddress || "—"}</td>
                    <td className={td}>{row.contactPerson || "—"}</td>
                    <td className={td}>{row.contactNumber || "—"}</td>
                    <td className={td}>{row.deliveryTime || "—"}</td>
                    <td className={`${td} text-center`}>{row.quantity || "—"}</td>
                    {showStatus && (
                      <td className="p-2.5 text-center bg-slate-50 align-top">
                        <StatusBadge status={row.stopStatus} />
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
