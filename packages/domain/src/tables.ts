// packages/domain/src/tables.ts
import { State } from '@livestore/livestore'

export const tables = {
  organizations: State.SQLite.table({
    name: 'organizations',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      name: State.SQLite.text(),
      ownerId: State.SQLite.text(),
      createdAt: State.SQLite.integer(),
    },
  }),

  projects: State.SQLite.table({
    name: 'projects',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      organizationId: State.SQLite.text(),
      name: State.SQLite.text(),
      address: State.SQLite.text({ nullable: true }),
      isArchived: State.SQLite.boolean({ default: false }),
      createdAt: State.SQLite.integer(),
      updatedAt: State.SQLite.integer(),
    },
    indexes: [{ name: 'projects_organizationId', columns: ['organizationId'] }],
  }),

  sheets: State.SQLite.table({
    name: 'sheets',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      projectId: State.SQLite.text(),
      number: State.SQLite.text(),
      title: State.SQLite.text(),
      discipline: State.SQLite.text(),
      imagePath: State.SQLite.text(),
      width: State.SQLite.integer(),
      height: State.SQLite.integer(),
      sortOrder: State.SQLite.integer(),
    },
    indexes: [
      { name: 'sheets_projectId', columns: ['projectId'] },
      { name: 'sheets_projectId_discipline', columns: ['projectId', 'discipline'] },
    ],
  }),

  markers: State.SQLite.table({
    name: 'markers',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      sheetId: State.SQLite.text(),
      label: State.SQLite.text(),
      targetSheetId: State.SQLite.text({ nullable: true }),
      x: State.SQLite.real(),
      y: State.SQLite.real(),
      confidence: State.SQLite.real(),
    },
    indexes: [{ name: 'markers_sheetId', columns: ['sheetId'] }],
  }),

  photos: State.SQLite.table({
    name: 'photos',
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
      { name: 'photos_projectId', columns: ['projectId'] },
      { name: 'photos_markerId', columns: ['markerId'] },
      { name: 'photos_capturedAt', columns: ['capturedAt'] },
    ],
  }),

  voiceNotes: State.SQLite.table({
    name: 'voice_notes',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      photoId: State.SQLite.text(),
      localPath: State.SQLite.text(),
      remotePath: State.SQLite.text({ nullable: true }),
      durationSeconds: State.SQLite.integer(),
      transcription: State.SQLite.text({ nullable: true }),
    },
    indexes: [{ name: 'voiceNotes_photoId', columns: ['photoId'] }],
  }),

  users: State.SQLite.table({
    name: 'users',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      email: State.SQLite.text(),
      name: State.SQLite.text(),
      avatarUrl: State.SQLite.text({ nullable: true }),
      company: State.SQLite.text({ nullable: true }),
      phone: State.SQLite.text({ nullable: true }),
    },
  }),
}
