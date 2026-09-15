/** Uniform random integer in [0, max) from the CSPRNG. Rejection sampling
 * rather than a plain modulo so the low values aren't very slightly more
 * likely than the high ones.
 *
 * Anything a user could be asked to prove they know — a verification code, a
 * handover PIN — has to come from here rather than Math.random(): V8's
 * generator is not cryptographic, and its internal state can be recovered
 * from a run of observed outputs, which an attacker can farm by requesting
 * codes for their own account. */
export function randomInt(max: number): number {
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return value % max;
}
