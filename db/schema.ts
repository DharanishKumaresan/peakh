// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const recordBoards = sqliteTable('record_boards', {
  owner: text('owner').primaryKey(),
  state: text('state').notNull(),
  updatedAt: text('updated_at').notNull(),
});
