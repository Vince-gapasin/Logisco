import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

export const authenticateUser = async (emailInput: string, passwordInput: string) => {
  try {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email: emailInput,
      password: passwordInput,
    });

    // If Express sends back that beautiful 200 OK we just saw in your test
    if (response.status === 200 && response.data) {
      
      // We explicitly return the exact variables your Next.js login page is expecting
      return {
        email: response.data.email,
        role: response.data.role,
        token: response.data.token,
        id: response.data.employeeId
      };
    }
    
    return null;
  } catch (error) {
    console.error("Auth Service Error:", error);
    return null; // This tells the login page to show the "Invalid credentials" error
  }
};