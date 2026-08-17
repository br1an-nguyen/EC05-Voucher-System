import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

const possiblePaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'apps/api/.env'),
  path.resolve(__dirname, '..', '..', '.env'),
  path.resolve(__dirname, '..', '..', '..', '.env'),
];

for (const envPath of possiblePaths) {
  if (!fs.existsSync(envPath)) {
    continue;
  }

  config({ path: envPath, override: false, quiet: true });
  break;
}
