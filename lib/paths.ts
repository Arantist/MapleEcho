import { join } from "node:path";
import { tmpdir } from "node:os";

export const PROJECT_ROOT = process.cwd();
export const DEFAULT_JOBS_ROOT = process.env.JOBS_ROOT
  || (process.env.VERCEL ? join(tmpdir(), "local-stem-splitter", "jobs") : join(PROJECT_ROOT, "data", "jobs"));
export const DEFAULT_PYTHON = process.env.PYTHON_BIN || ".venv/bin/python";
