// One delivery, on its own, as a PDF or a CSV.
//
// The Reports export is a list: a line per booking, for a period. This is the
// other thing the office is asked for - everything about one delivery, to send
// to the client who is asking about it or to file with its paperwork. So it
// carries what the booking record shows: who it was for, where it went, who
// took it, and what happened at each stop.
//
// Built from the same mapper as the record on screen, so the file and the
// screen cannot say different things about the same booking.

import { mapOrderToBookingView, toFeedBooking, type OrderWithRelations } from "@/app/lib/bookingView";
import { downloadCsv, type CsvValue } from "@/app/lib/csvExport";
import { formatDateTime, formatTime } from "@/app/lib/datetime";
import { bookingStatusLabel } from "@/app/lib/statusLabels";

export type ExportFormat = "pdf" | "csv";

function orDash(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value).trim();
  return text || "-";
}

function when(value: string | null | undefined): string {
  return value ? formatDateTime(value) : "-";
}

function describe(order: OrderWithRelations) {
  const view = mapOrderToBookingView(order);
  const booking = toFeedBooking(view);

  const summary: [string, string][] = [
    ["Order ID", orDash(view.orderId)],
    ["Final status", orDash(bookingStatusLabel(booking.confirmationStatus))],
    ["Delivery date", orDash(view.displayDate)],
    ["Date created", orDash(view.dateCreated)],
    ["Created by", orDash(view.createdBy)],
    ["Priority", orDash(view.priorityLevel)],
    ["Product", orDash(view.product)],
    ["Total quantity", orDash(view.totalQuantity)],
    ["Completed at", when(view.completedAt)],
  ];

  const client: [string, string][] = [
    ["Client", orDash(view.clientName)],
    ["Contact person", orDash(view.contactPerson)],
    ["Contact number", orDash(view.contactNumber)],
    ["Email", orDash(view.emailAddress)],
    ["Business address", orDash(view.businessAddress)],
  ];

  const crew: [string, string, string, string][] = [
    ...(view.subconPartner ? [["Sub-con partner", view.subconPartner, "", ""] as [string, string, string, string]] : []),
    ["Truck", orDash([view.truckPlate, view.truckModel].filter(Boolean).join(" - ")), "", ""],
    ...view.crews.map(
      (member) => [member.role, orDash(member.name), orDash(member.status), member.reason || ""] as [string, string, string, string],
    ),
  ];

  const pickups = view.pickups.map((stop) => [
    String(stop.sequence),
    orDash(stop.warehouseName),
    orDash(stop.pickupAddress),
    orDash([stop.contactPerson, stop.contactNum].filter(Boolean).join(" / ")),
    orDash(formatTime(stop.expectedTime)),
    orDash(stop.quantity),
    orDash(stop.status),
    when(stop.completedAt),
  ]);

  const deliveries = view.stops.map((stop) => [
    String(stop.sequence),
    orDash(stop.branchName),
    orDash(stop.deliveryAddress || view.businessAddress),
    orDash([stop.contactPerson, stop.contactNum].filter(Boolean).join(" / ")),
    orDash(formatTime(stop.expectedTime)),
    orDash(stop.quantity),
    orDash(stop.status),
    when(stop.completedAt),
    orDash(stop.proofs[0]?.receiverName),
  ]);

  const remarks = view.remarks.map((remark) => [
    orDash(remark.dateTime),
    orDash([remark.staff, remark.role].filter(Boolean).join(" - ")),
    orDash(remark.details),
  ]);

  return {
    view,
    booking,
    summary,
    client,
    crew,
    pickups,
    deliveries,
    remarks,
    reason: booking.foulDetails?.description || view.rejectionReason || "",
  };
}

