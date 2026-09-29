import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

export const stateDirectory = process.env.MENU_STATE_DIR || '.menu-state';
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export async function readState(key, directory = stateDirectory) {
  try { return JSON.parse(await readFile(join(directory, `${key}.json`), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
export async function saveState(key, value, directory = stateDirectory) {
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${key}.json`);
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2) + '\n');
  await rename(`${path}.tmp`, path);
}

// Version this namespace whenever extraction/review semantics change.
export async function checkpoint(args, invoke, { force = false, directory = stateDirectory, accept = () => true } = {}) {
  const key = `request-${digest(JSON.stringify({ version: 1, ...args }))}`;
  const previous = force ? null : await readState(key, directory);
  if (previous) return previous;
  const result = await invoke();
  if (accept(result)) await saveState(key, result, directory);
  else await saveState(`rejected-${key}`, result, directory);
  return result;
}

export async function runPrograms(ids, update) {
  const results = [];
  for (const id of ids) {
    try { results.push({ id, status: await update(id) ? 'updated' : 'unchanged' }); }
    catch (error) { results.push({ id, status: 'failed', error: error.message }); }
  }
  return results;
}
