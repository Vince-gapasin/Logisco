import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests for the logic that decides what the system does: status rules,
// the mapping from database rows to what each screen renders, and the
// parsing of the free text older bookings still carry. Nothing here touches
// Supabase or the network.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
