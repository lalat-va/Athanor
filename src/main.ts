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
import { MapPlugin } from './plugins/MapPlugin.js';

async function bootstrapApp() {
  console.log('[Bootstrap] Avvio Athanor v3.0 (Sidebar Resizable 20-50% & Canvas Canvas)...');

  // 1. Inizializzazione EventBus centrale
  const eventBus = new EventBus();

  // 2. Inizializzazione StorageAdapter
  const storageAdapter = new LocalStorageAdapter();

  // 3. Inizializzazione e caricamento asincrono di I18nManager
  const i18n = I18nManager.getInstance();
  await i18n.init(db, eventBus);

  // 4. Inizializzazione PluginManager e registrazione dei plugin
  const pluginManager = PluginManager.getInstance(eventBus, i18n);

  const checklistPlugin = new ChecklistPlugin();
  await pluginManager.registerPlugin(checklistPlugin);

  const mapPlugin = new MapPlugin();
  await pluginManager.registerPlugin(mapPlugin);

  // 5. Inizializzazione CollabService (Yjs + y-indexeddb)
  const docId = 'doc-associazione-001';
  const collabService = new CollabService(docId, storageAdapter);
  collabService.setUserPresence({ name: 'Operatore Terzo Settore', color: '#2563eb' });

  // 6. Layout UI Master Prompt v3.0: Sidebar Sinistra Ridimensionabile + Canvas Centrale Principale
  const appContainer = document.querySelector<HTMLDivElement>('#app') || document.body;

  appContainer.innerHTML = `
    <div class="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      
      <!-- 1. SIDEBAR LATERALE SINISTRA (PANNELLO DI CONTROLO - LARGHEZZA DINAMICA 20%-50%) -->
      <aside id="sidebar" class="h-full bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 shrink-0 transition-none" style="width: 25%;">
        
        <!-- Intestazione Sidebar -->
        <div class="space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <div class="flex items-center gap-2">
              <span class="text-xl">🔥</span>
              <h1 class="text-lg font-bold text-slate-100 tracking-tight">Athanor v3.0</h1>
            </div>
            <span class="bg-blue-950 text-blue-300 text-[10px] px-2 py-0.5 rounded border border-blue-800 font-semibold">Local-First</span>
          </div>

          <!-- SEZIONE 1 - "Progetti e eventi in corso" (In alto, Attualmente VUOTA) -->
          <div class="space-y-2">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Progetti e eventi in corso</h3>
            <div class="border-2 border-dashed border-slate-800/80 rounded-lg p-4 text-center bg-slate-950/40">
              <span class="text-xs text-slate-500 italic block">Sezione vuota</span>
              <span class="text-[10px] text-slate-600 block mt-0.5">(In attesa dei flussi futuri degli orchestratori)</span>
            </div>
          </div>
        </div>

        <!-- SEZIONE 2 - "Utilità" (In basso, Contiene PER ORA SOLO DUE PULSANTI: "Mappe" e "Task") -->
        <div class="space-y-2 border-t border-slate-800 pt-4">
          <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Utilità</h3>
          <div class="flex flex-col gap-2">
            <!-- Pulsante Mappe -->
            <button id="sidebar-btn-mappe" class="w-full bg-blue-950 hover:bg-blue-900 text-blue-200 border border-blue-800/80 text-xs px-3.5 py-2.5 rounded-lg font-semibold transition-colors flex items-center gap-2 text-left shadow-sm">
              <span class="text-base">🗺️</span>
              <div class="flex flex-col">
                <span>Mappe</span>
                <span class="text-[10px] text-blue-400 font-normal">GIS & Logistica Percorsi</span>
              </div>
            </button>

            <!-- Pulsante Task (Checklist) -->
            <button id="sidebar-btn-task" class="w-full bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-800/80 text-xs px-3.5 py-2.5 rounded-lg font-semibold transition-colors flex items-center gap-2 text-left shadow-sm">
              <span class="text-base">☑️</span>
              <div class="flex flex-col">
                <span>Task</span>
                <span class="text-[10px] text-purple-400 font-normal">Checklist Organizzativa</span>
              </div>
            </button>
          </div>
        </div>

      </aside>

      <!-- HANDLER DI RIDIMENSIONAMENTO DELLA SIDEBAR (SPLITTER 20%-50%) -->
      <div id="sidebar-resizer" class="w-1.5 h-full bg-slate-800 hover:bg-blue-500 cursor-col-resize shrink-0 transition-colors"></div>

      <!-- 2. SEZIONE CENTRALE PRINCIPALE (CANVAS DI VISUALIZZAZIONE REATTIVA) -->
      <div class="flex-1 h-full flex flex-col overflow-hidden bg-slate-950">
        
        <!-- Header Toolbar Superiore del Canvas -->
        <header class="h-14 border-b border-slate-800 px-6 flex items-center justify-between shrink-0 bg-slate-900/60">
          <div>
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Spazio Centrale Canvas</span>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-toggle-lang" class="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs px-3 py-1.5 rounded font-medium transition-colors">
              🌐 Lingua: ${i18n.getLocale().toUpperCase()}
            </button>
            <button id="btn-save-db" class="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3.5 py-1.5 rounded font-medium shadow transition-colors">
              💾 ${i18n.t('base.editor.save')} (IndexedDB)
            </button>
            <button id="btn-export-cloud" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 py-1.5 rounded font-medium shadow transition-colors">
              ☁️ Export Cloud (Markdown)
            </button>
          </div>
        </header>

        <!-- Area Editor TipTap (Inizialmente COMPLETAMENTE VUOTA o con Benvenuto) -->
        <main class="flex-1 p-6 overflow-y-auto">
          <div id="editor-mount" class="border border-slate-800 rounded-xl p-4 bg-slate-900 shadow-2xl min-h-[500px]"></div>

          <!-- Anteprima Output Markdown Export -->
          <div id="preview-panel" class="hidden mt-4 bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs space-y-2">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 class="font-bold text-emerald-400 flex items-center gap-2">
                📄 Risultato Serializzazione Markdown (Export Cloud)
              </h3>
              <button id="btn-close-preview" class="text-slate-400 hover:text-white font-bold px-2 py-0.5">✕</button>
            </div>
            <pre id="markdown-output" class="font-mono text-slate-300 bg-slate-900 p-3 rounded overflow-x-auto whitespace-pre-wrap max-h-64"></pre>
          </div>
        </main>

      </div>
    </div>
  `;

  // 7. Inizializzazione TipTap Editor (Inizialmente vuoto)
  const editorMount = document.querySelector<HTMLElement>('#editor-mount')!;
  const initialContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Seleziona un plugin dalla sidebar di sinistra sotto "Utilità" (es. "Mappe" o "Task") per iniziare.' }]
      }
    ]
  };

  const editorCore = new EditorCore(editorMount, initialContent);

  // 8. Inizializzazione del Ridimensionamento della Sidebar (20% - 50%)
  initSidebarResizer();

  // 9. Binding Pulsanti Sidebar "Utilità": "Mappe" e "Task"
  document.querySelector('#sidebar-btn-mappe')?.addEventListener('click', () => {
    editorCore.insertPluginBlock('map-plugin', {
      activeMode: 'map',
      activeBaseLayer: 'osm',
      activeOverlays: ['waymarked'],
      showLegendInExport: true,
      isOrganizational: true,
      waypoints: [],
      tracks: []
    });
  });

  document.querySelector('#sidebar-btn-task')?.addEventListener('click', () => {
    editorCore.insertPluginBlock('checklist-plugin', {
      items: [
        { id: String(Date.now()), label: 'Nuova attività organizzativa', completed: false }
      ]
    });
  });

  // 10. Actions Toolbar Superiore
  const saveDbBtn = document.querySelector<HTMLButtonElement>('#btn-save-db');
  saveDbBtn?.addEventListener('click', async () => {
    const derivedJsonAst = editorCore.getJsonAst();
    await db.documents.put({
      id: docId,
      title: 'Documento Gestionale 2026',
      lastModified: Date.now(),
      status: 'draft',
      metadata: {
        permissions: ['read', 'write'],
        roles: ['admin', 'operator'],
        groups: ['direttivo']
      },
      body: derivedJsonAst
    });
    alert('✅ Documento salvato in IndexedDB!');
  });

  const exportCloudBtn = document.querySelector<HTMLButtonElement>('#btn-export-cloud');
  const previewPanel = document.querySelector<HTMLElement>('#preview-panel');
  const markdownOutput = document.querySelector<HTMLElement>('#markdown-output');
  const closePreviewBtn = document.querySelector<HTMLButtonElement>('#btn-close-preview');

  closePreviewBtn?.addEventListener('click', () => previewPanel?.classList.add('hidden'));

  exportCloudBtn?.addEventListener('click', async () => {
    const currentAst = editorCore.getJsonAst();
    const md = MarkdownSerializer.serialize(currentAst);
    if (markdownOutput && previewPanel) {
      markdownOutput.textContent = md;
      previewPanel.classList.remove('hidden');
    }
    await storageAdapter.saveDocument(docId, {
      title: 'Documento Gestionale 2026',
      markdown: md,
      lastModified: Date.now()
    });
  });

  const langBtn = document.querySelector<HTMLButtonElement>('#btn-toggle-lang');
  langBtn?.addEventListener('click', async () => {
    const nextLocale = i18n.getLocale() === 'it' ? 'en' : 'it';
    await i18n.setLocale(nextLocale);
    langBtn.textContent = `🌐 Lingua: ${nextLocale.toUpperCase()}`;
    saveDbBtn!.textContent = `💾 ${i18n.t('base.editor.save')} (IndexedDB)`;
  });
}

/**
 * GESTIONE RIDIMENSIONAMENTO MANUALE SIDEBAR (20% - 50%)
 */
function initSidebarResizer() {
  const sidebar = document.querySelector<HTMLElement>('#sidebar');
  const resizer = document.querySelector<HTMLElement>('#sidebar-resizer');
  if (!sidebar || !resizer) return;

  let isResizing = false;

  resizer.addEventListener('mousedown', () => {
    isResizing = true;
    document.body.classList.add('select-none');
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const windowWidth = window.innerWidth;
    const newWidthPx = e.clientX;
    const newWidthPercent = (newWidthPx / windowWidth) * 100;

    // Vincolo min 20% e max 50%
    if (newWidthPercent >= 20 && newWidthPercent <= 50) {
      sidebar.style.width = `${newWidthPercent}%`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.classList.remove('select-none');
    }
  });
}

bootstrapApp().catch((err) => console.error('[Bootstrap Error]', err));
