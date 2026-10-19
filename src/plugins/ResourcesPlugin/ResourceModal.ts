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
 * NOME FILE: src/plugins/ResourcesPlugin/ResourceModal.ts
 * ============================================================================
 * DESCRIZIONE:
 * Modale unificata per Creazione Diretta, Consultazione e Modifica di Risorse (v2.0):
 * - Selezione della Categoria Master con aggiornamento dinamico dei campi metadati
 * - Inserimento metadati specifici guidati (Durata, Capienza, Dosi, Tonalità, ecc.)
 * - Gestione Immagine di Copertina (Cover Image URL con Live Preview)
 * - Gestione Allegati (File PDF, Audio, GPX, Documentazione su Google Drive)
 * - Tagging e Descrizione Markdown
 * - Live Card Preview interattiva in tempo reale durante la digitazione
 * - Supporto Sola Lettura con azione "Duplica / Fork" per risorse protette da verbali
 * ============================================================================
 */

import { ResourceItem, ResourceCategory, ResourceAttachment, ResourcesSpaceConfig } from './types.js';
import { resourceConfigRegistry } from './ResourceConfigRegistry.js';
import { resourceDataExtractor } from './ResourceDataExtractor.js';

export interface ResourceModalOptions {
  spaceId: string;
  config: ResourcesSpaceConfig;
  resource?: ResourceItem | null;
  onSaved: (savedItem: ResourceItem) => void;
}

export class ResourceModal {
  private options: ResourceModalOptions;
  private modalContainer: HTMLElement | null = null;
  private currentItem: ResourceItem;
  private isEditMode: boolean = false;
  private isReadOnly: boolean = false;

