import "dotenv/config";
import { type Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/generated",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  tablesFilter: ["google-map-contrib_*"],
} satisfies Config;
