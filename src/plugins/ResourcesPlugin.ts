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
 * NOME FILE: src/plugins/ResourcesPlugin.ts
 * ============================================================================
 * DESCRIZIONE:
 * Controller del Plugin "Hub Risorse & Conoscenza" (v2.0):
 * - Hub centrale, contenitore multimodale e permanente per il patrimonio dell'ente
 * - Partizionamento Y.Doc: PartitionGranularity = 'PER_SPACE' (`resources_{spaceId}`)
 * - Indicizzazione offline-first ad alte prestazioni su Dexie.js (tabella `resources`)
 * - Commutatore di vista istantaneo tra "Schede" (Grid reattiva) e "Lista" (Tabella)
 * - Header schede con cover background e dark gradient overlay per leggibilità
 * - Badge sintetici con priorità governata dalle regole di configurazione dello Spazio
 * - Inserimento diretto guidato con live preview della card
 * - Navigazione verso le Impostazioni di Governance Risorse
 * ============================================================================
 */

import { AppPlugin } from './AppPlugin.js';
import { EventBus } from '../base/EventBus.js';
import { I18nManager } from '../base/I18nManager.js';
import { db } from '../base/Database.js';
import {
  ResourceItem,
  ResourceViewMode,
  ResourcesSpaceConfig
} from './ResourcesPlugin/types.js';
import { resourceConfigRegistry } from './ResourcesPlugin/ResourceConfigRegistry.js';
import { resourceDataExtractor } from './ResourcesPlugin/ResourceDataExtractor.js';
import { ResourceCardView } from './ResourcesPlugin/components/ResourceCardView.js';
import { ResourceListView } from './ResourcesPlugin/components/ResourceListView.js';
import { ResourceModal } from './ResourcesPlugin/ResourceModal.js';

export interface ResourcesPluginState {
  pluginId: string;
  activeSpaceId?: string;
  viewMode?: ResourceViewMode;
  selectedCategory?: string;
  searchQuery?: string;
}

export class ResourcesPlugin implements AppPlugin {
  public id = 'resources-tool';
  public name = 'Hub Risorse & Conoscenza';
  public isCollaborative = true;

  // Dichiarazione Partizionamento Y.Doc conforme alle linee guida
  public static readonly PartitionGranularity = 'PER_SPACE';

  private eventBus: EventBus | null = null;
  private activeSpaceId: string = 'space-default';
  private currentContainer: HTMLElement | null = null;
  private currentConfig: ResourcesSpaceConfig | null = null;
  private currentViewMode: ResourceViewMode = 'CARDS';
  private currentCategoryFilter: string = 'ALL';
  private currentSearchQuery: string = '';
  private resources: ResourceItem[] = [];

  public locales = {
    it: {
      title: 'Hub Risorse & Conoscenza',
      subtitle: 'Contenitore Multimodale, Schede Visive e Governance della Conoscenza',
      newResourceBtn: '➕ Nuova Risorsa',
      settingsBtn: '⚙️ Configura Risorse'
    },
    en: {
      title: 'Resource & Knowledge Hub',
      subtitle: 'Multimodal Container, Visual Cards & Knowledge Governance',
      newResourceBtn: '➕ New Resource',
      settingsBtn: '⚙️ Resource Settings'
    }
  };

  public async init(eventBus: EventBus, _i18n: I18nManager): Promise<void> {
    this.eventBus = eventBus;

    // Attiva i listener sull'EventBus per intercettare entità pubblicate dagli altri moduli
    resourceDataExtractor.initListeners();

    // Recupera l'ultimo Spazio attivo salvato
    try {
      const savedSpace = await db.settings.get('core.active_space_id');
      if (savedSpace && savedSpace.value) {
        this.activeSpaceId = savedSpace.value;
      }
    } catch (e) {
      console.warn('[ResourcesPlugin] Errore lettura spazio attivo salvato:', e);
    }

    // Ascolto cambio Spazio
    this.eventBus.on('space:changed', async (payload: any) => {
      if (payload && payload.spaceId) {
        this.activeSpaceId = payload.spaceId;
        await this.reloadResources();
        if (this.currentContainer) {
          this.renderUI(this.currentContainer);
        }
      }
    });

    // Ascolto salvataggio ed eliminazione risorsa
    this.eventBus.on('resource:saved', async (payload: any) => {
      if (payload && payload.spaceId === this.activeSpaceId) {
        await this.reloadResources();
        if (this.currentContainer) {
          this.renderUI(this.currentContainer);
        }
      }
    });

    this.eventBus.on('resource:deleted', async (payload: any) => {
      if (payload && payload.spaceId === this.activeSpaceId) {
        await this.reloadResources();
        if (this.currentContainer) {
          this.renderUI(this.currentContainer);
        }
      }
    });

    console.log('[ResourcesPlugin] 📚 Plugin Hub Risorse v2.0 inizializzato.');
  }

