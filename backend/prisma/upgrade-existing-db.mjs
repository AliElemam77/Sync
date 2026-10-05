// One command to bring an existing database up to date (see MIGRATIONS.md): `npm run db:upgrade`
//
// 1. Backs up every table to backups/<timestamp>/ as JSON (the folder is git-ignored)
// 2. If the migration history is not baselined yet, checks that the database matches the baseline
//    schema (read-only) and records 0_init as applied. It stops if the database differs.
// 3. Applies the pending migrations (prisma migrate deploy)
// 4. Regenerates the Prisma client
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import prismaClient from '@prisma/client';

const { PrismaClient } = prismaClient;
const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_COMMIT = 'bff0ffd';
const BASELINE_MIGRATION = '0_init';

function step(title) {
  console.log(`\n=== ${title}`);
}

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function prisma(args, { capture = false } = {}) {
  const result = spawnSync('npx', ['prisma', ...args], {
    cwd: backendDir,
    shell: process.platform === 'win32',
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
  return { code: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

const toJson = (_key, value) => {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64');
  return value;
};

async function backup(db) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(backendDir, 'backups', stamp);
  mkdirSync(dir, { recursive: true });

  const tables = await db.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name`;
  for (const { table_name: table } of tables) {
    const rows = await db.$queryRawUnsafe(`SELECT * FROM "public"."${table.replace(/"/g, '""')}"`);
    writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows, toJson, 2));
    console.log(`  ${table}: ${rows.length} row(s)`);
  }
  return dir;
}

async function appliedMigrations(db) {
  try {
    const rows = await db.$queryRaw`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    return new Set(rows.map((r) => r.migration_name));
  } catch {
    return new Set(); // no migration history table yet
  }
}

const db = new PrismaClient();
try {
  step('1/4 Backing up the database');
  const backupDir = await backup(db);
  console.log(`  Saved to ${backupDir}`);

  step('2/4 Checking the migration history');
  if ((await appliedMigrations(db)).has(BASELINE_MIGRATION)) {
    console.log(`  ${BASELINE_MIGRATION} is already recorded; nothing to baseline.`);
  } else {
    const git = spawnSync('git', ['show', `${BASELINE_COMMIT}:backend/prisma/schema.prisma`], {
      cwd: backendDir,
      encoding: 'utf8',
    });
    if (git.status !== 0) fail(`Could not read the baseline schema from git: ${git.stderr}`);
    const baselineFile = join(tmpdir(), `sync-baseline-${Date.now()}.prisma`);
    writeFileSync(baselineFile, git.stdout);

    const diffArgs = [
      'migrate', 'diff',
      '--from-schema-datasource', 'prisma/schema.prisma',
      '--to-schema-datamodel', baselineFile,
    ];
    const check = prisma([...diffArgs, '--exit-code'], { capture: true });
    if (check.code === 2) {
      const diff = prisma([...diffArgs, '--script'], { capture: true });
      rmSync(baselineFile, { force: true });
      fail(
        'The database differs from the baseline schema, so nothing was changed.\n' +
          'Send this output to the developer:\n\n' + diff.output,
      );
    }
    rmSync(baselineFile, { force: true });
    if (check.code !== 0) fail(`The read-only check failed:\n${check.output}`);

    console.log('  The database matches the baseline. Recording it as applied (no table is changed).');
    if (prisma(['migrate', 'resolve', '--applied', BASELINE_MIGRATION]).code !== 0) {
      fail('Could not record the baseline.');
    }
  }
} finally {
  await db.$disconnect();
}

step('3/4 Applying pending migrations');
if (prisma(['migrate', 'deploy']).code !== 0) {
  fail('A migration failed. The backup folder above has the data from before. Send this output to the developer.');
}

step('4/4 Regenerating the Prisma client');
if (prisma(['generate']).code !== 0) {
  console.warn('\n! The database is up to date, but the client was not regenerated.');
  console.warn('  Stop the running backend, then run: npx prisma generate');
} else {
  console.log('\n✔ Done. Start the backend again.');
}
