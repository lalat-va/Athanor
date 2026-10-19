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
 * NOME FILE: src/plugins/MealAllergenPlugin.ts
 * ============================================================================
 * DESCRIZIONE:
 * Controller del Plugin "Pasti, Alimenti & Allergeni" (MealAllergenPlugin v2.0):
 * - Modulo logistico-alimentare e nutrizionale per la gestione dei campi ed eventi
 * - Partizionamento Y.Doc: PartitionGranularity = 'PER_INSTANCE' (`menu_{spaceId}_{eventId}`)
 * - Connessione bidirezionale nativa con l'Hub Risorse (ResourcesPlugin):
 *   • Importazione ricette collaudate da Risorse
 *   • Pubblicazione/Esportazione nuove ricette e varianti (Fork) nell'Hub Risorse
 * - Ricalcolo proporzionale automatico delle dosi (precisione a 3 decimali)
 * - Generazione Lista della Spesa aggregata e categorizzata con spunta acquisti
 * - Matrice di Sicurezza & Report Allergeni conforme al Reg. UE 1169/2011
 * - Integrazione EventBus con AccountingPlugin per la trasmissione automatica dei preventivi
 * ============================================================================
 */

import { AppPlugin } from './AppPlugin.js';
import { EventBus } from '../base/EventBus.js';
import { I18nManager } from '../base/I18nManager.js';
import { db, MenuRecord, AccountingTransactionRecord } from '../base/Database.js';
import {
  EventMenu,
  ScheduledMeal,
  MealRecipe,
  MealType,
  IngredientItem
} from './MealAllergenPlugin/types.js';
import { MealCalculator } from './MealAllergenPlugin/MealCalculator.js';
import { MenuScheduleView } from './MealAllergenPlugin/components/MenuScheduleView.js';
import { ShoppingListView } from './MealAllergenPlugin/components/ShoppingListView.js';
import { AllergenMatrixView } from './MealAllergenPlugin/components/AllergenMatrixView.js';
import { MealRecipeModal } from './MealAllergenPlugin/MealRecipeModal.js';
import { ResourceRecipeDrawer } from './MealAllergenPlugin/ResourceRecipeDrawer.js';
import { resourceDataExtractor } from './ResourcesPlugin/ResourceDataExtractor.js';
import { ResourceItem } from './ResourcesPlugin/types.js';

export interface MealAllergenPluginState {
  pluginId: string;
  activeSpaceId?: string;
  activeEventId?: string;
  activeTab?: 'schedule' | 'shopping' | 'allergens';
}

export class MealAllergenPlugin implements AppPlugin {
  public id = 'meal-allergen-tool';
  public name = 'Pasti, Alimenti & Allergeni';
  public isCollaborative = true;

  // Dichiarazione Partizionamento Y.Doc conforme alle specifiche
  public static readonly PartitionGranularity = 'PER_INSTANCE';

  private eventBus: EventBus | null = null;
  private activeSpaceId: string = 'space-default';
  private currentEventId: string = 'evt_campo_estivo_2026';
  private currentMenu: EventMenu | null = null;
  private currentContainer: HTMLElement | null = null;
  private activeTab: 'schedule' | 'shopping' | 'allergens' = 'schedule';

  public locales = {
    it: {
      title: 'Pasti, Alimenti & Allergeni',
      subtitle: 'Modulo Logistico-Alimentare, Dosi Proporzionali & Sicurezza Alimentare',
      tabSchedule: '📅 Menù Pasti',
      tabShopping: '🛒 Lista Spesa & Spunta',
      tabAllergens: '🛡️ Matrice Allergeni'
    },
    en: {
      title: 'Meals, Foods & Allergens',
      subtitle: 'Food Logistics, Proportional Portions & Food Safety',
      tabSchedule: '📅 Meal Schedule',
      tabShopping: '🛒 Shopping List',
      tabAllergens: '🛡️ Allergen Matrix'
    }
  };

