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
 * NOME FILE: src/plugins/ResourcesPlugin/types.ts
 * ============================================================================
 * DESCRIZIONE:
 * Interfacce TypeScript e schemi di tipo per il Plugin "Risorse" (v2.0):
 * - ResourceItem: contratto unificato per qualsiasi risorsa (documenti, giochi, ricette, canti, case, ecc.)
 * - Master Categories & Custom categories
 * - Configurazione priorità badge su schede (Card Priority)
 * - Mappature dai plugin sorgente
 * ============================================================================
 */

export type ResourceCategory =
  | 'DOCUMENTS'
  | 'GAMES'
  | 'WORKSHOPS'
  | 'SONGS'
  | 'GRAPHICS'
  | 'LOCATIONS'
  | 'RECIPES'
  | 'CUSTOM'
  | string;

export interface ResourceAttachment {
  fileId: string;
  fileName: string;
  driveUrl: string;
  fileType: 'IMAGE' | 'PDF' | 'AUDIO' | 'GPX' | 'OTHER';
}

export interface ResourceItem {
  resourceId: string;                   // ID univoco della risorsa (es. "res_game_098")
  spaceId: string;                      // Spazio di appartenenza (es. "space-default")
  title: string;                        // Titolo della risorsa
  category: ResourceCategory;           // Categoria di appartenenza
  descriptionMarkdown: string;          // Descrizione/Contenuto testuale sintetico
  coverImageUrl?: string | null;        // URL dell'immagine di sfondo per l'header della card
  sourcePluginId: string;               // ID del plugin sorgente ("activity", "cambusa", "maps", "minutes", "direct")
  sourceEntityId?: string | null;       // ID dell'entità originaria nel plugin sorgente
  
  // Metadati specifici e dinamici estratti o inseriti
  extractedMetadata: Record<string, string | number | boolean | string[]>;
  
  // Allegati collegati (PDF, file audio, GPX, documentazione)
  attachments: ResourceAttachment[];
  
  tags: string[];                       // Tag per la ricerca e catalogazione
  updatedAt: string;                    // ISO Timestamp ultima modifica
  createdBy: string;                    // User ID o Email dell'autore
  isReadOnly: boolean;                  // Se true, la modifica diretta è inibita (richiede duplicazione/fork)
}

export type ResourceViewMode = 'CARDS' | 'LIST';

export interface CategoryMetadataFieldDef {
  key: string;
  label: string;
  icon: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  formatHint?: string;
  placeholder?: string;
}

export interface CategoryDefinition {
  id: ResourceCategory;
  label: string;
  icon: string;
  colorClass: string;
  gradientStyle: string;
  description: string;
  defaultPriorityFields: string[];
  availableFields: CategoryMetadataFieldDef[];
}

export interface SourceModuleMapping {
  sourcePluginId: string;
  label: string;
  icon: string;
  matchTagOrType?: string;
  targetCategory: ResourceCategory;
}

export interface ResourcesSpaceConfig {
  defaultView: ResourceViewMode;
  categoryPriority: Record<string, string[]>; // Categoria -> array di chiavi di metadati ordinati (3-5 campi)
  sourceMappings: SourceModuleMapping[];
  customCategories?: Array<{ id: string; label: string; icon: string; description: string }>;
}
