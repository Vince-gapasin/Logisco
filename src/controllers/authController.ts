import { Router, Request, Response } from 'express';
import { supabase } from '../supabaseClient';

const router = Router();

// ==========================================
// 1. REGISTER NEW STAFF MEMBER
// ==========================================
router.post('/register', async (req: Request, res: Response): Promise<any> => {
  const { email, password, employeeName, role, address, contact } = req.body;

  try {
    // A. Create the secure user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) return res.status(400).json({ error: authError.message });
    if (!authData.user) return res.status(400).json({ error: "Failed to create Auth User" });

    // B. Generate the readable Human ID (e.g., EMP-4928)
    const employeeCode = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;

    // C. Save their profile to the Employee table (linking the secure auth_id)
    const { data: employeeData, error: dbError } = await supabase
      .from('Employee')
      .insert([{
        auth_id: authData.user.id, // The secure link!
        employeeCode,
        employeeName,
        role,
        availability: 'Available',
        healthStatus: 'Fit to Work',
        address,
        contact
      }])
      .select()
      .single();

    if (dbError) return res.status(400).json({ error: dbError.message });

    return res.status(201).json({ 
      message: "Staff registered successfully!", 
      user: employeeData 
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// ==========================================
// LOGIN ROUTE (UPGRADED WITH ROLE FETCHING)
// ==========================================
router.post('/login', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    // 1. Check Layer 1: Verify credentials in the Auth Vault
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return res.status(401).json({ error: authError.message });
    }

    // 2. Check Layer 2: Grab their official HR profile using their unique Auth ID
    const { data: employeeData, error: empError } = await supabase
      .from('Employee')
      .select('*')
      .eq('auth_id', authData.user?.id)
      .single(); // We only expect one match

    // 3. Package it ALL together and send it to Next.js
    return res.status(200).json({
      message: "Login successful",
      token: authData.session?.access_token,
      email: authData.user?.email,
      role: employeeData ? employeeData.role : null, // Next.js needs this!
      employeeId: employeeData ? employeeData.employeeID : null
    });

  } catch (err: any) {
    console.error("Login Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;