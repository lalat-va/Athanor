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
 * NOME FILE: src/plugins/ResourcesPlugin/ResourceDataExtractor.ts
 * ============================================================================
 * DESCRIZIONE:
 * Motore di estrazione dati, normalizzazione e persistenza per l'Hub Risorse:
 * 1. Ascolto su EventBus degli eventi emessi da altri plugin:
 *    - `minutes:status_changed` (Verbali e Delibere -> DOCUMENTS)
 *    - `activity:created` / `activity:updated` (Attività e Dinamiche -> GAMES / WORKSHOPS)
 *    - `menu:recipe_added` / `cambusa:recipe_added` (Menù e Ricette -> RECIPES)
 *    - `map:poi_added` / `map:gpx_imported` (Punti di interesse, basi -> LOCATIONS)
 * 2. Normalizzazione verso il contratto unificato `ResourceItem`.
 * 3. Persistenza Local-First su Dexie.js (tabella `resources`).
 * 4. Generazione seed iniziale di risorse demo per collaudo immediato.
 * ============================================================================
 */

import { EventBus, eventBus } from '../../base/EventBus.js';
import { db, ResourceRecord } from '../../base/Database.js';
import { ResourceItem, ResourceCategory } from './types.js';

export class ResourceDataExtractor {
  private static instance: ResourceDataExtractor;
  private bus: EventBus;
  private isListening: boolean = false;

  private constructor() {
    this.bus = eventBus;
  }

  public static getInstance(): ResourceDataExtractor {
    if (!ResourceDataExtractor.instance) {
      ResourceDataExtractor.instance = new ResourceDataExtractor();
    }
    return ResourceDataExtractor.instance;
  }

  /**
   * Inizializza i listener sull'EventBus per intercettare gli eventi dai vari moduli
   */
  public initListeners(): void {
    if (this.isListening) return;
    this.isListening = true;

    // 1. Intercettazione Verbali e Delibere (MinutesPlugin)
    this.bus.on('minutes:status_changed', async (payload: any) => {
      try {
        if (payload && payload.documentId && payload.spaceId) {
          const docRecord = await db.settings.get(`minutes_doc_${payload.documentId}`);
          if (docRecord && docRecord.value) {
            const minDoc = docRecord.value;
            if (minDoc.status === 'PUBLISHED') {
              await this.indexMeetingMinutes(minDoc);
            }
          }
        }
      } catch (err) {
        console.warn('[ResourceDataExtractor] Errore indicizzazione verbale:', err);
      }
    });

    // 2. Intercettazione Attività / Giochi generici
    this.bus.on('activity:created', async (payload: any) => {
      if (payload && payload.title) {
        await this.indexGenericActivity(payload);
      }
    });

    // 3. Intercettazione Ricette / Cambusa
    this.bus.on('menu:recipe_added', async (payload: any) => {
      if (payload && payload.title) {
        await this.indexRecipe(payload);
      }
    });

    // 4. Intercettazione Mappe / Punti di interesse
    this.bus.on('map:poi_added', async (payload: any) => {
      if (payload && payload.name) {
        await this.indexMapPoi(payload);
      }
    });

    console.log('[ResourceDataExtractor] 🎧 Listener EventBus per estrazione automatica risorse attivati.');
  }

