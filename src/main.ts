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
import { AccountingPlugin } from './plugins/AccountingPlugin.js';
import { WarehousePlugin } from './plugins/WarehousePlugin.js';
import { automationEngine } from './modules/AutomationEngine.js';
import { permissionManager } from './modules/PermissionManager.js';
import { CollabService } from './base/CollabService.js';
import { LocalStorageAdapter } from './modules/StorageAdapter.js';
import { MockAuthAdapter, UserSession } from './modules/AuthAdapter.js';
import { ActiveKillSwitch } from './modules/ActiveKillSwitch.js';
import { EditorCore } from './base/EditorCore.js';
import { ShellLayout } from './ui/ShellLayout.js';

async function bootstrapApp(): Promise<void> {
  console.log('[Bootstrap] Avvio Ecosistema Digitale Terzo Settore (PWA Demo Runtime)...');

  // 1. Inizializzazione storage, i18n e servizi di sistema
  const storageAdapter = new LocalStorageAdapter();
  const authAdapter = new MockAuthAdapter();
  await i18nManager.init(db, eventBus);

  // 2. Registrazione Plugin: Mappe, Task Manager, Rubrica (IdP), Permessi (RBAC), Rendicontazione e Magazzino
  const mapPlugin = new MapPlugin();
  const taskPlugin = new TaskPlugin();
  const contactsPlugin = new ContactsPlugin();
  const permissionsPlugin = new PermissionsPlugin();
  const accountingPlugin = new AccountingPlugin();
  const warehousePlugin = new WarehousePlugin();
  await pluginManager.registerPlugin(mapPlugin);
  await pluginManager.registerPlugin(taskPlugin);
  await pluginManager.registerPlugin(contactsPlugin);
  await pluginManager.registerPlugin(permissionsPlugin);
  await pluginManager.registerPlugin(accountingPlugin);
  await pluginManager.registerPlugin(warehousePlugin);

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
      await initializeMainShell(appRoot, docId, mapPlugin, contactsPlugin, permissionsPlugin, authAdapter);
    });
  } else {
    await initializeMainShell(appRoot, docId, mapPlugin, contactsPlugin, permissionsPlugin, authAdapter);
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
  permissionsPlugin: PermissionsPlugin,
  authAdapter: MockAuthAdapter
): Promise<void> {
  const shell = new ShellLayout(container);
  shell.render();
  console.log('[initializeMainShell] Plugins pronti:', { mapPlugin, contactsPlugin, permissionsPlugin });

  const activeSession = await authAdapter.getSession();
  await shell.setSession(activeSession);

  // Ascolta evento disconnessione / cambio utente
  eventBus.on('auth:logout', () => {
    console.log('[main.ts] 🚪 Ricevuta richiesta di disconnessione / cambio utente.');
    showSwitchAccountModal(authAdapter, async (newSession) => {
      console.log('[main.ts] 🔑 Nuova sessione utente convalidata:', newSession.email);
      permissionManager.setUserRoles(newSession.email, newSession.roles as any);
      await shell.setSession(newSession);
    });
  });

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
    eventBus.on('plugin:launch', async (payload: any) => {
      const currentSession = await authAdapter.getSession();
      const userEmail = currentSession?.email || 'test.athanor2@gmail.com';
      const userRoles = currentSession?.roles || ['RESPONSIBLE_LEGAL', 'ADMINISTRATOR'];

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
                openedBy: userEmail,
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
            currentUserRoles: userRoles as any,
            currentUserId: userEmail
          },
          true
        );
      } else if (payload && payload.pluginId === 'accounting-tool') {
        console.log('[main.ts] Inserimento del modulo Rendicontazione & Contabilità nel canvas dell\'editor...');
        editorCore.insertPluginBlock(
          'accounting-tool',
          {
            pluginId: 'accounting-tool',
            activeTab: 'transactions',
            activeFiscalYear: new Date().getFullYear(),
            searchQuery: ''
          },
          true
        );
      } else if (payload && payload.pluginId === 'warehouse-tool') {
        console.log('[main.ts] Inserimento del modulo Magazzino & Logistica nel canvas dell\'editor...');
        editorCore.insertPluginBlock(
          'warehouse-tool',
          {
            pluginId: 'warehouse-tool',
            activeSpaceId: 'space-default',
            searchQuery: ''
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

/**
 * Modale Grafico per il Cambio Utente / Autenticazione con Standard Medio di Sicurezza
 */
function showSwitchAccountModal(
  authAdapter: MockAuthAdapter,
  onSessionAuthenticated: (session: UserSession) => void
): void {
  const modalRoot = document.createElement('div');
  modalRoot.id = 'auth-modal-root';
  document.body.appendChild(modalRoot);

  db.rubrica.toArray().then((contacts) => {
    const userOptionsHtml = [
      `<option value="Administrator">Administrator (Amministratore Master)</option>`,
      `<option value="test.athanor2@gmail.com">Alessio Folli (test.athanor2@gmail.com - Responsabile Legale)</option>`,
      ...contacts
        .filter((c) => c.email && c.email.toLowerCase() !== 'test.athanor2@gmail.com')
        .map((c) => `<option value="${c.email}">${c.firstName} ${c.lastName} (${c.email})</option>`),
      `<option value="custom_email">-- Inserisci altra Email --</option>`
    ].join('');

    modalRoot.innerHTML = `
      <div class="fixed inset-0 z-[99999] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans text-slate-100 text-xs">
        <div class="bg-slate-900 border-2 border-blue-600/80 max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-4">
          
          <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-2xl">🚪</span>
              <div>
                <h3 class="text-md font-bold text-blue-400">Autenticazione & Cambio Utente</h3>
                <p class="text-[11px] text-slate-400">Seleziona un account o inserisci la tua email per accedere all'Ecosistema.</p>
              </div>
            </div>
            <button id="sw-close-btn" class="text-slate-400 hover:text-white font-bold text-base cursor-pointer">✕</button>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Seleziona Account *</label>
              <select id="sw-account-select" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 font-medium focus:border-blue-500 focus:outline-none">
                ${userOptionsHtml}
              </select>
            </div>

            <div id="sw-custom-email-container" class="hidden">
              <label class="block text-slate-300 font-semibold mb-1">Inserisci Email Account *</label>
              <input type="email" id="sw-custom-email" placeholder="utente@associazione.org" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none" />
            </div>

            <div class="space-y-1">
              <label id="sw-pass-label" class="block text-slate-300 font-semibold mb-1">Password *</label>
              <input type="password" id="sw-password-input" placeholder="Password di accesso" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none" />
            </div>

            <!-- Panel Requisiti Prima Configurazione Password per Account non-Admin -->
            <div id="sw-first-pass-banner" class="hidden bg-slate-950 p-3 rounded-lg border border-amber-900/60 space-y-2">
              <div class="font-bold text-amber-400 flex items-center gap-1.5">
                <span>🔑 Prima Configurazione Password (Standard Medio)</span>
              </div>
              <p class="text-[10px] text-slate-400">È richiesta la configurazione di una password che rispetti lo standard medio di sicurezza:</p>
              <div class="grid grid-cols-1 gap-1 text-[11px] font-medium text-slate-400">
                <div id="sw-req-len">🔴 Minimo 14 caratteri</div>
                <div id="sw-req-upper">🔴 Almeno 1 lettera maiuscola (A-Z)</div>
                <div id="sw-req-num">🔴 Almeno 1 numero (0-9)</div>
                <div id="sw-req-spec">🔴 Almeno 1 carattere speciale (!@#$%^&*...)</div>
                <div id="sw-req-noacc">🔴 Non contiene il nome o l'email dell'account</div>
              </div>
            </div>

            <div id="sw-error-msg" class="hidden text-xs text-red-400 font-semibold p-2 rounded bg-red-950/60 border border-red-800"></div>

            <div class="pt-2 flex justify-end gap-2">
              <button type="button" id="sw-cancel-btn" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer">
                Annulla
              </button>
              <button type="button" id="sw-login-btn" class="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold px-5 py-2 rounded-lg shadow transition-colors flex items-center gap-2 cursor-pointer">
                <span>🔑 Accedi con Account</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    const accountSelect = modalRoot.querySelector<HTMLSelectElement>('#sw-account-select');
    const customEmailContainer = modalRoot.querySelector<HTMLElement>('#sw-custom-email-container');
    const customEmailInput = modalRoot.querySelector<HTMLInputElement>('#sw-custom-email');
    const passInput = modalRoot.querySelector<HTMLInputElement>('#sw-password-input');
    const firstPassBanner = modalRoot.querySelector<HTMLElement>('#sw-first-pass-banner');
    const errorMsg = modalRoot.querySelector<HTMLElement>('#sw-error-msg');
    const loginBtn = modalRoot.querySelector<HTMLButtonElement>('#sw-login-btn');
    const closeBtn = modalRoot.querySelector<HTMLButtonElement>('#sw-close-btn');
    const cancelBtn = modalRoot.querySelector<HTMLButtonElement>('#sw-cancel-btn');

    const closeModal = () => {
      modalRoot.remove();
    };

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    const getTargetAccount = (): string => {
      if (accountSelect?.value === 'custom_email') {
        return customEmailInput?.value.trim() || '';
      }
      return accountSelect?.value || '';
    };

    const updateAccountContext = async () => {
      const targetAcc = getTargetAccount();

      if (accountSelect?.value === 'custom_email') {
        customEmailContainer?.classList.remove('hidden');
      } else {
        customEmailContainer?.classList.add('hidden');
      }

      if (errorMsg) errorMsg.classList.add('hidden');

      if (!targetAcc || targetAcc.toLowerCase() === 'administrator') {
        firstPassBanner?.classList.add('hidden');
        return;
      }

      const isConfigured = await authAdapter.isPasswordConfigured(targetAcc);
      if (!isConfigured) {
        firstPassBanner?.classList.remove('hidden');
        updateLiveChecklist();
      } else {
        firstPassBanner?.classList.add('hidden');
      }
    };

    const updateLiveChecklist = () => {
      const targetAcc = getTargetAccount();
      const pass = passInput?.value || '';
      const val = MockAuthAdapter.validatePasswordSecurity(pass, targetAcc);

      const rLen = modalRoot.querySelector('#sw-req-len');
      const rUpper = modalRoot.querySelector('#sw-req-upper');
      const rNum = modalRoot.querySelector('#sw-req-num');
      const rSpec = modalRoot.querySelector('#sw-req-spec');
      const rNoAcc = modalRoot.querySelector('#sw-req-noacc');

      if (rLen) rLen.innerHTML = val.hasMinLength ? '🟢 Minimo 14 caratteri' : '🔴 Minimo 14 caratteri';
      if (rUpper) rUpper.innerHTML = val.hasUppercase ? '🟢 Almeno 1 lettera maiuscola (A-Z)' : '🔴 Almeno 1 lettera maiuscola (A-Z)';
      if (rNum) rNum.innerHTML = val.hasNumber ? '🟢 Almeno 1 numero (0-9)' : '🔴 Almeno 1 numero (0-9)';
      if (rSpec) rSpec.innerHTML = val.hasSpecialChar ? '🟢 Almeno 1 carattere speciale (!@#$%^&*...)' : '🔴 Almeno 1 carattere speciale (!@#$%^&*...)';
      if (rNoAcc) rNoAcc.innerHTML = val.doesNotContainAccountName ? '🟢 Non contiene il nome o l\'email dell\'account' : '🔴 Non contiene il nome o l\'email dell\'account';
    };

    accountSelect?.addEventListener('change', updateAccountContext);
    customEmailInput?.addEventListener('input', updateAccountContext);
    passInput?.addEventListener('input', () => {
      const targetAcc = getTargetAccount();
      if (targetAcc.toLowerCase() !== 'administrator') {
        updateLiveChecklist();
      }
    });

    updateAccountContext();

    loginBtn?.addEventListener('click', async () => {
      const targetAcc = getTargetAccount();
      const pass = passInput?.value || '';

      if (!targetAcc) {
        if (errorMsg) {
          errorMsg.textContent = '❌ Specifica un account o un indirizzo email valido.';
          errorMsg.classList.remove('hidden');
        }
        return;
      }

      if (targetAcc.toLowerCase() !== 'administrator' && !targetAcc.includes('@')) {
        if (errorMsg) {
          errorMsg.textContent = '❌ Tutti gli account non-administrator devono accedere con un indirizzo Email valido.';
          errorMsg.classList.remove('hidden');
        }
        return;
      }

      try {
        const session = await authAdapter.login(targetAcc, pass);
        if (session) {
          modalRoot.remove();
          onSessionAuthenticated(session);
        } else {
          if (errorMsg) {
            errorMsg.textContent = '❌ Password errata o credenziali non valide.';
            errorMsg.classList.remove('hidden');
          }
        }
      } catch (err: any) {
        if (errorMsg) {
          errorMsg.textContent = `❌ ${err.message}`;
          errorMsg.classList.remove('hidden');
        }
      }
    });
  });
}

bootstrapApp().catch((err) => console.error('[Bootstrap Error]', err));
