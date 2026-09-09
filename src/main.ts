/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import './style.css';
import { db } from './base/Database.js';
import { eventBus } from './base/EventBus.js';
import { i18nManager } from './base/I18nManager.js';
import { pluginManager } from './plugins/PluginManager.js';
import { MapPlugin } from './plugins/MapPlugin.js';
import { TaskPlugin } from './plugins/TaskPlugin.js';
import { ContactsPlugin } from './plugins/ContactsPlugin.js';
import { PermissionsPlugin } from './plugins/PermissionsPlugin.js';
import { automationEngine } from './modules/AutomationEngine.js';
import { permissionManager } from './modules/PermissionManager.js';
import { CollabService } from './base/CollabService.js';
import { LocalStorageAdapter } from './modules/StorageAdapter.js';
import { MockAuthAdapter } from './modules/AuthAdapter.js';
import { ActiveKillSwitch } from './modules/ActiveKillSwitch.js';
import { EditorCore } from './base/EditorCore.js';
import { ShellLayout } from './ui/ShellLayout.js';

async function bootstrapApp(): Promise<void> {
  console.log('[Bootstrap] Avvio Ecosistema Digitale Terzo Settore (PWA Demo Runtime)...');

  // 1. Inizializzazione storage, i18n e servizi di sistema
  const storageAdapter = new LocalStorageAdapter();
  const authAdapter = new MockAuthAdapter();
  await i18nManager.init(db, eventBus);

  // 2. Registrazione Plugin: Mappe, Task Manager, Rubrica (IdP) e Permessi & Spazi (RBAC)
  const mapPlugin = new MapPlugin();
  const taskPlugin = new TaskPlugin();
  const contactsPlugin = new ContactsPlugin();
  const permissionsPlugin = new PermissionsPlugin();
  await pluginManager.registerPlugin(mapPlugin);
  await pluginManager.registerPlugin(taskPlugin);
  await pluginManager.registerPlugin(contactsPlugin);
  await pluginManager.registerPlugin(permissionsPlugin);

  // 3. Avvio del monitor di sicurezza attivo ActiveKillSwitch (Remote Wipe Polling)
  const activeKillSwitch = ActiveKillSwitch.getInstance(storageAdapter);
  activeKillSwitch.startSecurityPolling('operatore@associazione.org', 'sess-001', 'dev-browser-001', 300000);

  // 4. Inizializzazione CollabService (Yjs + y-indexeddb + CollabNetworkProvider WebRTC P2P)
  const docId = 'doc-associazione-001';
  const spaceId = 'space-default';
  const collabService = new CollabService(docId, storageAdapter, spaceId);
  collabService.setUserPresence({ name: 'Operatore Ente', color: '#2563eb' });

  // 5. Collegamento Y.Doc condiviso al ContactsPlugin, PermissionManager e AutomationEngine
  contactsPlugin.registerYDoc(collabService.doc);
  permissionManager.registerYDoc(spaceId, collabService.doc);
  automationEngine.registerYDoc(spaceId, collabService.doc);

  console.log('[Bootstrap] Moduli base, Rubrica (IdP), Permessi (RBAC), Mappe e Task Manager registrati:', {
    pluginManager,
    collabService,
    automationEngine,
    contactsPlugin,
    permissionsPlugin
  });

  // 6. Allineamento Permessi & Controllo Onboarding Responsabile Legale
  await ensureLegalRepresentativePermissions();
  const isDemoMode = await checkIsDemoMode();
  const hasLegalRep = await checkLegalRepresentativeExists();

  const appRoot = document.querySelector<HTMLDivElement>('#app') || document.body;

  if (!hasLegalRep) {
    showBlockingOnboardingModal(appRoot, isDemoMode, authAdapter, contactsPlugin, async () => {
      await initializeMainShell(appRoot, docId, mapPlugin, contactsPlugin, permissionsPlugin);
    });
  } else {
    await initializeMainShell(appRoot, docId, mapPlugin, contactsPlugin, permissionsPlugin);
  }
}

/**
 * Allinea e garantisce i permessi completi di Responsabile Legale ed Administrator per Alessio Folli (test.athanor2@gmail.com) e qualsiasi RL
 */