  constructor(options: ResourceModalOptions) {
    this.options = options;
    this.isEditMode = !!options.resource;
    this.isReadOnly = !!options.resource?.isReadOnly;

    if (options.resource) {
      this.currentItem = JSON.parse(JSON.stringify(options.resource));
    } else {
      this.currentItem = {
        resourceId: `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        spaceId: options.spaceId,
        title: '',
        category: 'GAMES',
        descriptionMarkdown: '',
        coverImageUrl: null,
        sourcePluginId: 'direct',
        sourceEntityId: null,
        extractedMetadata: {},
        attachments: [],
        tags: [],
        updatedAt: new Date().toISOString(),
        createdBy: 'operatore@associazione.org',
        isReadOnly: false
      };
    }
  }

  public open(): void {
    this.close();

    this.modalContainer = document.createElement('div');
    this.modalContainer.className =
      'fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto font-sans text-xs';
    this.render();
    document.body.appendChild(this.modalContainer);
  }

  public close(): void {
    if (this.modalContainer && this.modalContainer.parentNode) {
      this.modalContainer.parentNode.removeChild(this.modalContainer);
      this.modalContainer = null;
    }
  }

  private render(): void {
    if (!this.modalContainer) return;

    const categories = resourceConfigRegistry.getAllCategories();
    const currentCatDef = resourceConfigRegistry.getCategory(this.currentItem.category);

    this.modalContainer.innerHTML = `
      <div class="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        <!-- HEADER MODALE -->
        <div class="p-4 sm:px-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <span class="text-2xl">${this.isEditMode ? '📝' : '➕'}</span>
            <div>
              <h2 class="text-sm sm:text-base font-bold text-blue-400">
                ${this.isEditMode ? (this.isReadOnly ? 'Consultazione Risorsa Protetta' : 'Modifica Risorsa') : 'Nuova Risorsa nell\'Hub'}
              </h2>
              <p class="text-[11px] text-slate-400">
                Spazio: <strong class="text-slate-200 font-mono">${this.currentItem.spaceId}</strong>
                ${this.isReadOnly ? ' • <span class="text-amber-400 font-semibold">🔒 Contenuto in sola lettura</span>' : ''}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            ${
              this.isReadOnly
                ? `
              <button id="btn-fork-resource" class="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow transition-colors flex items-center gap-1.5 cursor-pointer">
                <span>🔱</span>
                <span>Duplica per Modificare (Fork)</span>
              </button>
            `
                : ''
            }
            <button id="btn-close-modal" class="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors text-base cursor-pointer">
              ✕
            </button>
          </div>
        </div>

        <!-- CORPO MODALE (SCROLLABILE) DIVISO IN 2 COLONNE: FORM & LIVE PREVIEW -->
        <div class="p-4 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <!-- COLONNA SINISTRA: FORM INSERIMENTO (8 COLONNE) -->
          <div class="lg:col-span-7 space-y-4">
            
            ${
              this.isReadOnly
                ? `
              <div class="bg-amber-950/40 border border-amber-800/80 rounded-xl p-3 text-amber-200 text-[11px] space-y-1">
                <div class="font-bold flex items-center gap-1.5">
                  <span>ℹ️ Risorsa Indicizzata da Modulo Ufficiale (${this.currentItem.sourcePluginId})</span>
                </div>
                <p class="text-amber-300/80">
                  Questa risorsa è congelata per conformità statutaria. Clicca su <strong>"Duplica per Modificare"</strong> se desideri apportare modifiche indipendenti.
                </p>
              </div>
            `
                : ''
            }

            <!-- 1. CATEGORIA -->
            <div>
              <label class="block text-slate-300 font-bold mb-1 text-xs">Categoria Risorsa *</label>
              <select id="input-category" ${this.isReadOnly ? 'disabled' : ''} class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-semibold focus:border-blue-500 focus:outline-none transition-colors cursor-pointer">
                ${categories
                  .map(
                    (cat) => `
                  <option value="${cat.id}" ${cat.id === this.currentItem.category ? 'selected' : ''}>
                    ${cat.icon} ${cat.label}
                  </option>
                `
                  )
                  .join('')}
              </select>
              <p class="text-[10px] text-slate-400 mt-1" id="category-description">
                ${currentCatDef?.description || ''}
              </p>
            </div>

            <!-- 2. TITOLO -->
            <div>
              <label class="block text-slate-300 font-bold mb-1 text-xs">Titolo Risorsa *</label>
              <input type="text" id="input-title" ${this.isReadOnly ? 'readonly' : ''} value="${this.escapeHtml(this.currentItem.title)}" placeholder="es. Il Grande Gioco della Giungla" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-blue-500 focus:outline-none transition-colors" />
            </div>

            <!-- 3. COVER IMAGE URL -->
            <div>
              <label class="block text-slate-300 font-bold mb-1 text-xs">URL Immagine di Copertina (Header Scheda)</label>
              <div class="flex gap-2">
                <input type="url" id="input-cover" ${this.isReadOnly ? 'readonly' : ''} value="${this.escapeHtml(this.currentItem.coverImageUrl || '')}" placeholder="https://images.unsplash.com/... o Google Drive WebLink" class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-blue-500 focus:outline-none transition-colors" />
                <button type="button" id="btn-clear-cover" ${this.isReadOnly ? 'disabled' : ''} class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer">
                  Rimuovi
                </button>
              </div>
              <p class="text-[10px] text-slate-400 mt-1">
                L'immagine verrà posizionata come sfondo dell'header con overlay scuro protettivo.
              </p>
            </div>

            <!-- 4. METADATI DINAMICI PER CATEGORIA -->
            <div class="border border-slate-800 bg-slate-950/60 rounded-xl p-4 space-y-3">
              <div class="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 class="font-bold text-blue-400 text-xs flex items-center gap-1.5">
                  <span>⚙️</span>
                  <span>Parametri & Metadati Specifici (${currentCatDef?.label || ''})</span>
                </h4>
                <span class="text-[10px] text-slate-500">Campi prioritari su scheda</span>
              </div>

              <div id="dynamic-metadata-fields" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                ${this.renderDynamicMetadataFields()}
              </div>
            </div>

            <!-- 5. DESCRIZIONE / CONTENUTO MARKDOWN -->
            <div>
              <label class="block text-slate-300 font-bold mb-1 text-xs">Descrizione & Istruzioni *</label>
              <textarea id="input-description" ${this.isReadOnly ? 'readonly' : ''} rows="4" placeholder="Descrivi in dettaglio la risorsa, regole, istruzioni o indicazioni operative..." class="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-100 text-xs focus:border-blue-500 focus:outline-none leading-relaxed transition-colors">${this.escapeHtml(this.currentItem.descriptionMarkdown)}</textarea>
            </div>

            <!-- 6. TAGS -->
            <div>
              <label class="block text-slate-300 font-bold mb-1 text-xs">Tag di Ricerca (separati da virgola)</label>
              <input type="text" id="input-tags" ${this.isReadOnly ? 'readonly' : ''} value="${this.escapeHtml((this.currentItem.tags || []).join(', '))}" placeholder="es. gioco, bosco, lupetti, pionieristica" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-blue-500 focus:outline-none transition-colors" />
            </div>

            <!-- 7. ALLEGATI (PDF, SPARTITI, GPX, DRIVE) -->
            <div class="border border-slate-800 bg-slate-950/60 rounded-xl p-4 space-y-3">
              <div class="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 class="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                  <span>📎</span>
                  <span>File & Allegati Collegati (${this.currentItem.attachments?.length || 0})</span>
                </h4>
              </div>

              <div id="attachments-list" class="space-y-2">
                ${this.renderAttachmentsList()}
              </div>

              ${
                !this.isReadOnly
                  ? `
                <div class="pt-2 flex gap-2">
                  <input type="text" id="input-att-name" placeholder="Nome allegato (es. Scheda.pdf)" class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none" />
                  <input type="url" id="input-att-url" placeholder="https://drive.google.com/..." class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none" />
                  <button type="button" id="btn-add-attachment" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors">
                    ➕ Aggiungi
                  </button>
                </div>
              `
                  : ''
              }
            </div>

          </div>

          <!-- COLONNA DESTRA: LIVE CARD PREVIEW (5 COLONNE) -->
          <div class="lg:col-span-5 space-y-3 flex flex-col">
            <div class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>📇 Anteprima Scheda Live</span>
              <span class="text-[10px] text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-900 font-mono">Realtime</span>
            </div>

            <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sticky top-0">
              <p class="text-[11px] text-slate-500 mb-3">
                Ecco come la scheda apparirà nella visuale principale dell'Hub Risorse con la gerarchia visiva impostata:
              </p>

              <!-- CONTENITORE PREVIEW CARD -->
              <div id="modal-card-preview-container">
                ${this.renderPreviewCardHtml()}
              </div>
            </div>
          </div>

        </div>

        <!-- FOOTER MODALE -->
        <div class="p-4 sm:px-6 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div class="text-[11px] text-slate-400 font-mono">
            ID: <span class="text-slate-300">${this.currentItem.resourceId}</span>
          </div>

          <div class="flex items-center gap-2">
            <button type="button" id="btn-cancel-modal" class="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer">
              Annulla
            </button>
            ${
              !this.isReadOnly
                ? `
              <button type="button" id="btn-save-modal" class="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-lg transition-colors flex items-center gap-2 cursor-pointer">
                <span>💾</span>
                <span>Salva Risorsa</span>
              </button>
            `
                : ''
            }
          </div>
        </div>

      </div>
    `;

    this.bindEvents();
  }

  private renderDynamicMetadataFields(): string {
    const catDef = resourceConfigRegistry.getCategory(this.currentItem.category);
    if (!catDef || catDef.availableFields.length === 0) {
      return '<div class="col-span-2 text-slate-500 italic text-[11px]">Nessun campo metadato aggiuntivo.</div>';
    }

    return catDef.availableFields
      .map((f) => {
        const val = this.currentItem.extractedMetadata[f.key] ?? '';
        return `
          <div>
            <label class="block text-slate-300 font-semibold mb-1 text-[11px] flex items-center gap-1.5">
              <span>${f.icon}</span>
              <span>${f.label}</span>
            </label>
            <input 
              type="text" 
              data-meta-key="${f.key}" 
              ${this.isReadOnly ? 'readonly' : ''} 
              value="${this.escapeHtml(String(val))}" 
              placeholder="${f.placeholder || ''}" 
              class="dynamic-meta-input w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none transition-colors" 
            />
          </div>
        `;
      })
      .join('');
  }

  private renderAttachmentsList(): string {
    if (!this.currentItem.attachments || this.currentItem.attachments.length === 0) {
      return '<div class="text-slate-500 italic text-[11px]">Nessun allegato collegato.</div>';
    }

    return this.currentItem.attachments
      .map(
        (att, idx) => `
        <div class="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs">
          <div class="flex items-center gap-2 truncate">
            <span class="text-base">${att.fileType === 'PDF' ? '📄' : att.fileType === 'IMAGE' ? '🖼️' : '📎'}</span>
            <span class="text-slate-200 font-medium truncate">${this.escapeHtml(att.fileName)}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <a href="${att.driveUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline text-[11px] font-semibold">
              Apri ↗
            </a>
            ${
              !this.isReadOnly
                ? `
              <button type="button" data-del-att-idx="${idx}" class="btn-del-att text-slate-400 hover:text-red-400 p-1 cursor-pointer">
                ✕
              </button>
            `
                : ''
            }
          </div>
        </div>
      `
      )
      .join('');
  }

  private renderPreviewCardHtml(): string {
    const catDef = resourceConfigRegistry.getCategory(this.currentItem.category);
    const catLabel = catDef?.label || this.currentItem.category;
    const catIcon = catDef?.icon || '📌';

    let headerStyle = '';
    if (this.currentItem.coverImageUrl && this.currentItem.coverImageUrl.trim()) {
      headerStyle = `
        background-image: linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.95) 100%), url('${this.currentItem.coverImageUrl}');
        background-size: cover;
        background-position: center;
      `;
    } else {
      headerStyle = `background: ${catDef?.gradientStyle || 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)'};`;
    }

