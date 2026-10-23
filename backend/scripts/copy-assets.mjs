// tsc does not copy .sql files; the migration runner needs them next to the compiled code.
import { cpSync } from 'node:fs';
cpSync('src/db/migrations', 'dist/db/migrations', { recursive: true });
console.log('copied migrations');
