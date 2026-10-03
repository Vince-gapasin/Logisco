import { supabase } from "@/app/lib/supabase";
import { normalizePhone, PHONE_RULE } from "@/app/lib/bookingRules";

export async function getAllSubcontractors() {
  const { data, error } = await supabase
    .from("SubContractor")
    .select("*")
    .order("companyName", { ascending: true }); // Alphabetical order for your dropdowns

  if (error) throw new Error(error.message);
  return data;
}

// A partner number follows the same rule as every other phone number:
// an 11-digit mobile, stored as 09XXXXXXXXX.
function partnerPhone(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = normalizePhone(String(value));
  if (!normalized) throw new Error(PHONE_RULE);
  return normalized;
}

export async function createSubcontractor(payload: Record<string, unknown>) {
  const { companyName, contactPerson } = payload;

  if (!companyName || !contactPerson) {
    throw new Error("Company Name and Contact Person are required.");
  }
  const contactNumber = partnerPhone(payload.contactNumber);

  // Everything the form collects. This saved the name, contact and phone only,
  // so a partner's contract type, email and address were lost the moment it
  // was added - and the edit form then showed them blank.
  const { data, error } = await supabase
    .from("SubContractor")
    .insert([{
      companyName,
      contactName: contactPerson, // Maps JSON to DB 'contactName' just like your Express route
      contactNumber,
      contractType: payload.contractType || null,
      emailAddress: payload.emailAddress || null,
      businessAddress: payload.businessAddress || null,
      isActive: true,
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateSubcontractor(id: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("SubContractor")
    .update({
      companyName: payload.companyName,
      contractType: payload.contractType,
      contactName: payload.contactPerson,
      contactNumber: partnerPhone(payload.contactNumber),
      emailAddress: payload.emailAddress,
      businessAddress: payload.businessAddress
    })
    .eq("subConID", id) // or "id", depends on your exact schema
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// Deactivates rather than deletes, as a client is. A partner's trips point at
// it with ON DELETE SET NULL, so removing the row erased which partner had
// carried every one of them - and the Sub-con Trips report with it. Inactive,
// it stops being offered for new bookings and its history stays whole.
export async function deleteSubcontractor(id: string) {
  const { error } = await supabase.from("SubContractor").update({ isActive: false }).eq("subConID", id);
  if (error) throw new Error(error.message);
  return true;
}