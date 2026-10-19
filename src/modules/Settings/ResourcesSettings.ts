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
 * NOME FILE: src/modules/Settings/ResourcesSettings.ts
 * ============================================================================
 * DESCRIZIONE:
 * Modulo di configurazione e governance per l'Hub Risorse (v2.0):
 * 1. Selezione della visuale predefinita dello Spazio (CARDS vs LIST)
 * 2. Mappature tra moduli sorgente (Activity, Cambusa, Mappe, Verbali) e Categorie
 * 3. Card Priority Configurator:
 *    - Selezione Categoria Master
 *    - Selezione e riordinamento dei 3-5 campi metadati prioritari per la card
 *    - Live Card Preview reattiva in tempo reale
 * 4. Salvataggio della configurazione per Spazio in Dexie (db.settings)
 * ============================================================================
 */

import { resourceConfigRegistry } from '../../plugins/ResourcesPlugin/ResourceConfigRegistry.js';
import {
  ResourcesSpaceConfig,
  ResourceCategory,
  ResourceViewMode,
  CategoryDefinition
} from '../../plugins/ResourcesPlugin/types.js';

export class ResourcesSettings {
  private static instance: ResourcesSettings;

  public static getInstance(): ResourcesSettings {
    if (!ResourcesSettings.instance) {
      ResourcesSettings.instance = new ResourcesSettings();
    }
    return ResourcesSettings.instance;
  }

