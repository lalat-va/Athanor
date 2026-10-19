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
 * NOME FILE: src/plugins/MealAllergenPlugin/ResourceRecipeDrawer.ts
 * ============================================================================
 * DESCRIZIONE:
 * Drawer laterale di selezione per l'Integrazione Bidirezionale con l'Hub Risorse:
 * - Recupera le ricette collaudate archiviate in `ResourcesPlugin` (categoria RECIPES / RICETTE_CAMBUSA)
 * - Mostra schede informative con copertina, dosi base, tempo di cottura, costo stimato e allergeni
 * - Permette la ricerca rapida per nome o tag
 * - Converte la risorsa selezionata nel contratto `MealRecipe` pronto per l'inserimento nel menù dell'evento
 * ============================================================================
 */

import { db } from '../../base/Database.js';
import { MealRecipe, IngredientItem } from './types.js';
import { allergenRegistry } from './AllergenRegistry.js';

export interface ResourceRecipeDrawerOptions {
  spaceId: string;
  onSelect: (recipe: MealRecipe) => void;
  onClose: () => void;
}

export class ResourceRecipeDrawer {
  private options: ResourceRecipeDrawerOptions;
  private drawerContainer: HTMLElement | null = null;
  private searchQuery: string = '';

  constructor(options: ResourceRecipeDrawerOptions) {
    this.options = options;
  }

  public async open(): Promise<void> {
    this.close();

    this.drawerContainer = document.createElement('div');
    this.drawerContainer.className =
      'fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex justify-end font-sans text-xs';
    await this.render();
    document.body.appendChild(this.drawerContainer);
  }

  public close(): void {
    if (this.drawerContainer && this.drawerContainer.parentNode) {
      this.drawerContainer.parentNode.removeChild(this.drawerContainer);
      this.drawerContainer = null;
    }
    this.options.onClose();
  }

  private async render(): Promise<void> {
    if (!this.drawerContainer) return;

    // Recupera le risorse di categoria RECIPES dallo Spazio
    const recipes = await this.loadRecipesFromResources();

    this.drawerContainer.innerHTML = `
      <div class="bg-slate-900 border-l border-slate-800 w-full max-w-xl h-full flex flex-col shadow-2xl text-slate-100 overflow-hidden animate-slide-left">
        
        <!-- HEADER DRAWER -->
        <div class="p-4 sm:px-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">📚</span>
            <div>
              <h3 class="text-sm font-bold text-blue-400">Pesca Ricetta da Hub Risorse</h3>
              <p class="text-[11px] text-slate-400">
                Archivio condiviso dello Spazio: <strong class="text-slate-200 font-mono">${this.options.spaceId}</strong>
              </p>
            </div>
          </div>

          <button id="btn-close-drawer" class="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 text-base cursor-pointer">
            ✕
          </button>
        </div>

        <!-- BARRA RICERCA -->
        <div class="p-4 border-b border-slate-800/80 bg-slate-900/90 shrink-0">
          <div class="relative">
            <input 
              type="text" 
              id="input-drawer-search" 
              value="${this.escapeHtml(this.searchQuery)}" 
              placeholder="Cerca ricetta per titolo o ingrediente..." 
              class="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <span class="absolute left-2.5 top-2.5 text-slate-500 pointer-events-none">🔍</span>
          </div>
        </div>

        <!-- CONTENUTO RICETTE -->
        <div class="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4" id="drawer-recipes-list">
          ${this.renderRecipesList(recipes)}
        </div>

        <!-- FOOTER DRAWER -->
        <div class="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span class="text-[11px] text-slate-400">
            Trovate: <strong class="text-slate-200">${recipes.length}</strong> ricette disponibili
          </span>
          <button id="btn-cancel-drawer" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-4 py-2 rounded-lg font-semibold cursor-pointer">
            Chiudi
          </button>
        </div>

      </div>
    `;

    this.bindEvents(recipes);
  }

  private async loadRecipesFromResources(): Promise<any[]> {
    try {
      let list = await db.resources
        .where('spaceId')
        .equals(this.options.spaceId)
        .filter((r) => r.category === 'RECIPES' || r.category === 'RICETTE_CAMBUSA')
        .toArray();

      // Se vuoto per questo spazio, carica anche le ricette demo globali o di default
      if (list.length === 0) {
        list = await db.resources
          .filter((r) => r.category === 'RECIPES' || r.category === 'RICETTE_CAMBUSA')
          .toArray();
      }

      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase().trim();
        list = list.filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.descriptionMarkdown.toLowerCase().includes(q) ||
            r.tags.some((t) => t.toLowerCase().includes(q))
        );
      }

