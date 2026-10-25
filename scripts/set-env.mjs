// Genera src/environments/runtime-env.ts a partir de variables de entorno
// (Vercel → Project Settings → Environment Variables) o de un fichero .env local.
// Así ninguna clave queda escrita en el repositorio.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envFile = resolve('.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const url = process.env.SUPABASE_URL ?? '';
const key = process.env.SUPABASE_ANON_KEY ?? '';
const out = resolve('src/environments/runtime-env.ts');

writeFileSync(
  out,
  `// Fichero GENERADO por scripts/set-env.mjs — no editar ni subir a Git\n` +
    `export const runtimeEnv = {\n  supabaseUrl: ${JSON.stringify(url)},\n  supabaseAnonKey: ${JSON.stringify(key)},\n};\n`,
);
console.log(`[set-env] runtime-env.ts generado (${url ? 'Supabase configurado' : 'SIN configuración de Supabase'})`);
