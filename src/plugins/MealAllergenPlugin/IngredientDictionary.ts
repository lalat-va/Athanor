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
 * NOME FILE: src/plugins/MealAllergenPlugin/IngredientDictionary.ts
 * ============================================================================
 * DESCRIZIONE:
 * Dizionario Globale degli Ingredienti di Riferimento per la Cambusa dell'Ente:
 * - Standardizzazione delle nomenclature, categorie di conservazione e costi base
 * - Matrice di correlazione automatica con gli allergeni noti
 * - Persistenza e cache locale tramite tabella Dexie `global_ingredients`
 * ============================================================================
 */

import { db, GlobalIngredientRecord } from '../../base/Database.js';
import { StorageCategory } from './types.js';

export interface StandardIngredient {
  ingredientId: string;
  name: string;
  category: StorageCategory;
  unit: string;
  defaultUnitCost: number;
  allergens: string[];
}

export class IngredientDictionary {
  private static instance: IngredientDictionary;

  private defaultCatalog: StandardIngredient[] = [
    { ingredientId: 'ing_penne', name: 'Penne rigate', category: 'NON_DEPERIBILE', unit: 'kg', defaultUnitCost: 1.50, allergens: ['Glutine'] },
    { ingredientId: 'ing_spaghetti', name: 'Spaghetti', category: 'NON_DEPERIBILE', unit: 'kg', defaultUnitCost: 1.50, allergens: ['Glutine'] },
    { ingredientId: 'ing_riso', name: 'Riso Carnaroli', category: 'NON_DEPERIBILE', unit: 'kg', defaultUnitCost: 2.20, allergens: [] },
    { ingredientId: 'ing_passata', name: 'Passata di pomodoro', category: 'NON_DEPERIBILE', unit: 'kg', defaultUnitCost: 1.80, allergens: [] },
    { ingredientId: 'ing_pelati', name: 'Pomodori pelati', category: 'NON_DEPERIBILE', unit: 'kg', defaultUnitCost: 1.60, allergens: [] },
    { ingredientId: 'ing_olio_evo', name: 'Olio extravergine di oliva', category: 'NON_DEPERIBILE', unit: 'l', defaultUnitCost: 8.50, allergens: [] },
    { ingredientId: 'ing_parmigiano', name: 'Parmigiano Reggiano grattugiato', category: 'FRESCO', unit: 'kg', defaultUnitCost: 18.00, allergens: ['Latte & Lattosio'] },
    { ingredientId: 'ing_mozzarella', name: 'Mozzarella vaccina', category: 'FRESCO', unit: 'kg', defaultUnitCost: 7.50, allergens: ['Latte & Lattosio'] },
    { ingredientId: 'ing_ricotta', name: 'Ricotta fresca', category: 'FRESCO', unit: 'kg', defaultUnitCost: 6.00, allergens: ['Latte & Lattosio'] },
    { ingredientId: 'ing_burro', name: 'Burro', category: 'FRESCO', unit: 'kg', defaultUnitCost: 8.00, allergens: ['Latte & Lattosio'] },
    { ingredientId: 'ing_uova', name: 'Uova fresche', category: 'FRESCO', unit: 'pz', defaultUnitCost: 0.30, allergens: ['Uova'] },
    { ingredientId: 'ing_pollo', name: 'Petto di pollo a fette', category: 'CARNI_E_PESCE', unit: 'kg', defaultUnitCost: 8.90, allergens: [] },
    { ingredientId: 'ing_macinato', name: 'Macinato misto (bovino/suino)', category: 'CARNI_E_PESCE', unit: 'kg', defaultUnitCost: 8.20, allergens: [] },
    { ingredientId: 'ing_tonno', name: 'Tonno sott\'olio', category: 'NON_DEPERIBILE', unit: 'kg', defaultUnitCost: 12.00, allergens: ['Pesce'] },
    { ingredientId: 'ing_cipolla', name: 'Cipolle dorate', category: 'ORTOFRUTTA', unit: 'kg', defaultUnitCost: 1.20, allergens: [] },
    { ingredientId: 'ing_carota', name: 'Carote', category: 'ORTOFRUTTA', unit: 'kg', defaultUnitCost: 1.10, allergens: [] },
    { ingredientId: 'ing_sedano', name: 'Sedano da costa', category: 'ORTOFRUTTA', unit: 'kg', defaultUnitCost: 1.50, allergens: ['Sedano'] },
    { ingredientId: 'ing_zucchine', name: 'Zucchine', category: 'ORTOFRUTTA', unit: 'kg', defaultUnitCost: 1.80, allergens: [] },
    { ingredientId: 'ing_patate', name: 'Patate gialle', category: 'ORTOFRUTTA', unit: 'kg', defaultUnitCost: 1.20, allergens: [] },
    { ingredientId: 'ing_mele', name: 'Mele Golden', category: 'ORTOFRUTTA', unit: 'kg', defaultUnitCost: 1.60, allergens: [] },
    { ingredientId: 'ing_banane', name: 'Banane', category: 'ORTOFRUTTA', unit: 'kg', defaultUnitCost: 1.80, allergens: [] },
    { ingredientId: 'ing_pane', name: 'Pane comune a fette', category: 'NON_DEPERIBILE', unit: 'kg', defaultUnitCost: 2.50, allergens: ['Glutine'] },
    { ingredientId: 'ing_fette_bisc', name: 'Fette biscottate', category: 'NON_DEPERIBILE', unit: 'kg', defaultUnitCost: 3.20, allergens: ['Glutine'] },
    { ingredientId: 'ing_marmellata', name: 'Marmellata assortita', category: 'NON_DEPERIBILE', unit: 'kg', defaultUnitCost: 4.50, allergens: [] },
    { ingredientId: 'ing_latte', name: 'Latte intero UHT', category: 'NON_DEPERIBILE', unit: 'l', defaultUnitCost: 1.20, allergens: ['Latte & Lattosio'] },
    { ingredientId: 'ing_biscotti', name: 'Biscotti frollini', category: 'NON_DEPERIBILE', unit: 'kg', defaultUnitCost: 2.80, allergens: ['Glutine', 'Latte & Lattosio', 'Uova'] },
    { ingredientId: 'ing_piselli_surg', name: 'Piselli fini surgelati', category: 'SURGELATI', unit: 'kg', defaultUnitCost: 2.20, allergens: [] },
    { ingredientId: 'ing_sale', name: 'Sale fino da cucina', category: 'NON_DEPERIBILE', unit: 'kg', defaultUnitCost: 0.40, allergens: [] },
    { ingredientId: 'ing_zucchero', name: 'Zucchero semolato', category: 'NON_DEPERIBILE', unit: 'kg', defaultUnitCost: 1.10, allergens: [] }
  ];