      return list;
    } catch (e) {
      console.warn('[ResourceRecipeDrawer] Errore lettura ricette da Dexie:', e);
      return [];
    }
  }

  private renderRecipesList(recipes: any[]): string {
    if (recipes.length === 0) {
      return `
        <div class="py-12 text-center text-slate-400 space-y-2">
          <div class="text-3xl">🍲</div>
          <p class="font-bold text-slate-300">Nessuna ricetta trovata nell'Hub Risorse</p>
          <p class="text-[11px] text-slate-500">
            Non ci sono ricette salvate con questi criteri. Puoi crearne una nuova direttamente nel menù dell'evento.
          </p>
        </div>
      `;
    }

    return recipes
      .map((res, idx) => {
        const servings = res.extractedMetadata?.servings || '10 persone';
        const costPerPerson = res.extractedMetadata?.cost_per_person || '1.80 €';
        const prepTime = res.extractedMetadata?.prep_time || '30 min';
        const rawAllergens = res.extractedMetadata?.allergens || '';

        const allergensList = typeof rawAllergens === 'string'
          ? rawAllergens.split(',').map((a: string) => a.trim()).filter(Boolean)
          : Array.isArray(rawAllergens)
          ? rawAllergens
          : [];

        const allergensBadges = allergensList
          .map((a: string) => allergenRegistry.renderBadge(a))
          .join('');

        let headerStyle = '';
        if (res.coverImageUrl && res.coverImageUrl.trim()) {
          headerStyle = `
            background-image: linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.95) 100%), url('${res.coverImageUrl}');
            background-size: cover;
            background-position: center;
          `;
        } else {
          headerStyle = 'background: linear-gradient(135deg, rgba(154, 52, 18, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%);';
        }

        return `
          <div class="bg-slate-950/80 border border-slate-800 hover:border-blue-500/80 rounded-2xl overflow-hidden shadow-lg transition-all group">
            
            <div class="p-3.5 flex flex-col justify-between min-h-[90px] relative" style="${headerStyle}">
              <div class="flex items-center justify-between z-10">
                <span class="inline-flex items-center gap-1 bg-slate-950/80 border border-slate-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <span>🍲</span>
                  <span>Ricetta Risorsa</span>
                </span>
                <span class="text-[10px] bg-blue-950/90 border border-blue-900 text-blue-300 font-mono px-2 py-0.5 rounded">
                  ${servings}
                </span>
              </div>

              <div class="mt-2 z-10">
                <h4 class="text-xs font-bold text-white tracking-wide drop-shadow-md">
                  ${this.escapeHtml(res.title)}
                </h4>
              </div>
            </div>

            <div class="p-3.5 space-y-2.5">
              <div class="grid grid-cols-2 gap-2 text-[10px]">
                <div class="bg-slate-900 p-1.5 rounded border border-slate-800 flex items-center gap-1.5">
                  <span>⏱️</span>
                  <span class="text-slate-300">Cottura: <strong>${prepTime}</strong></span>
                </div>
                <div class="bg-slate-900 p-1.5 rounded border border-slate-800 flex items-center gap-1.5">
                  <span>💰</span>
                  <span class="text-slate-300">Costo: <strong>${costPerPerson}</strong>/p</span>
                </div>
              </div>

              <p class="text-[11px] text-slate-400 line-clamp-2">
                ${this.escapeHtml(res.descriptionMarkdown || 'Nessuna descrizione.')}
              </p>

              ${
                allergensBadges
                  ? `
                <div class="pt-1 flex items-center gap-1 flex-wrap">
                  <span class="text-[10px] text-slate-500 mr-1">Allergeni:</span>
                  ${allergensBadges}
                </div>
              `
                  : ''
              }

              <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span class="text-[10px] text-slate-500 font-mono">
                  ${(res.tags || []).slice(0, 3).map((t: string) => `#${t}`).join(' ')}
                </span>

                <button type="button" data-recipe-idx="${idx}" class="btn-import-recipe bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow transition-colors flex items-center gap-1.5 cursor-pointer">
                  <span>📥</span>
                  <span>Importa nel Menù</span>
                </button>
              </div>

            </div>

          </div>
        `;
      })
      .join('');
  }

  private bindEvents(recipes: any[]): void {
    if (!this.drawerContainer) return;

    this.drawerContainer.querySelector('#btn-close-drawer')?.addEventListener('click', () => this.close());
    this.drawerContainer.querySelector('#btn-cancel-drawer')?.addEventListener('click', () => this.close());

    // Ricerca
    const searchInput = this.drawerContainer.querySelector<HTMLInputElement>('#input-drawer-search');
    searchInput?.addEventListener('input', async () => {
      this.searchQuery = searchInput.value;
      const updatedRecipes = await this.loadRecipesFromResources();
      const listMount = this.drawerContainer?.querySelector('#drawer-recipes-list');
      if (listMount) {
        listMount.innerHTML = this.renderRecipesList(updatedRecipes);
        this.bindImportButtons(updatedRecipes);
      }
    });

    this.bindImportButtons(recipes);
  }

  private bindImportButtons(recipes: any[]): void {
    const importButtons = this.drawerContainer?.querySelectorAll<HTMLButtonElement>('.btn-import-recipe');
    importButtons?.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idxStr = btn.getAttribute('data-recipe-idx');
        if (idxStr !== null) {
          const res = recipes[parseInt(idxStr, 10)];
          if (res) {
            const converted = this.convertResourceToMealRecipe(res);
            this.options.onSelect(converted);
            this.close();
          }
        }
      });
    });
  }

  private convertResourceToMealRecipe(res: any): MealRecipe {
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

    // Ingredienti predefiniti o estratti
    const sampleIngredients: IngredientItem[] = [
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
      },
      {
        name: 'Olio extravergine di oliva',
        category: 'NON_DEPERIBILE',
        quantityBase: Math.round((portionsBase * 0.015) * 1000) / 1000,
        unit: 'l',
        estimatedUnitCost: 8.50,
        allergens: []
      }
    ];

    return {
      recipeId: res.resourceId || `rec_${Date.now()}`,
      title: res.title,
      portionsBase,
      cookingTimeMinutes,
      tags: res.tags || ['cambusa', 'primo'],
      estimatedCostPerPortion,
      ingredients: sampleIngredients,
      preparationMarkdown: res.descriptionMarkdown || 'Preparazione standard per grandi numeri in cambusa.',
      allergensList,
      coverImageUrl: res.coverImageUrl,
      sourceResourceId: res.resourceId,
      isFork: false
    };
  }

  private escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
