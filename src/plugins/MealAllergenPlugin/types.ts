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
 * NOME FILE: src/plugins/MealAllergenPlugin/types.ts
 * ============================================================================
 * DESCRIZIONE:
 * Interfacce TypeScript e schemi dati per il Plugin "Pasti, Alimenti & Allergeni" (v2.0):
 * - Modello Ricetta Cambusa (MealRecipe) & Record Menù Evento (EventMenu)
 * - Ricalcolo proporzionale delle dosi con precisione a 3 decimali
 * - Tassonomia Categorie di Conservazione & Matrice 14 Allergeni UE (Reg. 1169/2011)
 * - Integrazione bidirezionale con Hub Risorse (ResourcesPlugin)
 * ============================================================================
 */

export type MealType = 'COLAZIONE' | 'PRANZO' | 'CENA' | 'MERENDA' | 'ALTRO';

export type StorageCategory =
  | 'FRESCO'
  | 'NON_DEPERIBILE'
  | 'ORTOFRUTTA'
  | 'CARNI_E_PESCE'
  | 'SURGELATI'
  | 'ALTRO';

export interface IngredientItem {
  name: string;
  category: StorageCategory;
  quantityBase: number; // Quantità per le porzioni base (es. 1.000 kg per 10 persone)
  unit: string;         // 'kg' | 'g' | 'l' | 'ml' | 'pz' | 'cucchiai' | 'confezioni'
  estimatedUnitCost: number; // Costo per unità di misura (es. 1.50 €/kg)
  allergens: string[];  // Es. ['Glutine', 'Latte']
}

export interface MealRecipe {
  recipeId: string;
  title: string;
  portionsBase: number; // Di default 10 persone
  cookingTimeMinutes: number;
  tags: string[];       // ['vegetariano', 'vegano', 'senza_glutine', 'primo', ecc.]
  estimatedCostPerPortion: number;
  ingredients: IngredientItem[];
  preparationMarkdown: string;
  allergensList: string[];
  coverImageUrl?: string | null;
  sourceResourceId?: string | null; // ID della risorsa nell'Hub Risorse se importata
  isFork?: boolean;                 // True se modificata localmente rispetto alla risorsa master
  forkNotes?: string;               // Note esplicative della variante per il campo
}

export interface ScheduledMeal {
  mealId: string;
  date: string;                     // Formato ISO 'YYYY-MM-DD'
  time: string;                     // Formato 'HH:mm'
  mealType: MealType;
  recipe: MealRecipe;
  customParticipantsCount?: number | null; // Se specificato per questo pasto
  notes?: string;
}

export interface EventMenu {
  menuId: string;
  spaceId: string;
  eventId: string;
  eventName: string;
  participantsCount: number;
  inheritParticipants: boolean;
  status: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED';
  meals: ScheduledMeal[];
  purchasedIngredients: string[];   // Nomi degli ingredienti spuntati nella lista spesa
  notes?: string;
  updatedAt: string;
}

export interface AllergenDefinition {
  id: string;
  code: string;
  name: string;
  icon: string;
  description: string;
}

export interface ShoppingListItem {
  name: string;
  category: StorageCategory;
  totalQuantity: number;            // Quantità scalata con max 3 decimali
  unit: string;
  estimatedCost: number;
  isPurchased: boolean;
  mealsOrigin: string[];            // Date e pasti in cui viene utilizzato
  allergens: string[];
}

export interface DailyAllergenEntry {
  date: string;
  mealType: MealType;
  recipeTitle: string;
  allergens: string[];
}