  public async init(eventBus: EventBus, _i18n: I18nManager): Promise<void> {
    this.eventBus = eventBus;

    // Recupera lo Spazio attivo salvato
    try {
      const savedSpace = await db.settings.get('core.active_space_id');
      if (savedSpace && savedSpace.value) {
        this.activeSpaceId = savedSpace.value;
      }
    } catch (e) {
      console.warn('[MealAllergenPlugin] Errore lettura spazio attivo salvato:', e);
    }

    // Ascolto cambio Spazio
    this.eventBus.on('space:changed', async (payload: any) => {
      if (payload && payload.spaceId) {
        this.activeSpaceId = payload.spaceId;
        await this.loadMenu();
        if (this.currentContainer) {
          this.renderUI(this.currentContainer);
        }
      }
    });

    console.log('[MealAllergenPlugin] 🍳 Plugin Pasti, Alimenti & Allergeni v2.0 inizializzato.');
  }

  public async render(container: HTMLElement, dataState: MealAllergenPluginState, _locale: string): Promise<void> {
    this.currentContainer = container;

    if (dataState && dataState.activeSpaceId) {
      this.activeSpaceId = dataState.activeSpaceId;
    }
    if (dataState && dataState.activeEventId) {
      this.currentEventId = dataState.activeEventId;
    }
    if (dataState && dataState.activeTab) {
      this.activeTab = dataState.activeTab;
    }

    await this.loadMenu();
    this.renderUI(container);
  }

  public serializeToMarkdown(_dataState: any): string {
    if (!this.currentMenu) {
      return `## 🍳 MENÙ PASTI & ALLERGENI\n*Nessun menù caricato.*`;
    }

    const budget = MealCalculator.calculateTotalMenuBudget(this.currentMenu);
    const lines: string[] = [];
    lines.push(`## 🍳 PIANO PASTI & CAMBUSA: ${this.currentMenu.eventName}`);
    lines.push(`- **Spazio:** \`${this.currentMenu.spaceId}\` | **Partecipanti:** ${this.currentMenu.participantsCount}`);
    lines.push(`- **Preventivo Totale:** € ${budget.totalCost.toFixed(2)} (€ ${budget.costPerPersonPerDay.toFixed(2)}/pers/giorno)\n`);

    lines.push(`### 📅 Programma Pasti:`);
    this.currentMenu.meals.forEach((m, idx) => {
      lines.push(`${idx + 1}. **${m.date} - ${m.mealType} (${m.time})**: ${m.recipe.title}`);
      lines.push(`   - Allergeni: ${m.recipe.allergensList.join(', ') || 'Nessuno'}`);
    });

    return lines.join('\n');
  }

  // ==========================================================================
  // METODI DI INTEGRAZIONE BIDIREZIONALE CON L'HUB RISORSE (RESOURCESPLUGIN)
  // ==========================================================================

  /**
   * Importa una ricetta collaudata dall'Hub Risorse nel formato locale MealRecipe
   */
  public async importRecipeFromResources(resourceId: string): Promise<MealRecipe> {
    const res = await db.resources.get(resourceId);
    if (!res) {
      throw new Error(`Risorsa con ID "${resourceId}" non trovata nell'Hub Risorse.`);
    }

    const rawServings = res.extractedMetadata?.servings || '10';
    const portionsBase = parseInt(String(rawServings).replace(/\D/g, ''), 10) || 10;
    const rawTime = res.extractedMetadata?.prep_time || '30';
    const cookingTimeMinutes = parseInt(String(rawTime).replace(/\D/g, ''), 10) || 30;
    const rawCost = res.extractedMetadata?.cost_per_person || '1.80';
    const estimatedCostPerPortion = parseFloat(String(rawCost).replace(',', '.').replace(/[^0-9.]/g, '')) || 1.80;

    const rawAllergens = res.extractedMetadata?.allergens || '';
    const allergensList = typeof rawAllergens === 'string'
      ? rawAllergens.split(',').map((a: string) => a.trim()).filter(Boolean)
      : Array.isArray(rawAllergens)
      ? rawAllergens
      : [];

    const defaultIngredients: IngredientItem[] = [
      {
        name: res.title.toLowerCase().includes('pasta') ? 'Penne rigate' : 'Riso Carnaroli',
        category: 'NON_DEPERIBILE',
        quantityBase: Math.round((portionsBase * 0.1) * 1000) / 1000,
        unit: 'kg',
        estimatedUnitCost: 1.50,
        allergens: res.title.toLowerCase().includes('pasta') ? ['Glutine'] : []
      },
      {
        name: 'Passata di pomodoro',
        category: 'NON_DEPERIBILE',
        quantityBase: Math.round((portionsBase * 0.08) * 1000) / 1000,
        unit: 'kg',
        estimatedUnitCost: 1.80,
        allergens: []
      },
      {
        name: 'Parmigiano Reggiano grattugiato',
        category: 'FRESCO',
        quantityBase: Math.round((portionsBase * 0.02) * 1000) / 1000,
        unit: 'kg',
        estimatedUnitCost: 18.00,
        allergens: ['Latte & Lattosio']
      }
    ];

    return {
      recipeId: res.resourceId,
      title: res.title,
      portionsBase,
      cookingTimeMinutes,
      tags: res.tags || ['cambusa'],
      estimatedCostPerPortion,
      ingredients: defaultIngredients,
      preparationMarkdown: res.descriptionMarkdown || '',
      allergensList,
      coverImageUrl: res.coverImageUrl,
      sourceResourceId: res.resourceId,
      isFork: false
    };
  }