  /**
   * Indicizza un verbale o delibera statutaria come risorsa DOCUMENTS
   */
  public async indexMeetingMinutes(minDoc: any): Promise<void> {
    const resource: ResourceItem = {
      resourceId: `res_min_${minDoc.documentId}`,
      spaceId: minDoc.spaceId || 'space-default',
      title: minDoc.metadata?.title || 'Verbale Ufficiale di Seduta',
      category: 'DOCUMENTS',
      descriptionMarkdown: `Verbale statutario approvato e congelato il ${minDoc.metadata?.date || 'data non indicata'}.\nLuogo: ${minDoc.metadata?.location || 'Sede'}. SHA-256: ${minDoc.metadata?.sha256Hash || 'N/A'}.`,
      coverImageUrl: null,
      sourcePluginId: 'minutes-tool',
      sourceEntityId: minDoc.documentId,
      extractedMetadata: {
        doc_type: 'Verbale Ufficiale Approvato',
        year: minDoc.fiscalYear || new Date().getFullYear().toString(),
        approved_by: minDoc.metadata?.publishedBy || 'Segreteria',
        validity: 'Permanente (Statutaria)',
        protocol: `VERB-${minDoc.fiscalYear}-${minDoc.documentId.substring(0, 6)}`
      },
      attachments: minDoc.agenda?.flatMap((item: any) =>
        (item.attachments || []).map((att: any, idx: number) => ({
          fileId: `att_min_${idx}`,
          fileName: att.fileName,
          driveUrl: att.url,
          fileType: 'PDF' as const
        }))
      ) || [],
      tags: ['verbale', 'delibera', 'statutario', minDoc.fiscalYear || '2026'],
      updatedAt: new Date(minDoc.metadata?.lastModified || Date.now()).toISOString(),
      createdBy: minDoc.metadata?.publishedBy || 'operatore@associazione.org',
      isReadOnly: true
    };

    await this.saveResource(resource);
    console.log(`[ResourceDataExtractor] 📄 Verbale "${resource.title}" indicizzato automaticamente nell'Hub Risorse.`);
  }

  /**
   * Indicizza un'attività / gioco
   */
  public async indexGenericActivity(payload: any): Promise<void> {
    const isWorkshop = (payload.tags || []).some((t: string) => t.toLowerCase().includes('bottega') || t.toLowerCase().includes('laboratorio'));
    const category: ResourceCategory = isWorkshop ? 'WORKSHOPS' : 'GAMES';

    const resource: ResourceItem = {
      resourceId: `res_act_${payload.id || Date.now()}`,
      spaceId: payload.spaceId || 'space-default',
      title: payload.title,
      category,
      descriptionMarkdown: payload.description || payload.content || 'Nessuna descrizione specificata.',
      coverImageUrl: payload.coverImageUrl || null,
      sourcePluginId: 'activity',
      sourceEntityId: payload.id || null,
      extractedMetadata: isWorkshop
        ? {
            difficulty: payload.difficulty || 'Intermedio',
            duration: payload.duration || '2 ore',
            tools: payload.tools || 'Attrezzi da campo',
            materials: payload.materials || 'Legname e cordini'
          }
        : {
            durata_min: payload.duration || '60 min',
            part_range: payload.participants || '15-40',
            eta_target: payload.targetAge || 'Tutte le età',
            materials_summary: payload.materials || 'Materiale da campo'
          },
      attachments: [],
      tags: payload.tags || ['attività'],
      updatedAt: new Date().toISOString(),
      createdBy: payload.author || 'operatore@associazione.org',
      isReadOnly: false
    };

    await this.saveResource(resource);
  }

  /**
   * Indicizza una ricetta di cambusa
   */
  public async indexRecipe(payload: any): Promise<void> {
    const resource: ResourceItem = {
      resourceId: `res_rcp_${payload.id || Date.now()}`,
      spaceId: payload.spaceId || 'space-default',
      title: payload.title,
      category: 'RECIPES',
      descriptionMarkdown: payload.description || 'Ricetta per campo di gruppo.',
      coverImageUrl: payload.coverImageUrl || null,
      sourcePluginId: 'cambusa',
      sourceEntityId: payload.id || null,
      extractedMetadata: {
        servings: payload.servings || '50 persone',
        cost_per_person: payload.costPerPerson || '2.50 €',
        prep_time: payload.prepTime || '45 min',
        allergens: payload.allergens || 'Verificare etichetta ingredienti'
      },
      attachments: [],
      tags: ['ricetta', 'cambusa', 'cucina'],
      updatedAt: new Date().toISOString(),
      createdBy: payload.author || 'cambusa@associazione.org',
      isReadOnly: false
    };

    await this.saveResource(resource);
  }

