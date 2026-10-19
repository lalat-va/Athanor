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
 * NOME FILE: src/plugins/ResourcesPlugin/components/ResourceListView.ts
 * ============================================================================
 * DESCRIZIONE:
 * Componente per la visualizzazione a Lista / Tabella del Plugin Risorse (v2.0):
 * - Tabella densa ad alta efficienza informativa per inventario e ricerca rapida
 * - Colonne: Anteprima/Icona, Titolo, Categoria, Modulo Sorgente, Metadati Chiave, Data, Azioni
 * - Indicatori grafici per allegati, stato di sola lettura e tag
 * - Pulsanti d'azione rapidi per consultazione/modifica ed eliminazione
 * ============================================================================
 */

import { ResourceItem, ResourcesSpaceConfig } from '../types.js';
import { resourceConfigRegistry } from '../ResourceConfigRegistry.js';

export interface ResourceListViewOptions {
  onView: (resource: ResourceItem) => void;
  onDelete: (resourceId: string) => void;
}

export class ResourceListView {
  public static render(
    container: HTMLElement,
    resources: ResourceItem[],
    config: ResourcesSpaceConfig,
    options: ResourceListViewOptions
  ): void {
    if (resources.length === 0) {
      container.innerHTML = `
        <div class="py-16 text-center bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-8 space-y-3">
          <div class="text-4xl">📊</div>
          <h4 class="text-base font-bold text-slate-300">Nessuna risorsa in elenco</h4>
          <p class="text-xs text-slate-400 max-w-md mx-auto">
            La tabella è vuota per i filtri correnti o per lo Spazio attivo.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/90 shadow-xl">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-950/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <th class="py-3 px-3 w-12 text-center">Tipo</th>
              <th class="py-3 px-4 font-bold">Titolo & Descrizione</th>
              <th class="py-3 px-3 w-40">Categoria</th>
              <th class="py-3 px-3 w-32">Modulo Sorgente</th>
              <th class="py-3 px-3 min-w-[200px]">Metadati Chiave</th>
              <th class="py-3 px-3 w-32">Aggiornato</th>
              <th class="py-3 px-3 w-28 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/80 text-slate-200" id="resource-table-body">
          </tbody>
        </table>
      </div>
    `;

    const tbody = container.querySelector('#resource-table-body');
    if (!tbody) return;

    resources.forEach((res) => {
      const row = this.createRowElement(res, config, options);
      tbody.appendChild(row);
    });
  }

  private static createRowElement(
    res: ResourceItem,
    config: ResourcesSpaceConfig,
    options: ResourceListViewOptions
  ): HTMLTableRowElement {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/50 transition-colors group cursor-pointer';

    const catDef = resourceConfigRegistry.getCategory(res.category);
    const catLabel = catDef?.label || res.category;
    const catIcon = catDef?.icon || '📌';

    // Anteprima o Icona
    let previewHtml = '';
    if (res.coverImageUrl && res.coverImageUrl.trim()) {
      previewHtml = `
        <div class="w-10 h-10 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 shrink-0">
          <img src="${res.coverImageUrl}" alt="${this.escapeHtml(res.title)}" class="w-full h-full object-cover" />
        </div>
      `;
    } else {
      previewHtml = `
        <div class="w-10 h-10 rounded-lg border border-slate-700/80 bg-slate-950 flex items-center justify-center text-lg shrink-0 shadow-sm">
          <span>${catIcon}</span>
        </div>
      `;
    }

    // Metadati prioritari per riga
    const priorityFieldKeys =
      config.categoryPriority[res.category] ||
      catDef?.defaultPriorityFields ||
      Object.keys(res.extractedMetadata).slice(0, 3);

    const metadataChips = priorityFieldKeys
      .map((key) => {
        const val = res.extractedMetadata[key];
        if (val === undefined || val === null || val === '') return '';
        const fieldDef = catDef?.availableFields.find((f) => f.key === key);
        const icon = fieldDef?.icon || '•';
        const displayVal = Array.isArray(val) ? val.join(', ') : String(val);
        return `
          <span class="inline-flex items-center gap-1 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-300 font-medium">
            <span>${icon}</span>
            <span class="truncate max-w-[120px]" title="${this.escapeHtml(displayVal)}">${this.escapeHtml(displayVal)}</span>
          </span>
        `;
      })
      .filter(Boolean)
      .join('');

    // Sorgente badge
    let sourceHtml = '';
    if (res.sourcePluginId === 'direct') {
      sourceHtml = `
        <span class="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
          <span>✏️</span>
          <span>Inserimento Diretto</span>
        </span>
      `;
    } else {
      sourceHtml = `
        <span class="inline-flex items-center gap-1 text-[11px] text-blue-300 bg-blue-950/70 border border-blue-900 px-2 py-0.5 rounded font-mono">
          <span>🔄</span>
          <span>${this.escapeHtml(res.sourcePluginId)}</span>
        </span>
      `;
    }

    const formattedDate = new Date(res.updatedAt).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const shortDesc = res.descriptionMarkdown
      ? res.descriptionMarkdown.length > 70
        ? res.descriptionMarkdown.substring(0, 70) + '...'
        : res.descriptionMarkdown
      : '';

    tr.innerHTML = `
      <td class="py-2.5 px-3 text-center align-middle">
        ${previewHtml}
      </td>
      <td class="py-2.5 px-4 align-middle">
        <div class="font-bold text-slate-100 group-hover:text-blue-400 transition-colors flex items-center gap-2">
          <span>${this.escapeHtml(res.title)}</span>
          ${res.isReadOnly ? '<span class="text-[10px] text-amber-400 font-semibold" title="Sola Lettura">🔒</span>' : ''}
          ${res.attachments?.length ? `<span class="text-[10px] text-slate-400 font-mono" title="${res.attachments.length} allegati">📎 ${res.attachments.length}</span>` : ''}
        </div>
        ${shortDesc ? `<p class="text-[11px] text-slate-400 mt-0.5 truncate max-w-sm">${this.escapeHtml(shortDesc)}</p>` : ''}
      </td>
      <td class="py-2.5 px-3 align-middle">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${catDef?.colorClass || 'border-slate-700 bg-slate-950 text-slate-300'}">
          <span>${catIcon}</span>
          <span>${this.escapeHtml(catLabel)}</span>
        </span>
      </td>
      <td class="py-2.5 px-3 align-middle">
        ${sourceHtml}
      </td>
      <td class="py-2.5 px-3 align-middle">
        <div class="flex items-center gap-1.5 flex-wrap">
          ${metadataChips || '<span class="text-slate-500 italic text-[10px]">Nessun metadato</span>'}
        </div>
      </td>
      <td class="py-2.5 px-3 align-middle text-slate-400 font-mono text-[11px]">
        ${formattedDate}
      </td>
      <td class="py-2.5 px-3 align-middle text-right">
        <div class="flex items-center justify-end gap-1">
          <button class="btn-list-view bg-blue-600/80 hover:bg-blue-600 text-white text-xs px-2.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer" title="Visualizza dettagli">
            <span>👁️</span>
          </button>
          <button class="btn-list-delete text-slate-400 hover:text-red-400 hover:bg-red-950/60 text-xs px-2 py-1 rounded transition-colors cursor-pointer" title="Elimina">
            <span>🗑️</span>
          </button>
        </div>
      </td>
    `;

    tr.addEventListener('click', (e) => {
      // Se non si è cliccato su elimina, apri visualizzazione
      if ((e.target as HTMLElement).closest('.btn-list-delete')) return;
      options.onView(res);
    });

    tr.querySelector('.btn-list-delete')?.addEventListener('click', (e) => {
      e.stopPropagation();
      options.onDelete(res.resourceId);
    });

    return tr;
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