  /**
   * Converte e pubblica una ricetta locale del menù come ResourceItem nell'Hub Risorse
   */
  public async publishRecipeToResources(recipe: MealRecipe): Promise<string> {
    const resourceId = recipe.sourceResourceId || `res_rcp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const resourceItem: ResourceItem = {
      resourceId,
      spaceId: this.activeSpaceId,
      title: recipe.title,
      category: 'RECIPES',
      descriptionMarkdown: recipe.preparationMarkdown || `Ricetta di cambusa per ${recipe.portionsBase} persone.`,
      coverImageUrl: recipe.coverImageUrl || null,
      sourcePluginId: 'meal-allergen-tool',
      sourceEntityId: recipe.recipeId,
      extractedMetadata: {
        servings: `${recipe.portionsBase} persone`,
        cost_per_person: `${recipe.estimatedCostPerPortion.toFixed(2)} € / persona`,
        prep_time: `${recipe.cookingTimeMinutes} minuti`,
        allergens: (recipe.allergensList || []).join(', ') || 'Nessun allergene dichiarato',
        difficulty: 'Media'
      },
      attachments: [],
      tags: [...new Set(['ricetta', 'cambusa', ...recipe.tags])],
      updatedAt: new Date().toISOString(),
      createdBy: 'cambusa@associazione.org',
      isReadOnly: false
    };

    await resourceDataExtractor.saveResource(resourceItem);
    if (this.eventBus) {
      this.eventBus.emit('menu:recipe_added', resourceItem);
    }

    recipe.sourceResourceId = resourceId;
    await this.saveCurrentMenu();

    console.log(`[MealAllergenPlugin] 💾 Ricetta "${recipe.title}" pubblicata con successo nell'Hub Risorse.`);
    return resourceId;
  }

  /**
   * Ricalcola le dosi necessarie
   */
  public calculateRequiredQuantities(
    ingredients: IngredientItem[],
    basePortions: number,
    targetParticipants: number
  ): IngredientItem[] {
    return MealCalculator.calculateRequiredQuantities(ingredients, basePortions, targetParticipants);
  }

  // ==========================================================================
  // CARICAMENTO E PERSISTENZA MENÙ IN DEXIE E Y.DOC (PER_INSTANCE)
  // ==========================================================================

  private async loadMenu(): Promise<void> {
    try {
      const record = await db.menus
        .where('spaceId')
        .equals(this.activeSpaceId)
        .and((m) => m.eventId === this.currentEventId)
        .first();

      if (record) {
        this.currentMenu = {
          menuId: record.menuId,
          spaceId: record.spaceId,
          eventId: record.eventId,
          eventName: record.eventName,
          participantsCount: record.participantsCount,
          inheritParticipants: record.inheritParticipants,
          status: record.status,
          meals: record.meals || [],
          purchasedIngredients: record.purchasedIngredients || [],
          notes: record.notes,
          updatedAt: record.updatedAt
        };
      } else {
        // Se non esiste ancora per questo evento, popola il menù demo iniziale
        await this.seedDemoMenuIfEmpty();
        const demoRecord = await db.menus
          .where('spaceId')
          .equals(this.activeSpaceId)
          .and((m) => m.eventId === this.currentEventId)
          .first();

        if (demoRecord) {
          this.currentMenu = demoRecord as EventMenu;
        }
      }
    } catch (e) {
      console.warn('[MealAllergenPlugin] Errore lettura menù da Dexie:', e);
    }
  }

