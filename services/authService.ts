export interface AuthResponse {
  email: string;
  role: string;
  token: string;
  id: string;
  employeeName: string;
}

export const authenticateUser = async (
  emailInput: string,
  passwordInput: string
): Promise<AuthResponse | null> => {
  try {
    const response = await fetch(
      "/api/auth/login",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          email: emailInput,
          password: passwordInput,
        }),
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      email: data.email,
      role: data.role,
      token: data.token,
      id: data.employeeId,
      employeeName: data.employeeName,
    };

  } catch (error) {
    console.error(
      "Auth Service Error:",
      error
    );

    return null;
  }
};

// Add this to the bottom of services/authService.ts

export const validateToken = async (token: string): Promise<boolean> => {
  try {
    const response = await fetch("/api/auth/validate", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });
    
    // Returns true if the token is valid (status 200)
    return response.ok; 
  } catch (error) {
    console.error("Token validation failed:", error);
    return false;
  }
};