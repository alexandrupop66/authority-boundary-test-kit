import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { runBoundaryChecks, checkIds } from '../src/index.mjs';
import { createFixture } from '../examples/reference-adapter.mjs';

test('correct reference passes every contract', async () => {
  const report = await runBoundaryChecks(createFixture);
  assert.equal(report.total, 13);
  assert.equal(report.passed, 13);
  assert.equal(report.failed, 0);
  assert.equal(new Set(checkIds).size, 13);
});

const mutations = {
  confidence: 'confidence-cannot-authorize',
  issuer: 'untrusted-issuer-denied',
  forgery: 'forged-capability-denied',
  replay: 'capability-single-use',
  revocation: 'revocation-before-effect-denied',
  'grant-expiry': 'grant-expiry-before-effect-denied',
  'capability-expiry': 'capability-expiry-denied',
  state: 'relevant-state-change-denied',
  policy: 'policy-change-before-effect-denied'
};
for (const [fault, expectedFailure] of Object.entries(mutations)) {
  test(`detects injected ${fault} defect`, async () => {
    const report = await runBoundaryChecks(() => createFixture({ fault }));
    assert.equal(report.results.find(r => r.id === expectedFailure).passed, false);
    assert.ok(report.failed > 0);
  });
}

test('fresh fixture for each check and cleanup always runs', async () => {
  let created = 0;
  let closed = 0;
  const report = await runBoundaryChecks(() => {
    created += 1;
    return { ...createFixture(), close() { closed += 1; } };
  });
  assert.equal(report.failed, 0);
  assert.equal(created, 13);
  assert.equal(closed, 13);
});

test('adapter exceptions are failures and later checks still run', async () => {
  const report = await runBoundaryChecks(() => { throw new Error('fixture unavailable'); });
  assert.equal(report.failed, 13);
  assert.equal(report.results[12].failure.message, 'fixture unavailable');
});

test('malformed fixture cannot earn PASS', async () => {
  const report = await runBoundaryChecks(() => ({}));
  assert.equal(report.failed, 13);
});

test('cleanup errors invalidate results', async () => {
  const report = await runBoundaryChecks(() => ({ ...createFixture(), close() { throw new Error('cleanup failed'); } }));
  assert.equal(report.failed, 13);
  assert.equal(report.results[0].failure.name, 'CleanupError');
});

test('CLI returns machine-readable success report', () => {
  const report = JSON.parse(execFileSync(process.execPath, ['src/cli.mjs', 'examples/reference-adapter.mjs'], { encoding: 'utf8' }));
  assert.equal(report.passed, 13);
});

test('CLI returns exit 1 for vulnerable executor and exit 2 for invalid invocation', () => {
  const bad = spawnSync(process.execPath, ['src/cli.mjs', 'examples/vulnerable-adapter.mjs'], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.ok(JSON.parse(bad.stdout).failed > 0);
  assert.equal(spawnSync(process.execPath, ['src/cli.mjs']).status, 2);
  assert.equal(spawnSync(process.execPath, ['src/cli.mjs', 'missing.mjs']).status, 2);
});
