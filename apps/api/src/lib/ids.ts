import { randomUUID } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function newPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