  private async saveCurrentMenu(): Promise<void> {
    if (!this.currentMenu) return;
    this.currentMenu.updatedAt = new Date().toISOString();

    const record: MenuRecord = {
      menuId: this.currentMenu.menuId,
      spaceId: this.currentMenu.spaceId,
      eventId: this.currentMenu.eventId,
      eventName: this.currentMenu.eventName,
      participantsCount: this.currentMenu.participantsCount,
      inheritParticipants: this.currentMenu.inheritParticipants,
      status: this.currentMenu.status,
      meals: this.currentMenu.meals,
      purchasedIngredients: this.currentMenu.purchasedIngredients,
      notes: this.currentMenu.notes,
      updatedAt: this.currentMenu.updatedAt
    };

    await db.menus.put(record);
  }

  private async seedDemoMenuIfEmpty(): Promise<void> {
    const demoMenu: EventMenu = {
      menuId: `menu_${this.activeSpaceId}_${this.currentEventId}`,
      spaceId: this.activeSpaceId,
      eventId: this.currentEventId,
      eventName: 'Campo Estivo Reparto 2026 (Val Fondillo)',
      participantsCount: 42,
      inheritParticipants: true,
      status: 'CONFIRMED',
      purchasedIngredients: ['Penne rigate', 'Sale fino da cucina'],
      updatedAt: new Date().toISOString(),
      meals: [
        {
          mealId: 'meal_demo_01',
          date: '2026-08-03',
          time: '12:30',
          mealType: 'PRANZO',
          recipe: {
            recipeId: 'rec_pasta_pomodoro_demo',
            title: 'Pasta al Pomodoro e Parmigiano',
            portionsBase: 10,
            cookingTimeMinutes: 25,
            tags: ['primo', 'vegetariano', 'classico'],
            estimatedCostPerPortion: 1.40,
            ingredients: [
              { name: 'Penne rigate', category: 'NON_DEPERIBILE', quantityBase: 1.000, unit: 'kg', estimatedUnitCost: 1.50, allergens: ['Glutine'] },
              { name: 'Passata di pomodoro', category: 'NON_DEPERIBILE', quantityBase: 0.800, unit: 'kg', estimatedUnitCost: 1.80, allergens: [] },
              { name: 'Parmigiano Reggiano grattugiato', category: 'FRESCO', quantityBase: 0.200, unit: 'kg', estimatedUnitCost: 18.00, allergens: ['Latte & Lattosio'] },
              { name: 'Olio extravergine di oliva', category: 'NON_DEPERIBILE', quantityBase: 0.150, unit: 'l', estimatedUnitCost: 8.50, allergens: [] }
            ],
            preparationMarkdown: 'Portare a ebollizione l\'acqua salata. Cuocere le penne per 10 minuti, scolare e condire.',
            allergensList: ['Glutine', 'Latte & Lattosio'],
            coverImageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281728?auto=format&fit=crop&w=800&q=80',
            isFork: false
          }
        },
        {
          mealId: 'meal_demo_02',
          date: '2026-08-03',
          time: '19:45',
          mealType: 'CENA',
          recipe: {
            recipeId: 'rec_pollo_zucchine_demo',
            title: 'Bocconcini di Pollo con Zucchine Trifolate',
            portionsBase: 10,
            cookingTimeMinutes: 35,
            tags: ['secondo', 'senza_glutine', 'carne'],
            estimatedCostPerPortion: 2.60,
            ingredients: [
              { name: 'Petto di pollo a fette', category: 'CARNI_E_PESCE', quantityBase: 1.500, unit: 'kg', estimatedUnitCost: 8.90, allergens: [] },
              { name: 'Zucchine', category: 'ORTOFRUTTA', quantityBase: 1.200, unit: 'kg', estimatedUnitCost: 1.80, allergens: [] },
              { name: 'Cipolle dorate', category: 'ORTOFRUTTA', quantityBase: 0.300, unit: 'kg', estimatedUnitCost: 1.20, allergens: [] },
              { name: 'Olio extravergine di oliva', category: 'NON_DEPERIBILE', quantityBase: 0.100, unit: 'l', estimatedUnitCost: 8.50, allergens: [] }
            ],
            preparationMarkdown: 'Tagliare il pollo a bocconcini. Soffriggere la cipolla, unire le zucchine e poi il pollo a fuoco vivo.',
            allergensList: [],
            coverImageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
            isFork: false
          }
        },
        {
          mealId: 'meal_demo_03',
          date: '2026-08-04',
          time: '08:00',
          mealType: 'COLAZIONE',
          recipe: {
            recipeId: 'rec_colazione_campo_demo',
            title: 'Colazione Energetica di Bivacco',
            portionsBase: 10,
            cookingTimeMinutes: 15,
            tags: ['colazione', 'cambusa'],
            estimatedCostPerPortion: 0.90,
            ingredients: [
              { name: 'Latte intero UHT', category: 'NON_DEPERIBILE', quantityBase: 2.000, unit: 'l', estimatedUnitCost: 1.20, allergens: ['Latte & Lattosio'] },
              { name: 'Biscotti frollini', category: 'NON_DEPERIBILE', quantityBase: 0.800, unit: 'kg', estimatedUnitCost: 2.80, allergens: ['Glutine', 'Latte & Lattosio', 'Uova'] },
              { name: 'Fette biscottate', category: 'NON_DEPERIBILE', quantityBase: 0.400, unit: 'kg', estimatedUnitCost: 3.20, allergens: ['Glutine'] },
              { name: 'Marmellata assortita', category: 'NON_DEPERIBILE', quantityBase: 0.300, unit: 'kg', estimatedUnitCost: 4.50, allergens: [] }
            ],
            preparationMarkdown: 'Scaldare il latte nei bricchi grandi. Allestire tavolo self-service con fette e confetture.',
            allergensList: ['Glutine', 'Latte & Lattosio', 'Uova'],
            coverImageUrl: null,
            isFork: false
          }
        }
      ]
    };

    await db.menus.put(demoMenu as MenuRecord);
  }