    const priorityFieldKeys =
      this.options.config.categoryPriority[this.currentItem.category] ||
      catDef?.defaultPriorityFields ||
      Object.keys(this.currentItem.extractedMetadata).slice(0, 4);

    const badgesHtml = priorityFieldKeys
      .map((key) => {
        const val = this.currentItem.extractedMetadata[key];
        if (val === undefined || val === null || val === '') return '';
        const fieldDef = catDef?.availableFields.find((f) => f.key === key);
        const icon = fieldDef?.icon || '🔹';
        const label = fieldDef?.label || key;
        const displayVal = Array.isArray(val) ? val.join(', ') : String(val);

        return `
          <div class="flex items-start gap-1.5 bg-slate-950/70 border border-slate-800/80 px-2 py-1 rounded-lg text-[10px] leading-tight">
            <span class="text-xs shrink-0">${icon}</span>
            <div class="truncate">
              <span class="text-slate-400 font-medium block text-[9px] leading-none mb-0.5">${this.escapeHtml(label)}</span>
              <span class="text-slate-200 font-semibold truncate block">${this.escapeHtml(displayVal)}</span>
            </div>
          </div>
        `;
      })
      .filter(Boolean)
      .join('');

    const shortTitle = this.currentItem.title.trim() ? this.currentItem.title : 'Nuova Risorsa Senza Titolo';
    const shortDesc = this.currentItem.descriptionMarkdown.trim()
      ? this.currentItem.descriptionMarkdown.length > 90
        ? this.currentItem.descriptionMarkdown.substring(0, 90) + '...'
        : this.currentItem.descriptionMarkdown
      : 'Nessuna descrizione inserita.';