  public async render(container: HTMLElement, spaceId: string = 'space-default'): Promise<void> {
    const config = await resourceConfigRegistry.getSpaceConfig(spaceId);
    const categories = resourceConfigRegistry.getAllCategories();
    let selectedCatId: ResourceCategory = 'GAMES';

    const renderFullUI = () => {
      const selectedCatDef = resourceConfigRegistry.getCategory(selectedCatId);
      const currentPriorityFields: string[] =
        config.categoryPriority[selectedCatId] ||
        selectedCatDef?.defaultPriorityFields ||
        [];

      container.innerHTML = `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6 text-slate-100 font-sans text-xs shadow-xl">
          
          <!-- HEADER SEZIONE -->
          <div class="border-b border-slate-800 pb-4 flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-3">
              <span class="text-2xl">📚</span>
              <div>
                <h3 class="text-sm font-bold text-blue-400">Configurazione Risorse & Mappature</h3>
                <p class="text-[11px] text-slate-400 mt-0.5">
                  Governance della conoscenza, visualizzazioni predefinite e regole di priorità per le schede visive.
                </p>
              </div>
            </div>
            <span class="text-[10px] bg-blue-950 text-blue-300 border border-blue-900 px-2.5 py-1 rounded font-mono font-bold">
              Spazio: ${spaceId}
            </span>
          </div>

          <!-- 1. VISUALE PREDEFINITA DELLO SPAZIO -->
          <div class="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-3">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 class="font-bold text-slate-200 text-xs flex items-center gap-2">
                  <span>1. Visuale Predefinita dell'Hub per questo Spazio</span>
                </h4>
                <p class="text-[11px] text-slate-400 mt-0.5">
                  Scegli se aprire l'Hub Risorse come griglia visiva di schede o come tabella compatta ad alta densità.
                </p>
              </div>
              <div class="flex items-center bg-slate-900 border border-slate-700 p-1 rounded-lg">
                <button id="btn-set-view-cards" class="px-3 py-1.5 rounded font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  config.defaultView === 'CARDS'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }">
                  <span>📇</span>
                  <span>Schede (Grid)</span>
                </button>
                <button id="btn-set-view-list" class="px-3 py-1.5 rounded font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  config.defaultView === 'LIST'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }">
                  <span>📊</span>
                  <span>Lista (Table)</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 2. REGOLE DI MAPPATURA MODULI SORGENTE -> CATEGORIE RISORSE -->
          <div class="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-3">
            <div>
              <h4 class="font-bold text-slate-200 text-xs flex items-center gap-2">
                <span>2. Regole di Mappatura Moduli Sorgente ──► Categorie Risorse</span>
              </h4>
              <p class="text-[11px] text-slate-400 mt-0.5">
                Definisci in quale categoria dell'Hub Risorse vengono indicizzati automaticamente gli elementi creati negli altri plugin.
              </p>
            </div>

            <div class="overflow-x-auto border border-slate-800/80 rounded-lg">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                    <th class="py-2.5 px-3">Modulo Origine</th>
                    <th class="py-2.5 px-3">Condizione / Tag</th>
                    <th class="py-2.5 px-3">Categoria Risorsa di Destinazione</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60">
                  ${config.sourceMappings
                    .map(
                      (m, idx) => `
                    <tr class="hover:bg-slate-900/40">
                      <td class="py-2.5 px-3 font-semibold text-slate-200 flex items-center gap-2">
                        <span>${m.icon}</span>
                        <span>${m.label}</span>
                      </td>
                      <td class="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                        ${m.matchTagOrType ? `#${m.matchTagOrType}` : 'Tutte le entità pubblicate'}
                      </td>
                      <td class="py-2.5 px-3">
                        <select data-mapping-idx="${idx}" class="select-mapping-category bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs font-semibold focus:border-blue-500 focus:outline-none cursor-pointer">
                          ${categories
                            .map(
                              (c) => `
                            <option value="${c.id}" ${c.id === m.targetCategory ? 'selected' : ''}>
                              ${c.icon} ${c.label}
                            </option>
                          `
                            )
                            .join('')}
                        </select>
                      </td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- 3. CONFIGURATORE PRIORITÀ VISUALIZZAZIONE CAMPI SCHEDA (CARD PRIORITY ENGINE) -->
          <div class="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-4">
            <div class="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
              <div>
                <h4 class="font-bold text-slate-200 text-xs flex items-center gap-2">
                  <span>3. Configuratore Priorità Visualizzazione Schede (Card Priority Engine)</span>
                </h4>
                <p class="text-[11px] text-slate-400 mt-0.5">
                  Personalizza, per ogni categoria, quali 3-5 campi chiave mostrare nei badge sintetici d'impatto sulla scheda visiva.
                </p>
              </div>

              <!-- Selettore Categoria per la configurazione -->
              <div class="flex items-center gap-2">
                <span class="text-slate-400 text-xs font-semibold">Categoria:</span>
                <select id="select-priority-category" class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs font-bold focus:border-blue-500 focus:outline-none cursor-pointer">
                  ${categories
                    .map(
                      (c) => `
                    <option value="${c.id}" ${c.id === selectedCatId ? 'selected' : ''}>
                      ${c.icon} ${c.label}
                    </option>
                  `
                    )
                    .join('')}
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              <!-- COLONNA LISTA CAMPI (RIORDINAMENTO SU/GIÙ) (7 COLONNE) -->
              <div class="lg:col-span-7 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-slate-300">
                    Campi Prioritari per <strong>${selectedCatDef?.label}</strong> (in ordine di apparizione):
                  </span>
                  <span class="text-[10px] text-slate-500">I primi 4 campi compaiono nei badge</span>
                </div>

                <div id="priority-fields-list" class="space-y-2">
                  ${this.renderPriorityFieldsList(selectedCatDef, currentPriorityFields)}
                </div>

                <div class="pt-2">
                  <button type="button" id="btn-reset-default-priority" class="text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer">
                    Ripristina campi consigliati di default per questa categoria
                  </button>
                </div>
              </div>

              <!-- COLONNA LIVE CARD PREVIEW (5 COLONNE) -->
              <div class="lg:col-span-5 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    📇 Anteprima Scheda Live
                  </span>
                  <span class="text-[10px] text-emerald-400 font-mono">Aggiornamento Realtime</span>
                </div>

                <div class="bg-slate-900 border border-slate-800 rounded-xl p-3">
                  ${this.renderLivePreviewCard(selectedCatDef, currentPriorityFields)}
                </div>
              </div>

            </div>
          </div>

          <!-- BOTTONE SALVATAGGIO GENERALE -->
          <div class="pt-2 flex items-center justify-between border-t border-slate-800">
            <span id="save-status-msg" class="text-xs text-slate-400 italic"></span>
            
            <button id="btn-save-resources-config" class="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer text-xs">
              <span>💾</span>
              <span>Salva Configurazione Risorse</span>
            </button>
          </div>

        </div>
      `;

      this.bindEvents(container, spaceId, config, selectedCatId, (newCatId) => {
        selectedCatId = newCatId;
        renderFullUI();
      });
    };

    renderFullUI();
  }

  private renderPriorityFieldsList(catDef?: CategoryDefinition, currentPriority: string[] = []): string {
    if (!catDef || catDef.availableFields.length === 0) {
      return '<div class="text-slate-500 italic text-xs">Nessun campo disponibile.</div>';
    }

    // Unisci i campi prioritari con quelli restanti non ancora inclusi
    const allFieldKeys = catDef.availableFields.map((f) => f.key);
    const orderedKeys = [
      ...currentPriority.filter((k) => allFieldKeys.includes(k)),
      ...allFieldKeys.filter((k) => !currentPriority.includes(k))
    ];

    return orderedKeys
      .map((key, idx) => {
        const fieldDef = catDef.availableFields.find((f) => f.key === key);
        if (!fieldDef) return '';
        const isPriority = idx < 4;

        return `
          <div class="flex items-center justify-between bg-slate-900/90 border ${
            isPriority ? 'border-blue-900/80 bg-blue-950/20' : 'border-slate-800'
          } rounded-lg p-2 text-xs">
            <div class="flex items-center gap-2.5">
              <span class="w-5 text-center font-bold font-mono text-[11px] ${
                isPriority ? 'text-blue-400' : 'text-slate-500'
              }">#${idx + 1}</span>
              <span class="text-sm">${fieldDef.icon}</span>
              <div>
                <span class="font-semibold text-slate-200">${fieldDef.label}</span>
                <span class="text-[10px] text-slate-500 font-mono ml-1.5">(${fieldDef.key})</span>
              </div>
            </div>

