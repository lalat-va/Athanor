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
 * NOME FILE: src/plugins/ResourcesPlugin/components/ResourceCardView.ts
 * ============================================================================
 * DESCRIZIONE:
 * Componente per la visualizzazione a Schede / Grid del Plugin Risorse (v2.0):
 * - Griglia responsive (1 colonna su mobile, 2 su tablet, 3-4 su desktop)
 * - Header scheda con background image di copertina + dark gradient overlay
 *   per garantire la massima leggibilità del titolo e badge impressi in bianco
 * - Fallback cromatico elegante con gradiente di categoria se cover assente
 * - Blocco sintetico con 3-5 metadati prioritari configurati nei Settings
 * - Badge categoria, tag, indicatori allegati e sorgente (IdP/Plugin)
 * - Azioni di consultazione dettagliata, fork e cancellazione
 * ============================================================================
 */

import { ResourceItem, ResourcesSpaceConfig } from '../types.js';
import { resourceConfigRegistry } from '../ResourceConfigRegistry.js';

export interface ResourceCardViewOptions {
  onView: (resource: ResourceItem) => void;
  onDelete: (resourceId: string) => void;
}

export class ResourceCardView {
  public static render(
    container: HTMLElement,
    resources: ResourceItem[],
    config: ResourcesSpaceConfig,
    options: ResourceCardViewOptions
  ): void {
    if (resources.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-8 space-y-3">
          <div class="text-4xl">🔍</div>
          <h4 class="text-base font-bold text-slate-300">Nessuna risorsa trovata</h4>
          <p class="text-xs text-slate-400 max-w-md mx-auto">
            Non ci sono risorse corrispondenti ai filtri impostati o allo Spazio attivo.
            Puoi aggiungere una nuova risorsa con il pulsante <strong>"➕ Nuova Risorsa"</strong>.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5';

    resources.forEach((res) => {
      const cardEl = this.createCardElement(res, config, options);
      grid.appendChild(cardEl);
    });

    container.appendChild(grid);
  }

  private static createCardElement(
    res: ResourceItem,
    config: ResourcesSpaceConfig,
    options: ResourceCardViewOptions
  ): HTMLElement {
    const card = document.createElement('div');
    card.className =
      'group bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-blue-500/60 transition-all duration-200 overflow-hidden shadow-lg hover:shadow-2xl flex flex-col justify-between';

    const catDef = resourceConfigRegistry.getCategory(res.category);
    const catLabel = catDef?.label || res.category;
    const catIcon = catDef?.icon || '📌';

    // Determina lo stile dell'header (Cover image con Dark Gradient Overlay vs Pattern di Categoria)
    let headerStyle = '';
    let headerClass = '';

    if (res.coverImageUrl && res.coverImageUrl.trim()) {
      headerStyle = `
        background-image: linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.95) 100%), url('${res.coverImageUrl}');
        background-size: cover;
        background-position: center;
      `;
      headerClass = 'min-h-[140px]';
    } else {
      headerStyle = `background: ${catDef?.gradientStyle || 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)'};`;
      headerClass = 'min-h-[120px]';
    }

    // Risoluzione campi prioritari (da configurazione spazio o default di categoria)
    const priorityFieldKeys =
      config.categoryPriority[res.category] ||
      catDef?.defaultPriorityFields ||
      Object.keys(res.extractedMetadata).slice(0, 4);

    const priorityBadgesHtml = priorityFieldKeys
      .map((key) => {
        const val = res.extractedMetadata[key];
        if (val === undefined || val === null || val === '') return '';
        const fieldDef = catDef?.availableFields.find((f) => f.key === key);
        const icon = fieldDef?.icon || '🔹';
        const label = fieldDef?.label || key;
        const displayVal = Array.isArray(val) ? val.join(', ') : String(val);

        return `
          <div class="flex items-start gap-1.5 bg-slate-950/70 border border-slate-800/80 px-2.5 py-1.5 rounded-lg text-[11px] leading-tight">
            <span class="text-xs shrink-0 select-none">${icon}</span>
            <div class="truncate">
              <span class="text-slate-400 font-medium block text-[10px] leading-none mb-0.5">${this.escapeHtml(label)}</span>
              <span class="text-slate-200 font-semibold truncate block" title="${this.escapeHtml(displayVal)}">${this.escapeHtml(displayVal)}</span>
            </div>
          </div>
        `;
      })
      .filter(Boolean)
      .join('');

    // Indicatori tags
    const tagsHtml = (res.tags || [])
      .slice(0, 4)
      .map(
        (t) => `
        <span class="text-[10px] bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 px-2 py-0.5 rounded-full font-mono transition-colors">
          #${this.escapeHtml(t)}
        </span>
      `
      )
      .join('');

    // Indicatore sorgente / readonly
    let sourceBadge = '';
    if (res.sourcePluginId && res.sourcePluginId !== 'direct') {
      sourceBadge = `
        <span class="text-[10px] bg-blue-950/80 border border-blue-800 text-blue-300 px-2 py-0.5 rounded font-mono font-medium flex items-center gap-1" title="Origine: ${this.escapeHtml(res.sourcePluginId)}">
          <span>🔄</span>
          <span>${this.escapeHtml(res.sourcePluginId)}</span>
        </span>
      `;
    }
    if (res.isReadOnly) {
      sourceBadge += `
        <span class="text-[10px] bg-amber-950/80 border border-amber-800 text-amber-300 px-2 py-0.5 rounded font-medium flex items-center gap-1" title="Contenuto congelato / sola lettura">
          <span>🔒</span>
          <span>Protetta</span>
        </span>
      `;
    }

    // Troncamento descrizione
    const shortDesc = res.descriptionMarkdown
      ? res.descriptionMarkdown.length > 130
        ? res.descriptionMarkdown.substring(0, 130) + '...'
        : res.descriptionMarkdown
      : 'Nessuna descrizione specificata.';

    const attachmentsCount = res.attachments?.length || 0;

    card.innerHTML = `
      <!-- HEADER CON SFONDO COVER / OVERLAY GRADIENTE SCURO -->
      <div class="p-4 flex flex-col justify-between relative rounded-t-2xl ${headerClass}" style="${headerStyle}">
        <div class="flex items-center justify-between gap-2 z-10">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-950/80 backdrop-blur-sm border border-slate-700 text-white shadow-sm">
            <span>${catIcon}</span>
            <span>${this.escapeHtml(catLabel)}</span>
          </span>

          <div class="flex items-center gap-1.5">
            ${sourceBadge}
          </div>
        </div>

        <div class="mt-4 z-10">
          <h3 class="text-sm font-bold text-white tracking-wide drop-shadow-md line-clamp-2 leading-snug" title="${this.escapeHtml(res.title)}">
            ${this.escapeHtml(res.title)}
          </h3>
        </div>
      </div>

      <!-- CORPO SCHEDA: METADATI PRIORITARI (CARD PRIORITY ENGINE) -->
      <div class="p-4 space-y-3 flex-1 flex flex-col justify-between">
        
        <!-- BADGES SINTETICI PRIORITARI (3-5 ELEMENTI) -->
        ${
          priorityBadgesHtml
            ? `
          <div class="grid grid-cols-2 gap-2 pt-1">
            ${priorityBadgesHtml}
          </div>
        `
            : ''
        }

        <!-- DESCRIZIONE SINTETICA -->
        <p class="text-[11px] text-slate-400 leading-relaxed line-clamp-3 pt-1">
          ${this.escapeHtml(shortDesc)}
        </p>

        <!-- TAGS & METADATI INFERIORI -->
        <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap text-[11px] text-slate-500">
          <div class="flex items-center gap-1 flex-wrap">
            ${tagsHtml}
          </div>

          ${
            attachmentsCount > 0
              ? `
            <span class="text-[10px] text-blue-400 font-semibold flex items-center gap-1 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-900/40">
              <span>📎</span>
              <span>${attachmentsCount} ${attachmentsCount === 1 ? 'allegato' : 'allegati'}</span>
            </span>
          `
              : ''
          }
        </div>
      </div>

      <!-- FOOTER AZIONI -->
      <div class="p-3 bg-slate-950/70 border-t border-slate-800 rounded-b-2xl flex items-center justify-between gap-2">
        <button class="btn-card-view bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow transition-colors flex items-center gap-1.5 cursor-pointer">
          <span>👁️</span>
          <span>Dettagli</span>
        </button>

        <button class="btn-card-delete text-slate-400 hover:text-red-400 hover:bg-red-950/40 active:bg-red-950/80 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer" title="Elimina risorsa">
          <span>🗑️</span>
          <span>Elimina</span>
        </button>
      </div>
    `;

    // Event listeners
    card.querySelector('.btn-card-view')?.addEventListener('click', () => {
      options.onView(res);
    });

    card.querySelector('.btn-card-delete')?.addEventListener('click', (e) => {
      e.stopPropagation();
      options.onDelete(res.resourceId);
    });

    return card;
  }

  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