    return `
      <div class="bg-slate-900 rounded-2xl border border-slate-700/80 overflow-hidden shadow-xl flex flex-col justify-between">
        
        <!-- HEADER PREVIEW CON SFONDO -->
        <div class="p-3.5 flex flex-col justify-between relative min-h-[110px]" style="${headerStyle}">
          <div class="flex items-center justify-between gap-2 z-10">
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-950/80 backdrop-blur-sm border border-slate-700 text-white shadow-sm">
              <span>${catIcon}</span>
              <span>${this.escapeHtml(catLabel)}</span>
            </span>

            <span class="text-[9px] bg-blue-950/80 border border-blue-800 text-blue-300 px-1.5 py-0.5 rounded font-mono">
              ${this.escapeHtml(this.currentItem.sourcePluginId)}
            </span>
          </div>

          <div class="mt-3 z-10">
            <h3 class="text-xs font-bold text-white tracking-wide drop-shadow-md line-clamp-2 leading-snug">
              ${this.escapeHtml(shortTitle)}
            </h3>
          </div>
        </div>

        <!-- CORPO PREVIEW -->
        <div class="p-3 space-y-2.5">
          ${badgesHtml ? `<div class="grid grid-cols-2 gap-1.5">${badgesHtml}</div>` : ''}

          <p class="text-[10px] text-slate-400 leading-relaxed line-clamp-2">
            ${this.escapeHtml(shortDesc)}
          </p>

          <div class="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
            <span>Tags: ${(this.currentItem.tags || []).slice(0, 3).map((t) => `#${t}`).join(' ') || 'nessuno'}</span>
            <span>📎 ${this.currentItem.attachments?.length || 0}</span>
          </div>
        </div>

