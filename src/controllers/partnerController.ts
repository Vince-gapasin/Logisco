import { Router, Request, Response } from 'express';
import { supabase } from '../supabaseClient';

const router = Router();

const sanitizePartnerData = (body: any) => {
  const { name, contractType, contactPerson, contactNumber, emailAddress, businessAddress } = body;

  // Enforce Database ENUMs
  const validContracts = ["Regular", "On-Call", "Seasonal"];
  let dbContractType = contractType ? String(contractType).trim() : "Regular";
  if (!validContracts.includes(dbContractType)) {
    dbContractType = "Regular"; 
  }

  return {
    companyName: name ? String(name).trim() : "UNKNOWN",
    contractType: dbContractType,
    contactName: contactPerson ? String(contactPerson).trim() : "",
    contactNumber: contactNumber ? String(contactNumber).trim() : "",
    emailAddress: emailAddress ? String(emailAddress).trim() : "",
    businessAddress: businessAddress ? String(businessAddress).trim() : "",
    isActive: true
  };
};

// ==========================================
// 1. GET ALL PARTNERS
// ==========================================
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const { data, error } = await supabase
      .from('SubContractor')
      .select('*')
      .eq('isActive', true)
      .order('companyName', { ascending: true });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. CREATE A NEW PARTNER
// ==========================================
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    console.log(`\n[EXPRESS] 🟢 Incoming Partner POST Request...`);
    const cleanData = sanitizePartnerData(req.body);

    const { data, error } = await supabase.from('SubContractor').insert([cleanData]).select();

    if (error) {
      console.error("[EXPRESS] ❌ Supabase Rejected Partner POST:", error);
      return res.status(400).json({ error: error.message, details: error.details });
    }
    console.log(`[EXPRESS] ✅ Partner Saved!`);
    return res.status(201).json(data[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;