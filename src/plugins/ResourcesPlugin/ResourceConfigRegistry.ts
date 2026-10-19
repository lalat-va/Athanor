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
 * NOME FILE: src/plugins/ResourcesPlugin/ResourceConfigRegistry.ts
 * ============================================================================
 * DESCRIZIONE:
 * Registro e motore di configurazione per il Plugin "Risorse":
 * - Definizioni delle Categorie Master (Giochi, Case, Canti, Ricette, Documenti, ecc.)
 * - Metadati specifici e campi disponibili per ciascuna categoria
 * - Regole di priorità dei badge sintetici per le schede visive (Card Priority Engine)
 * - Mappatura dei moduli sorgente verso le Categorie Risorse
 * - Persistenza configurazione per Spazio in Dexie (resources_config_{spaceId})
 * - Registrazione provider nel CategoryProviderRegistry del Core
 * ============================================================================
 */

import {
  CategoryDefinition,
  ResourceCategory,
  ResourcesSpaceConfig,
  SourceModuleMapping
} from './types.js';
import { db } from '../../base/Database.js';
import { categoryProviderRegistry, CategoryOption } from '../../base/CategoryProviderRegistry.js';

export class ResourceConfigRegistry {
  private static instance: ResourceConfigRegistry;

  // Categorie Master predefinite
  private categories: Map<ResourceCategory, CategoryDefinition> = new Map();

  // Mappature sorgente predefinite
  private defaultSourceMappings: SourceModuleMapping[] = [
    { sourcePluginId: 'activity', label: 'Modulo Attività (#gioco)', icon: '🎮', matchTagOrType: 'gioco', targetCategory: 'GAMES' },
    { sourcePluginId: 'activity', label: 'Modulo Attività (#bottega)', icon: '🛠️', matchTagOrType: 'bottega', targetCategory: 'WORKSHOPS' },
    { sourcePluginId: 'cambusa', label: 'Modulo Cambusa (Ricette)', icon: '🍲', targetCategory: 'RECIPES' },
    { sourcePluginId: 'maps', label: 'Modulo Mappe (Basi & Punti)', icon: '🏡', targetCategory: 'LOCATIONS' },
    { sourcePluginId: 'minutes', label: 'Modulo Verbali (Delibere)', icon: '📄', targetCategory: 'DOCUMENTS' }
  ];

  private constructor() {
    this.initMasterCategories();
    this.registerWithCategoryProviderRegistry();
  }

  public static getInstance(): ResourceConfigRegistry {
    if (!ResourceConfigRegistry.instance) {
      ResourceConfigRegistry.instance = new ResourceConfigRegistry();
    }
    return ResourceConfigRegistry.instance;
  }