        <!-- FOOTER PREVIEW -->
        <div class="p-2.5 bg-slate-950 border-t border-slate-800 rounded-b-2xl flex items-center justify-between">
          <span class="text-[10px] text-slate-400">Hub Risorse v2.0</span>
          <span class="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold">👁️ Dettagli</span>
        </div>

      </div>
    `;
  }

  private updatePreview(): void {
    const previewContainer = this.modalContainer?.querySelector('#modal-card-preview-container');
    if (previewContainer) {
      previewContainer.innerHTML = this.renderPreviewCardHtml();
    }
  }

  private bindEvents(): void {
    if (!this.modalContainer) return;

    // Chiudi modale
    this.modalContainer.querySelector('#btn-close-modal')?.addEventListener('click', () => this.close());
    this.modalContainer.querySelector('#btn-cancel-modal')?.addEventListener('click', () => this.close());

    // Duplica / Fork risorsa protetta
    this.modalContainer.querySelector('#btn-fork-resource')?.addEventListener('click', () => {
      this.currentItem.resourceId = `res_${Date.now()}_fork`;
      this.currentItem.title = `Copia di ${this.currentItem.title}`;
      this.currentItem.isReadOnly = false;
      this.currentItem.sourcePluginId = 'direct';
      this.currentItem.sourceEntityId = null;
      this.isReadOnly = false;
      this.isEditMode = false;
      this.render();
    });

    // Cambio Categoria: ri-renderizza i metadati dinamici
    this.modalContainer.querySelector('#input-category')?.addEventListener('change', (e) => {
      const newCat = (e.target as HTMLSelectElement).value as ResourceCategory;
      this.currentItem.category = newCat;
      const catDef = resourceConfigRegistry.getCategory(newCat);

      const catDesc = this.modalContainer?.querySelector('#category-description');
      if (catDesc && catDef) {
        catDesc.textContent = catDef.description;
      }

      const metaContainer = this.modalContainer?.querySelector('#dynamic-metadata-fields');
      if (metaContainer) {
        metaContainer.innerHTML = this.renderDynamicMetadataFields();
        this.bindMetadataInputEvents();
      }

      this.updatePreview();
    });

    // Input Titolo
    const titleInput = this.modalContainer.querySelector<HTMLInputElement>('#input-title');
    titleInput?.addEventListener('input', () => {
      this.currentItem.title = titleInput.value;
      this.updatePreview();
    });

    // Input Cover URL
    const coverInput = this.modalContainer.querySelector<HTMLInputElement>('#input-cover');
    coverInput?.addEventListener('input', () => {
      this.currentItem.coverImageUrl = coverInput.value.trim() || null;
      this.updatePreview();
    });

    this.modalContainer.querySelector('#btn-clear-cover')?.addEventListener('click', () => {
      if (coverInput) coverInput.value = '';
      this.currentItem.coverImageUrl = null;
      this.updatePreview();
    });

    // Input Descrizione
    const descInput = this.modalContainer.querySelector<HTMLTextAreaElement>('#input-description');
    descInput?.addEventListener('input', () => {
      this.currentItem.descriptionMarkdown = descInput.value;
      this.updatePreview();
    });

    // Input Tags
    const tagsInput = this.modalContainer.querySelector<HTMLInputElement>('#input-tags');
    tagsInput?.addEventListener('input', () => {
      this.currentItem.tags = tagsInput.value
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);
      this.updatePreview();
    });

    // Aggiungi Allegato
    this.modalContainer.querySelector('#btn-add-attachment')?.addEventListener('click', () => {
      const nameEl = this.modalContainer?.querySelector<HTMLInputElement>('#input-att-name');
      const urlEl = this.modalContainer?.querySelector<HTMLInputElement>('#input-att-url');
      if (nameEl && urlEl && nameEl.value.trim() && urlEl.value.trim()) {
        const ext = nameEl.value.split('.').pop()?.toLowerCase();
        let fileType: ResourceAttachment['fileType'] = 'OTHER';
        if (ext === 'pdf') fileType = 'PDF';
        else if (['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext || '')) fileType = 'IMAGE';
        else if (['mp3', 'wav', 'ogg'].includes(ext || '')) fileType = 'AUDIO';
        else if (ext === 'gpx') fileType = 'GPX';

        this.currentItem.attachments.push({
          fileId: `att_${Date.now()}`,
          fileName: nameEl.value.trim(),
          driveUrl: urlEl.value.trim(),
          fileType
        });

        nameEl.value = '';
        urlEl.value = '';

        const attList = this.modalContainer?.querySelector('#attachments-list');
        if (attList) {
          attList.innerHTML = this.renderAttachmentsList();
          this.bindAttachmentEvents();
        }
        this.updatePreview();
      }
    });

    this.bindAttachmentEvents();
    this.bindMetadataInputEvents();

    // Salva Risorsa
    this.modalContainer.querySelector('#btn-save-modal')?.addEventListener('click', async () => {
      if (!this.currentItem.title.trim()) {
        alert('Inserisci il titolo della risorsa.');
        titleInput?.focus();
        return;
      }

      this.currentItem.updatedAt = new Date().toISOString();
      await resourceDataExtractor.saveResource(this.currentItem);
      this.options.onSaved(this.currentItem);
      this.close();
    });
  }

  private bindMetadataInputEvents(): void {
    const metaInputs = this.modalContainer?.querySelectorAll<HTMLInputElement>('.dynamic-meta-input');
    metaInputs?.forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.getAttribute('data-meta-key');
        if (key) {
          this.currentItem.extractedMetadata[key] = input.value;
          this.updatePreview();
        }
      });
    });
  }

  private bindAttachmentEvents(): void {
    const delButtons = this.modalContainer?.querySelectorAll<HTMLButtonElement>('.btn-del-att');
    delButtons?.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idxStr = btn.getAttribute('data-del-att-idx');
        if (idxStr !== null) {
          const idx = parseInt(idxStr, 10);
          this.currentItem.attachments.splice(idx, 1);
          const attList = this.modalContainer?.querySelector('#attachments-list');
          if (attList) {
            attList.innerHTML = this.renderAttachmentsList();
            this.bindAttachmentEvents();
          }
          this.updatePreview();
        }
      });
    });
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
