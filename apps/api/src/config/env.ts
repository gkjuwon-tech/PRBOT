import "dotenv/config";
import { z } from "zod";

const Env = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  API_PORT: z.coerce.number().default(8787),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_FAST_MODEL: z.string().default("gemini-3.5-flash"),
  GEMINI_PRO_MODEL: z.string().default("gemini-3.1-pro"),
  GEMINI_EMBED_MODEL: z.string().default("text-embedding-004"),
  SECRET_BOX_KEY: z.string().min(16),
  AGENT_MAX_STEPS: z.coerce.number().default(240),
  AGENT_DEFAULT_TIMEOUT_HOURS: z.coerce.number().default(12)
});

export const env = Env.parse(process.env);
