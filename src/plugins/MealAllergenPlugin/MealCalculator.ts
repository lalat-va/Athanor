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
 * NOME FILE: src/plugins/MealAllergenPlugin/MealCalculator.ts
 * ============================================================================
 * DESCRIZIONE:
 * Motore matematico e nutrizionale per il Plugin Pasti & Allergeni:
 * 1. Ricalcolo proporzionale delle dosi con precisione a 3 decimali
 *    Formula: Quantità = (Quantità Base / Porzioni Base) * Partecipanti
 * 2. Generatore aggregato della Lista della Spesa con categorizzazione stoccaggio
 * 3. Matrice giornaliera degli allergeni per la conformità di sicurezza
 * 4. Calcolo preventivo economico complessivo della cambusa
 * ============================================================================
 */

import {
  IngredientItem,
  MealRecipe,
  EventMenu,
  ShoppingListItem,
  DailyAllergenEntry,
  StorageCategory
} from './types.js';

export class MealCalculator {
  /**
   * Ricalcola le quantità degli ingredienti per il numero effettivo di partecipanti.
   * Precisione garantita a 3 cifre decimali.
   */
  public static calculateRequiredQuantities(
    ingredients: IngredientItem[],
    basePortions: number,
    targetParticipants: number
  ): IngredientItem[] {
    const safeBase = basePortions > 0 ? basePortions : 10;
    const safeTarget = targetParticipants > 0 ? targetParticipants : 1;
    const multiplier = safeTarget / safeBase;

    return ingredients.map((ing) => {
      const rawQty = ing.quantityBase * multiplier;
      // Arrotondamento matematico esatto a 3 decimali
      const roundedQty = Math.round((rawQty + Number.EPSILON) * 1000) / 1000;

      return {
        ...ing,
        quantityBase: roundedQty
      };
    });
  }

  /**
   * Calcola il costo totale stimato per una ricetta e un certo numero di partecipanti
   */
  public static calculateMealEstimatedCost(recipe: MealRecipe, participants: number): number {
    const scaledIngredients = this.calculateRequiredQuantities(
      recipe.ingredients,
      recipe.portionsBase || 10,
      participants
    );

    const totalFromIngredients = scaledIngredients.reduce((sum, ing) => {
      return sum + ing.quantityBase * (ing.estimatedUnitCost || 0);
    }, 0);

    if (totalFromIngredients > 0) {
      return Math.round(totalFromIngredients * 100) / 100;
    }

    // Fallback: se gli ingredienti non hanno costi unitari, usa estimatedCostPerPortion
    const costPerPortion = recipe.estimatedCostPerPortion || 1.50;
    return Math.round(costPerPortion * participants * 100) / 100;
  }

  /**
   * Aggrega tutti gli ingredienti di tutti i pasti del menù per generare la Lista della Spesa.
   * Raggruppa ingredienti identici con la medesima unità di misura.
   */
  public static generateShoppingList(menu: EventMenu): ShoppingListItem[] {
    const aggregationMap = new Map<string, {
      name: string;
      category: StorageCategory;
      totalQuantity: number;
      unit: string;
      estimatedCost: number;
      mealsOrigin: Set<string>;
      allergens: Set<string>;
    }>();

    menu.meals.forEach((m) => {
      const mealParticipants = m.customParticipantsCount || menu.participantsCount || 10;
      const scaled = this.calculateRequiredQuantities(
        m.recipe.ingredients || [],
        m.recipe.portionsBase || 10,
        mealParticipants
      );

      const mealLabel = `${m.date} (${m.mealType}): ${m.recipe.title}`;

      scaled.forEach((ing) => {
        const key = `${ing.name.toLowerCase().trim()}_${ing.unit.toLowerCase().trim()}`;
        const existing = aggregationMap.get(key);

        const cost = ing.quantityBase * (ing.estimatedUnitCost || 0);

        if (existing) {
          existing.totalQuantity += ing.quantityBase;
          existing.estimatedCost += cost;
          existing.mealsOrigin.add(mealLabel);
          (ing.allergens || []).forEach((a) => existing.allergens.add(a));
        } else {
          aggregationMap.set(key, {
            name: ing.name,
            category: ing.category || 'NON_DEPERIBILE',
            totalQuantity: ing.quantityBase,
            unit: ing.unit,
            estimatedCost: cost,
            mealsOrigin: new Set([mealLabel]),
            allergens: new Set(ing.allergens || [])
          });
        }
      });
    });

    const list: ShoppingListItem[] = [];
    const purchasedSet = new Set(menu.purchasedIngredients || []);

    aggregationMap.forEach((entry) => {
      list.push({
        name: entry.name,
        category: entry.category,
        totalQuantity: Math.round((entry.totalQuantity + Number.EPSILON) * 1000) / 1000,
        unit: entry.unit,
        estimatedCost: Math.round(entry.estimatedCost * 100) / 100,
        isPurchased: purchasedSet.has(entry.name),
        mealsOrigin: Array.from(entry.mealsOrigin),
        allergens: Array.from(entry.allergens)
      });
    });

    // Ordina per Categoria di Stoccaggio e poi Nome
    const categoryOrder: Record<StorageCategory, number> = {
      ORTOFRUTTA: 1,
      FRESCO: 2,
      CARNI_E_PESCE: 3,
      SURGELATI: 4,
      NON_DEPERIBILE: 5,
      ALTRO: 6
    };

    return list.sort((a, b) => {
      const orderA = categoryOrder[a.category] || 99;
      const orderB = categoryOrder[b.category] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Genera la matrice giornaliera degli allergeni per la tabella di sicurezza
   */
  public static generateDailyAllergenMatrix(menu: EventMenu): DailyAllergenEntry[] {
    return menu.meals.map((m) => {
      const allergensSet = new Set<string>();
      (m.recipe.ingredients || []).forEach((ing) => {
        (ing.allergens || []).forEach((a) => allergensSet.add(a));
      });
      (m.recipe.allergensList || []).forEach((a) => allergensSet.add(a));

      return {
        date: m.date,
        mealType: m.mealType,
        recipeTitle: m.recipe.title,
        allergens: Array.from(allergensSet)
      };
    });
  }

  /**
   * Calcola il preventivo economico complessivo del menù
   */
  public static calculateTotalMenuBudget(menu: EventMenu): {
    totalCost: number;
    costPerPersonPerDay: number;
    totalMealsCount: number;
  } {
    let totalCost = 0;
    menu.meals.forEach((m) => {
      const participants = m.customParticipantsCount || menu.participantsCount || 10;
      totalCost += this.calculateMealEstimatedCost(m.recipe, participants);
    });

    const uniqueDays = new Set(menu.meals.map((m) => m.date)).size || 1;
    const participants = menu.participantsCount || 1;
    const costPerPersonPerDay = totalCost / (participants * uniqueDays);

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      costPerPersonPerDay: Math.round(costPerPersonPerDay * 100) / 100,
      totalMealsCount: menu.meals.length
    };
  }
}