            <div class="flex items-center gap-1">
              ${
                isPriority
                  ? '<span class="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded mr-1 font-bold">Badge Attivo</span>'
                  : ''
              }
              <button type="button" data-field-up="${key}" ${idx === 0 ? 'disabled' : ''} class="btn-field-up p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer" title="Sposta in alto">
                🔼
              </button>
              <button type="button" data-field-down="${key}" ${idx === orderedKeys.length - 1 ? 'disabled' : ''} class="btn-field-down p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer" title="Sposta in basso">
                🔽
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  private renderLivePreviewCard(catDef?: CategoryDefinition, currentPriority: string[] = []): string {
    const catLabel = catDef?.label || 'Categoria';
    const catIcon = catDef?.icon || '📌';
    const gradient = catDef?.gradientStyle || 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)';

    const badges = (currentPriority.slice(0, 4) || [])
      .map((key) => {
        const fieldDef = catDef?.availableFields.find((f) => f.key === key);
        if (!fieldDef) return '';
        const sampleVal = fieldDef.placeholder || 'Dato Esempio';
        return `
          <div class="flex items-start gap-1 bg-slate-950/70 border border-slate-800 px-2 py-1 rounded text-[10px]">
            <span>${fieldDef.icon}</span>
            <div class="truncate">
              <span class="text-slate-400 block text-[9px] leading-none mb-0.5 truncate">${fieldDef.label}</span>
              <span class="text-slate-200 font-semibold block truncate">${sampleVal}</span>
            </div>
          </div>
        `;
      })
      .filter(Boolean)
      .join('');

