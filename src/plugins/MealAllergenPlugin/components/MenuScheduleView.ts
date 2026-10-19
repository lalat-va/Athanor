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
 * NOME FILE: src/plugins/MealAllergenPlugin/components/MenuScheduleView.ts
 * ============================================================================
 * DESCRIZIONE:
 * Componente per la programmazione giornaliera e sequenziale dei pasti:
 * - Raggruppamento per data dell'evento (Colazione, Pranzo, Cena, Merenda)
 * - Calcolo immediato delle porzioni effettive e dei costi parziali
 * - Integrazione diretta con modale ricetta e drawer risorse
 * - Visualizzazione immediata degli allergeni presenti per ciascun pasto
 * ============================================================================
 */

import { EventMenu, ScheduledMeal, MealRecipe } from '../types.js';
import { allergenRegistry } from '../AllergenRegistry.js';
import { MealCalculator } from '../MealCalculator.js';

export interface MenuScheduleViewOptions {
  menu: EventMenu;
  onEditMeal: (meal: ScheduledMeal) => void;
  onDeleteMeal: (mealId: string) => void;
  onAddMeal: () => void;
  onImportFromResources: (mealId?: string) => void;
  onPublishToResources: (recipe: MealRecipe) => void;
}

export class MenuScheduleView {
  public static render(
    container: HTMLElement,
    options: MenuScheduleViewOptions
  ): void {
    const { menu } = options;

    if (!menu.meals || menu.meals.length === 0) {
      container.innerHTML = `
        <div class="py-16 text-center bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-8 space-y-4">
          <div class="text-4xl">🍳</div>
          <h4 class="text-base font-bold text-slate-300">Nessun pasto ancora programmato nel menù</h4>
          <p class="text-xs text-slate-400 max-w-md mx-auto">
            Inizia la pianificazione alimentare per l'evento <strong>"${this.escapeHtml(menu.eventName)}"</strong>.
            Puoi pescare ricette collaudate dall'Hub Risorse o crearne di nuove.
          </p>
          <div class="pt-2 flex items-center justify-center gap-3">
            <button id="btn-empty-add-meal" class="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg transition-colors flex items-center gap-2 cursor-pointer">
              <span>➕</span>
              <span>Aggiungi Primo Pasto</span>
            </button>
            <button id="btn-empty-import-res" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg transition-colors flex items-center gap-2 cursor-pointer">
              <span>🔍</span>
              <span>Pesca da Hub Risorse</span>
            </button>
          </div>
        </div>
      `;

      container.querySelector('#btn-empty-add-meal')?.addEventListener('click', () => options.onAddMeal());
      container.querySelector('#btn-empty-import-res')?.addEventListener('click', () => options.onImportFromResources());
      return;
    }

    // Raggruppa i pasti per data
    const mealsByDate = new Map<string, ScheduledMeal[]>();
    menu.meals.forEach((m) => {
      const d = m.date || 'Data non specificata';
      if (!mealsByDate.has(d)) {
        mealsByDate.set(d, []);
      }
      mealsByDate.get(d)!.push(m);
    });

    // Ordina le date
    const sortedDates = Array.from(mealsByDate.keys()).sort();

    let html = `
      <div class="space-y-6">
        
        <!-- HEADER CONTROLLO AGGIUNTA -->
        <div class="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
          <div>
            <h3 class="text-sm font-bold text-slate-200 flex items-center gap-2">
              <span>📅 Calendario Menù: ${sortedDates.length} Giorni Programmati</span>
            </h3>
            <p class="text-[11px] text-slate-400">
              Partecipanti base evento: <strong class="text-blue-400">${menu.participantsCount} persone</strong>
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button id="btn-schedule-import-res" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow transition-colors flex items-center gap-1.5 cursor-pointer">
              <span>🔍</span>
              <span>Pesca da Risorse</span>
            </button>
            <button id="btn-schedule-add-meal" class="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow transition-colors flex items-center gap-1.5 cursor-pointer">
              <span>➕</span>
              <span>Nuovo Pasto</span>
            </button>
          </div>
        </div>

        <!-- GRIGLIA GIORNALIERA -->
        <div class="space-y-6">
    `;

    sortedDates.forEach((dateStr) => {
      const meals = mealsByDate.get(dateStr) || [];
      // Ordina per orario
      meals.sort((a, b) => a.time.localeCompare(b.time));

      const formattedDate = dateStr !== 'Data non specificata'
        ? new Date(dateStr).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : dateStr;

      html += `
        <div class="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-md">
          
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <div class="flex items-center gap-2.5">
              <span class="text-base">📆</span>
              <h4 class="font-bold text-slate-200 text-xs sm:text-sm capitalize">${this.escapeHtml(formattedDate)}</h4>
            </div>
            <span class="text-[10px] bg-slate-900 text-slate-400 border border-slate-800 px-2.5 py-0.5 rounded-full font-mono">
              ${meals.length} pasti previsti
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      `;

      meals.forEach((m) => {
        const participants = m.customParticipantsCount || menu.participantsCount || 10;
        const estimatedCost = MealCalculator.calculateMealEstimatedCost(m.recipe, participants);

        const mealIcon = m.mealType === 'COLAZIONE' ? '☕'
          : m.mealType === 'PRANZO' ? '🍝'
          : m.mealType === 'CENA' ? '🍲'
          : m.mealType === 'MERENDA' ? '🍎'
          : '🍴';

        const allergensBadges = (m.recipe.allergensList || [])
          .map((a) => allergenRegistry.renderBadge(a))
          .join('');

        let headerBg = '';
        if (m.recipe.coverImageUrl) {
          headerBg = `
            background-image: linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.95) 100%), url('${m.recipe.coverImageUrl}');
            background-size: cover;
            background-position: center;
          `;
        } else {
          headerBg = 'background: linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%);';
        }

        html += `
          <div class="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden flex flex-col justify-between shadow-sm group">
            
            <!-- HEADER SCHEDA PASTO -->
            <div class="p-3 flex flex-col justify-between min-h-[85px] relative" style="${headerBg}">
              <div class="flex items-center justify-between z-10">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-950/80 border border-slate-700 text-white">
                  <span>${mealIcon}</span>
                  <span>${m.mealType} (${m.time})</span>
                </span>

                <span class="text-[10px] bg-blue-950/80 border border-blue-800 text-blue-300 font-bold px-2 py-0.5 rounded">
                  👥 ${participants} dosi
                </span>
              </div>

              <div class="mt-2 z-10">
                <h5 class="text-xs font-bold text-white tracking-wide drop-shadow-md truncate" title="${this.escapeHtml(m.recipe.title)}">
                  ${this.escapeHtml(m.recipe.title)}
                </h5>
              </div>
            </div>

            <!-- CORPO SCHEDA -->
            <div class="p-3 space-y-2 flex-1 flex flex-col justify-between">
              
              <div class="grid grid-cols-2 gap-2 text-[10px]">
                <div class="bg-slate-950 p-1.5 rounded border border-slate-800 flex items-center justify-between">
                  <span class="text-slate-400">⏱️ Cottura:</span>
                  <strong class="text-slate-200">${m.recipe.cookingTimeMinutes || 30} min</strong>
                </div>
                <div class="bg-slate-950 p-1.5 rounded border border-slate-800 flex items-center justify-between">
                  <span class="text-slate-400">💰 Spesa Tot:</span>
                  <strong class="text-emerald-400 font-mono">${estimatedCost.toFixed(2)} €</strong>
                </div>
              </div>

              <!-- ALLERGENI DEL PASTO -->
              <div class="pt-1">
                <div class="text-[10px] text-slate-500 mb-1">Allergeni Dichiarati:</div>
                <div class="flex items-center gap-1 flex-wrap">
                  ${allergensBadges || '<span class="text-[10px] text-emerald-400 font-semibold">🟢 Nessun allergene</span>'}
                </div>
              </div>

              <!-- INGREDIENTI ANTEPRIMA -->
              <div class="pt-1 text-[10px] text-slate-400 truncate">
                <span>Ingredienti: </span>
                <span class="text-slate-300 font-mono">
                  ${(m.recipe.ingredients || []).slice(0, 3).map((i) => i.name).join(', ') || 'Nessuno'}
                  ${(m.recipe.ingredients || []).length > 3 ? '...' : ''}
                </span>
              </div>

              <!-- FOOTER PULSANTI AZIONE -->
              <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1 flex-wrap">
                <div class="flex items-center gap-1">
                  <button type="button" data-edit-meal-id="${m.mealId}" class="btn-edit-meal bg-blue-600/80 hover:bg-blue-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer">
                    <span>✏️</span>
                    <span>Modifica</span>
                  </button>
                  <button type="button" data-pub-recipe-id="${m.mealId}" class="btn-pub-res text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 text-[11px] font-semibold px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer" title="Pubblica ricetta in Hub Risorse">
                    <span>💾</span>
                    <span>In Risorse</span>
                  </button>
                </div>

                <button type="button" data-del-meal-id="${m.mealId}" class="btn-del-meal text-slate-500 hover:text-red-400 hover:bg-red-950/40 text-[11px] p-1 rounded transition-colors cursor-pointer" title="Elimina pasto">
                  <span>🗑️</span>
                </button>
              </div>

            </div>

          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Bind event listeners
    container.querySelector('#btn-schedule-add-meal')?.addEventListener('click', () => options.onAddMeal());
    container.querySelector('#btn-schedule-import-res')?.addEventListener('click', () => options.onImportFromResources());

    container.querySelectorAll<HTMLButtonElement>('.btn-edit-meal').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit-meal-id');
        const meal = menu.meals.find((m) => m.mealId === id);
        if (meal) options.onEditMeal(meal);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('.btn-pub-res').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-pub-recipe-id');
        const meal = menu.meals.find((m) => m.mealId === id);
        if (meal) options.onPublishToResources(meal.recipe);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('.btn-del-meal').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-meal-id');
        if (id && confirm('Rimuovere questo pasto dal menù?')) {
          options.onDeleteMeal(id);
        }
      });
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
