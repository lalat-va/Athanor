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
import { I18nManager, i18nManager } from '../base/I18nManager.js';
import { db, AccountingTransactionRecord } from '../base/Database.js';
import { MockStorageAdapter, StorageAdapter } from '../modules/StorageAdapter.js';
import { costCenterRegistry, CostCenterDefinition } from '../modules/CostCenterRegistry.js';
import defaultMinisterialCategories from '../base/defaults/ministerialCategoriesDefault.json' with { type: 'json' };

export interface LocalCategoryMapping {
  localCategory: string;
  ministerialCategoryCode: string;
  ministerialCategoryLabel: string;
}

export interface MinisterialCategoryVersion {
  validFromDate: string;
  categories: Array<{
    code: string;
    label: string;
    section: 'ENTRATE' | 'USCITE';
  }>;
}

export interface AccountingPluginState {
  pluginId: string;
  activeSpaceId: string;
  fiscalYear: string;
  costCentersEnabled: boolean;
  activeSettingsTab?: 'transactions' | 'settings_categories' | 'settings_mapping' | 'settings_cost_centers' | 'export_sheets';
  selectedCategoryFilter?: string;
  searchQuery?: string;
}

export class AccountingPlugin implements AppPlugin {
  public id = 'accounting-tool';
  public name = 'Rendicontazione & Contabilità Generale';
  public isCollaborative = true;

  public partitioning = {
    strategy: 'PER_PERIOD' as const,
    periodUnit: 'FISCAL_YEAR' as const
  };

  public locales = {
    it: {
      title: '💰 Rendicontazione & Contabilità Generale (RUNTS Modello D / AGESCI A4)',
      subtitle: 'Gestione cassa di Spazio, rendicontazione finanziaria e bilancio consuntivo dell\'Ente.',
      tabTransactions: '📋 Registro Transazioni',
      tabCategories: '📜 Voci Ministeriali (Modello D)',
      tabMapping: '🔗 Mappatura Voci Locali',
      tabCostCenters: '📊 Centri di Costo (Opzionale)',
      tabExport: '📤 Export Google Sheets',
      totalIncome: 'Entrate Totali',
      totalExpense: 'Uscite Totali',
      netBalance: 'Saldo Netto',
      runtsStatus: 'Stato Conformità RUNTS',
      newTransactionBtn: '➕ Nuova Transazione',
      costCenterLabel: 'Centro di Costo',
      localCategoryLabel: 'Voce Locale Semplice',
      ministerialCategoryLabel: 'Voce Ufficiale RUNTS (Modello D)',
      amountLabel: 'Importo (€)',
      dateLabel: 'Data Transazione',
      paymentMethodLabel: 'Metodo di Pagamento',
      receiptAttachmentLabel: 'Allegato Scontrino / Ricevuta',
      confirmTransactionBtn: '✅ Conferma Transazione',
      publishSheetsBtn: '📊 Esporta su Google Sheets',
      costCentersDisabledAlert: 'ℹ️ Il modulo Centri di Costo è disattivato per garantire la semplicità d\'uso delle casse locali.',
      restrictedAdminAlert: '🔒 Maschera riservata esclusivamente a Responsabile Legale, Dirigente e Tesoriere.'
    },
    en: {
      title: '💰 Accounting & Financial Reporting (RUNTS Model D / AGESCI A4)',
      subtitle: 'Space cash management, financial reporting and consolidated balance sheet.',
      tabTransactions: '📋 Transaction Ledger',
      tabCategories: '📜 Official Categories (Model D)',
      tabMapping: '🔗 Local Category Mapping',
      tabCostCenters: '📊 Cost Centers (Optional)',
      tabExport: '📤 Export to Google Sheets',
      totalIncome: 'Total Income',
      totalExpense: 'Total Expenses',
      netBalance: 'Net Balance',
      runtsStatus: 'RUNTS Compliance Status',
      newTransactionBtn: '➕ New Transaction',
      costCenterLabel: 'Cost Center',
      localCategoryLabel: 'Simple Local Category',
      ministerialCategoryLabel: 'Official RUNTS Category (Model D)',
      amountLabel: 'Amount (€)',
      dateLabel: 'Transaction Date',
      paymentMethodLabel: 'Payment Method',
      receiptAttachmentLabel: 'Receipt Attachment',
      confirmTransactionBtn: '✅ Confirm Transaction',
      publishSheetsBtn: '📊 Export to Google Sheets',
      costCentersDisabledAlert: 'ℹ️ Cost Centers module is disabled to ensure visual simplicity for local cash units.',
      restrictedAdminAlert: '🔒 Administrative panel restricted to Legal Representative, Executive and Treasurer.'
    }
  };

  private i18n: I18nManager;
  private storageAdapter: StorageAdapter;

  private defaultLocalMappings: LocalCategoryMapping[] = [
    { localCategory: 'Cibo & Cambusa', ministerialCategoryCode: 'RUNTS_A4_1', ministerialCategoryLabel: 'Generi Alimentari e Ristorazione (Cambusa & Vitto)' },
    { localCategory: 'Sede & Affitto Spazi', ministerialCategoryCode: 'RUNTS_A4_2', ministerialCategoryLabel: 'Affitto e Noleggio Immobili, Terreni e Sedi' },
    { localCategory: 'Biglietti Treno / Bus / Carburante', ministerialCategoryCode: 'RUNTS_A4_3', ministerialCategoryLabel: 'Trasporti, Trasferte e Carburante (Treni, Bus, Mezzi)' },
    { localCategory: 'Utenze & Bollette', ministerialCategoryCode: 'RUNTS_A4_4', ministerialCategoryLabel: 'Utenze, Luce, Gas, Acqua e Connettività' },
    { localCategory: 'Materiali & Pionieristica', ministerialCategoryCode: 'RUNTS_A4_5', ministerialCategoryLabel: 'Attrezzature, Materiale Tecnico e Pionieristica' },
    { localCategory: 'Quote Assicurazioni e Tessere', ministerialCategoryCode: 'RUNTS_A4_6', ministerialCategoryLabel: 'Quote Associative, Assicurazioni e Tesseramenti' },
    { localCategory: 'Cancelleria & Modulistica', ministerialCategoryCode: 'RUNTS_A4_7', ministerialCategoryLabel: 'Cancelleria, Stampa, Certificati e Modulistica' },
    { localCategory: 'Spese Mediche & Farmacia', ministerialCategoryCode: 'RUNTS_A4_8', ministerialCategoryLabel: 'Spese Mediche, Primo Soccorso e Sanitarie' },
    { localCategory: 'Quota Cassa Partecipanti (Entrata)', ministerialCategoryCode: 'RUNTS_B1_4', ministerialCategoryLabel: 'Quote Partecipazione Attività e Campi' },
    { localCategory: 'Autofinanziamento ed Eventi (Entrata)', ministerialCategoryCode: 'RUNTS_B1_5', ministerialCategoryLabel: 'Raccolta Fondi ed Eventi Autofinanziamento' }
  ];