  public static getInstance(): IngredientDictionary {
    if (!IngredientDictionary.instance) {
      IngredientDictionary.instance = new IngredientDictionary();
    }
    return IngredientDictionary.instance;
  }

  /**
   * Inizializza il catalogo degli ingredienti nel database IndexedDB se vuoto
   */
  public async initCatalog(): Promise<void> {
    try {
      const count = await db.global_ingredients.count();
      if (count === 0) {
        for (const ing of this.defaultCatalog) {
          await db.global_ingredients.put(ing);
        }
        console.log(`[IngredientDictionary] Inizializzato dizionario con ${this.defaultCatalog.length} ingredienti.`);
      }
    } catch (e) {
      console.warn('[IngredientDictionary] Errore inizializzazione catalogo ingredienti:', e);
    }
  }

  public async getAll(): Promise<StandardIngredient[]> {
    try {
      await this.initCatalog();
      const list = await db.global_ingredients.toArray();
      return list as StandardIngredient[];
    } catch {
      return [...this.defaultCatalog];
    }
  }

  public async search(term: string): Promise<StandardIngredient[]> {
    const all = await this.getAll();
    if (!term.trim()) return all;
    const q = term.toLowerCase().trim();
    return all.filter((i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }

  public async findByName(name: string): Promise<StandardIngredient | undefined> {
    const all = await this.getAll();
    return all.find((i) => i.name.toLowerCase().trim() === name.toLowerCase().trim());
  }

  public async addOrUpdate(item: StandardIngredient): Promise<void> {
    const record: GlobalIngredientRecord = {
      ingredientId: item.ingredientId,
      name: item.name,
      category: item.category,
      unit: item.unit,
      defaultUnitCost: item.defaultUnitCost,
      allergens: item.allergens,
      isCustom: true
    };
    await db.global_ingredients.put(record);
  }
}

export const ingredientDictionary = IngredientDictionary.getInstance();
