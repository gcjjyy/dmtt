import postgres from "postgres";
import "dotenv/config";

// PostgreSQL connection
// Set DATABASE_URL environment variable with your connection string
// Example: postgresql://user:password@host:port/database
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

export const sql = postgres(connectionString, {
  max: 10, // Maximum number of connections
  idle_timeout: 20,
  connect_timeout: 10,
});

// Helper function to test connection
export async function testConnection() {
  try {
    await sql`SELECT NOW()`;
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}