    return `
      <div class="rounded-xl border border-slate-700/80 overflow-hidden bg-slate-900 shadow-md">
        <div class="p-3 flex flex-col justify-between min-h-[90px]" style="background: ${gradient};">
          <div class="flex items-center justify-between">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-950/80 border border-slate-700 text-white">
              ${catIcon} ${catLabel}
            </span>
            <span class="text-[9px] bg-blue-950 text-blue-300 border border-blue-900 px-1.5 py-0.5 rounded font-mono">
              Live Preview
            </span>
          </div>
          <h4 class="text-xs font-bold text-white drop-shadow-sm mt-2">
            Titolo Scheda Dimostrativa
          </h4>
        </div>

        <div class="p-3 space-y-2">
          <div class="grid grid-cols-2 gap-1.5">
            ${badges}
          </div>
          <p class="text-[10px] text-slate-400 line-clamp-2">
            Questo blocco sintetico visualizza i campi prioritari nell'ordine specificato a sinistra.
          </p>
        </div>
      </div>
    `;
  }

  private bindEvents(
    container: HTMLElement,
    spaceId: string,
    config: ResourcesSpaceConfig,
    currentCatId: ResourceCategory,
    onCategoryChanged: (newCatId: ResourceCategory) => void
  ): void {
    // 1. Switch default view
    container.querySelector('#btn-set-view-cards')?.addEventListener('click', () => {
      config.defaultView = 'CARDS';
      this.updateViewButtons(container, 'CARDS');
    });

    container.querySelector('#btn-set-view-list')?.addEventListener('click', () => {
      config.defaultView = 'LIST';
      this.updateViewButtons(container, 'LIST');
    });

    // 2. Mappature sorgenti
    const mappingSelects = container.querySelectorAll<HTMLSelectElement>('.select-mapping-category');
    mappingSelects.forEach((sel) => {
      sel.addEventListener('change', () => {
        const idxStr = sel.getAttribute('data-mapping-idx');
        if (idxStr !== null) {
          const idx = parseInt(idxStr, 10);
          config.sourceMappings[idx].targetCategory = sel.value as ResourceCategory;
        }
      });
    });

    // 3. Selettore Categoria per Priority Configurator
    const catSelect = container.querySelector<HTMLSelectElement>('#select-priority-category');
    catSelect?.addEventListener('change', () => {
      onCategoryChanged(catSelect.value as ResourceCategory);
    });

    // 4. Riordinamento campi prioritari (Su / Giù)
    const catDef = resourceConfigRegistry.getCategory(currentCatId);
    const allFieldKeys = catDef ? catDef.availableFields.map((f) => f.key) : [];
    let priorityKeys = config.categoryPriority[currentCatId]
      ? [...config.categoryPriority[currentCatId]]
      : catDef
      ? [...catDef.defaultPriorityFields]
      : [];

    // Allinea priorityKeys per contenere tutte le chiavi disponibili
    const completeList = [
      ...priorityKeys.filter((k) => allFieldKeys.includes(k)),
      ...allFieldKeys.filter((k) => !priorityKeys.includes(k))
    ];

    container.querySelectorAll<HTMLButtonElement>('.btn-field-up').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-field-up');
        if (!key) return;
        const idx = completeList.indexOf(key);
        if (idx > 0) {
          const temp = completeList[idx - 1];
          completeList[idx - 1] = completeList[idx];
          completeList[idx] = temp;
          config.categoryPriority[currentCatId] = completeList;
          onCategoryChanged(currentCatId);
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('.btn-field-down').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-field-down');
        if (!key) return;
        const idx = completeList.indexOf(key);
        if (idx < completeList.length - 1) {
          const temp = completeList[idx + 1];
          completeList[idx + 1] = completeList[idx];
          completeList[idx] = temp;
          config.categoryPriority[currentCatId] = completeList;
          onCategoryChanged(currentCatId);
        }
      });
    });

    // Reset default priority
    container.querySelector('#btn-reset-default-priority')?.addEventListener('click', () => {
      if (catDef) {
        config.categoryPriority[currentCatId] = [...catDef.defaultPriorityFields];
        onCategoryChanged(currentCatId);
      }
    });

    // 5. Salva configurazione
    container.querySelector('#btn-save-resources-config')?.addEventListener('click', async () => {
      const msgEl = container.querySelector('#save-status-msg');
      try {
        await resourceConfigRegistry.saveSpaceConfig(spaceId, config);
        if (msgEl) {
          msgEl.innerHTML = '<span class="text-emerald-400 font-bold">✅ Configurazione Risorse salvata con successo!</span>';
          setTimeout(() => {
            if (msgEl) msgEl.innerHTML = '';
          }, 4000);
        }
      } catch (err) {
        if (msgEl) {
          msgEl.innerHTML = '<span class="text-red-400 font-bold">❌ Errore durante il salvataggio.</span>';
        }
      }
    });
  }

  private updateViewButtons(container: HTMLElement, view: ResourceViewMode): void {
    const btnCards = container.querySelector('#btn-set-view-cards');
    const btnList = container.querySelector('#btn-set-view-list');
    if (btnCards && btnList) {
      if (view === 'CARDS') {
        btnCards.className = 'px-3 py-1.5 rounded font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-blue-600 text-white shadow';
        btnList.className = 'px-3 py-1.5 rounded font-bold transition-all cursor-pointer flex items-center gap-1.5 text-slate-400 hover:text-slate-200';
      } else {
        btnCards.className = 'px-3 py-1.5 rounded font-bold transition-all cursor-pointer flex items-center gap-1.5 text-slate-400 hover:text-slate-200';
        btnList.className = 'px-3 py-1.5 rounded font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-blue-600 text-white shadow';
      }
    }
  }
}

export const resourcesSettings = ResourcesSettings.getInstance();