  public async render(container: HTMLElement, dataState: ResourcesPluginState, _locale: string): Promise<void> {
    this.currentContainer = container;

    if (dataState && dataState.activeSpaceId) {
      this.activeSpaceId = dataState.activeSpaceId;
    }

    await this.reloadResources();

    if (dataState && dataState.viewMode) {
      this.currentViewMode = dataState.viewMode;
    } else if (this.currentConfig) {
      this.currentViewMode = this.currentConfig.defaultView || 'CARDS';
    }

    if (dataState && dataState.selectedCategory) {
      this.currentCategoryFilter = dataState.selectedCategory;
    }

    if (dataState && dataState.searchQuery) {
      this.currentSearchQuery = dataState.searchQuery;
    }

    this.renderUI(container);
  }

  public serializeToMarkdown(_dataState: any): string {
    const lines: string[] = [];
    lines.push(`## 📚 HUB RISORSE & CONOSCENZA - SPAZIO: ${this.activeSpaceId}\n`);
    lines.push(`Totale risorse archiviate: ${this.resources.length}\n`);

    if (this.resources.length === 0) {
      lines.push('*Nessuna risorsa registrata per questo spazio.*');
    } else {
      this.resources.forEach((res, idx) => {
        lines.push(`### ${idx + 1}. [${res.category}] ${res.title}`);
        lines.push(`- **Sorgente:** \`${res.sourcePluginId}\` | **Aggiornato:** ${res.updatedAt}`);
        lines.push(`- **Tag:** ${res.tags.map((t) => `#${t}`).join(' ')}`);
        if (res.descriptionMarkdown) {
          lines.push(`- **Descrizione:** ${res.descriptionMarkdown.substring(0, 150)}...`);
        }
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  private async reloadResources(): Promise<void> {
    this.currentConfig = await resourceConfigRegistry.getSpaceConfig(this.activeSpaceId);
    this.resources = await resourceDataExtractor.queryResources(this.activeSpaceId, {
      category: this.currentCategoryFilter,
      query: this.currentSearchQuery
    });
  }

  private renderUI(container: HTMLElement): void {
    const categories = resourceConfigRegistry.getAllCategories();
    const config = this.currentConfig || {
      defaultView: 'CARDS',
      categoryPriority: {},
      sourceMappings: []
    };

    container.innerHTML = `
      <div class="resources-plugin-root bg-slate-900 text-slate-100 rounded-2xl p-5 shadow-2xl border border-slate-800 space-y-5 font-sans text-xs">
        
        <!-- HEADER PRINCIPALE DELL'HUB RISORSE -->
        <div class="border-b border-slate-800 pb-4 flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-3">
            <span class="text-3xl">📚</span>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-blue-400">Hub Risorse & Conoscenza</h2>
                <span class="text-[10px] bg-blue-950 text-blue-300 border border-blue-900 px-2 py-0.5 rounded font-mono font-bold">
                  v2.0
                </span>
              </div>
              <p class="text-[11px] text-slate-400 mt-0.5">
                Contenitore Multimodale, Schede Visive e Governance delle Risorse dello Spazio
              </p>
            </div>
          </div>

          <!-- Pulsanti Azione Principali & Selettore Spazio -->
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[11px] bg-slate-950 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-lg font-mono">
              Spazio: <strong class="text-blue-400 font-bold">${this.activeSpaceId}</strong>
            </span>

            <button id="btn-open-resources-settings" class="bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition-all shadow cursor-pointer flex items-center gap-1.5" title="Configura visualizzazioni, mappature e priorità schede">
              <span>⚙️</span>
              <span>Impostazioni Risorse</span>
            </button>

            <button id="btn-create-resource" class="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-lg cursor-pointer flex items-center gap-2">
              <span>➕</span>
              <span>Nuova Risorsa</span>
            </button>
          </div>
        </div>

        <!-- BARRA CONTROLLI: FILTRI CATEGORIA, RICERCA E SWITCH LISTA/SCHEDE -->
        <div class="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between flex-wrap gap-3 shadow-inner">
          
          <!-- Filtro Categoria e Ricerca Testuale -->
          <div class="flex items-center gap-3 flex-wrap flex-1 min-w-[280px]">
            <div class="flex items-center gap-1.5">
              <span class="text-slate-400 font-semibold text-[11px]">Categoria:</span>
              <select id="select-category-filter" class="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-semibold focus:border-blue-500 focus:outline-none cursor-pointer">
                <option value="ALL" ${this.currentCategoryFilter === 'ALL' ? 'selected' : ''}>🌟 Tutte le Categorie (${this.resources.length})</option>
                ${categories
                  .map(
                    (cat) => `
                  <option value="${cat.id}" ${cat.id === this.currentCategoryFilter ? 'selected' : ''}>
                    ${cat.icon} ${cat.label}
                  </option>
                `
                  )
                  .join('')}
              </select>
            </div>

            <!-- Ricerca Testuale Libera -->
            <div class="relative flex-1 min-w-[200px] max-w-md">
              <input 
                type="text" 
                id="input-resource-search" 
                value="${this.escapeHtml(this.currentSearchQuery)}" 
                placeholder="Cerca per titolo, tag o parola chiave..." 
                class="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
              />
              <span class="absolute left-2.5 top-2 text-slate-500 pointer-events-none text-xs">🔍</span>
              ${
                this.currentSearchQuery
                  ? `
                <button id="btn-clear-search" class="absolute right-2.5 top-1.5 text-slate-400 hover:text-white text-xs cursor-pointer">
                  ✕
                </button>
              `
                  : ''
              }
            </div>
          </div>

          <!-- COMMUTATORE VISTA (LISTA | SCHEDE) -->
          <div class="flex items-center gap-1 bg-slate-900 border border-slate-700 p-1 rounded-xl shrink-0">
            <button id="btn-view-cards" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              this.currentViewMode === 'CARDS'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }" title="Visualizzazione Schede Visive con Copertina e Badge">
              <span>📇</span>
              <span>Schede</span>
            </button>
            <button id="btn-view-list" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              this.currentViewMode === 'LIST'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }" title="Visualizzazione Tabella ad Alta Densità">
              <span>📊</span>
              <span>Lista</span>
            </button>
          </div>

        </div>

        <!-- CONTAINER DEI CONTENUTI (RENDERIZZATO TRAMITE RESOURCECARDVIEW O RESOURCELISTVIEW) -->
        <div id="resources-content-mount" class="min-h-[400px]">
        </div>

      </div>
    `;

    this.renderCurrentView(container, config);
    this.bindEvents(container);
  }

  private renderCurrentView(container: HTMLElement, config: ResourcesSpaceConfig): void {
    const mount = container.querySelector<HTMLElement>('#resources-content-mount');
    if (!mount) return;

    const options = {
      onView: (resource: ResourceItem) => {
        this.openResourceModal(resource);
      },
      onDelete: async (resourceId: string) => {
        if (confirm('Sei sicuro di voler eliminare questa risorsa dall\'Hub?')) {
          await resourceDataExtractor.deleteResource(resourceId);
          await this.reloadResources();
          this.renderUI(container);
        }
      }
    };

    if (this.currentViewMode === 'CARDS') {
      ResourceCardView.render(mount, this.resources, config, options);
    } else {
      ResourceListView.render(mount, this.resources, config, options);
    }
  }

  private bindEvents(container: HTMLElement): void {
    // 1. Bottone Nuova Risorsa
    container.querySelector('#btn-create-resource')?.addEventListener('click', () => {
      this.openResourceModal(null);
    });

    // 2. Bottone Impostazioni Risorse (naviga a PermissionsPlugin tab resources-settings)
    container.querySelector('#btn-open-resources-settings')?.addEventListener('click', () => {
      if (this.eventBus) {
        this.eventBus.emit('plugin:launch', {
          pluginId: 'permissions-tool',
          activeSettingsTab: 'resources-settings'
        });
      }
    });

    // 3. Filtro Categoria
    const catSelect = container.querySelector<HTMLSelectElement>('#select-category-filter');
    catSelect?.addEventListener('change', async () => {
      this.currentCategoryFilter = catSelect.value;
      await this.reloadResources();
      this.renderUI(container);
    });

    // 4. Input Ricerca
    const searchInput = container.querySelector<HTMLInputElement>('#input-resource-search');
    let searchTimeout: any = null;
    searchInput?.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        this.currentSearchQuery = searchInput.value.trim();
        await this.reloadResources();
        if (this.currentConfig) {
          this.renderCurrentView(container, this.currentConfig);
        }
      }, 250);
    });

    container.querySelector('#btn-clear-search')?.addEventListener('click', async () => {
      this.currentSearchQuery = '';
      await this.reloadResources();
      this.renderUI(container);
    });

    // 5. Switch vista Schede / Lista
    container.querySelector('#btn-view-cards')?.addEventListener('click', () => {
      if (this.currentViewMode !== 'CARDS') {
        this.currentViewMode = 'CARDS';
        this.renderUI(container);
      }
    });

    container.querySelector('#btn-view-list')?.addEventListener('click', () => {
      if (this.currentViewMode !== 'LIST') {
        this.currentViewMode = 'LIST';
        this.renderUI(container);
      }
    });
  }

  private openResourceModal(resource: ResourceItem | null): void {
    const config = this.currentConfig || {
      defaultView: 'CARDS',
      categoryPriority: {},
      sourceMappings: []
    };

    const modal = new ResourceModal({
      spaceId: this.activeSpaceId,
      config,
      resource,
      onSaved: async () => {
        await this.reloadResources();
        if (this.currentContainer) {
          this.renderUI(this.currentContainer);
        }
      }
    });

    modal.open();
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
