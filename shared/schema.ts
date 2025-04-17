import { pgTable, text, serial, decimal, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Content table - store uploaded screenshots and videos
export const content = pgTable("content", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type", { enum: ["image", "video"] }).notNull().default("image"),
  originalUrl: text("original_url").notNull(),
  blurredUrl: text("blurred_url").notNull(),
  price: decimal("price", { precision: 12, scale: 6 }).notNull().default("0"),
  walletAddress: text("wallet_address").notNull(),
  likeCount: integer("like_count").notNull().default(0),
  durationSeconds: integer("duration_seconds"),
  isPaid: boolean("is_paid").notNull().default(false),
  status: text("status", { enum: ["active", "flagged", "removed"] }).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  metadata: jsonb("metadata").default({})
});

// Likes table - track likes on content
export const likes = pgTable("likes", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").notNull(),
  walletAddress: text("wallet_address").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Payments table - track payments between wallets
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  fromWallet: text("from_wallet").notNull(),
  toWallet: text("to_wallet").notNull(),
  amount: decimal("amount", { precision: 12, scale: 6 }).notNull(),
  contentId: integer("content_id"),
  verified: boolean("verified").notNull().default(false),
  type: text("type", { enum: ["tip", "payment"] }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Reports table - track reported content
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").notNull(),
  reason: text("reason").notNull(),
  reporterWallet: text("reporter_wallet"),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Daily pool stats
export const dailyPool = pgTable("daily_pool", {
  id: serial("id").primaryKey(),
  totalPool: decimal("total_pool", { precision: 12, scale: 6 }).notNull(),
  uploadPoolPercentage: integer("upload_pool_percentage").notNull(),
  likePoolPercentage: integer("like_pool_percentage").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  distributedAt: timestamp("distributed_at")
});

// Insert schemas
export const insertContentSchema = createInsertSchema(content).omit({ 
  id: true, 
  likeCount: true, 
  createdAt: true, 
  status: true,
  isPaid: true,
  metadata: true 
});

export const insertLikeSchema = createInsertSchema(likes).omit({ 
  id: true, 
  createdAt: true 
});

export const insertPaymentSchema = createInsertSchema(payments).omit({ 
  id: true, 
  verified: true, 
  createdAt: true 
});

export const insertReportSchema = createInsertSchema(reports).omit({ 
  id: true, 
  resolved: true, 
  createdAt: true 
});

export const insertDailyPoolSchema = createInsertSchema(dailyPool).omit({ 
  id: true, 
  date: true, 
  distributedAt: true 
});

// Export types
export type Content = typeof content.$inferSelect;
export type InsertContent = z.infer<typeof insertContentSchema>;

export type Like = typeof likes.$inferSelect;
export type InsertLike = z.infer<typeof insertLikeSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

export type DailyPool = typeof dailyPool.$inferSelect;
export type InsertDailyPool = z.infer<typeof insertDailyPoolSchema>;
