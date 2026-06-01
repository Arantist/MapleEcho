import { join } from "node:path";

export const PROJECT_ROOT = process.cwd();
export const DEFAULT_JOBS_ROOT = join(PROJECT_ROOT, "data", "jobs");
export const DEFAULT_PYTHON = process.env.PYTHON_BIN || ".venv/bin/python";
