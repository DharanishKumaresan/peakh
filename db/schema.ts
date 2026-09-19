// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const recordBoards = sqliteTable('record_boards', {
  owner: text('owner').primaryKey(),
  state: text('state').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const profiles = sqliteTable('profiles', {
  userId: text('user_id').primaryKey(),
  id: text('id').notNull().unique(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  photoKey: text('photo_key'),
  createdAt: text('created_at').notNull(),
});
export const friendships = sqliteTable('friendships', {
  userA: text('user_a').notNull(), userB: text('user_b').notNull(),
  id: text('id').notNull().unique(), requestedBy: text('requested_by').notNull(),
  status: text('status', { enum: ['pending', 'accepted'] }).notNull(),
  createdAt: text('created_at').notNull(),
}, table => [primaryKey({ columns: [table.userA, table.userB] }), index('friendships_user_b_idx').on(table.userB)]);
