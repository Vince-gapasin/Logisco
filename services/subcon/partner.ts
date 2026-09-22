// How a partner trip records who is carrying it. Shared by the partner
// trips themselves and the foul-trip recovery that hands a trip to a partner.

import { normalizePhone } from "@/app/lib/bookingRules";

export interface PartnerChoice {
  subConID: string;
  driverName?: string | null;
  plateNumber?: string | null;
  contactNumber?: string | null;
  helpers?: string[];
}

/** The legacy note lines, kept so screens that read them still render. */
export function partnerNote(companyName: string, choice: PartnerChoice, extra?: string | null) {
  return [
    `Subcontractor: ${companyName}`,
    choice.driverName ? `External Driver: ${choice.driverName}` : null,
    choice.plateNumber ? `Temporary Plate: ${choice.plateNumber}` : null,
    choice.contactNumber ? `Driver Contact: ${choice.contactNumber}` : null,
    choice.helpers?.length ? `Helpers: ${choice.helpers.join(", ")}` : null,
    extra ?? null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function partnerColumns(choice: PartnerChoice) {
  return {
    subConID: choice.subConID,
    partnerDriver: choice.driverName?.trim() || null,
    partnerPlate: choice.plateNumber?.trim().toUpperCase() || null,
    partnerContact: choice.contactNumber ? (normalizePhone(choice.contactNumber) ?? choice.contactNumber.trim()) : null,
  };
}

