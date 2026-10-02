import { createFixture as referenceFixture } from './reference-adapter.mjs';
// Deliberately accepts capability lookalikes. Never use as an executor.
export const createFixture = () => referenceFixture({ fault: 'forgery' });
