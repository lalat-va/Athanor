/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import { db } from '../base/Database.js';
import { CategoryOption, CategoryProviderDefinition, categoryProviderRegistry } from '../base/CategoryProviderRegistry.js';

export interface CostCenterDefinition extends CategoryOption {
  budgetCode?: string;
  spaceId?: string;
  allocatedBudget?: number;
}

export interface CostCenterAssignmentRecord {
  assignmentId: string;
  spaceId: string;
  costCenterId: string;
  validFrom: string;
  validTo: string | null;
  assignedBy: string;
}

export class CostCenterRegistry implements CategoryProviderDefinition {
  private static instance: CostCenterRegistry;
  public providerId = 'centri_di_costo';
  public label = 'Centri di Costo';
  public icon = '📊';

  private costCenters: CostCenterDefinition[] = [
    {
      value: 'cdc_branca_eg_2026',
      label: 'CDC Branca Esploratori / Reparto',
      validFrom: '2025-10-01',
      validTo: '2026-09-30',
      renewalPolicy: 'AUTO_RENEWAL',
      budgetCode: 'CC-EG-01',
      spaceId: 'space_reparto',
      allocatedBudget: 3500
    },
    {
      value: 'cdc_direttivo_2026',
      label: 'CDC Co.Ca. / Direttivo Generale',
      validFrom: '2025-10-01',
      validTo: '2026-09-30',
      renewalPolicy: 'AUTO_RENEWAL',
      budgetCode: 'CC-DIR-02',
      spaceId: 'space_coca',
      allocatedBudget: 12000
    },
    {
      value: 'cdc_magazzino_2026',
      label: 'CDC Magazzino & Logistica Materiali',
      validFrom: '2025-10-01',
      validTo: '2026-09-30',
      renewalPolicy: 'AUTO_RENEWAL',
      budgetCode: 'CC-MAG-03',
      spaceId: 'space_magazzino',
      allocatedBudget: 4500
    }
  ];

  private constructor() {
    this.initFromStorage();
  }

  public static getInstance(): CostCenterRegistry {
    if (!CostCenterRegistry.instance) {
      CostCenterRegistry.instance = new CostCenterRegistry();
    }
    return CostCenterRegistry.instance;
  }

  private async initFromStorage(): Promise<void> {
    try {
      const saved = await db.settings.get('accounting.cost_centers');
      if (saved && Array.isArray(saved.value) && saved.value.length > 0) {
        this.costCenters = saved.value;
      }
    } catch (e) {
      console.warn('[CostCenterRegistry] Impossibile caricare i Centri di Costo salvati:', e);
    }
  }

  public registerSelf(): void {
    categoryProviderRegistry.registerProvider(this);
  }

  /**
   * Restituisce le opzioni di Centri di Costo.
   * Se asOf è null, disabilita il filtro temporale e restituisce l'intero storico.
   */
  public async resolveOptions(asOf?: Date | null): Promise<CostCenterDefinition[]> {
    await this.initFromStorage();

    if (asOf === null) {
      return [...this.costCenters];
    }

    const targetDate = (asOf || new Date()).toISOString().split('T')[0];
    return this.costCenters.filter((cc) => {
      const isAfterStart = !cc.validFrom || cc.validFrom <= targetDate;
      const isBeforeEnd = !cc.validTo || targetDate < cc.validTo;
      return isAfterStart && isBeforeEnd;
    });
  }

  public async getCostCentersForSpace(spaceId: string, asOf?: Date | null): Promise<CostCenterDefinition[]> {
    const all = await this.resolveOptions(asOf);
    return all.filter((cc) => !cc.spaceId || cc.spaceId === spaceId || spaceId === 'space-default');
  }

  public async resolveCostCenterAt(spaceId: string, dateIso: string): Promise<string | null> {
    const targetDate = dateIso ? dateIso.split('T')[0] : new Date().toISOString().split('T')[0];
    const options = await this.resolveOptions(null);
    const match = options.find(
      (cc) =>
        (cc.spaceId === spaceId || spaceId === 'space-default') &&
        (!cc.validFrom || cc.validFrom <= targetDate) &&
        (!cc.validTo || targetDate < cc.validTo)
    );
    return match ? match.value : null;
  }

  public async addCostCenter(cc: CostCenterDefinition): Promise<void> {
    const idx = this.costCenters.findIndex((c) => c.value === cc.value);
    if (idx >= 0) {
      this.costCenters[idx] = cc;
    } else {
      this.costCenters.push(cc);
    }

    try {
      await db.settings.put({
        key: 'accounting.cost_centers',
        value: this.costCenters,
        lastUpdated: Date.now()
      });
    } catch (e) {
      console.warn('[CostCenterRegistry] Errore salvataggio Centri di Costo in Dexie:', e);
    }
  }
}

export const costCenterRegistry = CostCenterRegistry.getInstance();
