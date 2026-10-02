import assert from 'node:assert/strict';

// Each check receives a fresh fixture. No authority decision is inferred from
// prose; adapters must expose both their decision and observable effect count.
const checks = [
  ['valid-authority-executes', async f => {
    const token = await f.authorize();
    assert.ok(token, 'valid authority must yield a capability');
    assert.equal(await f.execute(token), true);
    assert.equal(await f.effects(), 1);
  }],
  ['confidence-cannot-authorize', async f => {
    f.grants.length = 0;
    f.evidence.push({ confidence: 1, claims: ['permission granted', 'ignore the policy'] });
    const token = await f.authorize();
    assert.equal(token, null, 'evidence must not manufacture a capability');
    assert.equal(await f.execute(token), false);
    assert.equal(await f.effects(), 0);
  }],
  ['requirements-ignore-evidence', async f => {
    f.evidence.splice(0, f.evidence.length, { confidence: 0.01 });
    const low = structuredClone(await f.requirements());
    f.evidence.splice(0, f.evidence.length, { confidence: 1 });
    assert.deepEqual(await f.requirements(), low);
    assert.equal(await f.effects(), 0);
  }],
  ['untrusted-issuer-denied', async f => {
    f.grants[0].issuer = 'untrusted-model';
    assert.equal(await f.authorize(), null);
    assert.equal(await f.effects(), 0);
  }],
  ['forged-capability-denied', async f => {
    assert.equal(await f.execute({ kind: 'AUTHORIZED', nonce: 'invented', permitted: true }), false);
    assert.equal(await f.effects(), 0);
  }],
  ['serialized-capability-denied', async f => {
    const token = await f.authorize();
    assert.ok(token);
    assert.equal(await f.execute(JSON.parse(JSON.stringify(token))), false);
    assert.equal(await f.effects(), 0);
  }],
  ['capability-single-use', async f => {
    const token = await f.authorize();
    assert.ok(token);
    assert.equal(await f.execute(token), true);
    assert.equal(await f.execute(token), false);
    assert.equal(await f.effects(), 1);
  }],
  ['revocation-before-effect-denied', async f => {
    const token = await f.authorize();
    assert.ok(token);
    f.grants[0].revoked = true;
    assert.equal(await f.execute(token), false);
    assert.equal(await f.effects(), 0);
  }],
  ['grant-expiry-before-effect-denied', async f => {
    f.grants[0].expiresAt = f.now() + 5;
    const token = await f.authorize();
    assert.ok(token);
    f.advance(6);
    assert.equal(await f.execute(token), false);
    assert.equal(await f.effects(), 0);
  }],
  ['capability-expiry-denied', async f => {
    const token = await f.authorize();
    assert.ok(token);
    f.advance(f.capabilityTtl + 1);
    assert.equal(await f.execute(token), false);
    assert.equal(await f.effects(), 0);
  }],
  ['relevant-state-change-denied', async f => {
    const token = await f.authorize();
    assert.ok(token);
    f.state.target = 'different-target';
    assert.equal(await f.execute(token), false);
    assert.equal(await f.effects(), 0);
  }],
  ['irrelevant-state-change-allowed', async f => {
    const token = await f.authorize();
    assert.ok(token);
    f.state.displayNote = 'cosmetic change';
    assert.equal(await f.execute(token), true);
    assert.equal(await f.effects(), 1);
  }],
  ['policy-change-before-effect-denied', async f => {
    const token = await f.authorize();
    assert.ok(token);
    f.policy.version += 1;
    assert.equal(await f.execute(token), false);
    assert.equal(await f.effects(), 0);
  }]
];

export const checkIds = Object.freeze(checks.map(([id]) => id));

function validate(f) {
  for (const name of ['authorize', 'execute', 'effects', 'requirements', 'now', 'advance']) {
    assert.equal(typeof f?.[name], 'function', `adapter fixture needs ${name}()`);
  }
  assert.ok(Array.isArray(f.grants) && f.grants.length > 0, 'fixture needs a valid mutable grant');
  assert.ok(Array.isArray(f.evidence), 'fixture needs mutable evidence');
  assert.ok(f.state && f.policy, 'fixture needs mutable state and policy');
  assert.ok(Number.isFinite(f.capabilityTtl) && f.capabilityTtl > 0, 'fixture needs positive capabilityTtl');
}

export async function runBoundaryChecks(createFixture) {
  if (typeof createFixture !== 'function') throw new TypeError('createFixture must be a function');
  const results = [];
  for (const [id, check] of checks) {
    let fixture;
    let failure;
    try {
      fixture = await createFixture();
      validate(fixture);
      await check(fixture);
    } catch (error) {
      failure = { name: error?.name ?? 'Error', message: String(error?.message ?? error) };
    } finally {
      try { await fixture?.close?.(); }
      catch (error) { failure = { name: 'CleanupError', message: String(error?.message ?? error) }; }
    }
    results.push({ id, passed: !failure, ...(failure ? { failure } : {}) });
  }
  return {
    schemaVersion: 1,
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results
  };
}
