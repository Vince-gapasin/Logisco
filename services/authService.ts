// ==========================================
// This code snippet is a mock authentication service designed for local development and
// testing in a frontend application (specifically for this project).
// It simulates how users log into the system beforewe officially connect a live backend like Supabase.
// ==========================================
import { UserProfile } from "../types/auth";

const MOCK_USERS: UserProfile[] = [
  {
    id: "usr-001",
    email: "admin@gmail.com",
    password: "admin123",
    role: "admin",
    route: "/admindashboard/dashboard",
    label: "Admin",
  },
  {
    id: "usr-002",
    email: "coordinator@gmail.com",
    password: "coord123",
    role: "coordinator",
    route: "/coordinator",
    label: "Coordinator",
  },
  {
    id: "usr-003",
    email: "crew@gmail.com",
    password: "crew123",
    role: "crew",
    route: "/crew",
    label: "Crew",
  },
  {
    id: "usr-004",
    email: "mechanic@gmail.com",
    password: "mech123",
    role: "mechanic",
    route: "/mechanic",
    label: "Mechanic",
  },
];

export async function authenticateUser(
  emailInput: string,
  passwordInput: string,
): Promise<UserProfile | null> {
  // TODO: Swap this block with Supabase Auth later:
  // const { data, error } = await supabase.auth.signInWithPassword({ email: emailInput, password: passwordInput })

  return new Promise((resolve) => {
    setTimeout(() => {
      const matchedUser = MOCK_USERS.find(
        (u) =>
          u.email.toLowerCase() === emailInput.trim().toLowerCase() &&
          u.password === passwordInput,
      );

      if (matchedUser) {
        resolve(matchedUser);
      } else {
        resolve(null);
      }
    }, 600);
  });
}
