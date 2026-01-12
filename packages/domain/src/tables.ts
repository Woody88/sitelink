// packages/domain/src/tables.ts
import { State } from "@livestore/livestore"

export const tables = {
  // ===================
  // Users
  // ===================
  users: State.SQLite.table({
    name: "users",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      email: State.SQLite.text(),
      name: State.SQLite.text(),
      avatarUrl: State.SQLite.text({ nullable: true }),
      company: State.SQLite.text({ nullable: true }),
      phone: State.SQLite.text({ nullable: true }),
      createdAt: State.SQLite.integer(),
      updatedAt: State.SQLite.integer(),
    },
    indexes: [{ name: "users_email", columns: ["email"] }],
  }),

  // ===================
  // Organizations
  // ===================
  organizations: State.SQLite.table({
    name: "organizations",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      name: State.SQLite.text(),
      ownerId: State.SQLite.text(),
      createdAt: State.SQLite.integer(),
      updatedAt: State.SQLite.integer(),
    },
  }),

  organizationMembers: State.SQLite.table({
    name: "organization_members",
    columns: {
      id: State.SQLite.text({ primaryKey: true }), // organizationId_userId
      organizationId: State.SQLite.text(),
      userId: State.SQLite.text(),
      role: State.SQLite.text(), // 'owner' | 'admin' | 'member' | 'viewer'
      addedAt: State.SQLite.integer(),
    },
    indexes: [
      { name: "orgMembers_orgId", columns: ["organizationId"] },
      { name: "orgMembers_userId", columns: ["userId"] },
    ],
  }),

  // ===================
  // Projects
  // ===================
  projects: State.SQLite.table({
    name: "projects",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      organizationId: State.SQLite.text(),
      name: State.SQLite.text(),
      address: State.SQLite.text({ nullable: true }),
      isArchived: State.SQLite.boolean({ default: false }),
      createdBy: State.SQLite.text(),
      createdAt: State.SQLite.integer(),
      updatedAt: State.SQLite.integer(),
    },
    indexes: [{ name: "projects_organizationId", columns: ["organizationId"] }],
  }),

  projectShares: State.SQLite.table({
    name: "project_shares",
    columns: {
      id: State.SQLite.text({ primaryKey: true }), // projectId_email
      projectId: State.SQLite.text(),
      sharedWithEmail: State.SQLite.text(),
      sharedWithUserId: State.SQLite.text({ nullable: true }),
      role: State.SQLite.text(), // 'viewer' | 'editor'
      sharedBy: State.SQLite.text(),
      accepted: State.SQLite.boolean({ default: false }),
      sharedAt: State.SQLite.integer(),
    },
    indexes: [
      { name: "projectShares_projectId", columns: ["projectId"] },
      { name: "projectShares_userId", columns: ["sharedWithUserId"] },
      { name: "projectShares_projectId_email", columns: ["projectId", "sharedWithEmail"] },
    ],
  }),

  // ===================
  // Plans (uploaded PDFs)
  // ===================
  plans: State.SQLite.table({
    name: "plans",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      projectId: State.SQLite.text(),
      fileName: State.SQLite.text(),
      fileSize: State.SQLite.integer(),
      mimeType: State.SQLite.text(),
      localPath: State.SQLite.text(),
      remotePath: State.SQLite.text({ nullable: true }),
      processingProgress: State.SQLite.integer({ nullable: true }),
      status: State.SQLite.text(), // 'uploaded' | 'processing' | 'completed' | 'failed'
      sheetCount: State.SQLite.integer({ nullable: true }),
      errorMessage: State.SQLite.text({ nullable: true }),
      uploadedBy: State.SQLite.text(),
      uploadedAt: State.SQLite.integer(),
      processedAt: State.SQLite.integer({ nullable: true }),
    },
    indexes: [
      { name: "plans_projectId", columns: ["projectId"] },
      { name: "plans_status", columns: ["status"] },
    ],
  }),

  // ===================
  // Sheets (extracted from plans)
  // ===================
  sheets: State.SQLite.table({
    name: "sheets",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      projectId: State.SQLite.text(),
      planId: State.SQLite.text(),
      number: State.SQLite.text(),
      title: State.SQLite.text(),
      discipline: State.SQLite.text(),
      localImagePath: State.SQLite.text(),
      localThumbnailPath: State.SQLite.text(),
      imagePath: State.SQLite.text({ nullable: true }),
      width: State.SQLite.integer(),
      height: State.SQLite.integer(),
      sortOrder: State.SQLite.integer(),
      processingStage: State.SQLite.text({ nullable: true }),
      localPmtilesPath: State.SQLite.text({ nullable: true }),
      remotePmtilesPath: State.SQLite.text({ nullable: true }),
      minZoom: State.SQLite.integer({ nullable: true }),
      maxZoom: State.SQLite.integer({ nullable: true }),
    },
    indexes: [
      { name: "sheets_projectId", columns: ["projectId"] },
      { name: "sheets_planId", columns: ["planId"] },
      { name: "sheets_projectId_discipline", columns: ["projectId", "discipline"] },
    ],
  }),

  // ===================
  // Markers (callouts on sheets)
  // ===================
  markers: State.SQLite.table({
    name: "markers",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      sheetId: State.SQLite.text(),
      label: State.SQLite.text(),
      targetSheetId: State.SQLite.text({ nullable: true }),
      x: State.SQLite.real(),
      y: State.SQLite.real(),
      confidence: State.SQLite.real({ nullable: true }), // null for manual markers
      createdBy: State.SQLite.text({ nullable: true }), // null for AI-detected markers
      createdAt: State.SQLite.integer({ nullable: true }),
    },
    indexes: [{ name: "markers_sheetId", columns: ["sheetId"] }],
  }),

  // ===================
  // Photos
  // ===================
  photos: State.SQLite.table({
    name: "photos",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      projectId: State.SQLite.text(),
      markerId: State.SQLite.text({ nullable: true }),
      localPath: State.SQLite.text(),
      remotePath: State.SQLite.text({ nullable: true }),
      isIssue: State.SQLite.boolean({ default: false }),
      capturedAt: State.SQLite.integer(),
      capturedBy: State.SQLite.text(),
    },
    indexes: [
      { name: "photos_projectId", columns: ["projectId"] },
      { name: "photos_markerId", columns: ["markerId"] },
      { name: "photos_capturedAt", columns: ["capturedAt"] },
    ],
  }),

  // ===================
  // Voice Notes
  // ===================
  voiceNotes: State.SQLite.table({
    name: "voice_notes",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      photoId: State.SQLite.text(),
      localPath: State.SQLite.text(),
      remotePath: State.SQLite.text({ nullable: true }),
      durationSeconds: State.SQLite.integer(),
      transcription: State.SQLite.text({ nullable: true }),
    },
    indexes: [{ name: "voiceNotes_photoId", columns: ["photoId"] }],
  }),
}
