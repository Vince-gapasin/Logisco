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

export async function createSubcontractor(payload: any) {
  const { companyName, contactPerson } = payload;

  if (!companyName || !contactPerson) {
    throw new Error("Company Name and Contact Person are required.");
  }
  const contactNumber = partnerPhone(payload.contactNumber);

  const { data, error } = await supabase
    .from("SubContractor")
    .insert([{ 
      companyName, 
      contactName: contactPerson, // Maps JSON to DB 'contactName' just like your Express route
      contactNumber 
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateSubcontractor(id: string, payload: any) {
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

export async function deleteSubcontractor(id: string) {
  const { error } = await supabase.from("SubContractor").delete().eq("subConID", id);
  if (error) throw new Error(error.message);
  return true;
}