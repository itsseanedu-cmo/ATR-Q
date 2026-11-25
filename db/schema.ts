import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const sessions=sqliteTable('sessions',{id:text('id').primaryKey(),owner:text('owner').notNull(),payload:text('payload').notNull(),revision:integer('revision').notNull().default(0),pinHash:text('pin_hash').notNull(),pinSalt:text('pin_salt').notNull(),createdAt:integer('created_at').notNull()});
export const tokens=sqliteTable('admin_tokens',{hash:text('hash').primaryKey(),sessionId:text('session_id').notNull(),expiresAt:integer('expires_at').notNull()});
export const attempts=sqliteTable('login_attempts',{id:text('id').primaryKey(),count:integer('count').notNull().default(0),resetAt:integer('reset_at').notNull()});
