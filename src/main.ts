import './style.css';
import { EventBus } from './base/EventBus.js';
import { db } from './base/Database.js';
import { I18nManager } from './base/I18nManager.js';
import { PluginManager } from './base/PluginManager.js';
import { CollabService } from './base/CollabService.js';
import { LocalStorageAdapter } from './modules/StorageAdapter.js';
import { EditorCore } from './base/EditorCore.js';
import { MarkdownSerializer } from './base/MarkdownSerializer.js';
import { ChecklistPlugin } from './plugins/ChecklistPlugin.js';

async function bootstrapApp() {
  console.log('[Bootstrap] Avvio architettura Athanor Local-First...');

  // 1. Inizializzazione EventBus centrale
  const eventBus = new EventBus();

  // 2. Inizializzazione StorageAdapter (mock locale per test offline)
  const storageAdapter = new LocalStorageAdapter();

  // 3. Inizializzazione e caricamento asincrono di I18nManager
  const i18n = I18nManager.getInstance();
  console.log(`[Bootstrap] Traduzione sincrona di bootstrap: ${i18n.t('base.editor.save')}`);

  // Caricamento asincrono della preferenza di lingua salvata in IndexedDB
  await i18n.init(db, eventBus);
  console.log(`[Bootstrap] Lingua caricata da IndexedDB: "${i18n.getLocale()}"`);

  // Notifica dinamica al cambio lingua
  eventBus.on('locale:changed', (newLocale: string) => {
    console.log(`[UI] Ricevuto evento 'locale:changed' -> Nuova lingua attiva: ${newLocale}`);
  });

  // 4. Inizializzazione PluginManager e caricamento del plugin di esempio multilingua non collaborativo
  const pluginManager = PluginManager.getInstance(eventBus, i18n);
  const checklistPlugin = new ChecklistPlugin();
  await pluginManager.registerPlugin(checklistPlugin);

  // 5. Inizializzazione CollabService (Yjs + y-indexeddb)
  const docId = 'doc-associazione-001';
  const collabService = new CollabService(docId, storageAdapter);
  collabService.setUserPresence({ name: 'Operatore Terzo Settore', color: '#2563eb' });

  // 6. Configurazione interfaccia e montaggio EditorCore con schema custom e NodeView per PluginBlock
  const appContainer = document.querySelector<HTMLDivElement>('#app') || document.body;

  appContainer.innerHTML = `
    <div class="max-w-4xl mx-auto p-6 font-sans text-slate-800">
      <header class="mb-6 flex justify-between items-center border-b border-slate-700 pb-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-100">Athanor - Gestionale Terzo Settore</h1>
          <p class="text-xs text-slate-400">Architettura Local-First, Reattiva & Modulare</p>
        </div>
        <div class="flex gap-2">
          <button id="btn-toggle-lang" class="bg-slate-700 text-slate-100 text-xs px-3 py-2 rounded font-medium hover:bg-slate-600 transition-colors">
            Lingua: ${i18n.getLocale().toUpperCase()}
          </button>
          <button id="btn-save-db" class="bg-blue-600 text-white text-xs px-3 py-2 rounded font-medium hover:bg-blue-700 transition-colors">
            ${i18n.t('base.editor.save')} (IndexedDB)
          </button>
          <button id="btn-export-cloud" class="bg-emerald-600 text-white text-xs px-3 py-2 rounded font-medium hover:bg-emerald-700 transition-colors">
            Export Cloud (Markdown)
          </button>
        </div>
      </header>

      <main>
        <div id="editor-mount" class="border border-slate-700 rounded-lg p-4 bg-slate-800 shadow-md min-h-[300px]"></div>
      </main>
    </div>
  `;

  const editorMount = document.querySelector<HTMLElement>('#editor-mount')!;

  const initialContent = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Documento Operativo Associazione' }]
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Questo documento utilizza un albero strutturato a blocchi senza formattazione testo libero.' }]
      },
      {
        type: 'pluginBlock',
        attrs: {
          pluginId: 'checklist-plugin',
          dataState: {
            items: [
              { id: '1', label: 'Approvazione bilancio preventivo 2026', completed: true },
              { id: '2', label: 'Rendicontazione contributo pubblico entro il 30 Giugno', completed: false }
            ]
          },
          isOrganizational: true
        }
      }
    ]
  };

  const editorCore = new EditorCore(editorMount, initialContent);

  // 7. Salvataggio vista derivata in IndexedDB ed Export Cloud
  const saveDbBtn = document.querySelector<HTMLButtonElement>('#btn-save-db');
  saveDbBtn?.addEventListener('click', async () => {
    /**
     * VINCOLO 2: Il Y.Doc è l'unica fonte di verità del contenuto vivo.
     * Il corpo salvato nella tabella 'documents' di Dexie è una vista derivata e materializzata.
     */
    const derivedJsonAst = editorCore.getJsonAst();

    await db.documents.put({
      id: docId,
      title: 'Verbale Assemblea 2026',
      lastModified: Date.now(),
      status: 'draft',
      /**
       * VINCOLO 4: I permessi in metadata sono SOLO stato UI-facing (nessuna illusione di controllo lato client).
       */
      metadata: {
        permissions: ['read', 'write'],
        roles: ['admin', 'operator'],
        groups: ['direttivo']
      },
      body: derivedJsonAst
    });

    console.log('[IndexedDB] Documento e vista derivata JSON-AST salvati nella tabella `documents` di Dexie:', derivedJsonAst);
    alert('Documento e vista derivata salvati in IndexedDB con successo!');
  });

  const exportCloudBtn = document.querySelector<HTMLButtonElement>('#btn-export-cloud');
  exportCloudBtn?.addEventListener('click', async () => {
    /**
     * VINCOLO 5: Serializzazione Markdown a due direzioni.
     * MarkdownSerializer.serialize() viene invocato per l'export finale su cloud tramite StorageAdapter.saveDocument()
     */
    const currentAst = editorCore.getJsonAst();
    const markdownOutput = MarkdownSerializer.serialize(currentAst);

    console.log('[Markdown Export] Risultato della serializzazione:\n', markdownOutput);

    // Salvataggio tramite lo StorageAdapter
    const saved = await storageAdapter.saveDocument(docId, {
      title: 'Verbale Assemblea 2026',
      markdown: markdownOutput,
      lastModified: Date.now()
    });

    if (saved) {
      alert(`Export Cloud completato tramite StorageAdapter!\n\nMarkdown Generato:\n${markdownOutput}`);
    }
  });

  const langBtn = document.querySelector<HTMLButtonElement>('#btn-toggle-lang');
  langBtn?.addEventListener('click', async () => {
    const nextLocale = i18n.getLocale() === 'it' ? 'en' : 'it';
    await i18n.setLocale(nextLocale);
    langBtn.textContent = `Lingua: ${nextLocale.toUpperCase()}`;
    saveDbBtn!.textContent = `${i18n.t('base.editor.save')} (IndexedDB)`;
  });
}

bootstrapApp().catch((err) => console.error('[Bootstrap Error]', err));
