// packages/domain/src/materializers.ts
import { State } from "@livestore/livestore"
import { events } from "./events"
import { tables } from "./tables"

export const materializers = State.SQLite.materializers(events, {
  // ===================
  // User materializers
  // ===================
  "v1.UserCreated": (event) => [
    tables.users.insert({
      id: event.id,
      email: event.email,
      name: event.name,
      avatarUrl: event.avatarUrl ?? null,
      company: null,
      phone: null,
      createdAt: event.createdAt,
      updatedAt: event.createdAt,
    }),
  ],

  "v1.UserUpdated": (event) =>
    tables.users
      .update({
        ...(event.name && { name: event.name }),
        ...(event.company !== undefined && { company: event.company }),
        ...(event.phone !== undefined && { phone: event.phone }),
        ...(event.avatarUrl !== undefined && { avatarUrl: event.avatarUrl }),
        updatedAt: event.updatedAt,
      })
      .where({ id: event.userId }),

  "v1.UserDeleted": (event) => tables.users.delete().where({ id: event.userId }),

  // ===================
  // Organization materializers
  // ===================
  "v1.OrganizationCreated": (event) => [
    tables.organizations.insert({
      id: event.id,
      name: event.name,
      ownerId: event.ownerId,
      createdAt: event.createdAt,
      updatedAt: event.createdAt,
    }),
    // Create the owner's user record in this org's store
    // This ensures each org store only contains users who are members of that org
    tables.users.insert({
      id: event.ownerId,
      email: event.ownerEmail,
      name: event.ownerName,
      avatarUrl: event.ownerAvatarUrl ?? null,
      company: null,
      phone: null,
      createdAt: event.createdAt,
      updatedAt: event.createdAt,
    }),
    tables.organizationMembers.insert({
      id: `${event.id}_${event.ownerId}`,
      organizationId: event.id,
      userId: event.ownerId,
      role: "owner",
      addedAt: event.createdAt,
    }),
  ],

  "v1.OrganizationUpdated": (event) =>
    tables.organizations
      .update({
        ...(event.name && { name: event.name }),
        updatedAt: event.updatedAt,
      })
      .where({ id: event.organizationId }),

  "v1.OrganizationDeleted": (event) =>
    tables.organizations.delete().where({ id: event.organizationId }),

  // ===================
  // Organization membership materializers
  // ===================
  "v1.MemberAdded": (event) =>
    tables.organizationMembers.insert({
      id: `${event.organizationId}_${event.userId}`,
      organizationId: event.organizationId,
      userId: event.userId,
      role: event.role,
      addedAt: event.addedAt,
    }),

  "v1.MemberRemoved": (event) =>
    tables.organizationMembers.delete().where({
      organizationId: event.organizationId,
      userId: event.userId,
    }),

  "v1.MemberRoleUpdated": (event) =>
    tables.organizationMembers
      .update({
        role: event.newRole,
      })
      .where({
        organizationId: event.organizationId,
        userId: event.userId,
      }),

  // ===================
  // Project materializers
  // ===================
  "v1.ProjectCreated": (event) =>
    tables.projects.insert({
      id: event.id,
      organizationId: event.organizationId,
      name: event.name,
      address: event.address ?? null,
      isArchived: false,
      createdBy: event.createdBy,
      createdAt: event.createdAt,
      updatedAt: event.createdAt,
    }),

  "v1.ProjectUpdated": (event) =>
    tables.projects
      .update({
        ...(event.name && { name: event.name }),
        ...(event.address !== undefined && { address: event.address }),
        updatedAt: event.updatedAt,
      })
      .where({ id: event.projectId }),

  "v1.ProjectArchived": (event) =>
    tables.projects
      .update({ isArchived: true, updatedAt: event.updatedAt })
      .where({ id: event.projectId }),

  "v1.ProjectUnarchived": (event) =>
    tables.projects
      .update({ isArchived: false, updatedAt: event.updatedAt })
      .where({ id: event.projectId }),

  "v1.ProjectDeleted": (event) => tables.projects.delete().where({ id: event.projectId }),

  // ===================
  // Project sharing materializers
  // ===================
  "v1.ProjectShared": (event) =>
    tables.projectShares.insert({
      id: `${event.projectId}_${event.sharedWithEmail}`,
      projectId: event.projectId,
      sharedWithEmail: event.sharedWithEmail,
      sharedWithUserId: event.sharedWithUserId ?? null,
      role: event.role,
      sharedBy: event.sharedBy,
      accepted: false,
      sharedAt: event.sharedAt,
    }),

  "v1.ShareAccepted": (event) =>
    tables.projectShares
      .update({
        accepted: true,
        sharedWithUserId: event.userId,
      })
      .where({ projectId: event.projectId, sharedWithEmail: event.email }),

  "v1.ShareRevoked": (event) =>
    tables.projectShares.delete().where({
      projectId: event.projectId,
      sharedWithEmail: event.email,
    }),

  // ===================
  // Plan materializers
  // ===================
  "v1.PlanUploaded": (event) =>
    tables.plans.insert({
      id: event.id,
      projectId: event.projectId,
      fileName: event.fileName,
      fileSize: event.fileSize,
      mimeType: event.mimeType,
      localPath: event.localPath,
      remotePath: event.remotePath ?? null,
      processingProgress: null,
      status: "uploaded",
      sheetCount: null,
      errorMessage: null,
      uploadedBy: event.uploadedBy,
      uploadedAt: event.uploadedAt.getTime(),
      processedAt: null,
    }),

  "v1.PlanProcessingStarted": (event) =>
    tables.plans
      .update({
        status: "processing",
        processingProgress: 0,
      })
      .where({ id: event.planId }),

  "v1.PlanProcessingProgress": (event) =>
    tables.plans
      .update({
        processingProgress: event.progress,
      })
      .where({ id: event.planId }),

  // ===================
  // Stage 1: Image Generation materializers
  // ===================
  "v1.PlanImageGenerationStarted": (event) =>
    tables.plans
      .update({
        status: "processing",
      })
      .where({ id: event.planId }),

  "v1.SheetImageGenerated": (event) =>
    tables.sheets.insert({
      id: event.sheetId,
      projectId: event.projectId,
      planId: event.planId,
      number: "",
      title: "",
      discipline: "",
      localImagePath: event.localImagePath,
      localThumbnailPath: "",
      imagePath: null,
      width: event.width,
      height: event.height,
      sortOrder: event.pageNumber - 1,
      processingStage: "image_generated",
      localPmtilesPath: null,
      remotePmtilesPath: null,
      minZoom: null,
      maxZoom: null,
    }),

  // ===================
  // Stage 2: Metadata Extraction materializers
  // ===================
  "v1.SheetMetadataExtracted": (event) =>
    tables.sheets
      .update({
        number: event.sheetNumber,
        title: event.sheetTitle ?? "",
        discipline: event.discipline ?? "",
        processingStage: "metadata_extracted",
      })
      .where({ id: event.sheetId }),

  "v1.PlanMetadataCompleted": (event) => [
    tables.sheets.delete().where({ planId: event.planId, id: { $notIn: event.validSheets } }),
  ],

  // ===================
  // Stage 3: Callout Detection materializers
  // ===================
  "v1.SheetCalloutsDetected": (event) => [
    tables.sheets
      .update({
        processingStage: "callouts_detected",
      })
      .where({ id: event.sheetId }),
    ...event.markers.map((marker) =>
      tables.markers.insert({
        id: marker.id,
        sheetId: event.sheetId,
        label: marker.label,
        targetSheetId: marker.targetSheetId ?? null,
        x: marker.x,
        y: marker.y,
        confidence: marker.confidence,
        createdBy: null,
        createdAt: null,
      }),
    ),
  ],

  // ===================
  // Stage 4: PMTiles Generation materializers
  // ===================
  "v1.SheetTilesGenerated": (event) =>
    tables.sheets
      .update({
        localPmtilesPath: event.localPmtilesPath,
        remotePmtilesPath: event.remotePmtilesPath ?? null,
        minZoom: event.minZoom,
        maxZoom: event.maxZoom,
        processingStage: "tiles_generated",
      })
      .where({ id: event.sheetId }),

  "v1.PlanProcessingCompleted": (event) =>
    tables.plans
      .update({
        status: "completed",
        processingProgress: 100,
        sheetCount: event.sheetCount,
        processedAt: event.completedAt.getTime(),
      })
      .where({ id: event.planId }),

  "v1.PlanProcessingFailed": (event) =>
    tables.plans
      .update({
        status: "failed",
        errorMessage: event.error,
        processedAt: event.failedAt.getTime(),
      })
      .where({ id: event.planId }),

  "v1.PlanDeleted": (event) => tables.plans.delete().where({ id: event.planId }),

  // ===================
  // Sheet materializers
  // ===================
  "v1.SheetsReceived": (event) =>
    event.sheets.map((sheet, index) =>
      tables.sheets.insert({
        id: sheet.id,
        projectId: event.projectId,
        planId: event.planId,
        number: sheet.number,
        title: sheet.title,
        discipline: sheet.discipline,
        localImagePath: sheet.localImagePath,
        localThumbnailPath: sheet.localThumbnailPath,
        imagePath: sheet.imagePath ?? null,
        width: sheet.width,
        height: sheet.height,
        sortOrder: index,
      }),
    ),

  "v1.SheetDeleted": (event) => tables.sheets.delete().where({ id: event.sheetId }),

  // ===================
  // Marker materializers
  // ===================
  "v1.MarkersReceived": (event) =>
    event.markers.map((marker) =>
      tables.markers.insert({
        id: marker.id,
        sheetId: event.sheetId,
        label: marker.label,
        targetSheetId: marker.targetSheetId ?? null,
        x: marker.x,
        y: marker.y,
        confidence: marker.confidence,
        createdBy: null, // AI-detected
        createdAt: null,
      }),
    ),

  "v1.MarkerCreated": (event) =>
    tables.markers.insert({
      id: event.id,
      sheetId: event.sheetId,
      label: event.label,
      targetSheetId: null,
      x: event.x,
      y: event.y,
      confidence: null, // Manual marker
      createdBy: event.createdBy,
      createdAt: event.createdAt,
    }),

  "v1.MarkerUpdated": (event) =>
    tables.markers
      .update({
        ...(event.label && { label: event.label }),
        ...(event.x !== undefined && { x: event.x }),
        ...(event.y !== undefined && { y: event.y }),
        ...(event.targetSheetId !== undefined && { targetSheetId: event.targetSheetId }),
      })
      .where({ id: event.markerId }),

  "v1.MarkerDeleted": (event) => tables.markers.delete().where({ id: event.markerId }),

  // ===================
  // Photo materializers
  // ===================
  "v1.PhotoCaptured": (event) =>
    tables.photos.insert({
      id: event.id,
      projectId: event.projectId,
      markerId: event.markerId ?? null,
      localPath: event.localPath,
      remotePath: null,
      isIssue: event.isIssue,
      capturedAt: event.capturedAt.getTime(),
      capturedBy: event.capturedBy,
    }),

  "v1.PhotoMarkedAsIssue": (event) =>
    tables.photos.update({ isIssue: true }).where({ id: event.photoId }),

  "v1.PhotoUnmarkedAsIssue": (event) =>
    tables.photos.update({ isIssue: false }).where({ id: event.photoId }),

  "v1.PhotoLinkedToMarker": (event) =>
    tables.photos.update({ markerId: event.markerId }).where({ id: event.photoId }),

  "v1.PhotoUploaded": (event) =>
    tables.photos.update({ remotePath: event.remotePath }).where({ id: event.photoId }),

  "v1.PhotoDeleted": (event) => tables.photos.delete().where({ id: event.photoId }),

  // ===================
  // Voice note materializers
  // ===================
  "v1.VoiceNoteRecorded": (event) =>
    tables.voiceNotes.insert({
      id: event.id,
      photoId: event.photoId,
      localPath: event.localPath,
      remotePath: null,
      durationSeconds: event.durationSeconds,
      transcription: null,
    }),

  "v1.VoiceNoteUploaded": (event) =>
    tables.voiceNotes.update({ remotePath: event.remotePath }).where({ id: event.voiceNoteId }),

  "v1.VoiceNoteTranscribed": (event) =>
    tables.voiceNotes
      .update({ transcription: event.transcription })
      .where({ id: event.voiceNoteId }),

  "v1.VoiceNoteDeleted": (event) => tables.voiceNotes.delete().where({ id: event.voiceNoteId }),
})