async function ensureLegalRepresentativePermissions(): Promise<void> {
  try {
    const contacts = await db.rubrica.toArray();
    for (const c of contacts) {
      const isLegal =
        c.metadata?.role === 'Responsabile Legale' ||
        c.metadata?.role === 'RESPONSIBLE_LEGAL' ||
        c.metadata?.isLegalRepresentative === true ||
        c.email?.trim().toLowerCase() === 'test.athanor2@gmail.com';

      if (isLegal) {
        permissionManager.setUserRoles(c.email, ['RESPONSIBLE_LEGAL', 'ADMINISTRATOR']);
        if (c.metadata?.role !== 'RESPONSIBLE_LEGAL' || !c.metadata?.isLegalRepresentative) {
          c.metadata = {
            ...c.metadata,
            role: 'RESPONSIBLE_LEGAL',
            isLegalRepresentative: true
          };
          await db.rubrica.put(c);
        }
        console.log(`[PermissionManager] Allineati con successo i permessi di Responsabile Legale ed Amministratore per "${c.email}" (${c.firstName} ${c.lastName}).`);
      }
    }
  } catch (e) {
    console.warn('[Bootstrap] Errore nell\'allineamento permessi del Responsabile Legale:', e);
  }
}

/**
 * Controlla se la Modalità Demo è attiva nelle impostazioni di Dexie
 */
async function checkIsDemoMode(): Promise<boolean> {
  try {
    const setting = await db.settings.get('core.is_demo_mode');
    return setting ? !!setting.value : true;
  } catch (e) {
    return true;
  }
}

/**
 * Interroga la tabella rubrica di Dexie per verificare se è presente almeno un Responsabile Legale
 */
async function checkLegalRepresentativeExists(): Promise<boolean> {
  try {
    const contacts = await db.rubrica.filter((c) => !c.deleted).toArray();
    return contacts.some(
      (c) =>
        c.isInternal &&
        (c.metadata?.role === 'Responsabile Legale' ||
          c.metadata?.role === 'RESPONSIBLE_LEGAL' ||
          c.metadata?.isLegalRepresentative === true ||
          c.metadata?.fullRecord?.organizationalProfile?.associatedRoles?.some((r: any) => r.role === 'RESPONSIBLE_LEGAL'))
    );
  } catch (e) {
    console.warn('[Bootstrap] Errore nella verifica del Responsabile Legale in Dexie:', e);
    return false;
  }
}

/**
 * Modale Grafico Invalicabile: Richiede l'autenticazione Administrator e l'onboarding del Responsabile Legale
 */
