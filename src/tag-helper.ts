import { Database } from "./db";

export async function getTagIds(db: Database, names: string[]): Promise<number[]> {
  if (!names.length) return [];
  const rows = await db.selectFrom('tag')
    .select(['id'])
    .where('value', 'in', names)
    .execute();
  return rows.filter(r => r.id)
             .map(r => r.id) as number[];
}