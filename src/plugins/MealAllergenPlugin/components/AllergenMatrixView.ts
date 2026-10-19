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
 * NOME FILE: src/plugins/MealAllergenPlugin/components/AllergenMatrixView.ts
 * ============================================================================
 * DESCRIZIONE:
 * Matrice di Sicurezza & Report Giornaliero degli Allergeni (Compliance UE 1169/2011):
 * - Griglia cronologica di tutti i pasti dell'evento con mappatura precisa degli allergeni
 * - Evidenziazione cromatico-visiva per allergeni ad alto impatto (Glutine, Lattosio, Arachidi)
 * - Legenda e catalogo dei 14 allergeni alimentari normati per i cambusieri
 * - Linee guida per la prevenzione delle contaminazioni crociate nei campi
 * ============================================================================
 */

import { EventMenu } from '../types.js';
import { MealCalculator } from '../MealCalculator.js';
import { allergenRegistry } from '../AllergenRegistry.js';

export class AllergenMatrixView {
  public static render(container: HTMLElement, menu: EventMenu): void {
    const matrix = MealCalculator.generateDailyAllergenMatrix(menu);
    const allKnownAllergens = allergenRegistry.getAll();

    if (matrix.length === 0) {
      container.innerHTML = `
        <div class="py-16 text-center bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-8 space-y-3">
          <div class="text-4xl">🛡️</div>
          <h4 class="text-base font-bold text-slate-300">Nessun pasto censito nella matrice allergeni</h4>
          <p class="text-xs text-slate-400 max-w-md mx-auto">
            Aggiungi pasti al menù per generare automaticamente la griglia di sicurezza alimentare.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="space-y-6">
        
        <!-- HEADER MATRICE & AVVISI SICUREZZA -->
        <div class="bg-slate-950/80 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-3 shadow-lg">
          <div class="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-2.5">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">🛡️</span>
              <div>
                <h3 class="text-sm font-bold text-amber-400">
                  Matrice di Sicurezza Alimentare & Allergeni Giornalieri
                </h3>
                <p class="text-[11px] text-slate-400">
                  Mappatura formale a tutela della salute dei partecipanti per l'evento <strong>"${this.escapeHtml(menu.eventName)}"</strong>
                </p>
              </div>
            </div>
            <span class="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2.5 py-1 rounded font-mono font-bold">
              Regolamento UE 1169/2011
            </span>
          </div>

          <!-- LINEE GUIDA PREVENZIONE CONTAMINAZIONI -->
          <div class="bg-amber-950/40 border border-amber-800/80 p-3 rounded-xl text-[11px] text-amber-200 space-y-1">
            <div class="font-bold flex items-center gap-1.5 text-amber-300">
              <span>⚠️ RACCOMANDAZIONI OPERATIVE PER LA CAMBUSA:</span>
            </div>
            <p class="text-amber-300/80 leading-relaxed">
              In caso di partecipanti celiaci o con allergie gravi, utilizzare pentolame e posate dedicate prima di manipolare ingredienti con glutine o allergeni. Conservare gli alimenti speciali in contenitori ermetici separati e contrassegnati.
            </p>
          </div>
        </div>

        <!-- TABELLA MATRICE GIORNALIERA -->
        <div class="border border-slate-800 rounded-2xl bg-slate-950 overflow-hidden shadow-xl">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <th class="py-3 px-4 w-32">Data</th>
                <th class="py-3 px-3 w-28">Pasto</th>
                <th class="py-3 px-4">Ricetta del Menù</th>
                <th class="py-3 px-4">Allergeni Presenti Rilevati</th>
                <th class="py-3 px-4 w-32 text-center">Stato Sicurezza</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 text-slate-200">
              ${matrix
                .map((entry) => {
                  const hasAllergens = entry.allergens.length > 0;
                  const hasHighRisk = entry.allergens.some((a) =>
                    ['arachidi', 'frutta a guscio', 'crostacei', 'pesce'].includes(a.toLowerCase())
                  );

                  const badges = hasAllergens
                    ? entry.allergens.map((a) => allergenRegistry.renderBadge(a)).join('')
                    : '<span class="text-emerald-400 text-[11px] font-semibold">🟢 Nessun allergene</span>';

                  let statusBadge = '';
                  if (!hasAllergens) {
                    statusBadge = '<span class="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-1 rounded-full font-bold">🟢 Sicuro</span>';
                  } else if (hasHighRisk) {
                    statusBadge = '<span class="text-[10px] bg-red-950 text-red-300 border border-red-800 px-2.5 py-1 rounded-full font-bold">🔴 Alto Rischio</span>';
                  } else {
                    statusBadge = '<span class="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2.5 py-1 rounded-full font-bold">🟡 Attenzione</span>';
                  }

                  const formattedDate = new Date(entry.date).toLocaleDateString('it-IT', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short'
                  });

                  return `
                    <tr class="hover:bg-slate-900/40">
                      <td class="py-3 px-4 font-mono text-slate-300 capitalize">
                        ${this.escapeHtml(formattedDate)}
                      </td>
                      <td class="py-3 px-3 font-semibold text-slate-300">
                        ${this.escapeHtml(entry.mealType)}
                      </td>
                      <td class="py-3 px-4 font-bold text-slate-100">
                        ${this.escapeHtml(entry.recipeTitle)}
                      </td>
                      <td class="py-3 px-4">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          ${badges}
                        </div>
                      </td>
                      <td class="py-3 px-4 text-center">
                        ${statusBadge}
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>

        <!-- LEGENDA DEI 14 ALLERGENI ALIMENTARI NORMATI (UE 1169/2011) -->
        <div class="bg-slate-950/80 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-3">
          <div class="border-b border-slate-800 pb-2">
            <h4 class="font-bold text-slate-200 text-xs flex items-center gap-2">
              <span>📖 Legenda Ufficiale dei 14 Allergeni Principali (Regolamento UE 1169/2011)</span>
            </h4>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            ${allKnownAllergens
              .map(
                (all) => `
              <div class="bg-slate-900/90 border border-slate-800/80 p-2.5 rounded-xl space-y-1">
                <div class="flex items-center gap-2">
                  <span class="text-base">${all.icon}</span>
                  <span class="font-bold text-slate-200 text-xs">${this.escapeHtml(all.name)}</span>
                </div>
                <p class="text-[10px] text-slate-400 leading-tight">
                  ${this.escapeHtml(all.description)}
                </p>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

      </div>
    `;
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
