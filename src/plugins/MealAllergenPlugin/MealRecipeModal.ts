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
 * NOME FILE: src/plugins/MealAllergenPlugin/MealRecipeModal.ts
 * ============================================================================
 * DESCRIZIONE:
 * Modale di composizione, consultazione e modifica della Scheda Ricetta:
 * - Dosi base per 10 persone, tempo di preparazione, allergeni e costo stimato
 * - Tabella interattiva degli ingredienti con categorie di conservazione e allergeni
 * - Autocompletamento rapido tramite Dizionario Globale degli Ingredienti
 * - Funzionalità "Salva in Risorse": esporta e pubblica la ricetta nell'Hub Risorse
 * - Gestione Fork e Varianti specifiche per il campo
 * ============================================================================
 */

import { MealRecipe, IngredientItem, StorageCategory } from './types.js';
import { allergenRegistry } from './AllergenRegistry.js';
import { ingredientDictionary } from './IngredientDictionary.js';
import { resourceDataExtractor } from '../ResourcesPlugin/ResourceDataExtractor.js';
import { ResourceItem } from '../ResourcesPlugin/types.js';
import { eventBus } from '../../base/EventBus.js';

export interface MealRecipeModalOptions {
  spaceId: string;
  recipe?: MealRecipe | null;
  onSave: (recipe: MealRecipe) => void;
  onClose: () => void;
}

export class MealRecipeModal {
  private options: MealRecipeModalOptions;
  private modalContainer: HTMLElement | null = null;
  private currentRecipe: MealRecipe;

  constructor(options: MealRecipeModalOptions) {
    this.options = options;
    if (options.recipe) {
      this.currentRecipe = JSON.parse(JSON.stringify(options.recipe));
    } else {
      this.currentRecipe = {
        recipeId: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: '',
        portionsBase: 10,
        cookingTimeMinutes: 30,
        tags: ['primo', 'cambusa'],
        estimatedCostPerPortion: 1.80,
        ingredients: [
          {
            name: 'Penne rigate',
            category: 'NON_DEPERIBILE',
            quantityBase: 1.000,
            unit: 'kg',
            estimatedUnitCost: 1.50,
            allergens: ['Glutine']
          },
          {
            name: 'Passata di pomodoro',
            category: 'NON_DEPERIBILE',
            quantityBase: 0.800,
            unit: 'kg',
            estimatedUnitCost: 1.80,
            allergens: []
          }
        ],
        preparationMarkdown: '',
        allergensList: ['Glutine'],
        coverImageUrl: null,
        sourceResourceId: null,
        isFork: false,
        forkNotes: ''
      };
    }
  }

  public open(): void {
    this.close();

    this.modalContainer = document.createElement('div');
    this.modalContainer.className =
      'fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto font-sans text-xs';
    this.render();
    document.body.appendChild(this.modalContainer);
  }

  public close(): void {
    if (this.modalContainer && this.modalContainer.parentNode) {
      this.modalContainer.parentNode.removeChild(this.modalContainer);
      this.modalContainer = null;
    }
    this.options.onClose();
  }

