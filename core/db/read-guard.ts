export type DatabaseRead<T> =
  { ok: true; data: T } | { ok: false; message: string };

const UNREACHABLE_MESSAGE =
  "Could not reach the database. Check DATABASE_URL and that PostgreSQL is running, then reload.";

export async function readFromDatabase<T>(
  operation: string,
  read: () => Promise<T>,
): Promise<DatabaseRead<T>> {
  try {
    return { ok: true, data: await read() };
  } catch (error) {
    console.error(`[db:${operation}]`, error);
    return { ok: false, message: UNREACHABLE_MESSAGE };
  }
}
