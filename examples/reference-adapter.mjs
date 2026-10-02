// Educational in-process model, NOT a production authority service.
// This example is independently implemented; it imports no ActionProof code.
export function createFixture({ fault = null } = {}) {
  let time = 1000;
  let count = 0;
  const grants = [{ issuer: 'trusted-human', action: 'guide', target: 'home', revoked: false, expiresAt: 100000 }];
  const evidence = [];
  const state = { target: 'home', displayNote: '' };
  const policy = { version: 1, requiredIssuer: 'trusted-human' };
  const tokens = new WeakMap();
  const capabilityTtl = 20;
  const requirements = () => ({ issuer: policy.requiredIssuer, approvals: fault === 'confidence' && evidence.some(e => e.confidence >= 0.9) ? 0 : 1 });
  const validGrants = () => grants.length > 0 && grants.every(g =>
    (fault === 'issuer' || g.issuer === policy.requiredIssuer) &&
    g.action === 'guide' && (fault === 'state' || g.target === state.target) &&
    (fault === 'revocation' || !g.revoked) &&
    (fault === 'grant-expiry' || g.expiresAt > time));
  return {
    grants, evidence, state, policy, capabilityTtl,
    now: () => time,
    advance: milliseconds => { time += milliseconds; },
    requirements,
    effects: () => count,
    authorize() {
      if (!validGrants() && !(fault === 'confidence' && requirements().approvals === 0)) return null;
      const token = Object.freeze({ kind: 'AUTHORIZED', nonce: 'fixture-only' });
      tokens.set(token, { used: false, expiresAt: time + capabilityTtl, target: state.target, version: policy.version });
      return token;
    },
    execute(token) {
      if (fault === 'forgery' && token?.kind === 'AUTHORIZED') { count += 1; return true; }
      if (!token || typeof token !== 'object') return false;
      const record = tokens.get(token);
      if (!record) return false;
      if (fault !== 'replay' && record.used) return false;
      if (fault !== 'capability-expiry' && record.expiresAt <= time) return false;
      if (fault !== 'state' && record.target !== state.target) return false;
      if (fault !== 'policy' && record.version !== policy.version) return false;
      if (!validGrants()) return false;
      record.used = true;
      count += 1;
      return true;
    }
  };
}
