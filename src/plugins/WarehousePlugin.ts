/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import { AppPlugin } from './AppPlugin.js';
import { EventBus } from '../base/EventBus.js';
import { I18nManager } from '../base/I18nManager.js';
import { db } from '../base/Database.js';

export interface WarehousePosition {
  id: string;
  nome: string;
  location: string;
  responsabile: string;
  note: string;
  spaceIds: string[];
}

export interface ScheduledCheckout {
  id: string;
  quantity: number;
  date: string;
  returnDate?: string;
  eventName?: string;
  notes?: string;
  spaceId?: string;
}

export interface WarehouseItem {
  id: string;
  materiale: string;
  quantita: number;
  positionId: string;
  positionName: string;
  spaceIds: string[];
  descrizione: string;
  allegati?: {
    fileName?: string;
    fileId?: string;
    url?: string;
  };
  usciteProgrammate: ScheduledCheckout[];
  lastUpdated: number;
}

export interface WarehousePluginState {
  pluginId: string;
  activeSpaceId: string;
  searchQuery?: string;
}

export class WarehousePlugin implements AppPlugin {
  public readonly id = 'warehouse-tool';
  public readonly name = 'Magazzino & Logistica';
  public readonly isCollaborative = true;
  public readonly version = '1.0.0';
  public readonly author = 'Antigravity TS Engine';
  public readonly description = 'Gestione magazzino, materiale, posizioni e uscite programmate per il Terzo Settore.';
  public readonly icon = '🛠️';

  private defaultPositions: WarehousePosition[] = [
    {
      id: 'pos_sede_main',
      nome: '🛠️ Magazzino Sede Principale',
      location: 'Sede Ente - Piano Terra Stanza B',
      responsabile: 'Mario Rossi (Capo Magazziniere)',
      note: 'Chiavi in rastrelliera direttivo. Attenzione all\'umidità nell\'angolo est.',
      spaceIds: []
    },
    {
      id: 'pos_deposito_reparto',
      nome: '⛺ Deposito Materiale di Branca',
      location: 'Sede Ente - Stanza Reparto Orione',
      responsabile: 'Giuseppe Bianchi',
      note: 'Contiene tende, picchetti, paleria e casse per uscite.',
      spaceIds: ['space_reparto']
    },
    {
      id: 'pos_garage_logistica',
      nome: '🚚 Box Logistica & Mezzi',
      location: 'Garage Esterno 2',
      responsabile: 'Anna Neri',
      note: 'Materiale pesante, gruppo elettrogeno e taniche carburante.',
      spaceIds: ['space_magazzino']
    }
  ];

  private defaultItems: WarehouseItem[] = [
    {
      id: 'wh_item_01',
      materiale: 'Tenda 8 posti modello Canada',
      quantita: 10,
      positionId: 'pos_deposito_reparto',
      positionName: '⛺ Deposito Materiale di Branca',
      spaceIds: ['space_reparto'],
      descrizione: 'Tende di reparto complete di sovratetto, paleria e picchetti.',
      allegati: { fileName: 'scheda_tecnica_tenda.pdf', url: '#' },
      usciteProgrammate: [
        {
          id: 'sc_01',
          quantity: 3,
          date: '2026-10-15',
          returnDate: '2026-10-18',
          eventName: 'Uscita Autunnale Reparto Orione'
        }
      ],
      lastUpdated: Date.now()
    },
    {
      id: 'wh_item_02',
      materiale: 'Fornellino da campo a 2 fuochi',
      quantita: 6,
      positionId: 'pos_sede_main',
      positionName: '🛠️ Magazzino Sede Principale',
      spaceIds: ['space_reparto', 'space_coca'],
      descrizione: 'Fornelli a gas GPL per cambusa e attività uscite.',
      usciteProgrammate: [],
      lastUpdated: Date.now()
    },
    {
      id: 'wh_item_03',
      materiale: 'Gruppo Elettrogeno 3.5 kW',
      quantita: 2,
      positionId: 'pos_garage_logistica',
      positionName: '🚚 Box Logistica & Mezzi',
      spaceIds: ['space_magazzino'],
      descrizione: 'Generatore a benzina 4 tempi con stabilizzatore di tensione.',
      allegati: { fileName: 'manuale_uso_generatore.pdf', url: '#' },
      usciteProgrammate: [],
      lastUpdated: Date.now()
    }
  ];