function showBlockingOnboardingModal(
  container: HTMLElement,
  isDemoMode: boolean,
  authAdapter: MockAuthAdapter,
  contactsPlugin: ContactsPlugin,
  onCompleted: () => Promise<void>
): void {
  let isAdministratorAuthenticated = false;

  container.innerHTML = `
    <div class="fixed inset-0 z-[99999] bg-slate-950 flex items-center justify-center p-4 overflow-y-auto text-slate-100 font-sans">
      <div class="bg-slate-900 border-2 border-red-500/80 max-w-xl w-full rounded-2xl p-6 shadow-2xl space-y-5">
        
        <div class="border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-2xl">🔒</span>
            <h2 class="text-lg font-bold text-red-400">Onboarding Obbligatorio Responsabile Legale</h2>
          </div>
          <p class="text-xs text-slate-400 mt-1">
            Configurazione di sistema richiesta al primo avvio. Autenticati come Amministratore per registrare l'anagrafica ed allegare la nomina del Responsabile Legale.
          </p>
        </div>

        <!-- Banner Informativo Modalità Demo -->
        ${
          isDemoMode
            ? `
          <div class="bg-amber-950/80 border border-amber-500/80 text-amber-200 p-3 rounded-lg text-xs space-y-1 shadow-md">
            <div class="font-bold flex items-center gap-1.5">
              <span>⚠️ MODALITÀ DEMO PRE-ALPHA ATTIVA</span>
            </div>
            <p class="text-[11px] text-amber-300/90 leading-relaxed">
              Per accedere alla console ed eseguire l'onboarding del Responsabile Legale, inserisci le credenziali amministratore di default:
              <br/>
              <strong>Username: Administrator</strong> &nbsp;|&nbsp; <strong>Password: demo</strong>
            </p>
          </div>
        `
            : ''
        }

        <!-- 1. STEP 1: Autenticazione Amministratore -->
        <div id="admin-auth-step" class="space-y-3 border-b border-slate-800 pb-4">
          <h3 class="text-xs font-bold text-slate-200 uppercase tracking-wider">1. Autenticazione Amministratore di Sistema</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Username Amministratore *</label>
              <input type="text" id="admin-user-input" placeholder="Administrator" value="Administrator" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Password Amministratore *</label>
              <input type="password" id="admin-pass-input" placeholder="demo" value="demo" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
          <button type="button" id="admin-auth-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded transition-colors shadow">
            🔑 Autentica Amministratore
          </button>
          <div id="admin-auth-error" class="hidden text-xs text-red-400 font-medium"></div>
        </div>

        <!-- 2. STEP 2: Form Registrazione Responsabile Legale (Disabilitato fino ad autenticazione) -->
        <form id="onboarding-form" class="space-y-3 text-xs opacity-50 pointer-events-none transition-opacity">
          <h3 class="text-xs font-bold text-slate-200 uppercase tracking-wider">2. Anagrafica & Nomina Responsabile Legale</h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Nome *</label>
              <input type="text" id="ob-firstname" required placeholder="Mario" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Cognome *</label>
              <input type="text" id="ob-lastname" required placeholder="Rossi" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Email Istituzionale *</label>
              <input type="email" id="ob-email" required placeholder="legale@associazione.org" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Cellulare *</label>
              <input type="tel" id="ob-phone" required placeholder="+39 333 1234567" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none" />
            </div>
          </div>

          <div>
            <label class="block text-slate-300 font-semibold mb-1">Data di Nascita *</label>
            <input type="date" id="ob-birthdate" required class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none" />
          </div>

          <!-- Upload PDF Nomina -->
          <div class="space-y-1">
            <label class="block text-slate-300 font-semibold">File PDF Nomina Responsabile Legale *</label>
            <input type="file" id="ob-pdf-file" accept=".pdf" required class="w-full text-xs text-slate-400 bg-slate-950 border border-slate-700 rounded p-2 cursor-pointer" />
            <p class="text-[10px] text-slate-500">Allegare la delibera di nomina in formato PDF.</p>
          </div>

          <div class="pt-3 border-t border-slate-800 flex justify-end">
            <button type="submit" id="ob-submit-btn" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-lg shadow-lg transition-colors flex items-center gap-2">
              <span>✅ Convalida & Sblocca Shell</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  // Autenticazione Amministratore
  const authBtn = container.querySelector('#admin-auth-btn');
  const authError = container.querySelector<HTMLElement>('#admin-auth-error');
  const onboardingForm = container.querySelector<HTMLFormElement>('#onboarding-form');

  authBtn?.addEventListener('click', async () => {
    const userInput = (container.querySelector('#admin-user-input') as HTMLInputElement).value;
    const passInput = (container.querySelector('#admin-pass-input') as HTMLInputElement).value;

    const session = await authAdapter.login(userInput, passInput);

    if (session && session.roles.includes('Administrator')) {
      isAdministratorAuthenticated = true;
      authError?.classList.add('hidden');
      if (onboardingForm) {
        onboardingForm.classList.remove('opacity-50', 'pointer-events-none');
      }
      authBtn.textContent = '✅ Amministratore Autenticato';
      authBtn.classList.replace('bg-blue-600', 'bg-emerald-600');
      (container.querySelector('#admin-user-input') as HTMLInputElement).disabled = true;
      (container.querySelector('#admin-pass-input') as HTMLInputElement).disabled = true;
    } else {
      if (authError) {
        authError.textContent = '❌ Credenziali non valide. Inserisci Username: Administrator e Password: demo.';
        authError.classList.remove('hidden');
      }
    }
  });

  // Form Onboarding Responsabile Legale
  onboardingForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!isAdministratorAuthenticated) {
      alert('È necessario autenticarsi prima come Amministratore.');
      return;
    }

    const firstName = (container.querySelector('#ob-firstname') as HTMLInputElement).value.trim();
    const lastName = (container.querySelector('#ob-lastname') as HTMLInputElement).value.trim();
    const email = (container.querySelector('#ob-email') as HTMLInputElement).value.trim();
    const phone = (container.querySelector('#ob-phone') as HTMLInputElement).value.trim();
    const birthDate = (container.querySelector('#ob-birthdate') as HTMLInputElement).value;
    const pdfFile = (container.querySelector('#ob-pdf-file') as HTMLInputElement).files?.[0];

    if (!firstName || !lastName || !email || !phone || !birthDate || !pdfFile) {
      alert('Tutti i campi ed il file PDF di nomina sono obbligatori.');
      return;
    }

    await contactsPlugin.initializeLegalRepresentative(
      { name: firstName, surname: lastName, email, phone, birthDate },
      pdfFile.name
    );

    console.log('[Bootstrap] Onboarding Responsabile Legale completato con successo tramite ContactsPlugin.');
    await onCompleted();
  });
}

/**
 * Inizializza la Shell visiva responsive con Sidebar a Sinistra
 */
async function initializeMainShell(
  container: HTMLElement,
  docId: string,
  mapPlugin: MapPlugin,
  contactsPlugin: ContactsPlugin,
  permissionsPlugin: PermissionsPlugin
): Promise<void> {
  const shell = new ShellLayout(container);
  shell.render();
  console.log('[initializeMainShell] Plugins pronti:', { mapPlugin, contactsPlugin, permissionsPlugin });

  const editorMount = container.querySelector<HTMLElement>('#shell-editor-mount');
  if (editorMount) {
    const existingDoc = await db.documents.get(docId);

    const initialContent = existingDoc?.body || {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Documento Operativo Associazione' }]
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Benvenuti nella shell operativa dell\'Ecosistema Digitale per il Terzo Settore. Per attivare un modulo (Rubrica Anagrafica, Permessi & Spazi, Mappe o Smart Task Manager), clicca sul relativo pulsante nella barra laterale sinistra.'
            }
          ]
        }
      ]
    };

    const editorCore = new EditorCore(editorMount, initialContent);

    /**
     * LISTENER LANCIO PLUGIN:
     * Inserisce i blocchi plugin nel canvas dell'editor su richiesta dell'utente
     */
    eventBus.on('plugin:launch', (payload: any) => {
      if (payload && payload.pluginId === 'map-tool') {
        console.log('[main.ts] Inserimento del modulo Mappe nel canvas dell\'editor...');
        editorCore.insertPluginBlock('map-tool', mapPlugin.createCleanInitialState(), false);
      } else if (payload && payload.pluginId === 'task-tool') {
        console.log('[main.ts] Inserimento del modulo Smart Task Manager nel canvas dell\'editor...');
        editorCore.insertPluginBlock(
          'task-tool',
          {
            pluginId: 'task-tool',
            tasks: [
              {
                taskId: `tsk-init-${Date.now()}`,
                parentId: null,
                taskType: 'OPERATIVO',
                category: 'GENERALE',
                description: 'Verificare materiali e attrezzature prima dell\'uscita',
                dueDate: null,
                assigneeId: null,
                completed: false,
                completedAt: null,
                completedBy: null,
                openedBy: 'segretario@ente.org',
                interaction: { actionType: 'NESSUNA' }
              }
            ]
          },
          true
        );
      } else if (payload && payload.pluginId === 'contacts-tool') {
        console.log('[main.ts] Inserimento del modulo Rubrica Anagrafica (IdP) nel canvas dell\'editor...');
        editorCore.insertPluginBlock(
          'contacts-tool',
          {
            pluginId: 'contacts-tool',
            activeTab: 'internal',
            searchQuery: ''
          },
          true
        );
      } else if (payload && payload.pluginId === 'permissions-tool') {
        console.log('[main.ts] Inserimento della Console Permessi & Spazi (RBAC) nel canvas dell\'editor...');
        editorCore.insertPluginBlock(
          'permissions-tool',
          {
            pluginId: 'permissions-tool',
            activeSpaceId: 'space-default',
            currentUserRoles: ['ADMINISTRATOR'],
            currentUserId: 'admin'
          },
          true
        );
      }
    });

    /**
     * LISTENER CAMBIO SPAZIO DI LAVORO (WORKSPACE SWITCHER):
     * Aggiorna istantaneamente il contesto applicativo ed il canvas dell'editor al cambio dello Spazio selezionato.
     */
    eventBus.on('space:changed', (payload: any) => {
      if (payload && payload.spaceId) {
        console.log(`[main.ts] 🔄 RE-INDIRIZZAMENTO CONTESTO SPAZIO ATTIVO: "${payload.spaceId}" (${payload.spaceName})`);

        // Re-inizializzazione del contenuto editor per lo spazio selezionato
        const newSpaceHeading = {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: `Documento Operativo - ${payload.spaceName}` }]
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `Stai attualmente visualizzando ed operando nello Spazio di Lavoro "${payload.spaceName}" (ID: ${payload.spaceId}). Tutti i dati, verbali, task e contatti caricati sono ora filtrati e sincronizzati per questo specifico ambiente.`
                }
              ]
            }
          ]
        };

        editorCore.setContent(newSpaceHeading);
      }
    });
  }
}

bootstrapApp().catch((err) => console.error('[Bootstrap Error]', err));