export async function exportDelivery(order: OrderWithRelations, format: ExportFormat): Promise<void> {
  const record = describe(order);
  const { toFileSlug } = await import("@/app/lib/pdfReport");
  const generatedAt = formatDateTime(new Date().toISOString());
  const base = `delivery-${toFileSlug(record.view.orderId || "record")}`;

  if (format === "csv") {
    // In sections, as the record reads, with a blank row between them: one
    // delivery is a document, not a table of like rows.
    const rows: CsvValue[][] = [
      ["Delivery Record", record.view.orderId],
      ["Generated", generatedAt],
      [],
      ...record.summary,
      [],
      ["Client"],
      ...record.client,
      [],
      ["Crew and truck"],
      ["Role", "Name", "Status", "Reason"],
      ...record.crew,
      [],
      ["Pickups"],
      ["#", "Warehouse", "Address", "Contact", "Expected", "Qty", "Status", "Done at"],
      ...record.pickups,
      [],
      ["Deliveries"],
      ["#", "Branch", "Address", "Contact", "Expected", "Qty", "Status", "Done at", "Received by"],
      ...record.deliveries,
    ];
    if (record.reason) rows.push([], ["Why it did not finish", record.reason]);
    if (record.view.plainNotes) rows.push([], ["Notes", record.view.plainNotes]);
    if (record.remarks.length) rows.push([], ["Remarks"], ["When", "By", "Details"], ...record.remarks);

    downloadCsv(`${base}.csv`, rows);
    return;
  }

  const { startReport } = await import("@/app/lib/pdfReport");
  const report = await startReport({
    title: `Delivery Record - ${record.view.orderId}`,
    // Landscape for the stop tables, which have the most columns of anything here.
    orientation: "landscape",
    meta: [`Client: ${record.view.clientName || "-"}`, `Generated ${generatedAt}`],
  });

  report.figures([
    { label: "Final status", value: bookingStatusLabel(record.booking.confirmationStatus) || "-" },
    { label: "Delivery date", value: record.view.displayDate || "-" },
    { label: "Priority", value: record.view.priorityLevel || "-" },
    { label: "Quantity", value: record.view.totalQuantity || "-" },
  ]);

  const pairs = [{ header: "Field", width: 50 }, { header: "Value", width: 217 }];

  report.section("Booking");
  report.table(pairs, record.summary);

  report.section("Client");
  report.table(pairs, record.client);

  report.section("Crew and truck");
  report.table(
    [
      { header: "Role", width: 45 },
      { header: "Name", width: 70 },
      { header: "Status", width: 40 },
      { header: "Reason", width: 112 },
    ],
    record.crew,
  );

  const stopColumns = (nameHeader: string, withReceiver: boolean) => [
    { header: "#", width: 8 },
    { header: nameHeader, width: withReceiver ? 38 : 45 },
    { header: "Address", width: withReceiver ? 70 : 85 },
    { header: "Contact", width: 40 },
    { header: "Expected", width: 18 },
    { header: "Qty", width: 12, align: "right" as const },
    { header: "Status", width: 22 },
    { header: "Done at", width: withReceiver ? 32 : 37 },
    ...(withReceiver ? [{ header: "Received by", width: 27 }] : []),
  ];

  if (record.pickups.length) {
    report.section("Pickups", `${record.pickups.length} stop${record.pickups.length === 1 ? "" : "s"}`);
    report.table(stopColumns("Warehouse", false), record.pickups);
  }

  report.section("Deliveries", `${record.deliveries.length} stop${record.deliveries.length === 1 ? "" : "s"}`);
  if (record.deliveries.length) {
    report.table(stopColumns("Branch", true), record.deliveries);
  } else {
    report.paragraph("No delivery stops recorded.", { muted: true });
  }

  if (record.reason) {
    report.section("Why it did not finish", undefined, 8);
    report.paragraph(record.reason);
  }

  if (record.view.plainNotes) {
    report.section("Notes", undefined, 8);
    report.paragraph(record.view.plainNotes);
  }

  if (record.remarks.length) {
    report.section("Remarks");
    report.table(
      [
        { header: "When", width: 45 },
        { header: "By", width: 60 },
        { header: "Details", width: 162 },
      ],
      record.remarks,
    );
  }

  report.save(`${base}.pdf`);
}