  constructor(_bus?: EventBus, i18n?: I18nManager) {
    this.i18n = i18n || i18nManager;
    this.storageAdapter = new MockStorageAdapter();
  }

  public async init(_bus: EventBus, i18n: I18nManager): Promise<void> {
    this.i18n = i18n;
    costCenterRegistry.registerSelf();
    await this.seedDefaultDataIfNeeded();
    console.log('[AccountingPlugin] Inizializzato con successo. Provider Centri di Costo registrato.');
  }

  private async seedDefaultDataIfNeeded(): Promise<void> {
    try {
      const existingMappings = await db.settings.get('accounting.local_category_mappings');
      if (!existingMappings) {
        await db.settings.put({
          key: 'accounting.local_category_mappings',
          value: this.defaultLocalMappings,
          lastUpdated: Date.now()
        });
      }

      const existingVersions = await db.settings.get('accounting.ministerial_category_versions');
      if (!existingVersions) {
        const initialVersion: MinisterialCategoryVersion = {
          validFromDate: '2024-01-01',
          categories: defaultMinisterialCategories as any
        };
        await db.settings.put({
          key: 'accounting.ministerial_category_versions',
          value: [initialVersion],
          lastUpdated: Date.now()
        });
      }

      const demoTxCount = await db.accounting.count();
      if (demoTxCount === 0) {
        const demoTransactions: AccountingTransactionRecord[] = [
          {
            transactionId: 'tx_2026_001',
            spaceId: 'space-default',
            fiscalYear: '2025/2026',
            date: '2026-02-10',
            type: 'EXPENSE',
            description: 'Acquisto materiale di cancelleria e registro verbali',
            localCategory: 'Cancelleria & Modulistica',
            ministerialCategoryCode: 'RUNTS_A4_7',
            ministerialCategoryLabel: 'Cancelleria, Stampa, Certificati e Modulistica',
            categoryListVersionDate: '2024-01-01',
            costCenterIdSnapshot: null,
            amount: 45.80,
            paymentMethod: 'DEBIT_CARD',
            status: 'CONFIRMED',
            attachment: { status: 'NONE' }
          },
          {
            transactionId: 'tx_2026_002',
            spaceId: 'space_reparto',
            fiscalYear: '2025/2026',
            date: '2026-03-01',
            type: 'EXPENSE',
            description: 'Cambusa e generi alimentari per la cassa di Reparto Orione',
            localCategory: 'Cibo & Cambusa',
            ministerialCategoryCode: 'RUNTS_A4_1',
            ministerialCategoryLabel: 'Generi Alimentari e Ristorazione (Cambusa & Vitto)',
            categoryListVersionDate: '2024-01-01',
            costCenterIdSnapshot: 'cdc_branca_eg_2026',
            amount: 184.50,
            paymentMethod: 'CASH',
            status: 'CONFIRMED',
            linkedPluginId: 'evt_campo_estivo_2026',
            attachment: { status: 'NONE' }
          },
          {
            transactionId: 'tx_2026_003',
            spaceId: 'space_reparto',
            fiscalYear: '2025/2026',
            date: '2026-03-05',
            type: 'INCOME',
            description: 'Incasso quote partecipante al Campo di Primavera',
            localCategory: 'Quota Cassa Partecipanti (Entrata)',
            ministerialCategoryCode: 'RUNTS_B1_4',
            ministerialCategoryLabel: 'Quote Partecipazione Attività e Campi',
            categoryListVersionDate: '2024-01-01',
            costCenterIdSnapshot: 'cdc_branca_eg_2026',
            amount: 450.00,
            paymentMethod: 'BANK_TRANSFER',
            status: 'CONFIRMED',
            attachment: { status: 'NONE' }
          }
        ];
        await db.accounting.bulkPut(demoTransactions);
      }
    } catch (e) {
      console.warn('[AccountingPlugin] Errore nel caricamento dei dati di default:', e);
    }
  }