  // ==========================================================================
  // RENDERING PRINCIPALE UI
  // ==========================================================================

  private renderUI(container: HTMLElement): void {
    if (!this.currentMenu) return;

    const budgetStats = MealCalculator.calculateTotalMenuBudget(this.currentMenu);

    container.innerHTML = `
      <div class="meal-allergen-plugin-root bg-slate-900 text-slate-100 rounded-2xl p-5 shadow-2xl border border-slate-800 space-y-5 font-sans text-xs">
        
        <!-- HEADER PRINCIPALE -->
        <div class="border-b border-slate-800 pb-4 flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-3">
            <span class="text-3xl">🍳</span>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-amber-400">Pasti, Alimenti & Allergeni</h2>
                <span class="text-[10px] bg-amber-950 text-amber-300 border border-amber-900 px-2 py-0.5 rounded font-mono font-bold">
                  v2.0
                </span>
                <span class="text-[10px] bg-blue-950 text-blue-300 border border-blue-900 px-2 py-0.5 rounded">
                  🔗 Hub Risorse Connesso
                </span>
              </div>
              <p class="text-[11px] text-slate-400 mt-0.5">
                Logistica Cambusa, Dosi Proporzionali, Matrice Allergeni e Gestione Ricette Condivise
              </p>
            </div>
          </div>

          <!-- CONTROLLI EVENTO & PARTECIPANTI -->
          <div class="flex items-center gap-3 flex-wrap">
            <div class="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <span class="text-slate-400 font-semibold text-[11px]">Partecipanti:</span>
              <input 
                type="number" 
                id="input-menu-participants" 
                value="${this.currentMenu.participantsCount}" 
                min="1" 
                max="500" 
                class="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-center text-blue-400 font-bold font-mono text-xs focus:border-blue-500 focus:outline-none" 
              />
              <span class="text-slate-500 text-[10px]">dosi</span>
            </div>

            <button id="btn-open-res-drawer" class="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow flex items-center gap-1.5 cursor-pointer" title="Cerca e importa ricette dall'Hub Risorse">
              <span>📚</span>
              <span>Pesca da Risorse</span>
            </button>

            <button id="btn-create-new-recipe" class="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer">
              <span>➕</span>
              <span>Nuovo Pasto</span>
            </button>
          </div>
        </div>

        <!-- BARRA NAVIGAZIONE SCHEDE (TABS) & STATS VELOCI -->
        <div class="bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between flex-wrap gap-3">
          
          <nav class="flex items-center gap-1">
            <button id="tab-btn-schedule" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              this.activeTab === 'schedule'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }">
              <span>📅</span>
              <span>Menù Pasti (${this.currentMenu.meals.length})</span>
            </button>

            <button id="tab-btn-shopping" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              this.activeTab === 'shopping'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }">
              <span>🛒</span>
              <span>Lista Spesa & Spunta</span>
            </button>

            <button id="tab-btn-allergens" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              this.activeTab === 'allergens'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }">
              <span>🛡️</span>
              <span>Matrice Allergeni</span>
            </button>
          </nav>

          <div class="text-[11px] text-slate-400 flex items-center gap-3">
            <span>Stima Spesa: <strong class="text-emerald-400 font-mono font-bold">${budgetStats.totalCost.toFixed(2)} €</strong></span>
            <span>•</span>
            <span>Spazio: <strong class="text-blue-300 font-mono">${this.activeSpaceId}</strong></span>
          </div>

        </div>

        <!-- CONTENITORE VISTA ATTIVA -->
        <div id="meal-view-mount" class="min-h-[420px]"></div>

      </div>
    `;

    this.renderActiveTab(container);
    this.bindMainEvents(container);
  }

