import { Router, Request, Response } from 'express';
import { supabase } from '../supabaseClient';

const router = Router();

// ==========================================
// 🛠️ HELPER: THE CLIENT SANITIZER
// ==========================================
const sanitizeClientData = (body: any, isUpdate: boolean = false) => {
  const { 
    company, contractType, status, contactName, 
    contact, businessAdd, emailAdd, contractStart, contractEnd, clientCode 
  } = body; // 🚀 Removed branchLoc completely!

  const safeCompany = company ? String(company).trim() : "UNKNOWN";
  const generatedCode = clientCode ? String(clientCode) : `CLI-${safeCompany.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6)}-${Math.floor(1000 + Math.random() * 9000)}`;

  // 🚀 Strict ENUM checking for Contract Type
  const validContracts = ["Regular", "On-Call", "Seasonal"];
  let dbContractType = contractType ? String(contractType).trim() : "Regular";
  if (!validContracts.includes(dbContractType)) {
    dbContractType = "Regular"; // Fallback to Regular if frontend sends something weird
  }

  const finalPayload: any = {
    company: safeCompany,
    contractType: dbContractType, 
    status: status ? String(status).trim() : "Active",
    contactName: contactName ? String(contactName).trim() : "",
    contact: contact ? String(contact).trim() : "",
    businessAdd: businessAdd ? String(businessAdd).trim() : "",
    emailAdd: emailAdd ? String(emailAdd).trim() : "",
    contractStart: contractStart ? String(contractStart).trim() : new Date().toISOString().split('T')[0],
    contractEnd: contractEnd ? String(contractEnd).trim() : new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
  };

  if (!isUpdate || !clientCode) {
    finalPayload.clientCode = generatedCode;
  }

  return finalPayload;
};

// ==========================================
// 1. GET ALL CLIENTS (With Warehouses & Branches attached!)
// ==========================================
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    // 🚀 Supabase Magic: Fetch Clients AND their Warehouses AND Branches in one query!
    const { data, error } = await supabase
      .from('Client')
      .select('*, Warehouse(*), Branch(*)')
      .eq('isActive', true) // Only get active clients
      .order('company', { ascending: true });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. CREATE A NEW CLIENT (POST)
// ==========================================
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    console.log(`\n[EXPRESS] 🟢 Incoming Client POST Request...`);
    const cleanData = sanitizeClientData(req.body, false);

    const { data, error } = await supabase.from('Client').insert([cleanData]).select();

    if (error) {
      console.error("[EXPRESS] ❌ Supabase Rejected Client POST:", error);
      return res.status(400).json({ error: error.message, details: error.details });
    }
    return res.status(201).json(data[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. UPDATE EXISTING CLIENT (PUT)
// ==========================================
router.put('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    console.log(`\n[EXPRESS] 🟡 Incoming Client PUT Request for ID: ${req.params.id}`);
    const cleanData = sanitizeClientData(req.body, true);

    const { data, error } = await supabase
      .from('Client')
      .update(cleanData)
      .eq('clientID', req.params.id)
      .select();

    if (error) {
      console.error("[EXPRESS] ❌ Supabase Rejected Client PUT:", error);
      return res.status(400).json({ error: error.message, details: error.details });
    }
    return res.status(200).json(data ? data[0] : {});
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. SOFT DELETE CLIENT (Don't destroy history!)
// ==========================================
router.delete('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    console.log(`\n[EXPRESS] 🔴 Soft-Deleting Client ID: ${req.params.id}`);
    
    // Instead of deleting, we set isActive to false so old Orders don't break
    const { data, error } = await supabase
      .from('Client')
      .update({ isActive: false })
      .eq('clientID', req.params.id)
      .select();

    if (error) throw error;
    return res.status(200).json({ message: "Client archived successfully", record: data[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. ADD WAREHOUSE (PICKUP) TO A CLIENT
// ==========================================
router.post('/:id/warehouses', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params; // The Client's ID
    const { whName, warehouseLoc, contactPerson, contactNum } = req.body;

    const warehouseData = {
      clientID: id,
      whName: whName ? String(whName).trim() : "Main Hub",
      warehouseLoc: warehouseLoc ? String(warehouseLoc).trim() : "",
      contactPerson: contactPerson ? String(contactPerson).trim() : "",
      contactNum: contactNum ? String(contactNum).trim() : ""
    };

    const { data, error } = await supabase.from('Warehouse').insert([warehouseData]).select();

    if (error) throw error;
    return res.status(201).json(data[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. ADD BRANCH (DELIVERY) TO A CLIENT
// ==========================================
router.post('/:id/branches', async (req: Request, res: Response): Promise<any> => {
  try {
    console.log(`\n[EXPRESS] 🟢 Incoming BRANCH POST Request for Client: ${req.params.id}`);
    console.log(`[EXPRESS] Raw Branch Data from Frontend:`, req.body);

    const { id } = req.params;
    const { branchName, deliveryAddress, contactPerson, contactNumber } = req.body;

    const branchData = {
      clientID: id,
      branchName: branchName ? String(branchName).trim() : "Main Branch",
      deliveryAddress: deliveryAddress ? String(deliveryAddress).trim() : "",
      contactPerson: contactPerson ? String(contactPerson).trim() : "",
      contactNumber: contactNumber ? String(contactNumber).trim() : ""
    };

    const { data, error } = await supabase.from('Branch').insert([branchData]).select();

    if (error) {
      console.error("[EXPRESS] ❌ Supabase Rejected BRANCH POST:", error);
      return res.status(400).json({ error: error.message, details: error.details });
    }
    
    console.log(`[EXPRESS] ✅ Branch Saved to Database!`);
    return res.status(201).json(data[0]);
  } catch (err: any) {
    console.error("[EXPRESS] ❌ Server Crashed on BRANCH POST:", err);
    return res.status(500).json({ error: err.message });
  }
});
export default router;