/**
 * Python Interpreter Detection Utility
 *
 * Automatically detects the Python interpreter to use:
 * 1. Checks for virtual environment (venv/) in project root
 * 2. Falls back to system Python if venv not found
 * 3. Handles cross-platform differences (Windows/Unix)
 * 4. Caches result for performance
 */

import { join } from "path";
import { existsSync } from "fs";
import { $ } from "bun";

// Cache the resolved Python path
let cachedPythonPath: string | null = null;

/**
 * Detect the Python interpreter to use
 *
 * Priority:
 * 1. Virtual environment (venv/) in project root
 * 2. System Python (python3, python, python.exe)
 *
 * @returns Path to Python interpreter
 * @throws Error if no valid Python interpreter found
 */
export async function getPythonInterpreter(): Promise<string> {
  if (cachedPythonPath) return cachedPythonPath;

  // Get project root (packages/new-detection-processing/)
  // import.meta.dir is src/utils/, so go up two levels
  const projectRoot = join(import.meta.dir, "..", "..");

  // Try venv first
  const venvPath = await findVenvPython(projectRoot);
  if (venvPath) {
    console.log(`   Using Python from venv: ${venvPath}`);
    cachedPythonPath = venvPath;
    return venvPath;
  }

  // Fallback to system Python
  console.warn(`   ⚠️  Virtual environment not found at ${projectRoot}/venv`);
  console.warn(`   Falling back to system Python (may not have required packages)`);
  console.warn(`   Run: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt`);

  const systemPython = await findSystemPython();
  if (systemPython) {
    cachedPythonPath = systemPython;
    return systemPython;
  }

  throw new Error(
    "No Python interpreter found. Please install Python 3.8+ or create a virtual environment.\n" +
    "Setup: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
  );
}

/**
 * Find Python in virtual environment
 */
async function findVenvPython(projectRoot: string): Promise<string | null> {
  const venvDir = join(projectRoot, "venv");

  if (!existsSync(venvDir)) {
    return null;
  }

  // Windows: venv\Scripts\python.exe
  if (process.platform === "win32") {
    const candidates = [
      join(venvDir, "Scripts", "python.exe"),
      join(venvDir, "Scripts", "python3.exe"),
    ];

    for (const path of candidates) {
      if (existsSync(path)) return path;
    }
  }
  // Unix (macOS, Linux): venv/bin/python3 or venv/bin/python
  else {
    const candidates = [
      join(venvDir, "bin", "python3"),
      join(venvDir, "bin", "python"),
    ];

    for (const path of candidates) {
      if (existsSync(path)) return path;
    }
  }

  return null;
}

/**
 * Find system Python
 */
async function findSystemPython(): Promise<string | null> {
  const candidates = process.platform === "win32"
    ? ["python", "python3", "py"]
    : ["python3", "python"];

  for (const cmd of candidates) {
    try {
      // Check if command exists and is Python 3+
      const { exitCode } = await $`${cmd} --version`.quiet();
      if (exitCode === 0) {
        return cmd;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Reset cached Python path (useful for testing)
 */
export function resetPythonCache(): void {
  cachedPythonPath = null;
}
