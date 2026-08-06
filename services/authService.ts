import axios from "axios";
import { UserProfile } from "../types/auth"; // Keep their original type import

// Point to your Express backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

export async function authenticateUser(
  emailInput: string,
  passwordInput: string,
): Promise<UserProfile | null> {
  try {
    // 1. Send the real login request to your Express server!
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email: emailInput,
      password: passwordInput,
    });

    // 2. Grab the real Supabase session token
    const session = response.data.session;

    if (session) {
      // 3. Keep the UI happy: Determine the route based on the email
      // (Later, we will upgrade your backend to fetch the real Role from the Employee table!)
      let userRoute = "/coordinator"; 
      let userRole = "coordinator";
      let userLabel = "Coordinator";

      const emailLower = emailInput.toLowerCase();
      if (emailLower.includes("admin")) {
        userRoute = "/admindashboard/dashboard";
        userRole = "admin";
        userLabel = "Admin";
      } else if (emailLower.includes("crew")) {
        userRoute = "/crew";
        userRole = "crew";
        userLabel = "Crew";
      } else if (emailLower.includes("mechanic")) {
        userRoute = "/mechanic";
        userRole = "mechanic";
        userLabel = "Mechanic";
      }

      // 4. Return the exact object structure the frontend UI expects
      return {
        id: session.user.id,        // The real, secure Supabase UUID
        email: emailInput,
        password: "",               // NEVER keep the real password in memory
        role: userRole,
        route: userRoute,           // This makes the UI redirect work!
        label: userLabel,
        token: session.access_token // Save the token so we can use it for other API calls later
      } as any; 
    }

    return null;
  } catch (error) {
    // If Express sends an error (like Wrong Password), return null to trigger the UI's red error box
    console.error("Live Login failed:", error);
    return null;
  }
}