  public async init(_eventBus: EventBus, _i18n: I18nManager): Promise<void> {
    await this.ensureDefaultData();
    console.log('[WarehousePlugin] Inizializzato con successo.');
  }

  private async ensureDefaultData(): Promise<void> {
    try {
      const savedPositions = await db.settings.get('warehouse.positions');
      if (!savedPositions) {
        await db.settings.put({
          key: 'warehouse.positions',
          value: this.defaultPositions,
          lastUpdated: Date.now()
        });
      }

      const savedItems = await db.settings.get('warehouse.items');
      if (!savedItems) {
        await db.settings.put({
          key: 'warehouse.items',
          value: this.defaultItems,
          lastUpdated: Date.now()
        });
      }
    } catch (e) {
      console.warn('[WarehousePlugin] Errore inizializzazione dati magazzino:', e);
    }
  }

  public render(container: HTMLElement, dataState: WarehousePluginState, _locale: string): void {
    if (!dataState) {
      dataState = {
        pluginId: this.id,
        activeSpaceId: 'space-default',
        searchQuery: ''
      };
    }

    const blockId = `warehouse-ui-${Math.random().toString(36).substring(2, 9)}`;

    container.innerHTML = `
      <div id="${blockId}" class="warehouse-plugin-root bg-slate-900 text-slate-100 rounded-xl p-5 shadow-2xl border border-slate-800 space-y-6 font-sans text-xs">
        
        <!-- HEADER PANNELLO MAGAZZINO -->
        <div class="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="text-3xl">🛠️</span>
            <div>
              <h3 class="text-sm font-bold text-indigo-400">Magazzino & Gestione Logistica</h3>
              <p class="text-[11px] text-slate-400 mt-0.5">Gestione beni, posizioni di conservazione e tracciamento uscite programmate.</p>
            </div>
          </div>
          <div class="text-right">
            <span class="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2.5 py-1 rounded font-mono font-bold">
              Modulo Local-First
            </span>
          </div>
        </div>

        <!-- BARRA D'AZIONE E FILTRI -->
        <div class="bg-slate-950 border border-slate-800 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2 flex-wrap">
            <button type="button" id="wh-btn-add-item" class="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold px-4 py-2 rounded-lg shadow transition-all flex items-center gap-1.5 cursor-pointer">
              <span>➕</span>
              <span>Inserisci materiale</span>
            </button>

            <button type="button" id="wh-btn-update-stock" class="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-4 py-2 rounded-lg shadow transition-all flex items-center gap-1.5 cursor-pointer">
              <span>🔄</span>
              <span>Aggiorna materiale</span>
            </button>
          </div>

          <div class="flex items-center gap-2">
            <div class="relative w-full sm:w-64">
              <input type="text" id="wh-search-input" value="${dataState.searchQuery || ''}" placeholder="Cerca materiale, posizione o spazio..." class="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 font-sans" />
            </div>
          </div>
        </div>

        <!-- TABELLA ELENCO MATERIALE -->
        <div class="wh-items-table-mount space-y-2">
          <div class="text-slate-500 italic p-4 text-center border border-slate-800 rounded-xl">Caricamento inventario magazzino in corso...</div>
        </div>

        <!-- ROOT MODALI -->
        <div id="wh-modal-root"></div>
      </div>
    `;

    this.loadItemsAndRender(container, dataState);
    this.bindEvents(container, dataState);
  }

