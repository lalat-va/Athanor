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
 * NOME FILE: src/modals/meeting/OutputGenerator.ts
 * ============================================================================
 * DESCRIZIONE:
 * Contiene le funzioni pure e deterministiche di trasformazione del verbale:
 * 1. Generazione del testo Markdown completo per il verbale.
 * 2. Estrazione disaccoppiata dei To-Do/Task verso il TaskPlugin & SpaceDashboard.
 * 3. Algoritmo di estrazione gerarchica "Copia per Legge" per l'Albo dei Verbali.
 * ============================================================================
 */

import { MinutesDocument, ExtractedMeetingTask, LegalCopyExtract } from './types.js';
import { db } from '../../base/Database.js';
import { eventBus } from '../../base/EventBus.js';

export class OutputGenerator {
  /**
   * Genera il documento completo del verbale in formato Markdown standard
   */
  public static generateMarkdown(doc: MinutesDocument): string {
    const lines: string[] = [];

    // 1. Intestazione Ufficiale
    lines.push(`# 📝 ${doc.metadata.title.toUpperCase()}`);
    lines.push(`**Spazio:** ${doc.spaceId} | **Anno Sociale:** ${doc.fiscalYear}`);
    lines.push(`**Stato Verbale:** ${doc.status} | **Firma SHA-256:** \`${doc.metadata.sha256Hash || 'Non ancora pubblicato'}\`\n`);

    lines.push(`---\n`);

    // 2. Coordinate Riunione
    lines.push(`### 📅 Coordinate della Riunione`);
    lines.push(`- **Data:** ${doc.metadata.date}`);
    lines.push(`- **Orario:** dalle ${doc.metadata.startTime} alle ${doc.metadata.endTime}`);
    lines.push(`- **Luogo:** ${doc.metadata.location || 'Sede dell\'Associazione'}\n`);

    // 3. Appello & Presenze
    lines.push(`### 👥 Presenze & Appello`);
    const present = doc.attendees.filter((a) => a.status === 'PRESENT' && !a.isExternal);
    const justified = doc.attendees.filter((a) => a.status === 'ABSENT_JUSTIFIED');
    const absent = doc.attendees.filter((a) => a.status === 'ABSENT_UNJUSTIFIED');
    const external = doc.attendees.filter((a) => a.isExternal || a.status === 'EXTERNAL');

    lines.push(`- **Presenti (${present.length}):** ${present.map((p) => `${p.name} (${p.role})`).join(', ') || 'Nessuno'}`);
    if (justified.length > 0) {
      lines.push(`- **Assenti Giustificati (${justified.length}):** ${justified.map((p) => `${p.name} (${p.role})`).join(', ')}`);
    }
    if (absent.length > 0) {
      lines.push(`- **Assenti Non Giustificati (${absent.length}):** ${absent.map((p) => `${p.name} (${p.role})`).join(', ')}`);
    }
    if (external.length > 0) {
      lines.push(`- **Partecipanti Esterni / Ospiti (${external.length}):** ${external.map((p) => `${p.name} (${p.role})`).join(', ')}`);
    }
    lines.push('');

    // 4. Ordine del Giorno Sintetico
    lines.push(`### 📋 Ordine del Giorno (OdG)`);
    if (doc.agenda.length === 0) {
      lines.push(`*Nessun punto all'ordine del giorno definito.*`);
    } else {
      doc.agenda.forEach((item, index) => {
        const copyBadge = item.flaggedForCopy ? ' *(📜 Albo Verbali)*' : '';
        lines.push(`${index + 1}. **${item.title}**${copyBadge}`);
      });
    }
    lines.push('');

    // 5. Trattazione dei Punti dell'OdG
    lines.push(`---\n`);
    lines.push(`## 🗣️ Discussione dei Punti all'OdG\n`);

    doc.agenda.forEach((item, index) => {
      lines.push(`### ${index + 1}. ${item.title}`);

      if (item.discussionContent && item.discussionContent.trim()) {
        lines.push(`\n${item.discussionContent.trim()}\n`);
      } else {
        lines.push(`\n*Nessuna nota di discussione registrata.*\n`);
      }

      if (item.deliberation && item.deliberation.trim()) {
        lines.push(`> ⚖️ **DELIBERA / DECISIONE UFFICIALE:**\n> ${item.deliberation.trim()}\n`);
      }

      if (item.tasks && item.tasks.length > 0) {
        lines.push(`**To-Do & Incarichi Decisi:**`);
        item.tasks.forEach((t) => {
          lines.push(`- [ ] **[${t.assigneeName}]** ${t.description} *(Scadenza: ${t.dueDate || 'Non indicata'})*`);
        });
        lines.push('');
      }

      if (item.attachments && item.attachments.length > 0) {
        lines.push(`**Allegati:**`);
        item.attachments.forEach((att) => {
          lines.push(`- 📎 [${att.fileName}](${att.url})`);
        });
        lines.push('');
      }
    });

    // 6. Varie ed Eventuali
    if (doc.genericPoints && doc.genericPoints.trim()) {
      lines.push(`---\n`);
      lines.push(`## 📌 Varie ed Eventuali`);
      lines.push(`${doc.genericPoints.trim()}\n`);
    }

    // 7. Prossima Riunione
    if (doc.nextMeeting && doc.nextMeeting.date) {
      lines.push(`---\n`);
      lines.push(`## 🔜 Prossima Riunione`);
      lines.push(`- **Data Prevista:** ${doc.nextMeeting.date}`);
      if (doc.nextMeeting.location) lines.push(`- **Luogo:** ${doc.nextMeeting.location}`);
      if (doc.nextMeeting.preliminaryAgenda && doc.nextMeeting.preliminaryAgenda.length > 0) {
        lines.push(`- **Bozza OdG Futuro:**`);
        doc.nextMeeting.preliminaryAgenda.forEach((odg) => lines.push(`  - ${odg}`));
      }
      lines.push('');
    }

    // 8. Chiusura formale
    lines.push(`---\n`);
    lines.push(`*Verbale redatto e archiviato tramite Ecosistema Digitale Terzo Settore (Local-First).*`);
    if (doc.metadata.publishedAt) {
      lines.push(`*Pubblicato e congelato il ${new Date(doc.metadata.publishedAt).toLocaleString('it-IT')} da ${doc.metadata.publishedBy || 'Segreteria'}.*`);
    }

    return lines.join('\n');
  }

