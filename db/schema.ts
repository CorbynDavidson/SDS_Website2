import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";

export const enquiries = sqliteTable("enquiries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  postcode: text("postcode").notNull(),
  disrepairType: text("disrepair_type").notNull(),
}, (table) => [index("idx_enquiries_created_at").on(table.createdAt)]);

export const formSubmissions = sqliteTable("form_submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  requestKey: text("request_key").notNull().unique(),
  formKey: text("form_key").notNull(),
  sourcePath: text("source_path").notNull(),
  payloadJson: text("payload_json").notNull(),
}, table => [index("idx_form_submissions_created_at").on(table.createdAt)]);

export const submissionRateLimits = sqliteTable("submission_rate_limits", {
  bucketKey: text("bucket_key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const contentDrafts = sqliteTable("content_drafts", {
  pagePath: text("page_path").notNull(),
  authorEmail: text("author_email").notNull(),
  baseSha256: text("base_sha256").notNull(),
  bodyHtml: text("body_html").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [primaryKey({columns:[table.pagePath,table.authorEmail]})]);

export const formUploads = sqliteTable("form_uploads", {
  id: text("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(()=>formSubmissions.id),
  storageKey: text("storage_key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  bytes: integer("bytes").notNull(),
}, table => [index("idx_form_uploads_submission").on(table.submissionId)]);
