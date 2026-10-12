/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

/**
 * ============================================================================
 * NOME FILE: src/modals/meeting/types.ts
 * ============================================================================
 * DESCRIZIONE:
 * Raccoglie e centralizza tutte le interfacce TypeScript di dominio per la gestione
 * delle riunioni e dei verbali formali (Fase 5 / Livello 5):
 * 1. Stati del ciclo di vita (State Machine a 4 fasi).
 * 2. Matrice dei ruoli ACL (Revisore, Editor, Visualizzatore).
 * 3. Struttura dei partecipanti, ordini del giorno, delibere e allegati.
 * 4. Strutture per l'estrazione dei To-Do e per la "Copia per Legge" (Albo Verbali).
 * ============================================================================
 */

export type MeetingStatus = 'PREPARATION' | 'EDITING' | 'REVISION' | 'PUBLISHED';

export type MeetingUserRole = 'REVISORE' | 'EDITOR' | 'VISUALIZZATORE';

export type AttendeeStatus = 'PRESENT' | 'ABSENT_JUSTIFIED' | 'ABSENT_UNJUSTIFIED' | 'EXTERNAL';

export interface MeetingAttendee {
  userId: string;
  name: string;
  role: string;
  status: AttendeeStatus;
  isExternal?: boolean;
}

export interface MeetingAttachment {
  fileName: string;
  url: string;
  driveId?: string;
  sizeBytes?: number;
  uploadedAt?: number;
}

export interface MeetingAgendaItem {
  odgId: string;
  title: string;
  discussionContent: string;
  deliberation?: string;
  flaggedForCopy: boolean; // Flag per inclusione gerarchica in "Copia per Legge"
  attachments?: MeetingAttachment[];
  tasks?: Array<{
    taskId?: string;
    description: string;
    assigneeName: string;
    assigneeEmail: string;
    dueDate: string;
    taskType?: string;
    ambito?: string;
    cosa?: string;
    quanto?: string;
  }>;
}

export interface ExtractedMeetingTask {
  taskId: string;
  spaceId: string;
  description: string;
  assigneeName: string;
  assigneeEmail: string;
  dueDate: string;
  odgTitle: string;
  meetingTitle: string;
  meetingDate: string;
}

export interface MinutesDocument {
  documentId: string;
  spaceId: string;
  fiscalYear: string;
  templateType: 'VERBALE_COCA' | 'VERBALE_ASSEMBLEA' | 'VERBALE_DIRETTIVO' | 'VERBALE_STAFF';
  status: MeetingStatus;
  metadata: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    copyForLaw: boolean;
    targetDocumentId?: string;
    sha256Hash?: string;
    publishedAt?: number;
    publishedBy?: string;
    lastModified?: number;
  };
  attendees: MeetingAttendee[];
  agenda: MeetingAgendaItem[];
  genericPoints: string;
  trackChangesDiff?: string;
  nextMeeting?: {
    date: string;
    location?: string;
    preliminaryAgenda: string[];
  };
}

export interface LegalCopyExtract {
  header: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    attendeesSummary: string;
    agendaSummary: string[];
  };
  extractedSections: Array<{
    title: string;
    content: string;
    deliberation?: string;
  }>;
  formattedMarkdown: string;
}
