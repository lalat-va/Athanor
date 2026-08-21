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
  console.log('[Bootstrap] Avvio applicazione Athanor Local-First GIS...');

  // 1. Inizializzazione EventBus centrale
  const eventBus = new EventBus();

  // 2. Inizializzazione StorageAdapter (mock locale per test offline)
  const storageAdapter = new LocalStorageAdapter();

  // 3. Inizializzazione e caricamento asincrono di I18nManager
  const i18n = I18nManager.getInstance();

  // Caricamento asincrono della preferenza di lingua salvata in IndexedDB
  await i18n.init(db, eventBus);
  console.log(`[Bootstrap] Lingua caricata da IndexedDB: "${i18n.getLocale()}"`);

  // 4. Inizializzazione PluginManager e caricamento dei plugin (Checklist & MapPlugin GIS)
  const pluginManager = PluginManager.getInstance(eventBus, i18n);

  const checklistPlugin = new ChecklistPlugin();
  await pluginManager.registerPlugin(checklistPlugin);

  const mapPlugin = new MapPlugin();
  await pluginManager.registerPlugin(mapPlugin);

  // 5. Inizializzazione CollabService (Yjs + y-indexeddb)
  const docId = 'doc-associazione-001';
  const collabService = new CollabService(docId, storageAdapter);
  collabService.setUserPresence({ name: 'Responsabile Percorso / Educatore', color: '#2563eb' });

  // 6. Rendering dell'Interfaccia Principale dell'Applicazione
  const appContainer = document.querySelector<HTMLDivElement>('#app') || document.body;

  appContainer.innerHTML = `
    <div class="max-w-5xl mx-auto p-4 sm:p-6 font-sans text-slate-100 min-h-screen">
      <!-- Header Principale -->
      <header class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-bold text-slate-100 tracking-tight">Athanor</h1>
            <span class="bg-blue-900/80 text-blue-300 text-xs px-2 py-0.5 rounded border border-blue-700 font-semibold">Local-First GIS</span>
          </div>
          <p class="text-xs text-slate-400 mt-1">Piattaforma reattiva a blocchi strutturati per Associazioni e Terzo Settore</p>
        </div>

        <!-- Toolbar Pulsanti Azione -->
        <div class="flex flex-wrap items-center gap-2">
          <button id="btn-toggle-lang" class="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs px-3 py-2 rounded font-medium transition-colors">
            🌐 Lingua: ${i18n.getLocale().toUpperCase()}
          </button>
          <button id="btn-save-db" class="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3.5 py-2 rounded font-medium shadow-sm transition-colors flex items-center gap-1.5">
            💾 ${i18n.t('base.editor.save')} (IndexedDB)
          </button>
          <button id="btn-export-cloud" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 py-2 rounded font-medium shadow-sm transition-colors flex items-center gap-1.5">
            ☁️ Export Cloud (Markdown)
          </button>
        </div>
      </header>

      <!-- Barra di Inserimento Dinamico Blocchi (Slash-Menu Bar) -->
      <div class="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3 mb-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-slate-300 uppercase tracking-wider">Inserisci Blocco Modulare:</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button id="btn-add-map-block" class="bg-blue-950 hover:bg-blue-900 text-blue-200 border border-blue-800 text-xs px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5">
            🗺️ + Mappa Escursione (.gpx)
          </button>
          <button id="btn-add-checklist-block" class="bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-800 text-xs px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5">
            ☑️ + Checklist Organizzativa
          </button>
        </div>
      </div>

      <!-- Canvas dell'Editor TipTap Reattivo -->
      <main class="mb-6">
        <div id="editor-mount" class="border border-slate-700 rounded-lg p-4 bg-slate-900 shadow-xl min-h-[420px]"></div>
      </main>

      <!-- Anteprima Output Markdown Export -->
      <div id="preview-panel" class="hidden bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs space-y-2">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 class="font-bold text-emerald-400 flex items-center gap-2">
            📄 Risultato Serializzazione Markdown (Pronto per Export Cloud)
          </h3>
          <button id="btn-close-preview" class="text-slate-400 hover:text-white font-bold px-2 py-0.5">✕</button>
        </div>
        <pre id="markdown-output" class="font-mono text-slate-300 bg-slate-900 p-3 rounded overflow-x-auto whitespace-pre-wrap max-h-64"></pre>
      </div>
    </div>
  `;

  const editorMount = document.querySelector<HTMLElement>('#editor-mount')!;

  // Definizione del contenuto iniziale del documento
  const initialContent = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Scheda Logistica Uscita ed Escursione Associazione' }]
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Documento operativo per educatori, animatori, volontari e responsabili di percorso.' }]
      },
      {
        type: 'pluginBlock',
        attrs: {
          pluginId: 'map-plugin',
          dataState: {
            activeBaseLayer: 'osm',
            activeOverlays: ['waymarked'],
            showLegendInExport: true,
            isOrganizational: true,
            waypoints: [
              {
                id: 'wp-1',
                lat: 45.8912,
                lng: 9.1245,
                title: 'Punto Ritrovo Partecipanti',
                category: 'rest',
                description: 'Piazzale di partenza per gli educatori e i ragazzi.',
                notesLogistica: 'Verificare presenza di tutti i volontari entro le 08:30.'
              },
              {
                id: 'wp-2',
                lat: 45.8985,
                lng: 9.1350,
                title: 'Fontanella Acqua Potabile',
                category: 'water',
                description: 'Postazione di rifornimento borraccia.',
                notesLogistica: 'Sosta idrica obbligatoria per tutti i gruppi.'
              }
            ]
          },
          isOrganizational: true
        }
      },
      {
        type: 'pluginBlock',
        attrs: {
          pluginId: 'checklist-plugin',
          dataState: {
            items: [
              { id: '1', label: 'Approvazione bilancio e delibera uscita soci', completed: true },
              { id: '2', label: 'Raccolta autorizzazioni sanitarie partecipanti', completed: true },
              { id: '3', label: 'Verifica kit di primo soccorso con i volontari', completed: false }
            ]
          },
          isOrganizational: true
        }
      }
    ]
  };

  const editorCore = new EditorCore(editorMount, initialContent);

  // Binding Inserimento Dinamico dei Blocchi Plugin
  document.querySelector('#btn-add-map-block')?.addEventListener('click', () => {
    editorCore.insertPluginBlock('map-plugin', {
      activeBaseLayer: 'osm',
      activeOverlays: ['waymarked'],
      showLegendInExport: true,
      isOrganizational: true,
      waypoints: []
    });
  });

  document.querySelector('#btn-add-checklist-block')?.addEventListener('click', () => {
    editorCore.insertPluginBlock('checklist-plugin', {
      items: [
        { id: String(Date.now()), label: 'Nuova attività da completare', completed: false }
      ]
    });
  });

  // Binding Salvataggio in IndexedDB
  const saveDbBtn = document.querySelector<HTMLButtonElement>('#btn-save-db');
  saveDbBtn?.addEventListener('click', async () => {
    /**
     * VINCOLO 2: Il Y.Doc è l'unica fonte di verità del contenuto vivo.
     * Il corpo salvato nella tabella 'documents' di Dexie è una vista derivata e materializzata.
     */
    const derivedJsonAst = editorCore.getJsonAst();

    await db.documents.put({
      id: docId,
      title: 'Uscita Escursionistica 2026',
      lastModified: Date.now(),
      status: 'draft',
      metadata: {
        permissions: ['read', 'write'],
        roles: ['admin', 'educator', 'route_leader'],
        groups: ['direttivo', 'animatori']
      },
      body: derivedJsonAst
    });

    console.log('[IndexedDB] Vista derivata salvata su IndexedDB:', derivedJsonAst);
    alert('✅ Documento, tracciato e vista derivata salvati in IndexedDB!');
  });

  // Binding Export Cloud Markdown
  const exportCloudBtn = document.querySelector<HTMLButtonElement>('#btn-export-cloud');
  const previewPanel = document.querySelector<HTMLElement>('#preview-panel');
  const markdownOutput = document.querySelector<HTMLElement>('#markdown-output');
  const closePreviewBtn = document.querySelector<HTMLButtonElement>('#btn-close-preview');

  closePreviewBtn?.addEventListener('click', () => {
    previewPanel?.classList.add('hidden');
  });

  exportCloudBtn?.addEventListener('click', async () => {
    const currentAst = editorCore.getJsonAst();
    const md = MarkdownSerializer.serialize(currentAst);

    if (markdownOutput && previewPanel) {
      markdownOutput.textContent = md;
      previewPanel.classList.remove('hidden');
    }

    const saved = await storageAdapter.saveDocument(docId, {
      title: 'Uscita Escursionistica 2026',
      markdown: md,
      lastModified: Date.now()
    });

    if (saved) {
      console.log('[StorageAdapter] Export completato.');
    }
  });

  // Binding Toggle Lingua
  const langBtn = document.querySelector<HTMLButtonElement>('#btn-toggle-lang');
  langBtn?.addEventListener('click', async () => {
    const nextLocale = i18n.getLocale() === 'it' ? 'en' : 'it';
    await i18n.setLocale(nextLocale);
    langBtn.textContent = `🌐 Lingua: ${nextLocale.toUpperCase()}`;
    saveDbBtn!.textContent = `💾 ${i18n.t('base.editor.save')} (IndexedDB)`;
  });
}

bootstrapApp().catch((err) => console.error('[Bootstrap Error]', err));