  private renderActiveTab(container: HTMLElement): void {
    const mount = container.querySelector<HTMLElement>('#meal-view-mount');
    if (!mount || !this.currentMenu) return;

    if (this.activeTab === 'schedule') {
      MenuScheduleView.render(mount, {
        menu: this.currentMenu,
        onEditMeal: (meal) => {
          this.openRecipeModal(meal.recipe, (updatedRecipe) => {
            meal.recipe = updatedRecipe;
            this.saveCurrentMenu();
            this.renderUI(container);
          });
        },
        onDeleteMeal: (mealId) => {
          if (this.currentMenu) {
            this.currentMenu.meals = this.currentMenu.meals.filter((m) => m.mealId !== mealId);
            this.saveCurrentMenu();
            this.renderUI(container);
          }
        },
        onAddMeal: () => {
          this.addNewMealDialog();
        },
        onImportFromResources: () => {
          this.openResourceDrawer();
        },
        onPublishToResources: async (recipe) => {
          await this.publishRecipeToResources(recipe);
          alert(`✅ Ricetta "${recipe.title}" pubblicata con successo nell'Hub Risorse dello Spazio!`);
          this.renderUI(container);
        }
      });
    } else if (this.activeTab === 'shopping') {
      ShoppingListView.render(mount, {
        menu: this.currentMenu,
        onTogglePurchased: (ingredientName) => {
          if (!this.currentMenu) return;
          const set = new Set(this.currentMenu.purchasedIngredients || []);
          if (set.has(ingredientName)) {
            set.delete(ingredientName);
          } else {
            set.add(ingredientName);
          }
          this.currentMenu.purchasedIngredients = Array.from(set);
          this.saveCurrentMenu();
          this.renderActiveTab(container);
        },
        onSendPreventiveToAccounting: async () => {
          await this.sendPreventiveToAccounting();
        }
      });
    } else {
      AllergenMatrixView.render(mount, this.currentMenu);
    }
  }

  private bindMainEvents(container: HTMLElement): void {
    // Cambio partecipanti globale
    const partInput = container.querySelector<HTMLInputElement>('#input-menu-participants');
    partInput?.addEventListener('change', async () => {
      if (this.currentMenu) {
        this.currentMenu.participantsCount = parseInt(partInput.value, 10) || 10;
        await this.saveCurrentMenu();
        this.renderActiveTab(container);
      }
    });

    // Switch Tabs
    container.querySelector('#tab-btn-schedule')?.addEventListener('click', () => {
      this.activeTab = 'schedule';
      this.renderUI(container);
    });

    container.querySelector('#tab-btn-shopping')?.addEventListener('click', () => {
      this.activeTab = 'shopping';
      this.renderUI(container);
    });

    container.querySelector('#tab-btn-allergens')?.addEventListener('click', () => {
      this.activeTab = 'allergens';
      this.renderUI(container);
    });

    // Drawer Risorse
    container.querySelector('#btn-open-res-drawer')?.addEventListener('click', () => {
      this.openResourceDrawer();
    });

    // Nuovo Pasto
    container.querySelector('#btn-create-new-recipe')?.addEventListener('click', () => {
      this.addNewMealDialog();
    });
  }

  private openRecipeModal(recipe: MealRecipe | null, onSave: (r: MealRecipe) => void): void {
    const modal = new MealRecipeModal({
      spaceId: this.activeSpaceId,
      recipe,
      onSave,
      onClose: () => {}
    });
    modal.open();
  }

