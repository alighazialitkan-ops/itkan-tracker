import { neon } from "@neondatabase/serverless";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set in .env.local");
  return neon(url);
}

// sql.query() for parameterised queries — handles both pg-style {rows:[]} and direct array
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const sql = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await sql.query(text, params);
  if (Array.isArray(result)) return result as T[];
  if (result && Array.isArray(result.rows)) return result.rows as T[];
  return [];
}
