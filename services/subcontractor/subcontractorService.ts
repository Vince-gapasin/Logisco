import { supabase } from "@/app/lib/supabase";

export async function getAllSubcontractors() {
  const { data, error } = await supabase
    .from("SubContractor")
    .select("*")
    .order("companyName", { ascending: true }); // Alphabetical order for your dropdowns

  if (error) throw new Error(error.message);
  return data;
}

export async function createSubcontractor(payload: any) {
  const { companyName, contactPerson, contactNumber } = payload;

  if (!companyName || !contactPerson) {
    throw new Error("Company Name and Contact Person are required.");
  }

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
      contactNumber: payload.contactNumber,
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