  /**
   * Indicizza un punto di interesse / base scout da mappa
   */
  public async indexMapPoi(payload: any): Promise<void> {
    const resource: ResourceItem = {
      resourceId: `res_loc_${payload.id || Date.now()}`,
      spaceId: payload.spaceId || 'space-default',
      title: payload.name,
      category: 'LOCATIONS',
      descriptionMarkdown: payload.description || 'Punto di interesse / Struttura ricettiva censita su mappa.',
      coverImageUrl: payload.coverImageUrl || null,
      sourcePluginId: 'maps',
      sourceEntityId: payload.id || null,
      extractedMetadata: {
        capacity: payload.capacity || '30 posti letto / prato tende',
        cost_per_day: payload.cost || 'Da concordare col gestore',
        services: payload.services || 'Acqua potabile, Luce, Bagni',
        contacts: payload.phone || payload.email || 'Vedi scheda mappa'
      },
      attachments: [],
      tags: ['posto', 'casa', 'mappa', 'bivacco'],
      updatedAt: new Date().toISOString(),
      createdBy: 'operatore@associazione.org',
      isReadOnly: false
    };

    await this.saveResource(resource);
  }

  /**
   * Salva o aggiorna una risorsa in Dexie
   */
  public async saveResource(resource: ResourceItem): Promise<void> {
    try {
      const record: ResourceRecord = {
        ...resource,
        updatedAt: new Date().toISOString()
      };
      await db.resources.put(record);
      this.bus.emit('resource:saved', { resourceId: resource.resourceId, spaceId: resource.spaceId });
    } catch (err) {
      console.error('[ResourceDataExtractor] Errore salvataggio risorsa in Dexie:', err);
      throw err;
    }
  }

  /**
   * Elimina una risorsa
   */
  public async deleteResource(resourceId: string): Promise<void> {
    try {
      const existing = await db.resources.get(resourceId);
      if (existing) {
        await db.resources.delete(resourceId);
        this.bus.emit('resource:deleted', { resourceId, spaceId: existing.spaceId });
        console.log(`[ResourceDataExtractor] 🗑️ Risorsa "${resourceId}" eliminata con successo.`);
      }
    } catch (err) {
      console.error('[ResourceDataExtractor] Errore eliminazione risorsa:', err);
      throw err;
    }
  }