  private initMasterCategories(): void {
    const list: CategoryDefinition[] = [
      {
        id: 'DOCUMENTS',
        label: 'Documenti e Modelli',
        icon: '📄',
        colorClass: 'border-blue-500/80 bg-blue-950/40 text-blue-300',
        gradientStyle: 'linear-gradient(135deg, rgba(30, 58, 138, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
        description: 'Modulistica, regolamenti, circolari, verbali approvati, guide legali e modelli ufficiali.',
        defaultPriorityFields: ['doc_type', 'year', 'approved_by', 'validity'],
        availableFields: [
          { key: 'doc_type', label: 'Tipologia Atto / Modello', icon: '📜', type: 'string', placeholder: 'es. Regolamento / Modulo Iscrizione' },
          { key: 'year', label: 'Anno Sociale / Esercizio', icon: '📅', type: 'string', placeholder: 'es. 2026' },
          { key: 'approved_by', label: 'Organo Deliberante', icon: '🏛️', type: 'string', placeholder: 'es. Assemblea dei Soci / Consiglio' },
          { key: 'validity', label: 'Durata Validità', icon: '⏳', type: 'string', placeholder: 'es. Triennale / Permanente' },
          { key: 'protocol', label: 'Protocollo / Riferimento', icon: '🔢', type: 'string', placeholder: 'es. PROT-2026-08' }
        ]
      },
      {
        id: 'GAMES',
        label: 'Giochi',
        icon: '🎮',
        colorClass: 'border-purple-500/80 bg-purple-950/40 text-purple-300',
        gradientStyle: 'linear-gradient(135deg, rgba(88, 28, 135, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
        description: 'Schede di giochi da campo, dinamiche di gruppo, regole, materiale occorrente ed età consigliata.',
        defaultPriorityFields: ['durata_min', 'part_range', 'eta_target', 'materials_summary'],
        availableFields: [
          { key: 'durata_min', label: 'Durata Stimata', icon: '⏱️', type: 'string', placeholder: 'es. 90 min' },
          { key: 'part_range', label: 'Numero Partecipanti', icon: '👥', type: 'string', placeholder: 'es. 20-50' },
          { key: 'eta_target', label: 'Fascia d\'Età / Branca', icon: '👦', type: 'string', placeholder: 'es. 8-11y (Lupetti/Coccinelle)' },
          { key: 'materials_summary', label: 'Materiale Occorrente', icon: '🛠️', type: 'string', placeholder: 'es. Scalpi, Fazzoletti, Fischietto' },
          { key: 'location_type', label: 'Ambiente di Gioco', icon: '🌲', type: 'string', placeholder: 'es. Bosco / Aperto / Salone' },
          { key: 'ambientazione', label: 'Tema / Ambientazione', icon: '🎭', type: 'string', placeholder: 'es. Giungla / Medioevo' }
        ]
      },
      {
        id: 'WORKSHOPS',
        label: 'Laboratori e Botteghe',
        icon: '🛠️',
        colorClass: 'border-amber-500/80 bg-amber-950/40 text-amber-300',
        gradientStyle: 'linear-gradient(135deg, rgba(120, 53, 15, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
        description: 'Attività pratiche, pionieristica, manualità, schede tecniche di costruzione, uscite e botteghe.',
        defaultPriorityFields: ['difficulty', 'duration', 'tools', 'materials'],
        availableFields: [
          { key: 'difficulty', label: 'Difficoltà Tecnica', icon: '⭐', type: 'string', placeholder: 'es. Intermedio' },
          { key: 'duration', label: 'Tempo Realizzazione', icon: '⏱️', type: 'string', placeholder: 'es. 2 ore' },
          { key: 'tools', label: 'Attrezzi Necessari', icon: '🪓', type: 'string', placeholder: 'es. Segaccio, Coltello, Raspa' },
          { key: 'materials', label: 'Materiali di Consumo', icon: '🪵', type: 'string', placeholder: 'es. Cordini 3mm, Pali castagno' },
          { key: 'safety_notes', label: 'DPI e Note di Sicurezza', icon: '⚠️', type: 'string', placeholder: 'es. Guanti da lavoro protettivi' }
        ]
      },
      {
        id: 'SONGS',
        label: 'Canti & Musica',
        icon: '🎵',
        colorClass: 'border-emerald-500/80 bg-emerald-950/40 text-emerald-300',
        gradientStyle: 'linear-gradient(135deg, rgba(6, 78, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
        description: 'Testi, spartiti, accordi per chitarra, audio di prova, canti di fuoco e momenti di animazione.',
        defaultPriorityFields: ['key', 'rhythm', 'moment', 'author'],
        availableFields: [
          { key: 'key', label: 'Tonalità Principale', icon: '🎼', type: 'string', placeholder: 'es. Sol Maggiore (G)' },
          { key: 'rhythm', label: 'Ritmo / Tempo', icon: '🥁', type: 'string', placeholder: 'es. 4/4 Allegro / Marcia' },
          { key: 'moment', label: 'Momento d\'Uso', icon: '🔥', type: 'string', placeholder: 'es. Fuoco di bivacco / Cammino' },
          { key: 'author', label: 'Autore / Origine', icon: '✍️', type: 'string', placeholder: 'es. Tradizionale / B-P' },
          { key: 'has_chords', label: 'Presenza Accordi', icon: '🎸', type: 'string', placeholder: 'es. Sì (spartito incluso)' }
        ]
      },
      {
        id: 'GRAPHICS',
        label: 'Materiale Grafico & Media',
        icon: '🎨',
        colorClass: 'border-pink-500/80 bg-pink-950/40 text-pink-300',
        gradientStyle: 'linear-gradient(135deg, rgba(131, 24, 67, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
        description: 'Loghi dell\'associazione, illustrazioni, locandine, template grafici e foto di copertina.',
        defaultPriorityFields: ['format', 'dimensions', 'color_mode', 'license'],
        availableFields: [
          { key: 'format', label: 'Formato Grafico', icon: '🖼️', type: 'string', placeholder: 'es. SVG Vettoriale / PNG Trasparente' },
          { key: 'dimensions', label: 'Dimensioni / Risoluzione', icon: '📐', type: 'string', placeholder: 'es. 300 DPI / 4K' },
          { key: 'color_mode', label: 'Spazio Colore', icon: '🌈', type: 'string', placeholder: 'es. CMYK Stampa / RGB Schermo' },
          { key: 'license', label: 'Licenza d\'Uso', icon: '⚖️', type: 'string', placeholder: 'es. Uso Interno Riservato' }
        ]
      },
      {
        id: 'LOCATIONS',
        label: 'Case e Posti',
        icon: '🏡',
        colorClass: 'border-cyan-500/80 bg-cyan-950/40 text-cyan-300',
        gradientStyle: 'linear-gradient(135deg, rgba(22, 78, 99, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
        description: 'Censimento di case vacanze, basi scout, terreni da campeggio, rifugi alpini e contatti gestori.',
        defaultPriorityFields: ['capacity', 'cost_per_day', 'services', 'contacts'],
        availableFields: [
          { key: 'capacity', label: 'Capienza Posti Letto / Tende', icon: '🛏️', type: 'string', placeholder: 'es. 45 letti / 80 in tenda' },
          { key: 'cost_per_day', label: 'Costo Indicativo / Notte', icon: '💶', type: 'string', placeholder: 'es. 8.50 € a persona/giorno' },
          { key: 'services', label: 'Servizi & Utenze', icon: '⚡', type: 'string', placeholder: 'es. Cucina ind., Acqua potabile, Docce' },
          { key: 'contacts', label: 'Contatto Gestore / Custode', icon: '📞', type: 'string', placeholder: 'es. Mario Bianchi 333-1234567' },
          { key: 'altitude', label: 'Altitudine & Posizione', icon: '⛰️', type: 'string', placeholder: 'es. 750 m s.l.m. - Parco Appennino' }
        ]
      },
      {
        id: 'RECIPES',
        label: 'Ricette & Cambusa',
        icon: '🍲',
        colorClass: 'border-orange-500/80 bg-orange-950/40 text-orange-300',
        gradientStyle: 'linear-gradient(135deg, rgba(154, 52, 18, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
        description: 'Menù bilanciati per campi, dosi scalate per grandi numeri, schede ingredienti e gestione allergeni.',
        defaultPriorityFields: ['servings', 'cost_per_person', 'prep_time', 'allergens'],
        availableFields: [
          { key: 'servings', label: 'Dosi Base Persone', icon: '🥣', type: 'string', placeholder: 'es. 50 persone' },
          { key: 'cost_per_person', label: 'Costo a Persona Stimato', icon: '💰', type: 'string', placeholder: 'es. 2.10 € / persona' },
          { key: 'prep_time', label: 'Tempo Cottura & Prep.', icon: '⏱️', type: 'string', placeholder: 'es. 40 minuti' },
          { key: 'allergens', label: 'Allergeni Dichiarati', icon: '⚠️', type: 'string', placeholder: 'es. Glutine, Lattosio' },
          { key: 'difficulty', label: 'Difficoltà Fuochi da Campo', icon: '🍳', type: 'string', placeholder: 'es. Facile (2 pentoloni)' }
        ]
      },
      {
        id: 'CUSTOM',
        label: 'Altro / Personalizzato',
        icon: '⚙️',
        colorClass: 'border-slate-500/80 bg-slate-900/60 text-slate-300',
        gradientStyle: 'linear-gradient(135deg, rgba(51, 65, 85, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
        description: 'Categoria flessibile per qualsiasi altra risorsa dell\'associazione.',
        defaultPriorityFields: ['field1', 'field2', 'field3', 'field4'],
        availableFields: [
          { key: 'field1', label: 'Parametro 1', icon: '📌', type: 'string', placeholder: 'Valore 1' },
          { key: 'field2', label: 'Parametro 2', icon: '🏷️', type: 'string', placeholder: 'Valore 2' },
          { key: 'field3', label: 'Parametro 3', icon: '💡', type: 'string', placeholder: 'Valore 3' },
          { key: 'field4', label: 'Note Accessorie', icon: '📝', type: 'string', placeholder: 'Dettagli' }
        ]
      }
    ];

    list.forEach((cat) => this.categories.set(cat.id, cat));
  }

