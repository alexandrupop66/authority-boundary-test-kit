#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runBoundaryChecks } from './index.mjs';

const args = process.argv.slice(2);
if (args.length !== 1 || args[0].startsWith('-')) {
  console.error('Usage: authority-boundary-check <trusted-local-adapter.mjs>');
  process.exitCode = 2;
} else {
  try {
    const adapter = await import(pathToFileURL(resolve(args[0])).href);
    const report = await runBoundaryChecks(adapter.createFixture);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.failed === 0 ? 0 : 1;
  } catch (error) {
    console.error(`Adapter error: ${error.message}`);
    process.exitCode = 2;
  }
}