  private openResourceDrawer(): void {
    const drawer = new ResourceRecipeDrawer({
      spaceId: this.activeSpaceId,
      onSelect: (importedRecipe) => {
        // Chiedi orario e data per il pasto con questa ricetta
        this.scheduleImportedRecipe(importedRecipe);
      },
      onClose: () => {}
    });
    drawer.open();
  }

  private scheduleImportedRecipe(recipe: MealRecipe): void {
    if (!this.currentMenu) return;

    const todayStr = new Date().toISOString().substring(0, 10);
    const newMeal: ScheduledMeal = {
      mealId: `meal_${Date.now()}`,
      date: todayStr,
      time: '12:30',
      mealType: 'PRANZO',
      recipe,
      customParticipantsCount: null
    };

    this.currentMenu.meals.push(newMeal);
    this.saveCurrentMenu();
    if (this.currentContainer) {
      this.renderUI(this.currentContainer);
    }
  }

  private addNewMealDialog(): void {
    if (!this.currentMenu) return;

    const todayStr = new Date().toISOString().substring(0, 10);
    const defaultRecipe: MealRecipe = {
      recipeId: `rec_${Date.now()}`,
      title: 'Nuova Ricetta del Pasto',
      portionsBase: 10,
      cookingTimeMinutes: 30,
      tags: ['cambusa'],
      estimatedCostPerPortion: 1.80,
      ingredients: [
        { name: 'Penne rigate', category: 'NON_DEPERIBILE', quantityBase: 1.000, unit: 'kg', estimatedUnitCost: 1.50, allergens: ['Glutine'] },
        { name: 'Passata di pomodoro', category: 'NON_DEPERIBILE', quantityBase: 0.800, unit: 'kg', estimatedUnitCost: 1.80, allergens: [] }
      ],
      preparationMarkdown: '',
      allergensList: ['Glutine'],
      coverImageUrl: null,
      isFork: false
    };

    this.openRecipeModal(defaultRecipe, (savedRecipe) => {
      if (this.currentMenu) {
        const meal: ScheduledMeal = {
          mealId: `meal_${Date.now()}`,
          date: todayStr,
          time: '12:30',
          mealType: 'PRANZO',
          recipe: savedRecipe,
          customParticipantsCount: null
        };
        this.currentMenu.meals.push(meal);
        this.saveCurrentMenu();
        if (this.currentContainer) {
          this.renderUI(this.currentContainer);
        }
      }
    });
  }

  /**
   * Integrazione Finanziaria con AccountingPlugin:
   * Genera e registra il preventivo economico della cambusa
   */
  private async sendPreventiveToAccounting(): Promise<void> {
    if (!this.currentMenu) return;

    const budget = MealCalculator.calculateTotalMenuBudget(this.currentMenu);
    const fiscalYear = new Date().getFullYear().toString();

    const transaction: AccountingTransactionRecord = {
      transactionId: `tx_cambusa_${this.currentMenu.menuId}_${Date.now()}`,
      spaceId: this.activeSpaceId,
      fiscalYear,
      date: new Date().toISOString().substring(0, 10),
      type: 'PREVENTIVE_EXPENSE',
      description: `Preventivo Cambusa per "${this.currentMenu.eventName}" (${this.currentMenu.participantsCount} partecipanti)`,
      localCategory: 'Cambusa & Vitto Attività',
      ministerialCategoryCode: 'U.01.03',
      ministerialCategoryLabel: 'Spese per vitto, alloggio e cambusa attività istituzionali',
      categoryListVersionDate: '2026-01-01',
      costCenterIdSnapshot: null,
      amount: budget.totalCost,
      paymentMethod: 'BANK_TRANSFER',
      linkedPluginId: 'meal-allergen-tool',
      status: 'CONFIRMED'
    };

    await db.accounting.put(transaction);

    if (this.eventBus) {
      this.eventBus.emit('accounting:add_preventive', {
        spaceId: this.activeSpaceId,
        fiscalYear,
        amount: budget.totalCost,
        description: transaction.description,
        transactionId: transaction.transactionId
      });
    }

    console.log(`[MealAllergenPlugin] 💰 Preventivo cambusa di € ${budget.totalCost.toFixed(2)} inviato con successo a Contabilità.`);
  }
}
