import { join } from "node:path";

export const PROJECT_ROOT = process.cwd();
export const DEFAULT_JOBS_ROOT = process.env.JOBS_ROOT || join(PROJECT_ROOT, "data", "jobs");