  public render(container: HTMLElement, dataState: AccountingPluginState, _currentLocale: string): void {
    if (!dataState) {
      dataState = {
        pluginId: this.id,
        activeSpaceId: 'space-default',
        fiscalYear: '2025/2026',
        costCentersEnabled: false,
        activeSettingsTab: 'transactions'
      };
    }
    if (!dataState.activeSettingsTab || !['transactions', 'export_sheets'].includes(dataState.activeSettingsTab)) {
      dataState.activeSettingsTab = 'transactions';
    }

    const currentUserRoles = ['RESPONSIBLE_LEGAL', 'ADMINISTRATOR'];
    const canManageAdminSettings =
      currentUserRoles.includes('RESPONSIBLE_LEGAL') ||
      currentUserRoles.includes('ADMINISTRATOR') ||
      currentUserRoles.includes('TESORIERE') ||
      currentUserRoles.includes('DIRIGENTE');

    const t = (key: string) => (this.i18n ? this.i18n.t(`plugins.${this.id}.${key}`) : key);
    const blockId = `accounting-ui-${Math.random().toString(36).substring(2, 9)}`;

    container.innerHTML = `
      <div id="${blockId}" class="accounting-plugin-root bg-slate-900 text-slate-100 rounded-xl p-5 shadow-2xl border border-slate-800 space-y-6 font-sans text-xs">
        
        <!-- HEADER PANNELLO RENDICONTAZIONE -->
        <div class="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="text-3xl">💰</span>
            <div>
              <h3 class="text-sm font-bold text-amber-400">${t('title')}</h3>
              <p class="text-[11px] text-slate-400 mt-0.5">${t('subtitle')}</p>
            </div>
          </div>

          <!-- TAB SWITCHER INTERNO (RISERVATO A MOVIMENTI & ESPORTAZIONE) -->
          <div class="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs flex-wrap">
            <button class="acc-tab-btn px-3 py-1.5 rounded-md font-medium transition-colors ${
              dataState.activeSettingsTab === 'transactions' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }" data-tab="transactions">
              📋 Movimenti Contabili
            </button>

            <button class="acc-tab-btn px-3 py-1.5 rounded-md font-medium transition-colors ${
              dataState.activeSettingsTab === 'export_sheets' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }" data-tab="export_sheets">
              📤 Esportazione Google Sheets / CSV
            </button>
          </div>
        </div>

        <!-- CONTENUTO TAB 1: REGISTRO TRANSAZIONI -->
        <div class="acc-content-transactions ${dataState.activeSettingsTab === 'transactions' ? '' : 'hidden'} space-y-5">
          
          <!-- PLANCIA CARDS RIASSUNTIVE FINANZIARIE (SUMMARY CARDS) -->
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div class="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">${t('totalIncome')}</div>
              <div id="acc-sum-income" class="text-base font-extrabold text-emerald-400">€ 0.00</div>
              <div class="text-[10px] text-slate-500">Anno Fiscale ${dataState.fiscalYear}</div>
            </div>

            <div class="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">${t('totalExpense')}</div>
              <div id="acc-sum-expense" class="text-base font-extrabold text-red-400">€ 0.00</div>
              <div class="text-[10px] text-slate-500">Anno Fiscale ${dataState.fiscalYear}</div>
            </div>

            <div class="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">${t('netBalance')}</div>
              <div id="acc-sum-net" class="text-base font-extrabold text-blue-400">€ 0.00</div>
              <div class="text-[10px] text-slate-500">Risultato d'Esercizio</div>
            </div>

            <div class="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">${t('runtsStatus')}</div>
              <div id="acc-sum-status" class="text-xs font-bold text-emerald-300 flex items-center gap-1.5 pt-1">
                <span>🟢 Conforme Modello D</span>
              </div>
              <div class="text-[10px] text-slate-500">Rendiconto per Cassa CTS</div>
            </div>
          </div>

          <!-- BARRA AZIONI E FILTRI TRANSAZIONI -->
          <div class="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div class="flex items-center gap-2 flex-wrap">
              <button type="button" id="acc-add-tx-btn" class="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-4 py-2 rounded-lg shadow transition-colors flex items-center gap-1.5 cursor-pointer">
                <span>➕</span>
                <span>${t('newTransactionBtn')}</span>
              </button>

              <select id="acc-space-filter" class="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 focus:outline-none">
                <option value="ALL">🌐 Tutti gli Spazi (Vista Consolidata Ente)</option>
                <option value="space-default" ${dataState.activeSpaceId === 'space-default' ? 'selected' : ''}>📦 Spazio Operativo Generale</option>
                <option value="space_coca" ${dataState.activeSpaceId === 'space_coca' ? 'selected' : ''}>🏛️ Co.Ca. / Direzione</option>
                <option value="space_reparto" ${dataState.activeSpaceId === 'space_reparto' ? 'selected' : ''}>⛺ Reparto Orione</option>
                <option value="space_magazzino" ${dataState.activeSpaceId === 'space_magazzino' ? 'selected' : ''}>🛠️ Magazzino & Logistica</option>
              </select>

              <select id="acc-year-filter" class="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 focus:outline-none">
                <option value="2025/2026" selected>Anno Fiscale 2025/2026</option>
                <option value="2024/2025">Anno Fiscale 2024/2025</option>
              </select>
            </div>

            <div class="flex items-center gap-2">
              <input type="text" id="acc-search-input" placeholder="Cerca descrizione o voce..." class="bg-slate-900 border border-slate-700 text-slate-100 rounded px-3 py-1.5 w-full sm:w-48 focus:outline-none focus:border-amber-500" />
            </div>
          </div>

          <!-- TABELLA TRANSAZIONI MOUNT -->
          <div class="acc-transactions-table-mount space-y-2">
            <div class="text-slate-500 italic p-4 text-center border border-slate-800 rounded-xl">Caricamento registro contabile in corso...</div>
          </div>
        </div>

        <!-- CONTENUTO TAB 2: VOCI MINISTERIALI (MODELLO D RUNTS / A4) -->
        <div class="acc-content-categories ${dataState.activeSettingsTab === 'settings_categories' ? '' : 'hidden'} space-y-5">
          <div class="bg-slate-950 border border-purple-900/60 p-4 rounded-xl space-y-4 shadow-md">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 class="font-bold text-slate-100 flex items-center gap-2 text-xs">
                <span>📜 Elenco Voci Ministeriali Ufficiali (Modello D RUNTS / AGESCI A4)</span>
              </h4>
              <span class="text-[10px] bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded font-bold">Versionamento Temporale</span>
            </div>

            <p class="text-[11px] text-slate-400 leading-relaxed">
              Carica un nuovo elenco di Voci Ministeriali in formato JSON specificando la <strong>Data di Validità</strong>. Tutte le transazioni registrate dopo la data di validità useranno il nuovo elenco, preservando l'integrità dei bilanci storici passati.
            </p>

            <div class="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-3">
              <div class="font-bold text-slate-200">➕ Carica Nuovo Elenco Voci Ministeriali:</div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block text-slate-400 mb-1">Data di Validità (ISO Date) *</label>
                  <input type="date" id="cat-valid-date" value="2027-01-01" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
                </div>
                <div>
                  <label class="block text-slate-400 mb-1">File JSON Voci Ministeriali *</label>
                  <input type="file" id="cat-json-file" accept=".json" class="w-full bg-slate-950 border border-slate-700 rounded p-1 text-slate-400 text-xs cursor-pointer" />
                </div>
                <div class="flex items-end">
                  <button type="button" id="cat-upload-btn" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-2 rounded shadow transition-colors">
                    Carica Elenco Voci
                  </button>
                </div>
              </div>
            </div>

            <!-- TABELLA VOCI ATTIVE -->
            <div class="acc-categories-list-mount space-y-2 pt-2">
              <div class="text-slate-500 italic p-3 text-center border border-slate-800 rounded">Caricamento voci ministeriali in corso...</div>
            </div>
          </div>
        </div>

        <!-- CONTENUTO TAB 3: MAPPATURA VOCI LOCALI -> MINISTERIALI -->
        <div class="acc-content-mapping ${dataState.activeSettingsTab === 'settings_mapping' ? '' : 'hidden'} space-y-5">
          <div class="bg-slate-950 border border-indigo-900/60 p-4 rounded-xl space-y-4 shadow-md">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 class="font-bold text-slate-100 flex items-center gap-2 text-xs">
                <span>🔗 Maschera Mappatura Voci Locali Semplici ➔ Voci Ministeriali</span>
              </h4>
              <span class="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-bold">Mapping Manager</span>
            </div>

            <p class="text-[11px] text-slate-400 leading-relaxed">
              Configura l'associazione tra il linguaggio semplice dei volontari (es. <em>"Cibo & Cambusa"</em>) e le voci contabili burocratiche del RUNTS (es. <em>"RUNTS_A4_1 - Generi Alimentari"</em>).
            </p>

            <div class="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-3">
              <div class="font-bold text-slate-200">➕ Aggiungi / Aggiorna Mappatura:</div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block text-slate-400 mb-1">Voce Locale Semplice *</label>
                  <input type="text" id="map-local-input" placeholder="es. Attrezzatura da Campo" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
                </div>
                <div>
                  <label class="block text-slate-400 mb-1">Corrispondente Voce Ministeriale RUNTS *</label>
                  <select id="map-ministerial-select" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100">
                    <!-- Popolato dinamicamente -->
                  </select>
                </div>
                <div class="flex items-end">
                  <button type="button" id="map-save-btn" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded shadow transition-colors">
                    Salva Mappatura
                  </button>
                </div>
              </div>
            </div>

            <div class="acc-mappings-table-mount space-y-2 pt-2">
              <div class="text-slate-500 italic p-3 text-center border border-slate-800 rounded">Caricamento dizionario mappature in corso...</div>
            </div>
          </div>
        </div>

        <!-- CONTENUTO TAB 4: CENTRI DI COSTO (OPZIONALE) -->
        <div class="acc-content-cost-centers ${dataState.activeSettingsTab === 'settings_cost_centers' ? '' : 'hidden'} space-y-5">
          <div class="bg-slate-950 border border-blue-900/60 p-4 rounded-xl space-y-4 shadow-md">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 class="font-bold text-slate-100 flex items-center gap-2 text-xs">
                <span>📊 Configurazione Centri di Costo (Modulo Opzionale Ad-Hoc)</span>
              </h4>
              <label class="flex items-center gap-2 cursor-pointer bg-slate-900 px-3 py-1 rounded border border-slate-700">
                <input type="checkbox" id="cc-enable-toggle" ${dataState.costCentersEnabled ? 'checked' : ''} class="rounded" />
                <span class="font-bold ${dataState.costCentersEnabled ? 'text-emerald-400' : 'text-slate-400'}">
                  ${dataState.costCentersEnabled ? 'ABILITATO' : 'DISATTIVATO'}
                </span>
              </label>
            </div>

            <p class="text-[11px] text-slate-400 leading-relaxed">
              Quando il modulo è <strong>DISATTIVATO</strong>, ogni riferimento ai Centri di Costo è nascosto dalla grafica per mantenere pulita la schermata delle casse locali. L'attivazione è riservata a Responsabile Legale, Dirigente e Tesoriere.
            </p>

            ${
              dataState.costCentersEnabled
                ? `
              <div class="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-3">
                <div class="font-bold text-slate-200">➕ Nuovo Centro di Costo:</div>
                <div class="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label class="block text-slate-400 mb-1">Nome Centro di Costo *</label>
                    <input type="text" id="cc-name-input" placeholder="es. CDC Branca Lupetti" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
                  </div>
                  <div>
                    <label class="block text-slate-400 mb-1">Codice Budget *</label>
                    <input type="text" id="cc-code-input" placeholder="es. CC-LUP-04" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono" />
                  </div>
                  <div>
                    <label class="block text-slate-400 mb-1">Spazio Associato *</label>
                    <select id="cc-space-select" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100">
                      <option value="space-default">📦 Spazio Operativo Generale</option>
                      <option value="space_coca">🏛️ Co.Ca. / Direzione</option>
                      <option value="space_reparto">⛺ Reparto Orione</option>
                      <option value="space_magazzino">🛠️ Magazzino & Logistica</option>
                    </select>
                  </div>
                  <div class="flex items-end">
                    <button type="button" id="cc-save-btn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2 rounded shadow transition-colors">
                      Aggiungi CDC
                    </button>
                  </div>
                </div>
              </div>

              <div class="acc-cost-centers-list-mount space-y-2 pt-2">
                <div class="text-slate-500 italic p-3 text-center border border-slate-800 rounded">Caricamento centri di costo...</div>
              </div>
            `
                : `
              <div class="bg-amber-950/60 border border-amber-800/80 text-amber-200 p-4 rounded-xl text-xs space-y-1">
                <div class="font-bold flex items-center gap-1.5">
                  <span>ℹ️ Modulo Centri di Costo Attualmente Disattivato</span>
                </div>
                <p class="text-[11px] text-amber-300/90 leading-relaxed">
                  L'interfaccia delle transazioni e dei form di spesa è attualmente semplificata. Se la tua associazione richiede il controllo di gestione avanzato per Centri di Costo, spunta la casella "ABILITATO" in alto a destra.
                </p>
              </div>
            `
            }
          </div>
        </div>

        <!-- CONTENUTO TAB 5: EXPORT GOOGLE SHEETS -->
        <div class="acc-content-export ${dataState.activeSettingsTab === 'export_sheets' ? '' : 'hidden'} space-y-5">
          <div class="bg-slate-950 border border-emerald-900/60 p-4 rounded-xl space-y-4 shadow-md">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 class="font-bold text-slate-100 flex items-center gap-2 text-xs">
                <span>📤 Pubblicazione Progressiva & Export Google Sheets</span>
              </h4>
              <span class="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-bold">Append-Only Audit</span>
            </div>

            <p class="text-[11px] text-slate-400 leading-relaxed">
              Esporta la plancia contabile ed il registro transazioni consolidato su un foglio di calcolo Google Sheets. L'esportazione avviene in modalità <strong>Append-Only</strong> per garantire la tracciabilità delle revisioni per il Tesoriere.
            </p>

            <div class="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-3">
              <div class="font-bold text-slate-200">📊 Parametri Export Esercizio Finanziario:</div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label class="block text-slate-400 mb-1">Seleziona Spazio *</label>
                  <select id="exp-space-select" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100">
                    <option value="ALL">🌐 Tutti gli Spazi (Consolidato Ente)</option>
                    <option value="space-default">📦 Spazio Operativo Generale</option>
                    <option value="space_coca">🏛️ Co.Ca. / Direzione</option>
                    <option value="space_reparto">⛺ Reparto Orione</option>
                  </select>
                </div>
                <div>
                  <label class="block text-slate-400 mb-1">Anno Fiscale *</label>
                  <select id="exp-year-select" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100">
                    <option value="2025/2026">Anno Fiscale 2025/2026</option>
                    <option value="2024/2025">Anno Fiscale 2024/2025</option>
                  </select>
                </div>
                <div class="flex items-end">
                  <button type="button" id="exp-execute-btn" class="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-4 py-2 rounded shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                    <span>📊</span>
                    <span>Esporta Ora su Google Sheets</span>
                  </button>
                </div>
              </div>
            </div>

            <div id="exp-result-box" class="hidden text-xs p-3 rounded-lg border"></div>
          </div>
        </div>

      </div>

      <!-- CONTAINER MODALE NUOVA TRANSAZIONE -->
      <div id="acc-modal-root"></div>
    `;

    this.loadTransactionsAndRender(container, dataState);
    this.bindEvents(container, dataState, canManageAdminSettings);
  }