  private render(): void {
    if (!this.modalContainer) return;

    this.modalContainer.innerHTML = `
      <div class="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        <!-- HEADER MODALE -->
        <div class="p-4 sm:px-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <span class="text-2xl">🍲</span>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-sm sm:text-base font-bold text-blue-400">
                  ${this.currentRecipe.title ? this.escapeHtml(this.currentRecipe.title) : 'Nuova Scheda Ricetta'}
                </h2>
                ${
                  this.currentRecipe.isFork
                    ? '<span class="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-bold">Variante Campo (Fork)</span>'
                    : ''
                }
              </div>
              <p class="text-[11px] text-slate-400">
                Dosi base calibrate per <strong class="text-slate-200">${this.currentRecipe.portionsBase} persone</strong>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- PULSANTE ESPORTAZIONE VERSO HUB RISORSE -->
            <button type="button" id="btn-publish-to-resources" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow transition-colors flex items-center gap-1.5 cursor-pointer" title="Pubblica questa ricetta nell'Hub Risorse dello Spazio per renderla riutilizzabile">
              <span>💾</span>
              <span>Salva in Risorse</span>
            </button>

            <button id="btn-close-recipe-modal" class="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 text-base cursor-pointer">
              ✕
            </button>
          </div>
        </div>

        <!-- CORPO MODALE (SCROLLABILE) -->
        <div class="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          <!-- BANNER FEEDBACK PUBBLICAZIONE RISORSE -->
          <div id="publish-feedback-banner" class="hidden p-3 rounded-xl border text-xs"></div>

          <!-- DATI PRINCIPALI RICETTA -->
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            
            <div class="sm:col-span-6">
              <label class="block text-slate-300 font-bold mb-1">Titolo della Ricetta *</label>
              <input type="text" id="recipe-title-input" value="${this.escapeHtml(this.currentRecipe.title)}" placeholder="es. Risotto ai Funghi di Bosco per 10p" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-blue-500 focus:outline-none" />
            </div>

            <div class="sm:col-span-2">
              <label class="block text-slate-300 font-bold mb-1">Dosi Base (p) *</label>
              <input type="number" id="recipe-portions-input" value="${this.currentRecipe.portionsBase}" min="1" max="500" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 text-xs focus:border-blue-500 focus:outline-none" />
            </div>

            <div class="sm:col-span-2">
              <label class="block text-slate-300 font-bold mb-1">Tempo Cottura (min)</label>
              <input type="number" id="recipe-time-input" value="${this.currentRecipe.cookingTimeMinutes}" min="1" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 text-xs focus:border-blue-500 focus:outline-none" />
            </div>

            <div class="sm:col-span-2">
              <label class="block text-slate-300 font-bold mb-1">Costo/Porzione (€)</label>
              <input type="number" step="0.05" id="recipe-cost-input" value="${this.currentRecipe.estimatedCostPerPortion}" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 text-xs focus:border-blue-500 focus:outline-none" />
            </div>

            <div class="sm:col-span-8">
              <label class="block text-slate-300 font-bold mb-1">URL Immagine di Copertina</label>
              <input type="url" id="recipe-cover-input" value="${this.escapeHtml(this.currentRecipe.coverImageUrl || '')}" placeholder="https://images.unsplash.com/... o link Drive" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:border-blue-500 focus:outline-none" />
            </div>

            <div class="sm:col-span-4">
              <label class="block text-slate-300 font-bold mb-1">Tag (separati da virgola)</label>
              <input type="text" id="recipe-tags-input" value="${this.escapeHtml((this.currentRecipe.tags || []).join(', '))}" placeholder="es. primo, vegetariano, estivo" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:border-blue-500 focus:outline-none" />
            </div>

          </div>

          <!-- TABELLA INGREDIENTI -->
          <div class="space-y-3">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <h3 class="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                  <span>🥗</span>
                  <span>Ingredienti della Ricetta (Dosi Base per ${this.currentRecipe.portionsBase} persone)</span>
                </h3>
                <p class="text-[10px] text-slate-400">Le quantità verranno ricalcolate proporzionalmente con precisione a 3 decimali</p>
              </div>

              <button type="button" id="btn-add-ingredient-row" class="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer">
                <span>➕</span>
                <span>Aggiungi Ingrediente</span>
              </button>
            </div>

            <div class="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <th class="py-2.5 px-3">Nome Ingrediente</th>
                    <th class="py-2.5 px-3 w-36">Conservazione</th>
                    <th class="py-2.5 px-3 w-28 text-right">Quantità Base</th>
                    <th class="py-2.5 px-3 w-24">Unità</th>
                    <th class="py-2.5 px-3 w-28 text-right">Costo Unit (€)</th>
                    <th class="py-2.5 px-3 min-w-[140px]">Allergeni</th>
                    <th class="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody id="recipe-ingredients-tbody" class="divide-y divide-slate-800/60">
                  ${this.renderIngredientsRows()}
                </tbody>
              </table>
            </div>
          </div>

          <!-- MATRICE ALLERGENI RILEVATI -->
          <div class="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                <span>🛡️</span>
                <span>Matrice di Sicurezza: Allergeni Dichiarati in questa Ricetta</span>
              </h4>
              <span class="text-[10px] text-slate-500">Reg. UE 1169/2011</span>
            </div>

            <div id="recipe-allergens-summary" class="flex items-center gap-1.5 flex-wrap pt-1">
              ${this.renderAllergensSummary()}
            </div>
          </div>

          <!-- ISTRUZIONI DI PREPARAZIONE MARKDOWN -->
          <div>
            <label class="block text-slate-300 font-bold mb-1 text-xs">Istruzioni di Preparazione & Note di Cambusa</label>
            <textarea id="recipe-prep-input" rows="4" placeholder="Descrivi il procedimento per la cottura a grandi numeri, pentoloni necessari, fuochi e tempi di attesa..." class="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-100 text-xs focus:border-blue-500 focus:outline-none leading-relaxed">${this.escapeHtml(this.currentRecipe.preparationMarkdown || '')}</textarea>
          </div>

        </div>

        <!-- FOOTER MODALE -->
        <div class="p-4 sm:px-6 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <button type="button" id="btn-cancel-recipe" class="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer">
            Annulla
          </button>

          <button type="button" id="btn-save-recipe-final" class="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-lg transition-colors flex items-center gap-2 cursor-pointer">
            <span>💾</span>
            <span>Applica al Menù dell'Evento</span>
          </button>
        </div>

      </div>
    `;

    this.bindEvents();
  }