  private registerWithCategoryProviderRegistry(): void {
    categoryProviderRegistry.registerProvider({
      providerId: 'resources_master_categories',
      label: 'Categorie Master Risorse',
      icon: '📚',
      resolveOptions: async () => {
        return Array.from(this.categories.values()).map((c): CategoryOption => ({
          value: c.id,
          label: `${c.icon} ${c.label}`,
          validFrom: '2020-01-01',
          validTo: null,
          renewalPolicy: 'NONE',
          metadata: { color: c.colorClass, description: c.description }
        }));
      }
    });
  }

  public getAllCategories(): CategoryDefinition[] {
    return Array.from(this.categories.values());
  }

  public getCategory(id: ResourceCategory): CategoryDefinition | undefined {
    return this.categories.get(id) || this.categories.get('CUSTOM');
  }

  public getDefaultSourceMappings(): SourceModuleMapping[] {
    return [...this.defaultSourceMappings];
  }

  /**
   * Recupera o genera la configurazione delle Risorse per lo Spazio attivo
   */
  public async getSpaceConfig(spaceId: string): Promise<ResourcesSpaceConfig> {
    const configKey = `resources_config_${spaceId}`;
    try {
      const record = await db.settings.get(configKey);
      if (record && record.value) {
        return {
          defaultView: record.value.defaultView || 'CARDS',
          categoryPriority: record.value.categoryPriority || this.buildDefaultPriorityMap(),
          sourceMappings: record.value.sourceMappings || this.defaultSourceMappings,
          customCategories: record.value.customCategories || []
        };
      }
    } catch (e) {
      console.warn(`[ResourceConfigRegistry] Errore lettura config ${configKey}:`, e);
    }

    const defaultConfig: ResourcesSpaceConfig = {
      defaultView: 'CARDS',
      categoryPriority: this.buildDefaultPriorityMap(),
      sourceMappings: this.defaultSourceMappings,
      customCategories: []
    };

    // Salva default iniziale
    try {
      await db.settings.put({
        key: configKey,
        value: defaultConfig,
        lastUpdated: Date.now()
      });
    } catch (err) {
      console.warn('[ResourceConfigRegistry] Errore salvataggio default config:', err);
    }

    return defaultConfig;
  }

  /**
   * Salva la configurazione delle Risorse per lo Spazio
   */
  public async saveSpaceConfig(spaceId: string, config: ResourcesSpaceConfig): Promise<void> {
    const configKey = `resources_config_${spaceId}`;
    try {
      await db.settings.put({
        key: configKey,
        value: config,
        lastUpdated: Date.now()
      });
      console.log(`[ResourceConfigRegistry] 💾 Configurazione Risorse salvata per spazio "${spaceId}".`);
    } catch (e) {
      console.error('[ResourceConfigRegistry] Errore salvataggio configurazione Risorse:', e);
    }
  }

  private buildDefaultPriorityMap(): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    for (const [id, cat] of this.categories.entries()) {
      map[id] = [...cat.defaultPriorityFields];
    }
    return map;
  }
}

export const resourceConfigRegistry = ResourceConfigRegistry.getInstance();
