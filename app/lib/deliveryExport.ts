// One delivery, on its own, as a PDF or a CSV.
//
// The Reports export is a list: a line per booking, for a period. This is the
// other thing the office is asked for - everything about one delivery, to send
// to the client who is asking about it or to file with its paperwork. So it
// reads like the booking record does: who it was for, the truck and crew, each
// stop on the route in order, and then everything that happened to it.
//
// Built from the same mapper as the record on screen, and the history from the
// same audit trail the History button reads, so the file and the screen cannot
// say different things about the same booking.

import { mapOrderToBookingView, toFeedBooking, type OrderWithRelations } from "@/app/lib/bookingView";
import { downloadCsv, type CsvValue } from "@/app/lib/csvExport";
import { formatDateTime, formatTime } from "@/app/lib/datetime";
import { STOP_STATUS } from "@/app/lib/enums";
import type { DetailItem } from "@/app/lib/pdfReport";
import { bookingStatusLabel } from "@/app/lib/statusLabels";
import type { BookingHistoryEntry } from "@/services/booking/bookingHistoryService";

export type ExportFormat = "pdf" | "csv";

function orDash(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value).trim();
  return text || "-";
}

function when(value: string | null | undefined): string {
  return value ? formatDateTime(value) : "-";
}

/** "Name - number", without a dangling separator when one is missing. */
function contactOf(person: string, number: string): string {
  return orDash([person, number].map((part) => part?.trim()).filter(Boolean).join(" - "));
}

/** The stop statuses as a person would say them. */
function stopStatusLabel(status: string): string {
  if (status === STOP_STATUS.delivered) return "Delivered";
  return orDash(status);
}

interface StopBlock {
  kind: "Pickup" | "Delivery";
  number: number;
  name: string;
  status: string;
  details: DetailItem[];
}

function describe(order: OrderWithRelations, history: BookingHistoryEntry[]) {
  const view = mapOrderToBookingView(order);
  const booking = toFeedBooking(view);
  const status = bookingStatusLabel(booking.confirmationStatus) || "-";
  // The booking itself does not keep who took it; the audit trail does.
  const created = history.find((entry) => entry.title === "Booking created");
  const createdBy = created && created.actorName !== "System" ? created.actorName : "";

  const bookingDetails: DetailItem[] = [
    { label: "Order ID", value: orDash(view.orderId) },
    { label: "Delivery date", value: orDash(view.displayDate) },
    { label: "Date created", value: orDash(view.dateCreated) },
    { label: "Created by", value: orDash(createdBy) },
    { label: "Product", value: orDash(view.product) },
    { label: "Completed at", value: when(view.completedAt) },
  ];

  const clientDetails: DetailItem[] = [
    { label: "Client", value: orDash(view.clientName) },
    { label: "Contact person", value: orDash(view.contactPerson) },
    { label: "Contact number", value: orDash(view.contactNumber) },
    { label: "Email", value: orDash(view.emailAddress) },
    { label: "Business address", value: orDash(view.businessAddress), wide: true },
  ];

  const crewDetails: DetailItem[] = [
    ...(view.subconPartner ? [{ label: "Sub-con partner", value: view.subconPartner }] : []),
    { label: "Truck", value: orDash([view.truckPlate, view.truckModel].filter(Boolean).join(" - ")) },
    ...view.crews.map((member) => ({
      label: member.role,
      value: [orDash(member.name), member.status ? `(${member.status})` : "", member.reason ? `- ${member.reason}` : ""]
        .filter(Boolean)
        .join(" "),
    })),
  ];

  // The route in the order it is driven: the pickups, then the drops.
  const stops: StopBlock[] = [
    ...view.pickups.map((stop, index) => ({
      kind: "Pickup" as const,
      number: index + 1,
      name: orDash(stop.warehouseName),
      status: stopStatusLabel(stop.status),
      details: [
        { label: "Address", value: orDash(stop.pickupAddress), wide: true },
        { label: "Contact", value: contactOf(stop.contactPerson, stop.contactNum) },
        { label: "Quantity", value: orDash(stop.quantity) },
        { label: "Expected", value: orDash(formatTime(stop.expectedTime)) },
        { label: "Arrived", value: when(stop.arrivedAt) },
        { label: "Completed", value: when(stop.completedAt) },
      ],
    })),
    ...view.stops.map((stop, index) => {
      const proof = stop.proofs[0];
      return {
        kind: "Delivery" as const,
        number: index + 1,
        name: orDash(stop.branchName),
        status: stopStatusLabel(stop.status),
        details: [
          { label: "Address", value: orDash(stop.deliveryAddress || view.businessAddress), wide: true },
          { label: "Contact", value: contactOf(stop.contactPerson, stop.contactNum) },
          { label: "Quantity", value: orDash(stop.quantity) },
          { label: "Expected", value: orDash(formatTime(stop.expectedTime)) },
          { label: "Arrived", value: when(stop.arrivedAt) },
          { label: "Completed", value: when(stop.completedAt) },
          { label: "Received by", value: orDash(proof?.receiverName) },
          ...(proof?.remarks ? [{ label: "Proof remarks", value: proof.remarks, wide: true }] : []),
          ...(proof?.missingReason ? [{ label: "No proof because", value: proof.missingReason, wide: true }] : []),
        ],
      };
    }),
  ];

  // Oldest first: on paper a history is read from the top, as it happened.
  // The screen shows it newest first because there the latest is what is
  // being looked for.
  const events = [...history]
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .map((entry, index) => ({
      number: String(index + 1),
      when: orDash(entry.dateTime),
      what: entry.detail ? `${entry.title}: ${entry.detail}` : entry.title,
      by:
        entry.actorName && entry.actorName !== entry.actorRole
          ? `${entry.actorName} (${entry.actorRole})`
          : orDash(entry.actorName),
    }));

  return {
    view,
    status,
    bookingDetails,
    clientDetails,
    crewDetails,
    stops,
    events,
    reason: booking.foulDetails?.description || view.rejectionReason || "",
  };
}