  /**
   * Interroga le risorse per lo spazio attivo con filtri opzionali
   */
  public async queryResources(
    spaceId: string,
    filter?: { category?: string; query?: string; tag?: string }
  ): Promise<ResourceItem[]> {
    try {
      let results = await db.resources.where('spaceId').equals(spaceId).toArray();

      // Se non ci sono risorse per lo spazio, popola il seed demo
      if (results.length === 0) {
        await this.seedDemoResourcesIfEmpty(spaceId);
        results = await db.resources.where('spaceId').equals(spaceId).toArray();
      }

      // Filtro per Categoria
      if (filter?.category && filter.category !== 'ALL') {
        results = results.filter((r) => r.category === filter.category);
      }

      // Filtro per Tag
      if (filter?.tag) {
        const tLower = filter.tag.toLowerCase();
        results = results.filter((r) => r.tags.some((t) => t.toLowerCase() === tLower));
      }

      // Filtro testuale di ricerca libera
      if (filter?.query && filter.query.trim()) {
        const qLower = filter.query.toLowerCase().trim();
        results = results.filter(
          (r) =>
            r.title.toLowerCase().includes(qLower) ||
            r.descriptionMarkdown.toLowerCase().includes(qLower) ||
            r.tags.some((t) => t.toLowerCase().includes(qLower)) ||
            Object.values(r.extractedMetadata).some((val) => String(val).toLowerCase().includes(qLower))
        );
      }

      // Ordina per data di aggiornamento decrescente
      return results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (err) {
      console.warn('[ResourceDataExtractor] Errore query risorse da Dexie:', err);
      return [];
    }
  }

  /**
   * Genera dati demo completi ed eterogenei per testare subito l'hub
   */
  public async seedDemoResourcesIfEmpty(spaceId: string): Promise<void> {
    const count = await db.resources.where('spaceId').equals(spaceId).count();
    if (count > 0) return;

    const demoItems: ResourceItem[] = [
      {
        resourceId: `res_demo_game_01_${spaceId}`,
        spaceId,
        title: 'Il Grande Gioco della Giungla',
        category: 'GAMES',
        descriptionMarkdown: `Grande gioco a stazioni ambientato nella Giungla di Mowgli. I partecipanti devono conquistare le Parole Maestre superando le sfide dei Bandar-log senza farsi catturare dai cacciatori di Shere Khan.`,
        coverImageUrl: 'https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=800&q=80',
        sourcePluginId: 'direct',
        extractedMetadata: {
          durata_min: '90 min',
          part_range: '25-50 partecipanti',
          eta_target: '8-11y (Lupetti / Branco)',
          materials_summary: '4 Scalpi, 8 Fazzolettoni colorati, Fischietto, Buste indizio',
          location_type: 'Bosco con radura',
          ambientazione: 'Storie di Mowgli / Giungla'
        },
        attachments: [
          {
            fileId: 'att_gioco_pdf',
            fileName: 'Scheda_Regole_Gioco_Giungla.pdf',
            driveUrl: 'https://drive.google.com/file/d/demo_gioco_giungla',
            fileType: 'PDF'
          }
        ],
        tags: ['gioco', 'bosco', 'lupetti', 'giungla', 'movimento'],
        updatedAt: '2026-10-18T10:00:00.000Z',
        createdBy: 'akela@associazione.org',
        isReadOnly: false
      },
      {
        resourceId: `res_demo_loc_02_${spaceId}`,
        spaceId,
        title: 'Casa Vacanze "Monte Alto"',
        category: 'LOCATIONS',
        descriptionMarkdown: `Ampia struttura scout situata a 850m s.l.m. Immersa nei faggi, dotata di salone riscaldato con camino, cucina industriale completa e prato pianeggiante per montaggio fino a 15 tende di squadriglia con presa d'acqua potabile.`,
        coverImageUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80',
        sourcePluginId: 'maps',
        extractedMetadata: {
          capacity: '50 posti letto + 80 in tenda',
          cost_per_day: '8.50 € / pers / notte',
          services: 'Cucina industriale, Riscaldamento a legna, 6 Bagni, Docce calde',
          contacts: 'Don Pietro (Cell: 338-9876543) - email: montealto@diocesi.it',
          altitude: '850 m s.l.m. (Parco Naturale)'
        },
        attachments: [
          {
            fileId: 'att_casa_reg',
            fileName: 'Regolamento_Ospiti_MonteAlto.pdf',
            driveUrl: 'https://drive.google.com/file/d/demo_monte_alto',
            fileType: 'PDF'
          }
        ],
        tags: ['casa', 'posto', 'campo-estivo', 'montagna', 'tende'],
        updatedAt: '2026-10-15T15:30:00.000Z',
        createdBy: 'logistica@associazione.org',
        isReadOnly: false
      },
      {
        resourceId: `res_demo_song_03_${spaceId}`,
        spaceId,
        title: 'Il Canto della Promessa',
        category: 'SONGS',
        descriptionMarkdown: `Brano solenne tradizionale di gruppo per la cerimonia delle promesse. Si esegue rigorosamente a cerchio o quadrato con accompagnamento di chitarra classica arpeggiata.`,
        coverImageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
        sourcePluginId: 'direct',
        extractedMetadata: {
          key: 'Re Maggiore (D)',
          rhythm: '3/4 Arpeggiato Lento',
          moment: 'Cerimonia delle Promesse / Serale',
          author: 'Tradizione Scout',
          has_chords: 'Sì (testo e accordi completi)'
        },
        attachments: [
          {
            fileId: 'att_canto_spartito',
            fileName: 'Spartito_Accordi_Promessa.pdf',
            driveUrl: 'https://drive.google.com/file/d/demo_spartito',
            fileType: 'PDF'
          }
        ],
        tags: ['canto', 'chitarra', 'promessa', 'cerimonia', 'musica'],
        updatedAt: '2026-10-14T18:00:00.000Z',
        createdBy: 'animazione@associazione.org',
        isReadOnly: false
      },
      {
        resourceId: `res_demo_recipe_04_${spaceId}`,
        spaceId,
        title: 'Pasta alla Pastora per 50 persone',
        category: 'RECIPES',
        descriptionMarkdown: `Primo piatto nutriente e veloce per grandi numeri in cambusa. Ingredienti scalati: 5 kg pasta corta rigata, 2.5 kg ricotta vaccina fresca, 1 kg pomodorini pelati, parmigiano, olio, sale e pepe.`,
        coverImageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281728?auto=format&fit=crop&w=800&q=80',
        sourcePluginId: 'cambusa',
        extractedMetadata: {
          servings: '50 porzioni abbondanti',
          cost_per_person: '1.80 € a persona',
          prep_time: '35 minuti',
          allergens: 'Glutine (pasta), Lattosio (ricotta e grana)',
          difficulty: 'Facile (1 fornellone cambusa)'
        },
        attachments: [],
        tags: ['ricetta', 'cambusa', 'primo', 'pasta', 'economico'],
        updatedAt: '2026-10-12T12:00:00.000Z',
        createdBy: 'cambusa@associazione.org',
        isReadOnly: false
      },
      {
        resourceId: `res_demo_doc_05_${spaceId}`,
        spaceId,
        title: 'Modulistica Ufficiale Iscrizione & Consenso Privacy ETS',
        category: 'DOCUMENTS',
        descriptionMarkdown: `Modulo unificato conforme al Codice del Terzo Settore (D.Lgs. 117/2017) e GDPR 2016/679 contenente consenso informato, scheda sanitaria e patto educativo di corresponsabilità.`,
        coverImageUrl: null,
        sourcePluginId: 'minutes-tool',
        extractedMetadata: {
          doc_type: 'Modulo Iscrizione Ufficiale',
          year: '2026',
          approved_by: 'Consiglio Direttivo Ente',
          validity: 'Annuale (Rinnovabile)',
          protocol: 'MOD-ETS-2026-01'
        },
        attachments: [
          {
            fileId: 'att_mod_iscrizione',
            fileName: 'Modulo_Iscrizione_Privacy_2026.pdf',
            driveUrl: 'https://drive.google.com/file/d/demo_modulo_iscrizione',
            fileType: 'PDF'
          }
        ],
        tags: ['documento', 'privacy', 'iscrizione', 'gdpr', 'amministrazione'],
        updatedAt: '2026-10-10T09:00:00.000Z',
        createdBy: 'legale@associazione.org',
        isReadOnly: true
      },
      {
        resourceId: `res_demo_ws_06_${spaceId}`,
        spaceId,
        title: 'Laboratorio Tecnico: Costruzione Rifugio Sopraelevato',
        category: 'WORKSHOPS',
        descriptionMarkdown: `Scheda tecnica di pionieristica per la legatura quadra e diagonale di 4 pali portanti in legno di castagno per allestire un tavolo da campo sopraelevato o piattaforma d'avvistamento.`,
        coverImageUrl: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80',
        sourcePluginId: 'direct',
        extractedMetadata: {
          difficulty: 'Avanzato (Reparto/Pionieri)',
          duration: '3 ore di lavoro pratico',
          tools: 'Segaccio a lama curva, Raspa, Metro, Mazzetta',
          materials: '8 Pali castagno d=10cm, Cordino canapa 6mm (40m)',
          safety_notes: 'Obbligatorio casco e guanti crosta'
        },
        attachments: [
          {
            fileId: 'att_legature_pdf',
            fileName: 'Manuale_Legature_Pionieristica.pdf',
            driveUrl: 'https://drive.google.com/file/d/demo_legature',
            fileType: 'PDF'
          }
        ],
        tags: ['laboratorio', 'tecnica', 'pionieristica', 'legno', 'costruzioni'],
        updatedAt: '2026-10-08T16:00:00.000Z',
        createdBy: 'staff@associazione.org',
        isReadOnly: false
      }
    ];

    for (const item of demoItems) {
      await db.resources.put(item);
    }

    console.log(`[ResourceDataExtractor] 🌱 Popolato seed iniziale di ${demoItems.length} risorse per lo spazio "${spaceId}".`);
  }
}

export const resourceDataExtractor = ResourceDataExtractor.getInstance();
