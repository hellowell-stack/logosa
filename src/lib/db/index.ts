import "server-only";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { Collection, Db } from "mongodb";
import { COLLECTIONS, type BookingDoc, type EnquiryDoc, type SessionDoc, type StaffDoc } from "./schema";

/**
 * THE DATABASE CONNECTION — MongoDB.
 *
 *   MONGODB_URI set       → that cluster (MongoDB Atlas, or any MongoDB).
 *   unset, in development → a real `mongod`, started by mongodb-memory-server
 *                           and kept in ./.data/mongo. Nothing to install, and
 *                           the data survives restarts. The binary downloads
 *                           itself on first run — once per machine, into
 *                           ~/.cache/mongodb-binaries — and it is not small:
 *                           the Windows archive for MongoDB 8 is ~780 MB, of
 *                           which ~75 MB is kept. Point MONGODB_URI at an Atlas
 *                           cluster instead to skip it.
 *   unset, in production  → not configured. Booking and the admin say so
 *                           rather than failing; see `databaseConfigured()`.
 *
 * The local server is never a production fallback: on a serverless host the
 * filesystem is ephemeral, and bookings written there would silently vanish on
 * the next deploy. That is worse than the booking form being switched off.
 *
 * Indexes are created on first connection. `createIndexes` is a no-op for an
 * index that already exists, so there is no migration step to remember.
 */

export interface Database {
  db: Db;
  staff: Collection<StaffDoc>;
  sessions: Collection<SessionDoc>;
  bookings: Collection<BookingDoc>;
  enquiries: Collection<EnquiryDoc>;
}

export function databaseConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI) || process.env.NODE_ENV !== "production";
}

export class DatabaseNotConfigured extends Error {
  constructor() {
    super("MONGODB_URI is not set. Bookings and the admin need a MongoDB database; see LAUNCH.md §3.");
    this.name = "DatabaseNotConfigured";
  }
}

const LOCAL_DIR = path.join(process.cwd(), ".data", "mongo");

declare global {
  // Survives hot reloads in development. Without it every edit would open a
  // new connection pool — and in development, try to start a second mongod on
  // a data directory the first one still holds.
  var __logosaDb: Promise<Database> | undefined;
}

async function connectionString(): Promise<string> {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  if (process.env.NODE_ENV === "production") throw new DatabaseNotConfigured();

  console.info("[db] MONGODB_URI not set — starting a local MongoDB in .data/mongo (the first run downloads it).");
  const { MongoMemoryServer } = await import("mongodb-memory-server-core");
  await mkdir(LOCAL_DIR, { recursive: true });
  const server = await MongoMemoryServer.create({
    instance: { dbPath: LOCAL_DIR, storageEngine: "wiredTiger" },
  });
  return server.getUri();
}

async function ensureIndexes(d: Database) {
  await Promise.all([
    d.staff.createIndex({ email: 1 }, { unique: true }),
    // Mongo deletes a session document once its expiresAt has passed.
    d.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    d.sessions.createIndex({ staffId: 1 }),
    d.bookings.createIndex({ reference: 1 }, { unique: true }),
    d.bookings.createIndex({ accessToken: 1 }, { unique: true }),
    d.bookings.createIndex({ status: 1, createdAt: -1 }),
    d.bookings.createIndex({ email: 1 }),
    d.bookings.createIndex({ startDate: 1 }),
    d.bookings.createIndex({ updatedAt: -1 }),
    d.bookings.createIndex({ "payments.id": 1 }),
    d.enquiries.createIndex({ reference: 1 }, { unique: true }),
    d.enquiries.createIndex({ status: 1, createdAt: -1 }),
  ]);
}

async function connect(): Promise<Database> {
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(await connectionString(), { maxPoolSize: 10 });
  await client.connect();
  // Atlas connection strings usually name no database, so name one.
  const db = client.db(process.env.MONGODB_DB || "logosa");
  const d: Database = {
    db,
    staff: db.collection<StaffDoc>(COLLECTIONS.staff),
    sessions: db.collection<SessionDoc>(COLLECTIONS.sessions),
    bookings: db.collection<BookingDoc>(COLLECTIONS.bookings),
    enquiries: db.collection<EnquiryDoc>(COLLECTIONS.enquiries),
  };
  await ensureIndexes(d);
  return d;
}

export function getDb(): Promise<Database> {
  if (!globalThis.__logosaDb) {
    globalThis.__logosaDb = connect().catch((err) => {
      // Let the next request retry rather than caching a failure forever.
      globalThis.__logosaDb = undefined;
      throw err;
    });
  }
  return globalThis.__logosaDb;
}

/** Mongo's duplicate-key error — a unique index refused the write. */
export const isDuplicateKey = (err: unknown): boolean => (err as { code?: number })?.code === 11000;
