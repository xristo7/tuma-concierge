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

/** Alphabet for generated tokens (temporary staff passwords): no 0/O/1/I/l —
 * characters a person could misread from an email or a screen share, since
 * these are meant to be typed in by hand at least once. */
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** A random string of `length` characters from the CSPRNG, grouped with
 * hyphens every `groupSize` characters for readability (e.g. "AB3D-EF7H"). */
export function randomToken(length: number, groupSize = 5): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += TOKEN_ALPHABET[randomInt(TOKEN_ALPHABET.length)];
  if (!groupSize) return out;
  return (out.match(new RegExp(`.{1,${groupSize}}`, "g")) ?? [out]).join("-");
}
