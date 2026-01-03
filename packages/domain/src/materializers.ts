// packages/domain/src/materializers.ts
import { State } from '@livestore/livestore'
import { events } from './events'
import { tables } from './tables'

export const materializers = State.SQLite.materializers(events, {
  // Organization materializers
  'v1.OrganizationCreated': (event) =>
    tables.organizations.insert({
      id: event.id,
      name: event.name,
      ownerId: event.ownerId,
      createdAt: Date.now(),
    }),

  // Project materializers
  'v1.ProjectCreated': (event) =>
    tables.projects.insert({
      id: event.id,
      organizationId: event.organizationId,
      name: event.name,
      address: event.address ?? null,
      isArchived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),

  'v1.ProjectUpdated': (event) =>
    tables.projects.update({
      ...(event.name && { name: event.name }),
      ...(event.address !== undefined && { address: event.address }),
      updatedAt: Date.now(),
    }).where({ id: event.projectId }),

  'v1.ProjectArchived': (event) =>
    tables.projects.update({ isArchived: true, updatedAt: Date.now() }).where({ id: event.projectId }),

  // Sheet materializers - insert each sheet
  'v1.SheetsReceived': (event) =>
    event.sheets.map((sheet, index) =>
      tables.sheets.insert({
        id: sheet.id,
        projectId: event.projectId,
        number: sheet.number,
        title: sheet.title,
        discipline: sheet.discipline,
        imagePath: sheet.imagePath,
        width: sheet.width,
        height: sheet.height,
        sortOrder: index,
      })
    ),

  // Marker materializers - insert each marker
  'v1.MarkersReceived': (event) =>
    event.markers.map((marker) =>
      tables.markers.insert({
        id: marker.id,
        sheetId: event.sheetId,
        label: marker.label,
        targetSheetId: marker.targetSheetId ?? null,
        x: marker.x,
        y: marker.y,
        confidence: marker.confidence,
      })
    ),

  // Photo materializers
  'v1.PhotoCaptured': (event) =>
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

  'v1.PhotoMarkedAsIssue': (event) =>
    tables.photos.update({ isIssue: true }).where({ id: event.photoId }),

  'v1.PhotoUnmarkedAsIssue': (event) =>
    tables.photos.update({ isIssue: false }).where({ id: event.photoId }),

  'v1.PhotoLinkedToMarker': (event) =>
    tables.photos.update({ markerId: event.markerId }).where({ id: event.photoId }),

  'v1.PhotoUploaded': (event) =>
    tables.photos.update({ remotePath: event.remotePath }).where({ id: event.photoId }),

  // Voice note materializers
  'v1.VoiceNoteRecorded': (event) =>
    tables.voiceNotes.insert({
      id: event.id,
      photoId: event.photoId,
      localPath: event.localPath,
      remotePath: null,
      durationSeconds: event.durationSeconds,
      transcription: null,
    }),

  'v1.VoiceNoteTranscribed': (event) =>
    tables.voiceNotes.update({ transcription: event.transcription }).where({ id: event.voiceNoteId }),

  // User materializers
  'v1.UserUpdated': (event) =>
    tables.users.update({
      ...(event.name && { name: event.name }),
      ...(event.company !== undefined && { company: event.company }),
      ...(event.phone !== undefined && { phone: event.phone }),
    }).where({ id: event.userId }),
})