export async function exportDelivery(
  order: OrderWithRelations,
  history: BookingHistoryEntry[],
  format: ExportFormat,
): Promise<void> {
  const record = describe(order, history);
  const { startReport, toFileSlug } = await import("@/app/lib/pdfReport");
  const generatedAt = formatDateTime(new Date().toISOString());
  const base = `delivery-${toFileSlug(record.view.orderId || "record")}`;

  if (format === "csv") {
    // In sections, as the record reads, with a blank row between them: one
    // delivery is a document, not a table of like rows.
    const pairs = (items: DetailItem[]): CsvValue[][] => items.map((item) => [item.label, item.value]);
    const rows: CsvValue[][] = [
      ["Delivery Record", record.view.orderId],
      ["Final status", record.status],
      ["Generated", generatedAt],
      [],
      ["BOOKING"],
      ...pairs(record.bookingDetails),
      ["Priority", orDash(record.view.priorityLevel)],
      ["Total quantity", orDash(record.view.totalQuantity)],
      [],
      ["CLIENT"],
      ...pairs(record.clientDetails),
      [],
      ["TRUCK AND CREW"],
      ...pairs(record.crewDetails),
      [],
      ["ROUTE"],
      ["Stop", "Name", "Status", "Address", "Contact", "Expected", "Quantity", "Arrived", "Completed", "Received by"],
      ...record.stops.map((stop) => {
        const value = (label: string) => stop.details.find((item) => item.label === label)?.value ?? "";
        return [
          `${stop.kind} ${stop.number}`,
          stop.name,
          stop.status,
          value("Address"),
          value("Contact"),
          value("Expected"),
          value("Quantity"),
          value("Arrived"),
          value("Completed"),
          stop.kind === "Delivery" ? value("Received by") : "",
        ];
      }),
    ];
    if (record.reason) rows.push([], ["WHY IT DID NOT FINISH"], [record.reason]);
    if (record.view.plainNotes) rows.push([], ["NOTES"], [record.view.plainNotes]);
    rows.push(
      [],
      ["HISTORY"],
      ["#", "Date and time", "What happened", "By"],
      ...record.events.map((event) => [event.number, event.when, event.what, event.by]),
    );

    downloadCsv(`${base}.csv`, rows);
    return;
  }

  // Portrait, like the paperwork it is filed with. Each part of the booking
  // is a boxed panel, a label beside each value, and each stop is a panel of
  // its own with its status as a badge - the stops were a table once, and a
  // table that wide could not be read without cutting its cells.
  const report = await startReport({
    title: `Delivery Record ${record.view.orderId}`,
    meta: [
      `${record.view.clientName || "-"}  |  Delivery date: ${record.view.displayDate || "-"}`,
      `Generated ${generatedAt}`,
    ],
  });

  report.figures([
    { label: "Final status", value: record.status },
    { label: "Priority", value: orDash(record.view.priorityLevel) },
    { label: "Stops", value: String(record.stops.length) },
    { label: "Quantity", value: orDash(record.view.totalQuantity) },
  ]);

  report.panel("Booking", record.bookingDetails);
  report.panel("Client", record.clientDetails);
  report.panel("Truck and crew", record.crewDetails);

  report.section(
    "Route",
    `${record.stops.filter((stop) => stop.kind === "Pickup").length} pickup(s), ${record.stops.filter((stop) => stop.kind === "Delivery").length} delivery stop(s), in the order driven`,
  );
  if (record.stops.length === 0) {
    report.paragraph("No stops recorded.", { muted: true });
  }
  for (const stop of record.stops) {
    report.panel(`${stop.kind} ${stop.number}: ${stop.name}`, stop.details, { status: stop.status });
  }

  if (record.reason) {
    report.section("Why it did not finish", undefined, 8);
    report.paragraph(record.reason);
  }

  if (record.view.plainNotes) {
    report.section("Notes", undefined, 8);
    report.paragraph(record.view.plainNotes);
  }

  report.section("History", `${record.events.length} recorded, oldest first`, 16);
  if (record.events.length) {
    report.table(
      [
        { header: "#", width: 8 },
        { header: "Date and time", width: 34 },
        { header: "What happened", width: 96 },
        { header: "By", width: 42 },
      ],
      record.events.map((event) => [event.number, event.when, event.what, event.by]),
    );
  } else {
    report.paragraph("Nothing recorded for this booking.", { muted: true });
  }

  report.save(`${base}.pdf`);
}