  private renderIngredientsRows(): string {
    if (!this.currentRecipe.ingredients || this.currentRecipe.ingredients.length === 0) {
      return `
        <tr>
          <td colspan="7" class="py-6 text-center text-slate-500 italic">
            Nessun ingrediente inserito. Clicca su "+ Aggiungi Ingrediente".
          </td>
        </tr>
      `;
    }

    return this.currentRecipe.ingredients
      .map((ing, idx) => {
        return `
          <tr class="hover:bg-slate-900/40">
            <td class="py-2 px-3">
              <input type="text" data-ing-field="name" data-ing-idx="${idx}" value="${this.escapeHtml(ing.name)}" placeholder="Nome ingrediente" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs" />
            </td>
            <td class="py-2 px-3">
              <select data-ing-field="category" data-ing-idx="${idx}" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs">
                <option value="NON_DEPERIBILE" ${ing.category === 'NON_DEPERIBILE' ? 'selected' : ''}>Non Deperibile</option>
                <option value="FRESCO" ${ing.category === 'FRESCO' ? 'selected' : ''}>Fresco</option>
                <option value="ORTOFRUTTA" ${ing.category === 'ORTOFRUTTA' ? 'selected' : ''}>Ortofrutta</option>
                <option value="CARNI_E_PESCE" ${ing.category === 'CARNI_E_PESCE' ? 'selected' : ''}>Carni & Pesce</option>
                <option value="SURGELATI" ${ing.category === 'SURGELATI' ? 'selected' : ''}>Surgelati</option>
                <option value="ALTRO" ${ing.category === 'ALTRO' ? 'selected' : ''}>Altro</option>
              </select>
            </td>
            <td class="py-2 px-3 text-right">
              <input type="number" step="0.001" min="0" data-ing-field="quantityBase" data-ing-idx="${idx}" value="${ing.quantityBase}" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs text-right font-mono" />
            </td>
            <td class="py-2 px-3">
              <select data-ing-field="unit" data-ing-idx="${idx}" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs">
                <option value="kg" ${ing.unit === 'kg' ? 'selected' : ''}>kg</option>
                <option value="g" ${ing.unit === 'g' ? 'selected' : ''}>g</option>
                <option value="l" ${ing.unit === 'l' ? 'selected' : ''}>l</option>
                <option value="ml" ${ing.unit === 'ml' ? 'selected' : ''}>ml</option>
                <option value="pz" ${ing.unit === 'pz' ? 'selected' : ''}>pz</option>
                <option value="cucchiai" ${ing.unit === 'cucchiai' ? 'selected' : ''}>cucchiai</option>
                <option value="confezioni" ${ing.unit === 'confezioni' ? 'selected' : ''}>confezioni</option>
              </select>
            </td>
            <td class="py-2 px-3 text-right">
              <input type="number" step="0.10" min="0" data-ing-field="estimatedUnitCost" data-ing-idx="${idx}" value="${ing.estimatedUnitCost}" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs text-right font-mono" />
            </td>
            <td class="py-2 px-3">
              <input type="text" data-ing-field="allergens" data-ing-idx="${idx}" value="${this.escapeHtml((ing.allergens || []).join(', '))}" placeholder="es. Glutine, Latte" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-amber-300 text-xs" />
            </td>
            <td class="py-2 px-2 text-center">
              <button type="button" data-del-row-idx="${idx}" class="btn-del-ing text-slate-500 hover:text-red-400 p-1 cursor-pointer" title="Rimuovi riga">
                ✕
              </button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  private renderAllergensSummary(): string {
    const list = this.currentRecipe.allergensList || [];
    if (list.length === 0) {
      return '<span class="text-emerald-400 font-semibold text-[11px]">🟢 Nessun allergene dichiarato presente</span>';
    }

    return list
      .map((a) => allergenRegistry.renderBadge(a))
      .join('');
  }

  private recalculateAllergensList(): void {
    const set = new Set<string>();
    this.currentRecipe.ingredients.forEach((ing) => {
      (ing.allergens || []).forEach((a) => set.add(a.trim()));
    });
    this.currentRecipe.allergensList = Array.from(set).filter(Boolean);
    const summary = this.modalContainer?.querySelector('#recipe-allergens-summary');
    if (summary) {
      summary.innerHTML = this.renderAllergensSummary();
    }
  }

  private bindEvents(): void {
    if (!this.modalContainer) return;

    this.modalContainer.querySelector('#btn-close-recipe-modal')?.addEventListener('click', () => this.close());
    this.modalContainer.querySelector('#btn-cancel-recipe')?.addEventListener('click', () => this.close());

    // Input Titolo
    const titleInput = this.modalContainer.querySelector<HTMLInputElement>('#recipe-title-input');
    titleInput?.addEventListener('input', () => {
      this.currentRecipe.title = titleInput.value;
    });

    // Dosi base
    const portionsInput = this.modalContainer.querySelector<HTMLInputElement>('#recipe-portions-input');
    portionsInput?.addEventListener('input', () => {
      this.currentRecipe.portionsBase = parseInt(portionsInput.value, 10) || 10;
    });

    // Tempo
    const timeInput = this.modalContainer.querySelector<HTMLInputElement>('#recipe-time-input');
    timeInput?.addEventListener('input', () => {
      this.currentRecipe.cookingTimeMinutes = parseInt(timeInput.value, 10) || 30;
    });

    // Costo porzione
    const costInput = this.modalContainer.querySelector<HTMLInputElement>('#recipe-cost-input');
    costInput?.addEventListener('input', () => {
      this.currentRecipe.estimatedCostPerPortion = parseFloat(costInput.value) || 1.80;
    });

    // Cover
    const coverInput = this.modalContainer.querySelector<HTMLInputElement>('#recipe-cover-input');
    coverInput?.addEventListener('input', () => {
      this.currentRecipe.coverImageUrl = coverInput.value.trim() || null;
    });

    // Tags
    const tagsInput = this.modalContainer.querySelector<HTMLInputElement>('#recipe-tags-input');
    tagsInput?.addEventListener('input', () => {
      this.currentRecipe.tags = tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean);
    });

    // Preparazione
    const prepInput = this.modalContainer.querySelector<HTMLTextAreaElement>('#recipe-prep-input');
    prepInput?.addEventListener('input', () => {
      this.currentRecipe.preparationMarkdown = prepInput.value;
    });

    // Aggiungi riga ingrediente
    this.modalContainer.querySelector('#btn-add-ingredient-row')?.addEventListener('click', () => {
      this.currentRecipe.ingredients.push({
        name: '',
        category: 'NON_DEPERIBILE',
        quantityBase: 1.000,
        unit: 'kg',
        estimatedUnitCost: 1.50,
        allergens: []
      });
      const tbody = this.modalContainer?.querySelector('#recipe-ingredients-tbody');
      if (tbody) {
        tbody.innerHTML = this.renderIngredientsRows();
        this.bindTableInputEvents();
      }
    });

    // PUBBLICAZIONE VERSO HUB RISORSE (RESOURCESPLUGIN)
    this.modalContainer.querySelector('#btn-publish-to-resources')?.addEventListener('click', async () => {
      await this.publishToResourcesHub();
    });

    // Salva finale nel menù dell'evento
    this.modalContainer.querySelector('#btn-save-recipe-final')?.addEventListener('click', () => {
      if (!this.currentRecipe.title.trim()) {
        alert('Inserisci il titolo della ricetta.');
        titleInput?.focus();
        return;
      }
      this.options.onSave(this.currentRecipe);
      this.close();
    });

    this.bindTableInputEvents();
  }

  private bindTableInputEvents(): void {
    if (!this.modalContainer) return;

    // Modifica campi tabella
    const inputs = this.modalContainer.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-ing-field]');
    inputs.forEach((el) => {
      el.addEventListener('input', async () => {
        const field = el.getAttribute('data-ing-field');
        const idxStr = el.getAttribute('data-ing-idx');
        if (field && idxStr !== null) {
          const idx = parseInt(idxStr, 10);
          const ing = this.currentRecipe.ingredients[idx];
          if (!ing) return;

          if (field === 'name') {
            ing.name = el.value;
            // Verifica autocompletamento da Dizionario Globale
            const std = await ingredientDictionary.findByName(el.value);
            if (std) {
              ing.category = std.category;
              ing.unit = std.unit;
              ing.estimatedUnitCost = std.defaultUnitCost;
              ing.allergens = [...std.allergens];
              const tbody = this.modalContainer?.querySelector('#recipe-ingredients-tbody');
              if (tbody) {
                tbody.innerHTML = this.renderIngredientsRows();
                this.bindTableInputEvents();
                this.recalculateAllergensList();
              }
            }
          } else if (field === 'category') {
            ing.category = el.value as StorageCategory;
          } else if (field === 'quantityBase') {
            ing.quantityBase = parseFloat(el.value) || 0;
          } else if (field === 'unit') {
            ing.unit = el.value;
          } else if (field === 'estimatedUnitCost') {
            ing.estimatedUnitCost = parseFloat(el.value) || 0;
          } else if (field === 'allergens') {
            ing.allergens = el.value.split(',').map((a) => a.trim()).filter(Boolean);
            this.recalculateAllergensList();
          }
        }
      });
    });

    // Eliminazione riga ingrediente
    this.modalContainer.querySelectorAll<HTMLButtonElement>('.btn-del-ing').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idxStr = btn.getAttribute('data-del-row-idx');
        if (idxStr !== null) {
          const idx = parseInt(idxStr, 10);
          this.currentRecipe.ingredients.splice(idx, 1);
          const tbody = this.modalContainer?.querySelector('#recipe-ingredients-tbody');
          if (tbody) {
            tbody.innerHTML = this.renderIngredientsRows();
            this.bindTableInputEvents();
            this.recalculateAllergensList();
          }
        }
      });
    });
  }

  /**
   * Pubblica la ricetta come ResourceItem nell'Hub Risorse
   */
  private async publishToResourcesHub(): Promise<void> {
    const banner = this.modalContainer?.querySelector<HTMLElement>('#publish-feedback-banner');
    if (!this.currentRecipe.title.trim()) {
      alert('Inserisci prima il titolo della ricetta da pubblicare.');
      return;
    }

    try {
      const resourceId = this.currentRecipe.sourceResourceId || `res_rcp_${Date.now()}`;
      const resourceItem: ResourceItem = {
        resourceId,
        spaceId: this.options.spaceId,
        title: this.currentRecipe.title,
        category: 'RECIPES',
        descriptionMarkdown: this.currentRecipe.preparationMarkdown || `Ricetta di cambusa "${this.currentRecipe.title}" calibrata per ${this.currentRecipe.portionsBase} persone.`,
        coverImageUrl: this.currentRecipe.coverImageUrl,
        sourcePluginId: 'meal-allergen-tool',
        sourceEntityId: this.currentRecipe.recipeId,
        extractedMetadata: {
          servings: `${this.currentRecipe.portionsBase} persone`,
          cost_per_person: `${this.currentRecipe.estimatedCostPerPortion.toFixed(2)} € / persona`,
          prep_time: `${this.currentRecipe.cookingTimeMinutes} minuti`,
          allergens: this.currentRecipe.allergensList.join(', ') || 'Nessun allergene dichiarato',
          difficulty: 'Media per campo'
        },
        attachments: [],
        tags: [...new Set(['ricetta', 'cambusa', ...this.currentRecipe.tags])],
        updatedAt: new Date().toISOString(),
        createdBy: 'cambusa@associazione.org',
        isReadOnly: false
      };

      await resourceDataExtractor.saveResource(resourceItem);
      eventBus.emit('menu:recipe_added', resourceItem);

      this.currentRecipe.sourceResourceId = resourceId;

      if (banner) {
        banner.className = 'p-3 rounded-xl border bg-emerald-950/80 border-emerald-500 text-emerald-200 text-xs block space-y-1';
        banner.innerHTML = `
          <div class="font-bold flex items-center gap-1.5">
            <span>✅ Ricetta Pubblicata con Successo nell'Hub Risorse!</span>
          </div>
          <p class="text-[11px] text-emerald-300/80">
            La scheda è ora archiviata nello Spazio <strong>${this.options.spaceId}</strong> e consultabile dall'Hub Risorse generale.
          </p>
        `;
      }
    } catch (err: any) {
      if (banner) {
        banner.className = 'p-3 rounded-xl border bg-red-950/80 border-red-500 text-red-200 text-xs block';
        banner.textContent = `Errore durante il salvataggio in Risorse: ${err.message}`;
      }
    }
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
