/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import { eventBus, EventBus } from './EventBus.js';

export type RenewalPolicy = 'NONE' | 'MANUAL_RENEWAL' | 'AUTO_RENEWAL';

export interface CategoryOption {
  value: string;                       // ID univoco e stabile (es. "bando_regione_2026", "cdc_reparto")
  label: string;                       // Etichetta visiva localizzata (es. "Bando Giovani 2026")
  validFrom: string;                   // Data ISO di inizio validità (es. "2025-10-01")
  validTo: string | null;              // Data ISO di fine validità (null = senza scadenza)
  renewalPolicy: RenewalPolicy;        // Politica di rinnovo/estensione
  previousPeriodId?: string | null;    // Riferimento all'istanza precedente in caso di rinnovo/continuità
  metadata?: Record<string, unknown>;  // Metadati accessori (es. ente erogatore, budget max)
}

export interface CategoryProviderDefinition {
  providerId: string;                  // ID univoco del provider (es. "bandi", "centri_di_costo")
  label: string;                       // Nome del provider nell'interfaccia (es. "Bando di Finanziamento")
  icon?: string;                       // Icona per il Drawer No-Code
  /**
   * Restituisce le opzioni di categorizzazione.
   * @param asOf Se Date, filtra le sole opzioni valide a quella data (UI inserimento).
   *             Se null, disabilita il filtro e restituisce l'intero storico (risoluzione tag).
   */
  resolveOptions(asOf?: Date | null): Promise<CategoryOption[]>;
}

export class CategoryProviderRegistry {
  private static instance: CategoryProviderRegistry;
  private providers = new Map<string, CategoryProviderDefinition>();
  private bus: EventBus;

  private constructor() {
    this.bus = eventBus;
  }

  public static getInstance(): CategoryProviderRegistry {
    if (!CategoryProviderRegistry.instance) {
      CategoryProviderRegistry.instance = new CategoryProviderRegistry();
    }
    return CategoryProviderRegistry.instance;
  }

  /**
   * Registra un nuovo provider di tassonomia (chiamato dai plugin al bootstrap)
   */
  public registerProvider(def: CategoryProviderDefinition): void {
    this.providers.set(def.providerId, def);
    this.bus.emit('category-provider:registered', { providerId: def.providerId });
    console.log(`[CategoryProviderRegistry] 🏷️ Registrato provider di tassonomia: "${def.label}" (${def.providerId})`);
  }

  /**
   * Restituisce le opzioni di tutti i provider registrati per il Drawer di selezione UI
   */
  public async listAllOptions(asOf: Date = new Date()): Promise<Record<string, CategoryOption[]>> {
    const result: Record<string, CategoryOption[]> = {};
    for (const [providerId, provider] of this.providers.entries()) {
      try {
        result[providerId] = await provider.resolveOptions(asOf);
      } catch (err) {
        this.bus.emit('category-provider:load_error', { providerId, error: err });
        result[providerId] = [];
      }
    }
    return result;
  }

  /**
   * Risolve un tag storico.
   * DEVE risolvere SEMPRE l'etichetta storica passando null a resolveOptions,
   * disabilitando i filtri temporali in modo che anche opzioni scadute vengano risolte.
   */
  public async resolveTag(providerId: string, value: string): Promise<CategoryOption | null> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      // Fallback elegante: provider non installato o non ancora registrato
      return null;
    }
    // Chiamata con null = carica intero storico senza filtro temporale validFrom <= asOf < validTo
    const options = await provider.resolveOptions(null);
    return options.find((opt) => opt.value === value) || null;
  }

  /**
   * Restituisce la definizione del provider dato il suo ID
   */
  public getProvider(providerId: string): CategoryProviderDefinition | undefined {
    return this.providers.get(providerId);
  }
}

export const categoryProviderRegistry = CategoryProviderRegistry.getInstance();
