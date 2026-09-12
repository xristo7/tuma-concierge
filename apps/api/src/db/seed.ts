import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { db } from "./client.js";

/** Local/staging demo data: one customer, one verified+online rider, one admin. Password for all: "password123". */
async function run() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const customerId = randomUUID();
  const riderId = randomUUID();
  const adminId = randomUUID();

  await db.execute({
    sql: `INSERT OR IGNORE INTO users (id, phone, name, password_hash, role) VALUES (?, ?, ?, ?, 'customer')`,
    args: [customerId, "+256700000001", "Sharon", passwordHash],
  });
  await db.execute({
    sql: `INSERT OR IGNORE INTO users (id, phone, name, password_hash, role) VALUES (?, ?, ?, ?, 'rider')`,
    args: [riderId, "+256700000002", "Juma", passwordHash],
  });
  await db.execute({
    sql: `INSERT OR IGNORE INTO users (id, phone, name, password_hash, role) VALUES (?, ?, ?, ?, 'admin')`,
    args: [adminId, "+256700000003", "Admin", passwordHash],
  });
  await db.execute({
    sql: `INSERT OR IGNORE INTO riders (user_id, verified, is_online, area, vehicle_info) VALUES (?, 1, 1, 'Kololo', 'Boda — UBG 123X')`,
    args: [riderId],
  });

  console.log("Seeded demo users (password: password123):");
  console.log(`  customer +256700000001`);
  console.log(`  rider    +256700000002 (verified, online)`);
  console.log(`  admin    +256700000003`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
