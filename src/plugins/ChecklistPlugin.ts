import { AppPlugin } from '../base/PluginManager.js';
import { EventBus } from '../base/EventBus.js';
import { I18nManager } from '../base/I18nManager.js';

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export class ChecklistPlugin implements AppPlugin {
  public id = 'checklist-plugin';
  public name = 'Checklist Gestionale';
  
  /**
   * VINCOLO 3: Plugin non collaborativo in tempo reale.
   * isCollaborative = false segnala che dataState usa un JSON piatto (last-write-wins).
   */
  public isCollaborative = false;

  public locales = {
    it: {
      title: 'Elenco Attività Organizzative',
      addItem: 'Aggiungi voce',
      completed: 'Completate',
      placeholder: 'Nuova attività...'
    },
    en: {
      title: 'Organizational Task List',
      addItem: 'Add item',
      completed: 'Completed',
      placeholder: 'New task...'
    }
  };

  private i18n: I18nManager | null = null;

  public async init(_eventBus: EventBus, i18n: I18nManager): Promise<void> {
    this.i18n = i18n;
    console.log(`[ChecklistPlugin] Plugin "${this.name}" initialized successfully.`);
  }

  public render(container: HTMLElement, dataState: { items?: ChecklistItem[] }, _currentLocale: string): void {
    const items: ChecklistItem[] = dataState.items || [
      { id: '1', label: 'Verifica verbale assemblea soci', completed: true },
      { id: '2', label: 'Invio convocazione consiglio direttivo', completed: false }
    ];
    dataState.items = items;

    const tTitle = this.i18n ? this.i18n.t(`plugins.${this.id}.title`) : 'Checklist';
    const tAddItem = this.i18n ? this.i18n.t(`plugins.${this.id}.addItem`) : 'Aggiungi';
    const tPlaceholder = this.i18n ? this.i18n.t(`plugins.${this.id}.placeholder`) : 'Nuova attività...';

    container.innerHTML = `
      <div class="checklist-widget bg-slate-50 p-4 rounded-md border border-slate-200">
        <h4 class="text-sm font-semibold text-slate-800 mb-3">${tTitle}</h4>
        <ul class="checklist-items space-y-2 mb-3">
          ${items
            .map(
              (item) => `
            <li class="flex items-center gap-2 text-xs">
              <input type="checkbox" data-item-id="${item.id}" ${item.completed ? 'checked' : ''} class="item-checkbox cursor-pointer rounded border-slate-300" />
              <span class="${item.completed ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}">${item.label}</span>
            </li>
          `
            )
            .join('')}
        </ul>
        <div class="flex gap-2">
          <input type="text" class="new-item-input text-xs border border-slate-300 rounded p-1.5 flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="${tPlaceholder}" />
          <button class="add-item-btn text-xs bg-blue-600 text-white px-3 py-1.5 rounded font-medium hover:bg-blue-700 transition-colors">${tAddItem}</button>
        </div>
      </div>
    `;

    // Interattività e aggiornamento dello stato locale
    const checkboxes = container.querySelectorAll<HTMLInputElement>('.item-checkbox');
    checkboxes.forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const itemId = target.getAttribute('data-item-id');
        const found = items.find((i) => i.id === itemId);
        if (found) {
          found.completed = target.checked;
          this.render(container, dataState, _currentLocale);
        }
      });
    });

    const addBtn = container.querySelector<HTMLButtonElement>('.add-item-btn');
    const inputEl = container.querySelector<HTMLInputElement>('.new-item-input');

    if (addBtn && inputEl) {
      addBtn.addEventListener('click', () => {
        const text = inputEl.value.trim();
        if (text) {
          items.push({ id: String(Date.now()), label: text, completed: false });
          inputEl.value = '';
          this.render(container, dataState, _currentLocale);
        }
      });
    }
  }

  public serializeToMarkdown(dataState: { items?: ChecklistItem[] }): string {
    const items = dataState.items || [];
    if (items.length === 0) return '';
    return items.map((item) => `- [${item.completed ? 'x' : ' '}] ${item.label}`).join('\n');
  }
}
