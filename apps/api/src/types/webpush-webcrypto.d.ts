// webpush-webcrypto ships no types (plain JS + JSDoc) — declaring just the
// surface this app actually calls. See apps/api/src/lib/webpush.ts.
declare module "webpush-webcrypto" {
  export type JSONSerializedKeys = { publicKey: string; privateKey: string };

  export class ApplicationServerKeys {
    publicKey: CryptoKey;
    privateKey: CryptoKey;
    toJSON(): Promise<JSONSerializedKeys>;
    static fromJSON(keys: JSONSerializedKeys): Promise<ApplicationServerKeys>;
    static generate(): Promise<ApplicationServerKeys>;
  }

  export type PushTarget = {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  export type PushOptions = {
    payload: string | Uint8Array;
    applicationServerKeys: ApplicationServerKeys;
    target: PushTarget;
    adminContact: string;
    ttl: number;
    topic?: string;
    urgency?: "very-low" | "low" | "normal" | "high";
  };

  export function generatePushHTTPRequest(
    options: PushOptions,
  ): Promise<{ headers: Record<string, string>; body: ArrayBuffer; endpoint: string }>;

  export function setWebCrypto(crypto: Crypto): void;
}