  /**
   * Estrazione Disaccoppiata dei To-Do / Task per il TaskPlugin & SpaceDashboard
   */
  public static async extractAndInjectTasks(doc: MinutesDocument): Promise<ExtractedMeetingTask[]> {
    const extracted: ExtractedMeetingTask[] = [];

    doc.agenda.forEach((item) => {
      if (item.tasks && item.tasks.length > 0) {
        item.tasks.forEach((t) => {
          extracted.push({
            taskId: t.taskId || `tsk_min_${doc.documentId}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            spaceId: doc.spaceId,
            description: t.description,
            assigneeName: t.assigneeName,
            assigneeEmail: t.assigneeEmail,
            dueDate: t.dueDate || doc.metadata.date,
            odgTitle: item.title,
            meetingTitle: doc.metadata.title,
            meetingDate: doc.metadata.date
          });
        });
      }
    });

    if (extracted.length === 0) return [];

    try {
      // Inietta i task nell'elenco persistente dello spazio in Dexie solo se non già presenti
      const spaceTasksKey = `tasks_${doc.spaceId}`;
      const savedRecord = await db.settings.get(spaceTasksKey);
      let existingTasks = savedRecord?.value || [];

      let addedCount = 0;
      extracted.forEach((ext) => {
        const alreadyExists = existingTasks.some((ex: any) => ex.taskId === ext.taskId);
        if (!alreadyExists) {
          existingTasks.push({
            taskId: ext.taskId,
            spaceId: ext.spaceId,
            parentId: null,
            subtaskIds: [],
            taskType: 'DA_FARE',
            ambito: 'EVENTO',
            category: 'EVENTO',
            description: ext.description,
            cosa: ext.description,
            quanto: '1 azione',
            scadenza: ext.dueDate,
            dueDate: ext.dueDate,
            assigneeId: ext.assigneeEmail,
            assigneeName: ext.assigneeName,
            completed: false,
            openedBy: doc.metadata.publishedBy || 'segreteria@associazione.org',
            inheritedMetadata: {
              eventName: `${doc.metadata.title} (${doc.metadata.date})`,
              odgTitle: ext.odgTitle
            }
          });
          eventBus.emit('task:created', existingTasks[existingTasks.length - 1]);
          addedCount++;
        }
      });

      if (addedCount > 0) {
        await db.settings.put({
          key: spaceTasksKey,
          value: existingTasks,
          lastUpdated: Date.now()
        });
        console.log(`[OutputGenerator] 🚀 Iniettati ${addedCount} nuovi To-Do dal verbale "${doc.metadata.title}" nello spazio "${doc.spaceId}".`);
      }
    } catch (e) {
      console.warn('[OutputGenerator] Errore iniezione task in Dexie:', e);
    }

    return extracted;
  }

  /**
   * Algoritmo di Estrazione "Copia per Legge" (Albo Verbali Ufficiale)
   * Estrae obbligatoriamente l'intestazione e i capitoli OdG contrassegnati con flaggedForCopy.
   */
  public static extractLegalCopy(doc: MinutesDocument): LegalCopyExtract {
    const attendeesNames = doc.attendees
      .filter((a) => a.status === 'PRESENT')
      .map((a) => `${a.name} (${a.role})`)
      .join(', ');

    const header = {
      title: doc.metadata.title,
      date: doc.metadata.date,
      startTime: doc.metadata.startTime,
      endTime: doc.metadata.endTime,
      location: doc.metadata.location,
      attendeesSummary: attendeesNames,
      agendaSummary: doc.agenda.map((a) => a.title)
    };

    // Estrae i punti OdG flaggati per la Copia per Legge
    const flaggedItems = doc.agenda.filter((a) => a.flaggedForCopy);

    const extractedSections = flaggedItems.map((item) => ({
      title: item.title,
      content: item.discussionContent,
      deliberation: item.deliberation
    }));

    // Formatta il Markdown estratto per l'append nell'Albo Verbali
    const lines: string[] = [];
    lines.push(`\n## 📜 ESTRATTO VERBALE UFFICIALE: ${doc.metadata.title.toUpperCase()}`);
    lines.push(`**Data Riunione:** ${doc.metadata.date} | **Orario:** ${doc.metadata.startTime} - ${doc.metadata.endTime} | **Luogo:** ${doc.metadata.location}`);
    lines.push(`**Presenti:** ${attendeesNames || 'Come da foglio presenze'}`);
    lines.push(`**Ordine del Giorno Generale:** ${header.agendaSummary.join('; ')}\n`);
    lines.push(`### Deliberazioni ed Estratti Statutari:`);

    if (extractedSections.length === 0) {
      lines.push(`*Nessuna deliberazione sottoposta a pubblicazione formale sull'Albo dei Verbali.*`);
    } else {
      extractedSections.forEach((sec, idx) => {
        lines.push(`\n#### ${idx + 1}. ${sec.title}`);
        if (sec.content && sec.content.trim()) {
          lines.push(`${sec.content.trim()}`);
        }
        if (sec.deliberation && sec.deliberation.trim()) {
          lines.push(`\n> ⚖️ **DELIBERAZIONE:**\n> ${sec.deliberation.trim()}`);
        }
      });
    }

    lines.push(`\n*Firma crittografica di convalida: ${doc.metadata.sha256Hash || 'In fase di convalida'}*`);
    lines.push(`\n---\n`);

    return {
      header,
      extractedSections,
      formattedMarkdown: lines.join('\n')
    };
  }

  /**
   * Append Non-Distruttivo all'Albo Verbali salvato in Dexie
   */
  public static async appendToLegalRegister(spaceId: string, extract: LegalCopyExtract): Promise<void> {
    try {
      const registerKey = `albo_verbali_${spaceId}`;
      const savedRecord = await db.settings.get(registerKey);
      const existingRegisterText = savedRecord?.value || `# 🏛️ ALBO UFFICIALE DEI VERBALI E DELIBERAZIONI\n*Registro cronologico non modificabile dell'Ente del Terzo Settore.*\n\n---\n`;

      const updatedRegisterText = existingRegisterText + extract.formattedMarkdown;

      await db.settings.put({
        key: registerKey,
        value: updatedRegisterText,
        lastUpdated: Date.now()
      });

      console.log(`[OutputGenerator] 📜 Append completato sull'Albo Verbali per lo spazio "${spaceId}".`);
    } catch (e) {
      console.warn('[OutputGenerator] Errore append su Albo Verbali:', e);
    }
  }
}
