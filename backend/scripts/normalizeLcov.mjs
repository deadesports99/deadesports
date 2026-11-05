/**
 * Node's built-in coverage writes Windows paths (`src\config\env.ts`) relative
 * to the backend folder. SonarCloud needs POSIX paths relative to the repo
 * root (`backend/src/config/env.ts`), otherwise the report is silently ignored.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const RAW = 'coverage/lcov.raw.info';
const OUT = 'coverage/lcov.info';
const BACKSLASH = String.fromCharCode(92);

const text = readFileSync(RAW, 'utf8');
const fixed = text
  .split(String.fromCharCode(10))
  .map((line) => {
    if (!line.startsWith('SF:')) return line;
    const posix = line.slice(3).split(BACKSLASH).join('/').replace(/^\.?\//, '');
    // The test files themselves are not production code — keep them out of the report.
    if (posix.startsWith('tests/')) return '';
    // Prisma client is generated code — Sonar excludes it, so keep it out too.
    if (posix.startsWith('src/generated/')) return '';
    return `SF:backend/${posix}`;
  })
  .join(String.fromCharCode(10));

writeFileSync(OUT, fixed);
const files = fixed.split(String.fromCharCode(10)).filter((l) => l.startsWith('SF:')).length;
console.log(`✅ lcov normalised: ${files} files -> ${OUT}`);
