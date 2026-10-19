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
 * NOME FILE: src/plugins/MealAllergenPlugin/components/ShoppingListView.ts
 * ============================================================================
 * DESCRIZIONE:
 * Componente per la generazione della Lista della Spesa & Spunta Logistica:
 * - Aggregazione proporzionale di tutti gli ingredienti con arrotondamento a 3 decimali
 * - Suddivisione per categorie di stoccaggio (Fresco, Non deperibile, Ortofrutta, Carni, Surgelati)
 * - Checkbox interattive per la spunta durante gli acquisti con persistenza dello stato
 * - Calcolo del preventivo complessivo e invio diretto al modulo Contabilità (AccountingPlugin)
 * ============================================================================
 */

import { EventMenu, StorageCategory } from '../types.js';
import { MealCalculator } from '../MealCalculator.js';
import { allergenRegistry } from '../AllergenRegistry.js';

export interface ShoppingListViewOptions {
  menu: EventMenu;
  onTogglePurchased: (ingredientName: string) => void;
  onSendPreventiveToAccounting: () => void;
}

export class ShoppingListView {
  public static render(
    container: HTMLElement,
    options: ShoppingListViewOptions
  ): void {
    const { menu } = options;
    const shoppingList = MealCalculator.generateShoppingList(menu);
    const budgetStats = MealCalculator.calculateTotalMenuBudget(menu);

    const totalCount = shoppingList.length;
    const purchasedCount = shoppingList.filter((i) => i.isPurchased).length;
    const progressPercent = totalCount > 0 ? Math.round((purchasedCount / totalCount) * 100) : 0;

    if (totalCount === 0) {
      container.innerHTML = `
        <div class="py-16 text-center bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-8 space-y-3">
          <div class="text-4xl">🛒</div>
          <h4 class="text-base font-bold text-slate-300">Lista della spesa vuota</h4>
          <p class="text-xs text-slate-400 max-w-md mx-auto">
            Aggiungi pasti e ricette al calendario del menù per generare automaticamente la lista aggregata degli acquisti.
          </p>
        </div>
      `;
      return;
    }

    // Raggruppa per categoria di stoccaggio
    const categoryLabels: Record<StorageCategory, { label: string; icon: string }> = {
      ORTOFRUTTA: { label: 'Ortofrutta (Verdura & Frutta Fresca)', icon: '🍏' },
      FRESCO: { label: 'Prodotti Freschi & Latticini', icon: '🥛' },
      CARNI_E_PESCE: { label: 'Carni Fresche, Salumi & Pesce', icon: '🥩' },
      SURGELATI: { label: 'Alimenti Surgelati', icon: '🧊' },
      NON_DEPERIBILE: { label: 'Dispensa & Non Deperibile (Pasta, Scatolame, Spezie)', icon: '🥫' },
      ALTRO: { label: 'Altro & Accessori Cambusa', icon: '📦' }
    };

    const categoriesPresent: StorageCategory[] = [
      'ORTOFRUTTA',
      'FRESCO',
      'CARNI_E_PESCE',
      'SURGELATI',
      'NON_DEPERIBILE',
      'ALTRO'
    ];

    container.innerHTML = `
      <div class="space-y-6">
        
        <!-- HEADER STATISTICHE & AZIONI FINANZIARIE -->
        <div class="bg-slate-950/80 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-4 shadow-lg">
          
          <div class="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 class="text-sm font-bold text-blue-400 flex items-center gap-2">
                <span>🛒 Lista della Spesa Aggregata & Logistica Cambusa</span>
              </h3>
              <p class="text-[11px] text-slate-400 mt-0.5">
                Dosi proporzionali calibrate per <strong class="text-slate-200">${menu.participantsCount} persone</strong> su 
                <strong class="text-slate-200">${budgetStats.totalMealsCount} pasti programmati</strong>.
              </p>
            </div>

            <div class="flex items-center gap-2">
              <button id="btn-export-shopping-print" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer">
                <span>📋</span>
                <span>Stampa / Copia</span>
              </button>

              <!-- TRASMISSIONE PREVENTIVO AD ACCOUNTINGPLUGIN -->
              <button id="btn-send-accounting" class="bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer">
                <span>💰</span>
                <span>Invia Preventivo a Contabilità</span>
              </button>
            </div>
          </div>

          <!-- BANNER RIEPILOGO BUDGET & AVANZAMENTO SPUNTA -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            
            <div class="bg-slate-900 p-3 rounded-xl border border-slate-800">
              <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Preventivo Totale Spesa:</span>
              <span class="text-lg font-bold text-emerald-400 font-mono">${budgetStats.totalCost.toFixed(2)} €</span>
            </div>

            <div class="bg-slate-900 p-3 rounded-xl border border-slate-800">
              <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Costo Medio Persona / Giorno:</span>
              <span class="text-lg font-bold text-blue-400 font-mono">${budgetStats.costPerPersonPerDay.toFixed(2)} €</span>
            </div>

            <div class="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-slate-400">Stato Acquisti Spuntati:</span>
                <strong class="text-slate-200 font-mono">${purchasedCount} / ${totalCount} (${progressPercent}%)</strong>
              </div>
              <div class="w-full bg-slate-950 rounded-full h-2 mt-2 overflow-hidden border border-slate-800">
                <div class="bg-emerald-500 h-full transition-all duration-300" style="width: ${progressPercent}%;"></div>
              </div>
            </div>

          </div>

          <!-- FEEDBACK PREVENTIVO TRASMESSO -->
          <div id="accounting-feedback-msg" class="hidden text-xs font-bold text-emerald-400 pt-1"></div>

        </div>

        <!-- SEZIONI PER CATEGORIA DI CONSERVAZIONE -->
        <div class="space-y-5" id="shopping-categories-container">
          ${categoriesPresent
            .map((catKey) => {
              const items = shoppingList.filter((i) => i.category === catKey);
              if (items.length === 0) return '';
              const catInfo = categoryLabels[catKey];

              return `
                <div class="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-md">
                  
                  <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <h4 class="font-bold text-slate-200 text-xs sm:text-sm flex items-center gap-2">
                      <span class="text-base">${catInfo.icon}</span>
                      <span>${catInfo.label}</span>
                    </h4>
                    <span class="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded font-mono border border-slate-800">
                      ${items.length} articoli
                    </span>
                  </div>

                  <div class="divide-y divide-slate-800/60">
                    ${items
                      .map((item) => {
                        const allergensBadges = (item.allergens || [])
                          .map((a) => allergenRegistry.renderBadge(a))
                          .join('');

                        return `
                        <div class="py-2.5 flex items-center justify-between gap-3 group transition-colors ${
                          item.isPurchased ? 'opacity-50' : ''
                        }">
                          <div class="flex items-center gap-3">
                            <input 
                              type="checkbox" 
                              data-ing-name="${this.escapeHtml(item.name)}" 
                              ${item.isPurchased ? 'checked' : ''} 
                              class="cb-purchased w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 cursor-pointer"
                            />
                            <div>
                              <span class="text-xs font-bold ${
                                item.isPurchased ? 'line-through text-slate-500' : 'text-slate-100 group-hover:text-blue-400'
                              }">
                                ${this.escapeHtml(item.name)}
                              </span>
                              <div class="text-[10px] text-slate-500 truncate max-w-md">
                                Usato in: ${this.escapeHtml(item.mealsOrigin.slice(0, 2).join(', '))}
                                ${item.mealsOrigin.length > 2 ? '...' : ''}
                              </div>
                            </div>
                          </div>

                          <div class="flex items-center gap-3 shrink-0 text-right">
                            ${
                              allergensBadges
                                ? `
                              <div class="hidden sm:flex items-center gap-1">
                                ${allergensBadges}
                              </div>
                            `
                                : ''
                            }

                            <div class="min-w-[110px]">
                              <span class="text-xs font-mono font-bold text-slate-100 block">
                                ${item.totalQuantity.toFixed(3)} ${item.unit}
                              </span>
                              ${
                                item.estimatedCost > 0
                                  ? `<span class="text-[10px] text-emerald-400/90 font-mono block">~ ${item.estimatedCost.toFixed(2)} €</span>`
                                  : ''
                              }
                            </div>
                          </div>
                        </div>
                      `;
                      })
                      .join('')}
                  </div>

                </div>
              `;
            })
            .join('')}
        </div>

      </div>
    `;

    // Bind event listeners
    container.querySelectorAll<HTMLInputElement>('.cb-purchased').forEach((cb) => {
      cb.addEventListener('change', () => {
        const name = cb.getAttribute('data-ing-name');
        if (name) {
          options.onTogglePurchased(name);
        }
      });
    });

    container.querySelector('#btn-send-accounting')?.addEventListener('click', () => {
      options.onSendPreventiveToAccounting();
      const feedback = container.querySelector('#accounting-feedback-msg');
      if (feedback) {
        feedback.className = 'text-xs font-bold text-emerald-400 pt-1 block';
        feedback.innerHTML = '✅ Preventivo cambusa di <strong>' + budgetStats.totalCost.toFixed(2) + ' €</strong> registrato e inviato a Rendicontazione Economica!';
      }
    });

    container.querySelector('#btn-export-shopping-print')?.addEventListener('click', () => {
      window.print();
    });
  }

  private static escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
