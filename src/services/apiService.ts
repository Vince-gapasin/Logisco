// src/services/apiService.ts

// If running on a physical phone, you must change this to your computer's 
// local IP address (e.g., http://192.168.1.33:3001) instead of localhost.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export const apiService = {
  // Generic POST request handler
  post: async (endpoint: string, data: any) => {
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response.json();
  },
  
  // Generic GET request handler
  get: async (endpoint: string) => {
    const response = await fetch(`${BACKEND_URL}${endpoint}`);
    return response.json();
  }
};