  private async loadItemsAndRender(container: HTMLElement, dataState: WarehousePluginState): Promise<void> {
    const mount = container.querySelector('.wh-items-table-mount');
    if (!mount) return;

    try {
      const itemsSetting = await db.settings.get('warehouse.items');
      let items: WarehouseItem[] = itemsSetting?.value || this.defaultItems;

      // Filtro per spazio attivo se non ALL
      if (dataState.activeSpaceId && dataState.activeSpaceId !== 'ALL') {
        items = items.filter(
          (i) =>
            !i.spaceIds ||
            i.spaceIds.length === 0 ||
            i.spaceIds.includes(dataState.activeSpaceId) ||
            i.spaceIds.includes('space-default') ||
            dataState.activeSpaceId === 'space-default'
        );
      }

      // Filtro ricerca testo
      if (dataState.searchQuery && dataState.searchQuery.trim()) {
        const q = dataState.searchQuery.toLowerCase();
        items = items.filter(
          (i) =>
            i.materiale.toLowerCase().includes(q) ||
            i.descrizione.toLowerCase().includes(q) ||
            i.positionName.toLowerCase().includes(q)
        );
      }

      const spaceLabels: Record<string, string> = {
        'space_reparto': '⛺ Reparto',
        'space_coca': '🏛️ Co.Ca.',
        'space_magazzino': '🛠️ Magazzino',
        'space-default': '📦 Generale',
        'amministrazione': '🏛️ Governance'
      };

      if (items.length === 0) {
        mount.innerHTML = `<div class="text-slate-500 italic p-6 text-center border border-slate-800 rounded-xl bg-slate-950/40">Nessun elemento registrato in magazzino per la ricerca effettuata.</div>`;
        return;
      }

      mount.innerHTML = `
        <div class="overflow-x-auto border border-slate-800 rounded-xl shadow-lg">
          <table class="w-full text-left text-xs text-slate-200">
            <thead class="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th class="p-3">Materiale</th>
                <th class="p-3 text-center">Quantità in Magazzino</th>
                <th class="p-3">Posizione</th>
                <th class="p-3">Appartenenza</th>
                <th class="p-3">Descrizione</th>
                <th class="p-3">Uscite Programmate</th>
                <th class="p-3 text-center">Allegati</th>
                <th class="p-3 text-center">Azioni</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800 bg-slate-900/60">
              ${items
                .map((item) => {
                  const spaceBadges = item.spaceIds && item.spaceIds.length > 0
                    ? item.spaceIds.map((s) => `<span class="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-1.5 py-0.5 rounded font-mono">${spaceLabels[s] || s}</span>`).join(' ')
                    : `<span class="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.5 rounded font-mono">🌐 Tutti gli Spazi</span>`;

                  const scheduledFormatted = item.usciteProgrammate && item.usciteProgrammate.length > 0
                    ? item.usciteProgrammate
                        .map((sc) => {
                          const remainingAtDate = Math.max(0, item.quantita - sc.quantity);
                          return `
                          <div class="bg-amber-950/70 border border-amber-800/80 p-1.5 rounded text-[10px] text-amber-200 space-y-0.5">
                            <div class="font-bold flex items-center justify-between gap-1">
                              <span>📅 ${sc.date} - ${sc.quantity} pz in uscita</span>
                              <span class="text-amber-400 font-mono">(residuo: ${remainingAtDate} pz)</span>
                            </div>
                            ${sc.eventName ? `<div class="text-slate-300 truncate">Evento: ${sc.eventName}</div>` : ''}
                            ${sc.returnDate ? `<div class="text-slate-400">Rientro previsto: ${sc.returnDate}</div>` : ''}
                          </div>
                        `;
                        })
                        .join('')
                    : `<span class="text-slate-600 italic">Nessuna uscita</span>`;

                  return `
                  <tr class="hover:bg-slate-800/60 transition-colors">
                    <td class="p-3 font-bold text-slate-100 whitespace-nowrap">
                      ${item.materiale}
                    </td>
                    <td class="p-3 text-center whitespace-nowrap">
                      <span class="px-2.5 py-1 rounded text-xs font-extrabold font-mono ${item.quantita > 0 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'}">
                        ${item.quantita} pz
                      </span>
                    </td>
                    <td class="p-3 text-slate-300 font-medium whitespace-nowrap">
                      ${item.positionName}
                    </td>
                    <td class="p-3 whitespace-nowrap">
                      ${spaceBadges}
                    </td>
                    <td class="p-3 text-slate-300 max-w-xs truncate" title="${item.descrizione}">
                      ${item.descrizione || '-'}
                    </td>
                    <td class="p-3 max-w-xs space-y-1">
                      ${scheduledFormatted}
                    </td>
                    <td class="p-3 text-center whitespace-nowrap">
                      ${
                        item.allegati && item.allegati.fileName
                          ? `<a href="${item.allegati.url || '#'}" class="text-indigo-400 hover:text-indigo-300 font-semibold underline text-[11px] flex items-center justify-center gap-1">
                              <span>📎</span> <span>${item.allegati.fileName}</span>
                            </a>`
                          : `<span class="text-slate-600">-</span>`
                      }
                    </td>
                    <td class="p-3 text-center whitespace-nowrap">
                      <button data-update-item-id="${item.id}" class="wh-row-update-btn bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 mx-auto">
                        <span>🔄</span>
                        <span>Aggiorna materiale</span>
                      </button>
                    </td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `;

      // Event listener sui pulsanti di riga
      mount.querySelectorAll('.wh-row-update-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const itemId = (btn as HTMLElement).dataset.updateItemId;
          if (itemId) {
            this.openUpdateStockModal(container, dataState, itemId);
          }
        });
      });
    } catch (e) {
      console.warn('[WarehousePlugin] Errore rendering tabella inventario:', e);
    }
  }

  private bindEvents(container: HTMLElement, dataState: WarehousePluginState): void {
    const searchInput = container.querySelector<HTMLInputElement>('#wh-search-input');
    searchInput?.addEventListener('input', (e) => {
      dataState.searchQuery = (e.target as HTMLInputElement).value;
      this.loadItemsAndRender(container, dataState);
    });

    container.querySelector('#wh-btn-add-item')?.addEventListener('click', () => {
      this.openAddItemModal(container, dataState);
    });

    container.querySelector('#wh-btn-update-stock')?.addEventListener('click', () => {
      this.openUpdateStockModal(container, dataState);
    });
  }

  /**
   * MASCHERA "INSERISCI MATERIALE"
   */
  private async openAddItemModal(container: HTMLElement, dataState: WarehousePluginState): Promise<void> {
    const modalRoot = container.querySelector('#wh-modal-root');
    if (!modalRoot) return;

    const positionsSetting = await db.settings.get('warehouse.positions');
    const positions: WarehousePosition[] = positionsSetting?.value || this.defaultPositions;

    modalRoot.innerHTML = `
      <div class="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans text-slate-100 text-xs">
        <div class="bg-slate-900 border-2 border-indigo-500/80 max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-4">
          
          <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-2xl">➕</span>
              <h3 class="text-md font-bold text-indigo-400">Inserisci Nuovo Materiale in Magazzino</h3>
            </div>
            <button id="wh-close-add-modal-btn" class="text-slate-400 hover:text-white font-bold text-base cursor-pointer">✕</button>
          </div>

          <form id="wh-add-item-form" class="space-y-3">
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Nome Materiale / Articolo *</label>
              <input type="text" id="wh-add-name" required placeholder="es. Tenda 8 posti modello Canada" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Quantità Iniziale *</label>
                <input type="number" id="wh-add-qty" min="0" value="1" required class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono font-bold" />
              </div>

              <div>
                <label class="block text-slate-300 font-semibold mb-1">Posizione di Conservazione *</label>
                <select id="wh-add-position" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100">
                  ${positions.map((p) => `<option value="${p.id}">${p.nome}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
              <label class="block text-slate-300 font-semibold mb-1">Appartenenza / Spazi di Competenza (se vuoto = Tutti)</label>
              <div class="grid grid-cols-2 gap-2 text-xs" id="wh-add-spaces-container">
                <label class="flex items-center gap-1.5 cursor-pointer bg-slate-900 p-2 rounded border border-slate-800">
                  <input type="checkbox" class="wh-add-space-cb cursor-pointer" value="space_reparto" />
                  <span>⛺ Reparto Orione</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer bg-slate-900 p-2 rounded border border-slate-800">
                  <input type="checkbox" class="wh-add-space-cb cursor-pointer" value="space_coca" />
                  <span>🏛️ Co.Ca. / Direzione</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer bg-slate-900 p-2 rounded border border-slate-800">
                  <input type="checkbox" class="wh-add-space-cb cursor-pointer" value="space_magazzino" />
                  <span>🛠️ Magazzino & Logistica</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer bg-slate-900 p-2 rounded border border-slate-800">
                  <input type="checkbox" class="wh-add-space-cb cursor-pointer" value="space-default" />
                  <span>📦 Spazio Generale</span>
                </label>
              </div>
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">Descrizione Dettagliata</label>
              <textarea id="wh-add-desc" rows="2" placeholder="Note, caratteristiche e accessori compresi..." class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"></textarea>
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">Allegati (Scheda Tecnica / Foto)</label>
              <input type="file" id="wh-add-file" accept="image/*,.pdf" class="w-full bg-slate-950 border border-slate-700 rounded p-1 text-slate-400 text-xs cursor-pointer" />
            </div>

            <div class="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button type="button" id="wh-cancel-add-modal-btn" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer">
                Annulla
              </button>
              <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-lg shadow transition-colors cursor-pointer flex items-center gap-1.5">
                <span>✅ Registra Materiale</span>
              </button>
            </div>
          </form>

        </div>
      </div>
    `;

    const closeModal = () => {
      modalRoot.innerHTML = '';
    };

    modalRoot.querySelector('#wh-close-add-modal-btn')?.addEventListener('click', closeModal);
    modalRoot.querySelector('#wh-cancel-add-modal-btn')?.addEventListener('click', closeModal);

    modalRoot.querySelector('#wh-add-item-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = (modalRoot.querySelector('#wh-add-name') as HTMLInputElement).value.trim();
      const qty = parseInt((modalRoot.querySelector('#wh-add-qty') as HTMLInputElement).value || '0', 10);
      const posId = (modalRoot.querySelector('#wh-add-position') as HTMLSelectElement).value;
      const desc = (modalRoot.querySelector('#wh-add-desc') as HTMLTextAreaElement).value.trim();
      const file = (modalRoot.querySelector('#wh-add-file') as HTMLInputElement).files?.[0];

      const selSpaceCbs = modalRoot.querySelectorAll<HTMLInputElement>('.wh-add-space-cb:checked');
      const selectedSpaces = Array.from(selSpaceCbs).map((cb) => cb.value);

      const targetPos = positions.find((p) => p.id === posId);
      const positionName = targetPos ? targetPos.nome : 'Magazzino Generale';

      const itemsSetting = await db.settings.get('warehouse.items');
      const items: WarehouseItem[] = itemsSetting?.value || [...this.defaultItems];

      const newItem: WarehouseItem = {
        id: `wh_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        materiale: name,
        quantita: qty,
        positionId: posId,
        positionName,
        spaceIds: selectedSpaces,
        descrizione: desc,
        allegati: file ? { fileName: file.name, url: '#' } : undefined,
        usciteProgrammate: [],
        lastUpdated: Date.now()
      };

      items.push(newItem);
      await db.settings.put({
        key: 'warehouse.items',
        value: items,
        lastUpdated: Date.now()
      });

      alert(`✅ Materiale "${name}" (${qty} pz) registrato con successo in magazzino.`);
      closeModal();
      this.loadItemsAndRender(container, dataState);
    });
  }

  /**
   * MASCHERA "AGGIORNA MATERIALE" (BATCH / AZIONI INVENTARIO)
   */
  private async openUpdateStockModal(container: HTMLElement, dataState: WarehousePluginState, preSelectedItemId?: string): Promise<void> {
    const modalRoot = container.querySelector('#wh-modal-root');
    if (!modalRoot) return;

    const itemsSetting = await db.settings.get('warehouse.items');
    const items: WarehouseItem[] = itemsSetting?.value || [...this.defaultItems];

    if (items.length === 0) {
      alert('Nessun elemento presente in magazzino da aggiornare.');
      return;
    }

    let selectedIds: string[] = preSelectedItemId ? [preSelectedItemId] : [];

    modalRoot.innerHTML = `
      <div class="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans text-slate-100 text-xs">
        <div class="bg-slate-900 border-2 border-emerald-500/80 max-w-2xl w-full rounded-2xl p-6 shadow-2xl space-y-4">
          
          <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-2xl">🔄</span>
              <h3 class="text-md font-bold text-emerald-400">Aggiorna / Movimenta Materiale Magazzino</h3>
            </div>
            <button id="wh-close-upd-modal-btn" class="text-slate-400 hover:text-white font-bold text-base cursor-pointer">✕</button>
          </div>

          <form id="wh-upd-form" class="space-y-4">
            
            <!-- SELETTORE AZIONE -->
            <div class="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <label class="block text-slate-200 font-bold">1. Seleziona Tipologia Operazione / Azione *</label>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <label class="flex items-center justify-center gap-1.5 p-2 rounded-lg border cursor-pointer transition-all bg-slate-900 border-slate-700 hover:border-emerald-500 has-[:checked]:bg-emerald-950 has-[:checked]:border-emerald-500 has-[:checked]:text-emerald-200">
                  <input type="radio" name="wh-action" value="AGGIUNGI" checked class="cursor-pointer" />
                  <span class="font-bold">➕ Aggiungi</span>
                </label>
                <label class="flex items-center justify-center gap-1.5 p-2 rounded-lg border cursor-pointer transition-all bg-slate-900 border-slate-700 hover:border-blue-500 has-[:checked]:bg-blue-950 has-[:checked]:border-blue-500 has-[:checked]:text-blue-200">
                  <input type="radio" name="wh-action" value="RECUPERA" class="cursor-pointer" />
                  <span class="font-bold">📥 Recupera</span>
                </label>
                <label class="flex items-center justify-center gap-1.5 p-2 rounded-lg border cursor-pointer transition-all bg-slate-900 border-slate-700 hover:border-amber-500 has-[:checked]:bg-amber-950 has-[:checked]:border-amber-500 has-[:checked]:text-amber-200">
                  <input type="radio" name="wh-action" value="RECUPERO_PROGRAMMATO" class="cursor-pointer" />
                  <span class="font-bold">📅 Rec. Programmat.</span>
                </label>
                <label class="flex items-center justify-center gap-1.5 p-2 rounded-lg border cursor-pointer transition-all bg-slate-900 border-slate-700 hover:border-red-500 has-[:checked]:bg-red-950 has-[:checked]:border-red-500 has-[:checked]:text-red-200">
                  <input type="radio" name="wh-action" value="SMALTISCI" class="cursor-pointer" />
                  <span class="font-bold">🗑️ Smaltisci</span>
                </label>
              </div>
            </div>

            <!-- CAMPI CONTESTUALI PER DATE ED EVENTO -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Evento / Attività Collegata</label>
                <input type="text" id="wh-upd-event" placeholder="es. Uscita Autunnale / Campo" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
              </div>

              <div id="wh-output-date-box" class="hidden">
                <label class="block text-slate-300 font-semibold mb-1">Data Uscita *</label>
                <input type="date" id="wh-upd-out-date" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
              </div>

              <div id="wh-return-date-box" class="hidden">
                <label class="block text-slate-300 font-semibold mb-1">Data Restituzione Prevista</label>
                <input type="date" id="wh-upd-ret-date" value="${new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
              </div>
            </div>

            <!-- SELEZIONE MULTIPLA VOCI MAGAZZINO -->
            <div class="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
              <div class="flex items-center justify-between">
                <label class="block text-slate-200 font-bold">2. Seleziona Elementi da Movimentare *</label>
                <input type="text" id="wh-upd-filter" placeholder="Filtra lista articoli..." class="bg-slate-900 border border-slate-700 text-slate-100 rounded px-2 py-1 text-[11px] w-48" />
              </div>

              <div id="wh-upd-items-selector" class="max-h-36 overflow-y-auto space-y-1 border border-slate-800 rounded p-2 bg-slate-900/60 text-xs">
                ${items
                  .map(
                    (it) => `
                  <label class="flex items-center justify-between p-1.5 rounded hover:bg-slate-800 cursor-pointer text-xs">
                    <div class="flex items-center gap-2">
                      <input type="checkbox" class="wh-upd-item-cb cursor-pointer" value="${it.id}" ${selectedIds.includes(it.id) ? 'checked' : ''} />
                      <span class="font-bold text-slate-100">${it.materiale}</span>
                      <span class="text-[10px] text-slate-400">(${it.positionName})</span>
                    </div>
                    <span class="font-mono text-emerald-400 font-bold">Disponibili: ${it.quantita} pz</span>
                  </label>
                `
                  )
                  .join('')}
              </div>
            </div>

            <!-- BLOCCO QUANTITA' ED ESITO PER ELEMENTI SELEZIONATI -->
            <div class="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
              <div class="font-bold text-slate-200 text-xs">3. Specifiche Quantità da Inserire / Risultato Proiettato:</div>
              <div id="wh-upd-quantities-container" class="space-y-2">
                <div class="text-slate-500 italic text-center p-2">Nessun elemento selezionato. Spunta gli articoli nella lista sopra.</div>
              </div>
            </div>

            <div class="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button type="button" id="wh-cancel-upd-modal-btn" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer">
                Annulla
              </button>
              <button type="submit" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-lg shadow transition-colors cursor-pointer flex items-center gap-1.5">
                <span>✅ Conferma Movimentazione</span>
              </button>
            </div>

          </form>

        </div>
      </div>
    `;

    const closeModal = () => {
      modalRoot.innerHTML = '';
    };

    modalRoot.querySelector('#wh-close-upd-modal-btn')?.addEventListener('click', closeModal);
    modalRoot.querySelector('#wh-cancel-upd-modal-btn')?.addEventListener('click', closeModal);

    const form = modalRoot.querySelector<HTMLFormElement>('#wh-upd-form');
    if (!form) return;

    const actionRadios = form.querySelectorAll<HTMLInputElement>('input[name="wh-action"]');
    const outDateBox = modalRoot.querySelector('#wh-output-date-box');
    const retDateBox = modalRoot.querySelector('#wh-return-date-box');
    const filterInput = modalRoot.querySelector<HTMLInputElement>('#wh-upd-filter');
    const qtyContainer = modalRoot.querySelector('#wh-upd-quantities-container');

    const updateVisibilityAndCalculations = () => {
      const selectedAction = Array.from(actionRadios).find((r) => r.checked)?.value || 'AGGIUNGI';

      if (selectedAction === 'RECUPERO_PROGRAMMATO') {
        outDateBox?.classList.remove('hidden');
        retDateBox?.classList.remove('hidden');
      } else if (selectedAction === 'RECUPERA') {
        outDateBox?.classList.add('hidden');
        retDateBox?.classList.remove('hidden');
      } else {
        outDateBox?.classList.add('hidden');
        retDateBox?.classList.add('hidden');
      }

      // Ricostruzione blocchi quantità per elementi spuntati
      const checkedCbs = modalRoot.querySelectorAll<HTMLInputElement>('.wh-upd-item-cb:checked');
      const currentSelectedIds = Array.from(checkedCbs).map((c) => c.value);

      if (currentSelectedIds.length === 0) {
        if (qtyContainer) {
          qtyContainer.innerHTML = `<div class="text-slate-500 italic text-center p-2">Nessun elemento selezionato. Spunta gli articoli nella lista sopra.</div>`;
        }
        return;
      }

      if (qtyContainer) {
        qtyContainer.innerHTML = currentSelectedIds
          .map((id) => {
            const it = items.find((i) => i.id === id);
            if (!it) return '';

            const scheduledInfo =
              it.usciteProgrammate && it.usciteProgrammate.length > 0
                ? it.usciteProgrammate.map((sc) => `📅 Uscita il ${sc.date}: ${sc.quantity} pz`).join(', ')
                : 'Nessuna uscita programmata';

            return `
            <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs" data-item-row="${it.id}">
              <div class="space-y-1">
                <div class="font-bold text-slate-100">${it.materiale}</div>
                <div class="text-[10px] text-slate-400">
                  In Magazzino: <strong class="text-emerald-400">${it.quantita} pz</strong> | Posizione: ${it.positionName}
                </div>
                <div class="text-[10px] text-amber-300">
                  Uscite Previste: ${scheduledInfo}
                </div>
              </div>
              <div class="flex items-center gap-2">
                <label class="text-[11px] text-slate-300 font-semibold">Qtà da inserire:</label>
                <input type="number" min="1" value="1" data-qty-for="${it.id}" class="wh-qty-input bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-100 font-mono font-bold w-20 text-center" />
                <span class="text-[11px] text-slate-400 font-mono projected-result-span" data-result-for="${it.id}"></span>
              </div>
            </div>
          `;
          })
          .join('');

        // Attacca evento input sulle caselle quantità
        qtyContainer.querySelectorAll<HTMLInputElement>('.wh-qty-input').forEach((inputEl) => {
          const calculateProjected = () => {
            const itemId = inputEl.dataset.qtyFor;
            const targetItem = items.find((i) => i.id === itemId);
            const span = qtyContainer.querySelector<HTMLElement>(`[data-result-for="${itemId}"]`);
            if (!targetItem || !span) return;

            const inputQty = parseInt(inputEl.value || '0', 10) || 0;
            if (selectedAction === 'AGGIUNGI') {
              span.innerHTML = `= Totale: <strong class="text-emerald-400">${targetItem.quantita + inputQty} pz</strong>`;
            } else if (selectedAction === 'RECUPERA' || selectedAction === 'SMALTISCI') {
              const res = targetItem.quantita - inputQty;
              span.innerHTML = `= Rimanenti: <strong class="${res >= 0 ? 'text-amber-300' : 'text-red-400'}">${res} pz</strong>`;
            } else if (selectedAction === 'RECUPERO_PROGRAMMATO') {
              const resAtDate = targetItem.quantita - inputQty;
              span.innerHTML = `<span class="text-amber-300 font-bold">(residuo a quella data: ${resAtDate} pz)</span>`;
            }
          };

          inputEl.addEventListener('input', calculateProjected);
          calculateProjected();
        });
      }
    };

    actionRadios.forEach((r) => r.addEventListener('change', updateVisibilityAndCalculations));
    modalRoot.querySelectorAll('.wh-upd-item-cb').forEach((cb) => cb.addEventListener('change', updateVisibilityAndCalculations));

    if (filterInput) {
      filterInput.addEventListener('input', () => {
        const q = filterInput.value.toLowerCase();
        modalRoot.querySelectorAll<HTMLElement>('#wh-upd-items-selector label').forEach((lbl) => {
          const txt = lbl.textContent?.toLowerCase() || '';
          lbl.style.display = txt.includes(q) ? 'flex' : 'none';
        });
      });
    }

    updateVisibilityAndCalculations();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const selectedAction = Array.from(actionRadios).find((r) => r.checked)?.value || 'AGGIUNGI';
      const eventName = (modalRoot.querySelector('#wh-upd-event') as HTMLInputElement).value.trim();
      const outDate = (modalRoot.querySelector('#wh-upd-out-date') as HTMLInputElement).value;
      const retDate = (modalRoot.querySelector('#wh-upd-ret-date') as HTMLInputElement).value;

      const checkedCbs = modalRoot.querySelectorAll<HTMLInputElement>('.wh-upd-item-cb:checked');
      const targetIds = Array.from(checkedCbs).map((c) => c.value);

      if (targetIds.length === 0) {
        alert('Seleziona almeno un elemento da movimentare.');
        return;
      }

      const itemsSetting = await db.settings.get('warehouse.items');
      let currentItems: WarehouseItem[] = itemsSetting?.value || [...this.defaultItems];

      targetIds.forEach((id) => {
        const idx = currentItems.findIndex((it) => it.id === id);
        if (idx < 0) return;

        const inputEl = modalRoot.querySelector<HTMLInputElement>(`[data-qty-for="${id}"]`);
        const qtyVal = parseInt(inputEl?.value || '0', 10) || 0;

        if (selectedAction === 'AGGIUNGI') {
          currentItems[idx].quantita += qtyVal;
        } else if (selectedAction === 'RECUPERA') {
          currentItems[idx].quantita = Math.max(0, currentItems[idx].quantita - qtyVal);
          if (retDate) {
            currentItems[idx].usciteProgrammate.push({
              id: `sc_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
              quantity: qtyVal,
              date: new Date().toISOString().split('T')[0],
              returnDate: retDate,
              eventName: eventName || 'Uscita Immediata'
            });
          }
        } else if (selectedAction === 'RECUPERO_PROGRAMMATO') {
          currentItems[idx].usciteProgrammate.push({
            id: `sc_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            quantity: qtyVal,
            date: outDate || new Date().toISOString().split('T')[0],
            returnDate: retDate,
            eventName: eventName || 'Uscita Programmata'
          });
        } else if (selectedAction === 'SMALTISCI') {
          currentItems[idx].quantita = Math.max(0, currentItems[idx].quantita - qtyVal);
        }

        currentItems[idx].lastUpdated = Date.now();
      });

      await db.settings.put({
        key: 'warehouse.items',
        value: currentItems,
        lastUpdated: Date.now()
      });

      alert(`✅ Movimentazione "${selectedAction}" completata con successo per ${targetIds.length} articolo/i.`);
      closeModal();
      this.loadItemsAndRender(container, dataState);
    });
  }

  public serializeToMarkdown(dataState: WarehousePluginState): string {
    return `### 🛠️ Registro Magazzino & Logistica\n- Spazio Attivo: ${dataState?.activeSpaceId || 'space-default'}\n- Data Ultimo Aggiornamento: ${new Date().toISOString()}\n`;
  }
}
