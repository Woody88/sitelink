// packages/domain/src/events.ts
import { Events, Schema } from '@livestore/livestore'

export const events = {
  // Organization events
  organizationCreated: Events.synced({
    name: 'v1.OrganizationCreated',
    schema: Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      ownerId: Schema.String,
    }),
  }),

  // Project events
  projectCreated: Events.synced({
    name: 'v1.ProjectCreated',
    schema: Schema.Struct({
      id: Schema.String,
      organizationId: Schema.String,
      name: Schema.String,
      address: Schema.optional(Schema.String),
    }),
  }),

  projectUpdated: Events.synced({
    name: 'v1.ProjectUpdated',
    schema: Schema.Struct({
      projectId: Schema.String,
      name: Schema.optional(Schema.String),
      address: Schema.optional(Schema.String),
    }),
  }),

  projectArchived: Events.synced({
    name: 'v1.ProjectArchived',
    schema: Schema.Struct({ projectId: Schema.String }),
  }),

  // Sheet events
  sheetsReceived: Events.synced({
    name: 'v1.SheetsReceived',
    schema: Schema.Struct({
      projectId: Schema.String,
      sheets: Schema.Array(Schema.Struct({
        id: Schema.String,
        number: Schema.String,
        title: Schema.String,
        discipline: Schema.String,
        imagePath: Schema.String,
        width: Schema.Number,
        height: Schema.Number,
      })),
    }),
  }),

  // Marker events
  markersReceived: Events.synced({
    name: 'v1.MarkersReceived',
    schema: Schema.Struct({
      sheetId: Schema.String,
      markers: Schema.Array(Schema.Struct({
        id: Schema.String,
        label: Schema.String,
        targetSheetId: Schema.optional(Schema.String),
        x: Schema.Number,
        y: Schema.Number,
        confidence: Schema.Number,
      })),
    }),
  }),

  // Photo events
  photoCaptured: Events.synced({
    name: 'v1.PhotoCaptured',
    schema: Schema.Struct({
      id: Schema.String,
      projectId: Schema.String,
      markerId: Schema.optional(Schema.String),
      localPath: Schema.String,
      isIssue: Schema.Boolean,
      capturedAt: Schema.Date,
      capturedBy: Schema.String,
    }),
  }),

  photoMarkedAsIssue: Events.synced({
    name: 'v1.PhotoMarkedAsIssue',
    schema: Schema.Struct({ photoId: Schema.String }),
  }),

  photoUnmarkedAsIssue: Events.synced({
    name: 'v1.PhotoUnmarkedAsIssue',
    schema: Schema.Struct({ photoId: Schema.String }),
  }),

  photoLinkedToMarker: Events.synced({
    name: 'v1.PhotoLinkedToMarker',
    schema: Schema.Struct({
      photoId: Schema.String,
      markerId: Schema.String,
    }),
  }),

  photoUploaded: Events.synced({
    name: 'v1.PhotoUploaded',
    schema: Schema.Struct({
      photoId: Schema.String,
      remotePath: Schema.String,
    }),
  }),

  // Voice note events
  voiceNoteRecorded: Events.synced({
    name: 'v1.VoiceNoteRecorded',
    schema: Schema.Struct({
      id: Schema.String,
      photoId: Schema.String,
      localPath: Schema.String,
      durationSeconds: Schema.Number,
    }),
  }),

  voiceNoteTranscribed: Events.synced({
    name: 'v1.VoiceNoteTranscribed',
    schema: Schema.Struct({
      voiceNoteId: Schema.String,
      transcription: Schema.String,
    }),
  }),

  // User events
  userUpdated: Events.synced({
    name: 'v1.UserUpdated',
    schema: Schema.Struct({
      userId: Schema.String,
      name: Schema.optional(Schema.String),
      company: Schema.optional(Schema.String),
      phone: Schema.optional(Schema.String),
    }),
  }),
}
