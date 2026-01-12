// packages/domain/src/events.ts
import { Events, Schema } from "@livestore/livestore"

export const events = {
  // ===================
  // User events
  // ===================
  userCreated: Events.synced({
    name: "v1.UserCreated",
    schema: Schema.Struct({
      id: Schema.String,
      email: Schema.String,
      name: Schema.String,
      avatarUrl: Schema.optional(Schema.String),
      createdAt: Schema.Number,
    }),
  }),

  userUpdated: Events.synced({
    name: "v1.UserUpdated",
    schema: Schema.Struct({
      userId: Schema.String,
      name: Schema.optional(Schema.String),
      company: Schema.optional(Schema.String),
      phone: Schema.optional(Schema.String),
      avatarUrl: Schema.optional(Schema.String),
      updatedAt: Schema.Number,
    }),
  }),

  userDeleted: Events.synced({
    name: "v1.UserDeleted",
    schema: Schema.Struct({ userId: Schema.String }),
  }),

  // ===================
  // Organization events
  // ===================
  organizationCreated: Events.synced({
    name: "v1.OrganizationCreated",
    schema: Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      ownerId: Schema.String,
      // Owner user data to bootstrap the org with owner info
      ownerEmail: Schema.String,
      ownerName: Schema.String,
      ownerAvatarUrl: Schema.optional(Schema.String),
      createdAt: Schema.Number,
    }),
  }),

  organizationUpdated: Events.synced({
    name: "v1.OrganizationUpdated",
    schema: Schema.Struct({
      organizationId: Schema.String,
      name: Schema.optional(Schema.String),
      updatedAt: Schema.Number,
    }),
  }),

  organizationDeleted: Events.synced({
    name: "v1.OrganizationDeleted",
    schema: Schema.Struct({ organizationId: Schema.String }),
  }),

  // ===================
  // Organization membership events
  // ===================
  memberAdded: Events.synced({
    name: "v1.MemberAdded",
    schema: Schema.Struct({
      organizationId: Schema.String,
      userId: Schema.String,
      role: Schema.String, // 'owner' | 'admin' | 'member' | 'viewer'
      addedBy: Schema.String,
      addedAt: Schema.Number,
    }),
  }),

  memberRemoved: Events.synced({
    name: "v1.MemberRemoved",
    schema: Schema.Struct({
      organizationId: Schema.String,
      userId: Schema.String,
      removedBy: Schema.String,
    }),
  }),

  memberRoleUpdated: Events.synced({
    name: "v1.MemberRoleUpdated",
    schema: Schema.Struct({
      organizationId: Schema.String,
      userId: Schema.String,
      newRole: Schema.String,
      updatedBy: Schema.String,
    }),
  }),

  // ===================
  // Project events
  // ===================
  projectCreated: Events.synced({
    name: "v1.ProjectCreated",
    schema: Schema.Struct({
      id: Schema.String,
      organizationId: Schema.String,
      name: Schema.String,
      address: Schema.optional(Schema.String),
      createdBy: Schema.String,
      createdAt: Schema.Number,
    }),
  }),

  projectUpdated: Events.synced({
    name: "v1.ProjectUpdated",
    schema: Schema.Struct({
      projectId: Schema.String,
      name: Schema.optional(Schema.String),
      address: Schema.optional(Schema.String),
      updatedAt: Schema.Number,
    }),
  }),

  projectArchived: Events.synced({
    name: "v1.ProjectArchived",
    schema: Schema.Struct({
      projectId: Schema.String,
      updatedAt: Schema.Number,
    }),
  }),

  projectUnarchived: Events.synced({
    name: "v1.ProjectUnarchived",
    schema: Schema.Struct({
      projectId: Schema.String,
      updatedAt: Schema.Number,
    }),
  }),

  projectDeleted: Events.synced({
    name: "v1.ProjectDeleted",
    schema: Schema.Struct({ projectId: Schema.String }),
  }),

  // ===================
  // Project sharing events
  // ===================
  projectShared: Events.synced({
    name: "v1.ProjectShared",
    schema: Schema.Struct({
      projectId: Schema.String,
      sharedWithEmail: Schema.String,
      sharedWithUserId: Schema.optional(Schema.String), // null if user doesn't exist yet
      role: Schema.String, // 'viewer' | 'editor'
      sharedBy: Schema.String,
      sharedAt: Schema.Number,
    }),
  }),

  shareAccepted: Events.synced({
    name: "v1.ShareAccepted",
    schema: Schema.Struct({
      projectId: Schema.String,
      userId: Schema.String,
      email: Schema.String, // Email used to look up the share record
    }),
  }),

  shareRevoked: Events.synced({
    name: "v1.ShareRevoked",
    schema: Schema.Struct({
      projectId: Schema.String,
      email: Schema.String, // Email to identify the share (works for pending and accepted)
      revokedBy: Schema.String,
    }),
  }),

  // ===================
  // Plan upload events
  // ===================
  planUploaded: Events.synced({
    name: "v1.PlanUploaded",
    schema: Schema.Struct({
      id: Schema.String,
      projectId: Schema.String,
      fileName: Schema.String,
      fileSize: Schema.Number,
      mimeType: Schema.String,
      localPath: Schema.String,
      remotePath: Schema.optional(Schema.String),
      uploadedBy: Schema.String,
      uploadedAt: Schema.Date,
    }),
  }),

  planProcessingStarted: Events.synced({
    name: "v1.PlanProcessingStarted",
    schema: Schema.Struct({
      planId: Schema.String,
      startedAt: Schema.Date,
    }),
  }),

  planProcessingProgress: Events.synced({
    name: "v1.PlanProcessingProgress",
    schema: Schema.Struct({
      planId: Schema.String,
      progress: Schema.Number,
      currentPage: Schema.Number,
      totalPages: Schema.Number,
    }),
  }),

  // ===================
  // Stage 1: Image Generation (PDF → 300 DPI PNG)
  // ===================
  planImageGenerationStarted: Events.synced({
    name: "v1.PlanImageGenerationStarted",
    schema: Schema.Struct({
      planId: Schema.String,
      totalPages: Schema.Number,
      startedAt: Schema.Number,
    }),
  }),

  sheetImageGenerated: Events.synced({
    name: "v1.SheetImageGenerated",
    schema: Schema.Struct({
      sheetId: Schema.String,
      projectId: Schema.String,
      planId: Schema.String,
      pageNumber: Schema.Number,
      localImagePath: Schema.String,
      width: Schema.Number,
      height: Schema.Number,
      generatedAt: Schema.Number,
    }),
  }),

  // ===================
  // Stage 2: Metadata Extraction (OCR sheet names)
  // ===================
  sheetMetadataExtracted: Events.synced({
    name: "v1.SheetMetadataExtracted",
    schema: Schema.Struct({
      sheetId: Schema.String,
      planId: Schema.String,
      sheetNumber: Schema.String,
      sheetTitle: Schema.optional(Schema.String),
      discipline: Schema.optional(Schema.String),
      extractedAt: Schema.Number,
    }),
  }),

  planMetadataCompleted: Events.synced({
    name: "v1.PlanMetadataCompleted",
    schema: Schema.Struct({
      planId: Schema.String,
      validSheets: Schema.Array(Schema.String),
      completedAt: Schema.Number,
    }),
  }),

  // ===================
  // Stage 3: Callout Detection (OpenCV + LLM)
  // ===================
  sheetCalloutsDetected: Events.synced({
    name: "v1.SheetCalloutsDetected",
    schema: Schema.Struct({
      sheetId: Schema.String,
      planId: Schema.String,
      markers: Schema.Array(
        Schema.Struct({
          id: Schema.String,
          label: Schema.String,
          targetSheetRef: Schema.optional(Schema.String),
          targetSheetId: Schema.optional(Schema.String),
          x: Schema.Number,
          y: Schema.Number,
          confidence: Schema.Number,
          needsReview: Schema.Boolean,
        }),
      ),
      unmatchedCount: Schema.Number,
      detectedAt: Schema.Number,
    }),
  }),

  // ===================
  // Stage 4: PMTiles Generation (VIPS tiles)
  // ===================
  sheetTilesGenerated: Events.synced({
    name: "v1.SheetTilesGenerated",
    schema: Schema.Struct({
      sheetId: Schema.String,
      planId: Schema.String,
      localPmtilesPath: Schema.String,
      remotePmtilesPath: Schema.optional(Schema.String),
      minZoom: Schema.Number,
      maxZoom: Schema.Number,
      generatedAt: Schema.Number,
    }),
  }),

  planProcessingCompleted: Events.synced({
    name: "v1.PlanProcessingCompleted",
    schema: Schema.Struct({
      planId: Schema.String,
      sheetCount: Schema.Number,
      completedAt: Schema.Date,
    }),
  }),

  planProcessingFailed: Events.synced({
    name: "v1.PlanProcessingFailed",
    schema: Schema.Struct({
      planId: Schema.String,
      error: Schema.String,
      failedAt: Schema.Date,
    }),
  }),

  planDeleted: Events.synced({
    name: "v1.PlanDeleted",
    schema: Schema.Struct({ planId: Schema.String }),
  }),

  // ===================
  // Sheet events
  // ===================
  sheetsReceived: Events.synced({
    name: "v1.SheetsReceived",
    schema: Schema.Struct({
      projectId: Schema.String,
      planId: Schema.String,
      sheets: Schema.Array(
        Schema.Struct({
          id: Schema.String,
          number: Schema.String,
          title: Schema.String,
          discipline: Schema.String,
          localImagePath: Schema.String,
          localThumbnailPath: Schema.String,
          imagePath: Schema.optional(Schema.String),
          width: Schema.Number,
          height: Schema.Number,
        }),
      ),
    }),
  }),

  sheetDeleted: Events.synced({
    name: "v1.SheetDeleted",
    schema: Schema.Struct({ sheetId: Schema.String }),
  }),

  // ===================
  // Marker events
  // ===================
  markersReceived: Events.synced({
    name: "v1.MarkersReceived",
    schema: Schema.Struct({
      sheetId: Schema.String,
      markers: Schema.Array(
        Schema.Struct({
          id: Schema.String,
          label: Schema.String,
          targetSheetId: Schema.optional(Schema.String),
          x: Schema.Number,
          y: Schema.Number,
          confidence: Schema.Number,
        }),
      ),
    }),
  }),

  markerCreated: Events.synced({
    name: "v1.MarkerCreated",
    schema: Schema.Struct({
      id: Schema.String,
      sheetId: Schema.String,
      label: Schema.String,
      x: Schema.Number,
      y: Schema.Number,
      createdBy: Schema.String,
      createdAt: Schema.Number,
    }),
  }),

  markerUpdated: Events.synced({
    name: "v1.MarkerUpdated",
    schema: Schema.Struct({
      markerId: Schema.String,
      label: Schema.optional(Schema.String),
      x: Schema.optional(Schema.Number),
      y: Schema.optional(Schema.Number),
      targetSheetId: Schema.optional(Schema.String),
    }),
  }),

  markerDeleted: Events.synced({
    name: "v1.MarkerDeleted",
    schema: Schema.Struct({ markerId: Schema.String }),
  }),

  // ===================
  // Photo events
  // ===================
  photoCaptured: Events.synced({
    name: "v1.PhotoCaptured",
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
    name: "v1.PhotoMarkedAsIssue",
    schema: Schema.Struct({ photoId: Schema.String }),
  }),

  photoUnmarkedAsIssue: Events.synced({
    name: "v1.PhotoUnmarkedAsIssue",
    schema: Schema.Struct({ photoId: Schema.String }),
  }),

  photoLinkedToMarker: Events.synced({
    name: "v1.PhotoLinkedToMarker",
    schema: Schema.Struct({
      photoId: Schema.String,
      markerId: Schema.String,
    }),
  }),

  photoUploaded: Events.synced({
    name: "v1.PhotoUploaded",
    schema: Schema.Struct({
      photoId: Schema.String,
      remotePath: Schema.String,
    }),
  }),

  photoDeleted: Events.synced({
    name: "v1.PhotoDeleted",
    schema: Schema.Struct({ photoId: Schema.String }),
  }),

  // ===================
  // Voice note events
  // ===================
  voiceNoteRecorded: Events.synced({
    name: "v1.VoiceNoteRecorded",
    schema: Schema.Struct({
      id: Schema.String,
      photoId: Schema.String,
      localPath: Schema.String,
      durationSeconds: Schema.Number,
    }),
  }),

  voiceNoteUploaded: Events.synced({
    name: "v1.VoiceNoteUploaded",
    schema: Schema.Struct({
      voiceNoteId: Schema.String,
      remotePath: Schema.String,
    }),
  }),

  voiceNoteTranscribed: Events.synced({
    name: "v1.VoiceNoteTranscribed",
    schema: Schema.Struct({
      voiceNoteId: Schema.String,
      transcription: Schema.String,
    }),
  }),

  voiceNoteDeleted: Events.synced({
    name: "v1.VoiceNoteDeleted",
    schema: Schema.Struct({ voiceNoteId: Schema.String }),
  }),
}