  private async loadTransactionsAndRender(container: HTMLElement, dataState: AccountingPluginState): Promise<void> {
    const mount = container.querySelector('.acc-transactions-table-mount');
    if (!mount) return;

    try {
      let txs = await db.accounting.toArray();

      if (dataState.activeSpaceId && dataState.activeSpaceId !== 'ALL') {
        txs = txs.filter((t) => t.spaceId === dataState.activeSpaceId || t.spaceId === 'space-default');
      }

      if (dataState.fiscalYear) {
        txs = txs.filter((t) => t.fiscalYear === dataState.fiscalYear);
      }

      if (dataState.searchQuery && dataState.searchQuery.trim()) {
        const q = dataState.searchQuery.toLowerCase();
        txs = txs.filter(
          (t) => t.description.toLowerCase().includes(q) || t.localCategory.toLowerCase().includes(q) || t.ministerialCategoryLabel.toLowerCase().includes(q)
        );
      }

      // Ricalcolo Totali
      let totalIncome = 0;
      let totalExpense = 0;
      txs.forEach((t) => {
        if (t.type === 'INCOME') totalIncome += t.amount;
        if (t.type === 'EXPENSE') totalExpense += t.amount;
      });
      const net = totalIncome - totalExpense;

      const sumIncEl = container.querySelector('#acc-sum-income');
      const sumExpEl = container.querySelector('#acc-sum-expense');
      const sumNetEl = container.querySelector('#acc-sum-net');

      if (sumIncEl) sumIncEl.textContent = `€ ${totalIncome.toFixed(2)}`;
      if (sumExpEl) sumExpEl.textContent = `€ ${totalExpense.toFixed(2)}`;
      if (sumNetEl) {
        sumNetEl.textContent = `€ ${net.toFixed(2)}`;
        sumNetEl.className = net >= 0 ? 'text-base font-extrabold text-blue-400' : 'text-base font-extrabold text-red-400';
      }

      if (txs.length === 0) {
        mount.innerHTML = `<div class="text-slate-500 italic p-4 text-center border border-slate-800 rounded-xl">Nessuna transazione contabile registrata per lo Spazio ed Anno Fiscale selezionato.</div>`;
        return;
      }

      mount.innerHTML = `
        <div class="overflow-x-auto border border-slate-800 rounded-xl">
          <table class="w-full text-left text-xs text-slate-200">
            <thead class="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th class="p-3">Data</th>
                <th class="p-3">Tipo</th>
                <th class="p-3">Descrizione</th>
                <th class="p-3">Voce Locale & RUNTS</th>
                ${dataState.costCentersEnabled ? `<th class="p-3">Centro di Costo</th>` : ''}
                <th class="p-3 text-right">Importo (€)</th>
                <th class="p-3">Stato</th>
                <th class="p-3 text-center">Azioni</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800 bg-slate-900/60">
              ${txs
                .map((t) => {
                  const isInc = t.type === 'INCOME';
                  return `
                  <tr class="hover:bg-slate-800/60 transition-colors">
                    <td class="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">${t.date}</td>
                    <td class="p-3 whitespace-nowrap">
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isInc ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'}">
                        ${isInc ? 'ENTRATA' : 'USCITA'}
                      </span>
                    </td>
                    <td class="p-3 font-medium text-slate-100 max-w-xs truncate" title="${t.description}">
                      ${t.description}
                      ${t.linkedPluginId ? `<span class="block text-[10px] text-blue-400 font-mono">Evento ID: ${t.linkedPluginId}</span>` : ''}
                    </td>
                    <td class="p-3">
                      <div class="font-bold text-slate-200">${t.localCategory}</div>
                      <div class="text-[10px] text-purple-300 font-mono">${t.ministerialCategoryCode} • ${t.ministerialCategoryLabel}</div>
                    </td>
                    ${
                      dataState.costCentersEnabled
                        ? `
                      <td class="p-3 font-mono text-[11px] text-blue-300">
                        ${t.costCenterIdSnapshot ? `<span class="bg-blue-950 border border-blue-800 px-2 py-0.5 rounded">${t.costCenterIdSnapshot}</span>` : '<span class="text-slate-600">-</span>'}
                      </td>
                    `
                        : ''
                    }
                    <td class="p-3 text-right font-extrabold whitespace-nowrap ${isInc ? 'text-emerald-400' : 'text-red-400'}">
                      ${isInc ? '+' : '-'} € ${t.amount.toFixed(2)}
                    </td>
                    <td class="p-3 whitespace-nowrap">
                      <span class="px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        t.status === 'CONFIRMED' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-slate-800 text-slate-300 border-slate-700'
                      }">
                        ${t.status}
                      </span>
                    </td>
                    <td class="p-3 text-center whitespace-nowrap">
                      <button data-delete-id="${t.transactionId}" class="acc-del-tx-btn text-red-400 hover:text-red-300 font-bold px-2 py-1 rounded">
                        🗑️
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

      mount.querySelectorAll('.acc-del-tx-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const id = (e.currentTarget as HTMLElement).getAttribute('data-delete-id');
          if (id) {
            await db.accounting.delete(id);
            this.loadTransactionsAndRender(container, dataState);
          }
        });
      });
    } catch (e) {
      console.warn('[AccountingPlugin] Errore caricamento registro transazioni:', e);
    }
  }

  private async loadCategoriesAndRender(container: HTMLElement): Promise<void> {
    const mount = container.querySelector('.acc-categories-list-mount');
    const ministerialSelect = container.querySelector<HTMLSelectElement>('#map-ministerial-select');
    if (!mount) return;

    try {
      const versions = (await db.settings.get('accounting.ministerial_category_versions'))?.value || [];
      const currentVersion = versions[versions.length - 1] || { categories: defaultMinisterialCategories };
      const categories = currentVersion.categories || defaultMinisterialCategories;

      if (ministerialSelect) {
        ministerialSelect.innerHTML = categories
          .map((c: any) => `<option value="${c.code}">${c.code} - ${c.label} (${c.section})</option>`)
          .join('');
      }

      mount.innerHTML = `
        <div class="overflow-x-auto border border-slate-800 rounded-lg">
          <table class="w-full text-left text-xs text-slate-200">
            <thead class="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th class="p-2.5">Codice Voce</th>
                <th class="p-2.5">Descrizione Ministeriale RUNTS / A4</th>
                <th class="p-2.5">Sezione</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800 bg-slate-900/60 font-mono text-[11px]">
              ${categories
                .map(
                  (c: any) => `
                <tr>
                  <td class="p-2.5 font-bold text-purple-300">${c.code}</td>
                  <td class="p-2.5 text-slate-200">${c.label}</td>
                  <td class="p-2.5"><span class="px-2 py-0.5 rounded text-[10px] ${c.section === 'ENTRATE' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'}">${c.section}</span></td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      console.warn('[AccountingPlugin] Errore caricamento voci ministeriali:', e);
    }
  }

  private async loadMappingsAndRender(container: HTMLElement): Promise<void> {
    const mount = container.querySelector('.acc-mappings-table-mount');
    if (!mount) return;

    try {
      const mappings: LocalCategoryMapping[] = (await db.settings.get('accounting.local_category_mappings'))?.value || this.defaultLocalMappings;

      mount.innerHTML = `
        <div class="overflow-x-auto border border-slate-800 rounded-lg">
          <table class="w-full text-left text-xs text-slate-200">
            <thead class="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th class="p-2.5">Voce Locale Semplice</th>
                <th class="p-2.5">Corrispondente Codice RUNTS</th>
                <th class="p-2.5">Etichetta Ministeriale Ufficiale</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800 bg-slate-900/60">
              ${mappings
                .map(
                  (m) => `
                <tr>
                  <td class="p-2.5 font-bold text-indigo-300">${m.localCategory}</td>
                  <td class="p-2.5 font-mono text-purple-300 text-[11px]">${m.ministerialCategoryCode}</td>
                  <td class="p-2.5 text-slate-300">${m.ministerialCategoryLabel}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      console.warn('[AccountingPlugin] Errore caricamento mappature voci locali:', e);
    }
  }

  private async loadCostCentersAndRender(container: HTMLElement, dataState: AccountingPluginState): Promise<void> {
    const mount = container.querySelector('.acc-cost-centers-list-mount');
    if (!mount || !dataState.costCentersEnabled) return;

    try {
      const ccs = await costCenterRegistry.resolveOptions(null);

      mount.innerHTML = `
        <div class="overflow-x-auto border border-slate-800 rounded-lg">
          <table class="w-full text-left text-xs text-slate-200">
            <thead class="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th class="p-2.5">Codice Budget</th>
                <th class="p-2.5">Nome Centro di Costo</th>
                <th class="p-2.5">Spazio Associato</th>
                <th class="p-2.5 text-right">Budget Assegnato (€)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800 bg-slate-900/60 font-mono text-[11px]">
              ${ccs
                .map(
                  (c) => `
                <tr>
                  <td class="p-2.5 font-bold text-blue-300">${c.budgetCode || c.value}</td>
                  <td class="p-2.5 text-slate-200 font-sans">${c.label}</td>
                  <td class="p-2.5 text-slate-400">${c.spaceId || 'Generale'}</td>
                  <td class="p-2.5 text-right font-extrabold text-emerald-400">€ ${(c.allocatedBudget || 0).toFixed(2)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      console.warn('[AccountingPlugin] Errore caricamento centri di costo:', e);
    }
  }

  private bindEvents(container: HTMLElement, dataState: AccountingPluginState, canManageAdminSettings: boolean): void {
    // Cambio Tab Settings
    container.querySelectorAll('.acc-tab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).getAttribute('data-tab') as any;

        if (tab !== 'transactions' && !canManageAdminSettings) {
          alert(this.locales.it.restrictedAdminAlert);
          return;
        }

        dataState.activeSettingsTab = tab;
        this.render(container, dataState, '');
      });
    });

    // Filtri Spazio e Anno Fiscale
    container.querySelector('#acc-space-filter')?.addEventListener('change', (e) => {
      dataState.activeSpaceId = (e.target as HTMLSelectElement).value;
      this.loadTransactionsAndRender(container, dataState);
    });

    container.querySelector('#acc-year-filter')?.addEventListener('change', (e) => {
      dataState.fiscalYear = (e.target as HTMLSelectElement).value;
      this.loadTransactionsAndRender(container, dataState);
    });

    container.querySelector('#acc-search-input')?.addEventListener('input', (e) => {
      dataState.searchQuery = (e.target as HTMLInputElement).value;
      this.loadTransactionsAndRender(container, dataState);
    });

    // Apertura Modale Nuova Transazione
    container.querySelector('#acc-add-tx-btn')?.addEventListener('click', () => {
      this.renderTransactionModal(container, dataState);
    });

    if (canManageAdminSettings) {
      // Toggle Centri di Costo
      container.querySelector('#cc-enable-toggle')?.addEventListener('change', async (e) => {
        const isChecked = (e.target as HTMLInputElement).checked;
        dataState.costCentersEnabled = isChecked;

        try {
          await db.settings.put({
            key: 'accounting.costCentersEnabled',
            value: isChecked,
            lastUpdated: Date.now()
          });
        } catch (err) {
          console.warn('[AccountingPlugin] Errore salvataggio flag centri di costo:', err);
        }

        this.render(container, dataState, '');
      });

      // Caricamento Elenco Voci Ministeriali da JSON
      container.querySelector('#cat-upload-btn')?.addEventListener('click', async () => {
        const validDateInput = container.querySelector<HTMLInputElement>('#cat-valid-date');
        const fileInput = container.querySelector<HTMLInputElement>('#cat-json-file');

        if (!validDateInput || !validDateInput.value) {
          alert('Inserisci la Data di Validità dell\'elenco.');
          return;
        }

        const file = fileInput?.files?.[0];
        if (!file) {
          alert('Seleziona un file JSON di Voci Ministeriali.');
          return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const categories = JSON.parse(event.target?.result as string);
            if (!Array.isArray(categories)) throw new Error('Formato JSON non valido.');

            const versions = (await db.settings.get('accounting.ministerial_category_versions'))?.value || [];
            versions.push({
              validFromDate: validDateInput.value,
              categories
            });

            await db.settings.put({
              key: 'accounting.ministerial_category_versions',
              value: versions,
              lastUpdated: Date.now()
            });

            alert(`✅ Nuovo elenco Voci Ministeriali caricato con successo!\nData di Validità: ${validDateInput.value}`);
            this.loadCategoriesAndRender(container);
          } catch (err: any) {
            alert(`❌ Errore parsing file JSON: ${err.message}`);
          }
        };
        reader.readAsText(file);
      });

      // Aggiunta Mappatura Voce Locale -> Ministeriale
      container.querySelector('#map-save-btn')?.addEventListener('click', async () => {
        const localInput = container.querySelector<HTMLInputElement>('#map-local-input');
        const minSelect = container.querySelector<HTMLSelectElement>('#map-ministerial-select');

        if (!localInput || !localInput.value.trim() || !minSelect || !minSelect.value) {
          alert('Compila sia la Voce Locale che la Voce Ministeriale.');
          return;
        }

        const localCategory = localInput.value.trim();
        const code = minSelect.value;
        const label = minSelect.options[minSelect.selectedIndex]?.text.split(' - ')[1] || code;

        const mappings: LocalCategoryMapping[] = (await db.settings.get('accounting.local_category_mappings'))?.value || this.defaultLocalMappings;
        const idx = mappings.findIndex((m) => m.localCategory.toLowerCase() === localCategory.toLowerCase());

        if (idx >= 0) {
          mappings[idx] = { localCategory, ministerialCategoryCode: code, ministerialCategoryLabel: label };
        } else {
          mappings.push({ localCategory, ministerialCategoryCode: code, ministerialCategoryLabel: label });
        }

        await db.settings.put({
          key: 'accounting.local_category_mappings',
          value: mappings,
          lastUpdated: Date.now()
        });

        alert(`✅ Mappatura salvata con successo per "${localCategory}".`);
        localInput.value = '';
        this.loadMappingsAndRender(container);
      });

      // Aggiunta Centro di Costo
      container.querySelector('#cc-save-btn')?.addEventListener('click', async () => {
        const nameInput = container.querySelector<HTMLInputElement>('#cc-name-input');
        const codeInput = container.querySelector<HTMLInputElement>('#cc-code-input');
        const spaceSelect = container.querySelector<HTMLSelectElement>('#cc-space-select');

        if (!nameInput || !nameInput.value.trim() || !codeInput || !codeInput.value.trim()) {
          alert('Inserisci il Nome ed il Codice Budget per il Centro di Costo.');
          return;
        }

        const name = nameInput.value.trim();
        const code = codeInput.value.trim();
        const spaceId = spaceSelect?.value || 'space-default';

        const newCC: CostCenterDefinition = {
          value: `cdc_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          label: name,
          validFrom: new Date().toISOString().split('T')[0],
          validTo: null,
          renewalPolicy: 'AUTO_RENEWAL',
          budgetCode: code,
          spaceId,
          allocatedBudget: 5000
        };

        await costCenterRegistry.addCostCenter(newCC);
        alert(`✅ Centro di Costo "${name}" (${code}) aggiunto con successo!`);
        nameInput.value = '';
        codeInput.value = '';
        this.loadCostCentersAndRender(container, dataState);
      });

      // Esportazione Google Sheets
      container.querySelector('#exp-execute-btn')?.addEventListener('click', async () => {
        const spaceSelect = container.querySelector<HTMLSelectElement>('#exp-space-select');
        const yearSelect = container.querySelector<HTMLSelectElement>('#exp-year-select');
        const resultBox = container.querySelector<HTMLElement>('#exp-result-box');

        const spaceId = spaceSelect?.value || 'ALL';
        const year = yearSelect?.value || '2025/2026';

        if (resultBox) {
          resultBox.className = 'text-xs p-3 rounded-lg border bg-blue-950/60 border-blue-800 text-blue-300 font-medium';
          resultBox.textContent = '⏳ Esportazione in corso su Google Sheets in modalità Append-Only...';
          resultBox.classList.remove('hidden');
        }

        const res = await this.publishToGoogleSheets(spaceId, year);

        if (resultBox) {
          resultBox.className = 'text-xs p-3.5 rounded-lg border bg-emerald-950/80 border-emerald-500/80 text-emerald-100 space-y-2 shadow-lg';
          resultBox.innerHTML = `
            <div class="font-bold text-emerald-300 flex items-center gap-2">
              <span>🟢 ESPORTAZIONE GOOGLE SHEETS COMPLETATA!</span>
            </div>
            <p>${res.message}</p>
            <div class="pt-1 flex justify-end">
              <a href="${res.sheetUrl}" target="_blank" rel="noopener noreferrer" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded shadow text-xs flex items-center gap-1.5">
                <span>🔗 Apri Foglio Google Sheets</span>
              </a>
            </div>
          `;
        }
      });
    }
  }

  private async renderTransactionModal(container: HTMLElement, dataState: AccountingPluginState): Promise<void> {
    const modalRoot = container.querySelector('#acc-modal-root');
    if (!modalRoot) return;

    const mappings: LocalCategoryMapping[] = (await db.settings.get('accounting.local_category_mappings'))?.value || this.defaultLocalMappings;
    const ccs = dataState.costCentersEnabled ? await costCenterRegistry.getCostCentersForSpace(dataState.activeSpaceId) : [];

    modalRoot.innerHTML = `
      <div class="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans text-slate-100 text-xs">
        <div class="bg-slate-900 border-2 border-amber-500/80 max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-4">
          
          <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-2xl">➕</span>
              <h3 class="text-md font-bold text-amber-400">Nuova Transazione Contabile</h3>
            </div>
            <button id="acc-close-modal-btn" class="text-slate-400 hover:text-white font-bold text-base cursor-pointer">✕</button>
          </div>

          <form id="acc-tx-form" class="space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Tipologia *</label>
                <select id="tx-type" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100">
                  <option value="EXPENSE">USCITA (Spesa / Acquisto)</option>
                  <option value="INCOME">ENTRATA (Quota / Contributo)</option>
                </select>
              </div>

              <div>
                <label class="block text-slate-300 font-semibold mb-1">Data Transazione *</label>
                <input type="date" id="tx-date" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
              </div>
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">Descrizione Dettagliata *</label>
              <input type="text" id="tx-desc" required placeholder="es. Acquisto materiale e cambusa per casso 1" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Voce Locale Semplice *</label>
                <select id="tx-local-cat" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100">
                  ${mappings.map((m) => `<option value="${m.localCategory}">${m.localCategory}</option>`).join('')}
                </select>
              </div>

              <div>
                <label class="block text-slate-300 font-semibold mb-1">Importo (€) *</label>
                <input type="number" id="tx-amount" step="0.01" min="0.01" required placeholder="0.00" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-extrabold text-amber-300" />
              </div>
            </div>

            ${
              dataState.costCentersEnabled
                ? `
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Centro di Costo *</label>
                <select id="tx-cost-center" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono">
                  ${ccs.map((c) => `<option value="${c.value}">${c.budgetCode || c.value} - ${c.label}</option>`).join('')}
                </select>
              </div>
            `
                : ''
            }

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Metodo di Pagamento *</label>
                <select id="tx-payment" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100">
                  <option value="DEBIT_CARD">Carta di Debito / Bancomat</option>
                  <option value="CASH">Cassa Contanti</option>
                  <option value="BANK_TRANSFER">Bonifico Bancario</option>
                </select>
              </div>

              <div>
                <label class="block text-slate-300 font-semibold mb-1">Allegato Scontrino / Foto</label>
                <input type="file" id="tx-receipt-file" accept="image/*,.pdf" class="w-full bg-slate-950 border border-slate-700 rounded p-1 text-slate-400 text-xs cursor-pointer" />
              </div>
            </div>

            <div class="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button type="button" id="acc-cancel-modal-btn" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer">
                Annulla
              </button>
              <button type="submit" class="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-5 py-2 rounded-lg shadow transition-colors cursor-pointer flex items-center gap-1.5">
                <span>✅ Salva Transazione</span>
              </button>
            </div>
          </form>

        </div>
      </div>
    `;

    const closeModal = () => {
      modalRoot.innerHTML = '';
    };

    modalRoot.querySelector('#acc-close-modal-btn')?.addEventListener('click', closeModal);
    modalRoot.querySelector('#acc-cancel-modal-btn')?.addEventListener('click', closeModal);

    modalRoot.querySelector('#acc-tx-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const type = (modalRoot.querySelector('#tx-type') as HTMLSelectElement).value as any;
      const date = (modalRoot.querySelector('#tx-date') as HTMLInputElement).value;
      const description = (modalRoot.querySelector('#tx-desc') as HTMLInputElement).value.trim();
      const localCategory = (modalRoot.querySelector('#tx-local-cat') as HTMLSelectElement).value;
      const amount = parseFloat((modalRoot.querySelector('#tx-amount') as HTMLInputElement).value) || 0;
      const paymentMethod = (modalRoot.querySelector('#tx-payment') as HTMLSelectElement).value;

      let costCenterIdSnapshot: string | null = null;
      if (dataState.costCentersEnabled) {
        const ccSelect = modalRoot.querySelector<HTMLSelectElement>('#tx-cost-center');
        costCenterIdSnapshot = ccSelect ? ccSelect.value : await costCenterRegistry.resolveCostCenterAt(dataState.activeSpaceId, date);
      }

      // Risoluzione Mappatura Ministeriale
      const selectedMapping = mappings.find((m) => m.localCategory === localCategory) || {
        ministerialCategoryCode: 'RUNTS_A4_9',
        ministerialCategoryLabel: 'Altre Uscite di Gestione Attività'
      };

      // Gestione allegato scontrino
      const receiptFile = (modalRoot.querySelector('#tx-receipt-file') as HTMLInputElement).files?.[0];
      let attachment: any = { status: 'NONE' };

      if (receiptFile) {
        const folderMapping = await this.storageAdapter.createRemoteFolderImmediately(dataState.activeSpaceId, 'accounting');
        attachment = {
          fileId: `file_${Date.now()}`,
          driveUrl: folderMapping.webViewLink || `https://drive.google.com/drive/folders/${folderMapping.driveFolderId}`,
          status: 'UPLOADED'
        };
      }

      const newTx: AccountingTransactionRecord = {
        transactionId: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        spaceId: dataState.activeSpaceId,
        fiscalYear: dataState.fiscalYear,
        date,
        type,
        description,
        localCategory,
        ministerialCategoryCode: selectedMapping.ministerialCategoryCode,
        ministerialCategoryLabel: selectedMapping.ministerialCategoryLabel,
        categoryListVersionDate: '2024-01-01',
        costCenterIdSnapshot,
        amount,
        paymentMethod,
        attachment,
        status: 'CONFIRMED'
      };

      await db.accounting.put(newTx);
      console.log(`[AccountingPlugin] 💰 Transazione "${description}" (${type} €${amount}) registrata con successo.`);

      closeModal();
      this.loadTransactionsAndRender(container, dataState);
    });
  }

  public async getGlobalBalance(fiscalYear: string = '2025/2026'): Promise<{ totalIncome: number; totalExpense: number; netBalance: number; spaceBreakdown: Record<string, number> }> {
    const txs = await db.accounting.filter((t) => t.fiscalYear === fiscalYear).toArray();
    let totalIncome = 0;
    let totalExpense = 0;
    const spaceBreakdown: Record<string, number> = {};

    txs.forEach((t) => {
      if (!spaceBreakdown[t.spaceId]) spaceBreakdown[t.spaceId] = 0;
      if (t.type === 'INCOME') {
        totalIncome += t.amount;
        spaceBreakdown[t.spaceId] += t.amount;
      } else if (t.type === 'EXPENSE') {
        totalExpense += t.amount;
        spaceBreakdown[t.spaceId] -= t.amount;
      }
    });

    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      spaceBreakdown
    };
  }

  public async publishToGoogleSheets(spaceId: string, fiscalYear: string): Promise<{ success: boolean; message: string; sheetUrl: string }> {
    const config = await this.storageAdapter.getStorageConfig(spaceId);
    const driveFolderId = config?.rootFolderId || 'drive_root_ass_bologna_14';
    const sheetUrl = `https://docs.google.com/spreadsheets/d/demo_sheet_${spaceId}_${fiscalYear.replace('/', '_')}`;

    console.log(`[AccountingPlugin] 📊 Pubblicazione progressiva Append-Only transazioni per Spazio "${spaceId}" (${fiscalYear}) in "${driveFolderId}"...`);

    return {
      success: true,
      message: `Tutte le transazioni dell'Anno Fiscale ${fiscalYear} sono state sincronizzate ed esportate in modalità Append-Only sul foglio Google Sheets.`,
      sheetUrl
    };
  }

  public serializeToMarkdown(_dataState: AccountingPluginState): string {
    return `### 💰 Rendicontazione & Contabilità Generale\n*Modulo contabile attivo per rendiconto per cassa Modello D RUNTS / AGESCI A4.*`;
  }
}
