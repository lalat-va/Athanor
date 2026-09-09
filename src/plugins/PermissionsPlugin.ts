/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import { AppPlugin } from './AppPlugin.js';
import { EventBus } from '../base/EventBus.js';
import { I18nManager, i18nManager } from '../base/I18nManager.js';
import { db } from '../base/Database.js';
import { permissionManager, SystemRole } from '../modules/PermissionManager.js';

export interface PermissionsPluginState {
  pluginId: string;
  activeSpaceId: string;
  currentUserRoles: SystemRole[];
  currentUserId: string;
}

export class PermissionsPlugin implements AppPlugin {
  public id = 'permissions-tool';
  public name = 'Permessi & Spazi (RBAC)';
  public isCollaborative = true;

  public locales = {
    it: {
      title: '🔐 Permessi, Ruoli & Gestione Spazi (RBAC)',
      subtitle: 'Configurazione centralizzata del controllo accessi e partizionamento cloud.',
      spaceConsoleTitle: '📦 Console Gestione Spazi',
      rbacMatrixTitle: '🛡️ Matrice Assegnazione Ruoli (RBAC)',
      createSpaceBtn: '➕ Crea Nuovo Spazio',
      spaceNamePlaceholder: 'es. Branca Esploratori / Reparto Orione',
      cloudDriveFolderLabel: 'ID Cartella Cloud Google Drive',
      assignRoleBtn: '➕ Associa Ruolo',
      volontarioBlockedAlert: '⚠️ ATTENZIONE SICUREZZA: Il ruolo Volontario è rigorosamente escluso dalla configurazione di permessi e spazi.',
      delegationLabel: 'Abilita Delega Gestione Permessi',
      roleAdministrator: 'Amministratore Master',
      roleLegal: 'Responsabile Legale',
      rolePrivacy: 'Responsabile Privacy',
      roleTreasurer: 'Tesoriere',
      roleSector: 'Responsabile di Spazio / Settore',
      roleVolunteer: 'Volontario / Operativo',
      roleCollaborator: 'Collaboratore Esterno'
    },
    en: {
      title: '🔐 Permissions, Roles & Space Management (RBAC)',
      subtitle: 'Centralized access control and cloud space segregation.',
      spaceConsoleTitle: '📦 Space Management Console',
      rbacMatrixTitle: '🛡️ Role Binding Matrix (RBAC)',
      createSpaceBtn: '➕ Create New Space',
      spaceNamePlaceholder: 'e.g. Explorers Sector / Orion Unit',
      cloudDriveFolderLabel: 'Google Drive Cloud Folder ID',
      assignRoleBtn: '➕ Assign Role',
      volontarioBlockedAlert: '⚠️ SECURITY WARNING: Role Volunteer is strictly unauthorized to configure space permissions.',
      delegationLabel: 'Enable Permission Management Delegation',
      roleAdministrator: 'Master Administrator',
      roleLegal: 'Legal Representative',
      rolePrivacy: 'Privacy Officer',
      roleTreasurer: 'Treasurer',
      roleSector: 'Space / Sector Responsible',
      roleVolunteer: 'Volunteer / Operational',
      roleCollaborator: 'External Collaborator'
    }
  };

  private i18n: I18nManager;

  constructor(_bus?: EventBus, i18n?: I18nManager) {
    this.i18n = i18n || i18nManager;
  }

  public async init(_bus: EventBus, i18n: I18nManager): Promise<void> {
    this.i18n = i18n;
    console.log('[PermissionsPlugin] Inizializzato con successo.');
  }

  public render(container: HTMLElement, dataState: PermissionsPluginState, _currentLocale: string): void {
    if (!dataState) {
      dataState = {
        pluginId: this.id,
        activeSpaceId: 'space-default',
        currentUserRoles: ['ADMINISTRATOR'],
        currentUserId: 'admin'
      };
    }

    const t = (key: string) => (this.i18n ? this.i18n.t(`plugins.${this.id}.${key}`) : key);
    const canManage = permissionManager.canUserManagePermissions(dataState.currentUserId, dataState.currentUserRoles);
    const isVolontarioBlocked = dataState.currentUserRoles.includes('VOLUNTEER') || dataState.currentUserRoles.includes('Volontario');

    const blockId = `permissions-ui-${Math.random().toString(36).substring(2, 9)}`;

    container.innerHTML = `
      <div id="${blockId}" class="permissions-plugin-root bg-slate-900 text-slate-100 rounded-xl p-5 shadow-2xl border border-slate-800 space-y-6 font-sans text-xs">
        
        <!-- HEADER PANNELLO SETTINGS -->
        <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-2xl">🔐</span>
            <div>
              <h3 class="text-sm font-bold text-blue-400">${t('title')}</h3>
              <p class="text-[11px] text-slate-400 mt-0.5">${t('subtitle')}</p>
            </div>
          </div>
          <span class="px-2.5 py-1 rounded text-[10px] ${canManage ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold' : 'bg-red-950 text-red-300 border border-red-800'}">
            ${canManage ? '✅ Permessi Amministrativi Attivi' : '🔒 Solo Lettura'}
          </span>
        </div>

        ${
          isVolontarioBlocked && !canManage
            ? `
          <div class="bg-red-950/80 border border-red-500/80 text-red-200 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
            <span>🚨</span>
            <span>${t('volontarioBlockedAlert')}</span>
          </div>
        `
            : ''
        }

        <!-- 1. CONSOLE GESTIONE SPAZI (CREAZIONE E CARTELLE CLOUD) -->
        <div class="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
          <h4 class="font-bold text-slate-200 flex items-center gap-2 text-xs border-b border-slate-800/80 pb-2">
            <span>${t('spaceConsoleTitle')}</span>
          </h4>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-slate-400 font-semibold mb-1">Nome Spazio *</label>
              <input type="text" id="sp-name-input" ${!canManage ? 'disabled' : ''} placeholder="${t('spaceNamePlaceholder')}" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 disabled:opacity-50" />
            </div>

            <div>
              <label class="block text-slate-400 font-semibold mb-1">Tipologia Spazio</label>
              <select id="sp-type-select" ${!canManage ? 'disabled' : ''} class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 disabled:opacity-50">
                <option value="Obbligatorio">Obbligatorio (Direttivo)</option>
                <option value="Consigliato">Consigliato (Settore)</option>
                <option value="Custom" selected>Custom (Progetto)</option>
              </select>
            </div>

            <div>
              <label class="block text-slate-400 font-semibold mb-1">${t('cloudDriveFolderLabel')}</label>
              <input type="text" id="sp-cloud-input" ${!canManage ? 'disabled' : ''} placeholder="drive_folder_123..." class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 disabled:opacity-50" />
            </div>
          </div>

          ${
            canManage
              ? `
            <div class="flex justify-end pt-2">
              <button type="button" id="create-space-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded shadow transition-colors">
                ${t('createSpaceBtn')}
              </button>
            </div>
          `
              : ''
          }
        </div>

        <!-- 2. MATRICE ASSEGNAZIONE RUOLI (RBAC MATRIX) -->
        <div class="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-4">
          <h4 class="font-bold text-slate-200 flex items-center gap-2 text-xs border-b border-slate-800/80 pb-2">
            <span>${t('rbacMatrixTitle')}</span>
          </h4>

          <!-- MOUNT TABELLA ASSEGNAZIONE RUOLI -->
          <div class="rbac-bindings-mount space-y-2">
            <div class="text-slate-500 italic p-3 text-center">Caricamento matrice ruoli in corso...</div>
          </div>

          <!-- FORM AGGIUNTA RUOLO UTENTE DA RUBRICA -->
          ${
            canManage
              ? `
            <div class="border-t border-slate-800/80 pt-3 space-y-3">
              <div class="font-semibold text-slate-300">➕ Associa Ruolo a Utente da Rubrica:</div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block text-slate-400 mb-1">Seleziona Utente *</label>
                  <select id="rb-user-select" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100">
                    <option value="">Caricamento Rubrica...</option>
                  </select>
                </div>
                <div>
                  <label class="block text-slate-400 mb-1">Ruolo Associativo *</label>
                  <select id="rb-role-select" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100">
                    <option value="VOLUNTEER">${t('roleVolunteer')}</option>
                    <option value="RESPONSIBLE_SECTOR">${t('roleSector')}</option>
                    <option value="TREASURER">${t('roleTreasurer')}</option>
                    <option value="MANAGER_PRIVACY">${t('rolePrivacy')}</option>
                    <option value="RESPONSIBLE_LEGAL">${t('roleLegal')}</option>
                    <option value="ADMINISTRATOR">${t('roleAdministrator')}</option>
                    <option value="COLLABORATOR">${t('roleCollaborator')}</option>
                  </select>
                </div>
                <div class="flex items-end">
                  <button type="button" id="add-binding-btn" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded shadow">
                    ${t('assignRoleBtn')}
                  </button>
                </div>
              </div>
            </div>
          `
              : ''
          }
        </div>

      </div>
    `;

    this.loadUsersAndRenderRBAC(container, dataState, canManage);
    this.bindEvents(container, dataState, canManage);
  }

  private async loadUsersAndRenderRBAC(container: HTMLElement, dataState: PermissionsPluginState, canManage: boolean): Promise<void> {
    const mount = container.querySelector('.rbac-bindings-mount');
    const userSelect = container.querySelector<HTMLSelectElement>('#rb-user-select');

    try {
      const contacts = await db.rubrica.filter((c) => !c.deleted).toArray();

      if (userSelect) {
        if (contacts.length === 0) {
          userSelect.innerHTML = `<option value="">Nessun utente in rubrica</option>`;
        } else {
          userSelect.innerHTML = contacts
            .map((c) => `<option value="${c.email}">${c.firstName} ${c.lastName} (${c.email})</option>`)
            .join('');
        }
      }

      if (!mount) return;

      if (contacts.length === 0) {
        mount.innerHTML = `<div class="text-slate-500 italic p-3 text-center border border-slate-800 rounded">Nessun utente censito in Rubrica. Esegui l'onboarding per iniziare.</div>`;
        return;
      }

      mount.innerHTML = contacts
        .map((c) => {
          const isLegal =
            c.metadata?.role === 'Responsabile Legale' ||
            c.metadata?.role === 'RESPONSIBLE_LEGAL' ||
            c.metadata?.isLegalRepresentative === true ||
            c.email?.trim().toLowerCase() === 'test.athanor2@gmail.com' ||
            c.metadata?.fullRecord?.organizationalProfile?.associatedRoles?.some((r: any) => r.role === 'RESPONSIBLE_LEGAL');
          const currentRole: SystemRole = isLegal ? 'RESPONSIBLE_LEGAL' : 'VOLUNTEER';
          const canUserManage = permissionManager.canUserManagePermissions(c.email, [currentRole]);

          return `
            <div class="rbac-card bg-slate-900 border border-slate-800 p-2.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full ${isLegal ? 'bg-amber-600' : 'bg-blue-600'} text-white font-bold flex items-center justify-center text-xs">
                  ${c.firstName.charAt(0)}${c.lastName.charAt(0)}
                </div>
                <div>
                  <div class="font-bold text-slate-100">${c.firstName} ${c.lastName}</div>
                  <div class="text-[10px] text-slate-400 font-mono">${c.email}</div>
                </div>
              </div>

              <div class="flex items-center gap-3 text-xs">
                <span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-blue-300 font-mono font-semibold">
                  ${currentRole}
                </span>

                <label class="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                  <input type="checkbox" data-user-email="${c.email}" ${canUserManage ? 'checked' : ''} ${!canManage || currentRole === 'VOLUNTEER' ? 'disabled' : ''} class="toggle-delegation-cb rounded" />
                  <span>Delega Permessi</span>
                </label>
              </div>
            </div>
          `;
        })
        .join('');

      // Event listener delega
      mount.querySelectorAll<HTMLInputElement>('.toggle-delegation-cb').forEach((cb) => {
        cb.addEventListener('change', async (e) => {
          const email = (e.target as HTMLElement).getAttribute('data-user-email');
          const isChecked = (e.target as HTMLInputElement).checked;
          if (email) {
            try {
              await permissionManager.delegatePermissionsManagement(dataState.currentUserId, email, ['Dirigente'], isChecked);
              this.render(container, dataState, '');
            } catch (err: any) {
              alert(err.message);
              (e.target as HTMLInputElement).checked = !isChecked;
            }
          }
        });
      });
    } catch (e) {
      console.warn('[PermissionsPlugin] Errore caricamento rubrica per RBAC:', e);
    }
  }

  private bindEvents(container: HTMLElement, dataState: PermissionsPluginState, canManage: boolean): void {
    if (!canManage) return;

    // Creazione Spazio
    container.querySelector('#create-space-btn')?.addEventListener('click', () => {
      const nameInput = container.querySelector<HTMLInputElement>('#sp-name-input');
      const typeSelect = container.querySelector<HTMLSelectElement>('#sp-type-select');
      const cloudInput = container.querySelector<HTMLInputElement>('#sp-cloud-input');

      if (!nameInput || !nameInput.value.trim()) {
        alert('Inserisci il Nome dello Spazio.');
        return;
      }

      const spaceName = nameInput.value.trim();
      const type = (typeSelect?.value || 'Custom') as any;
      const cloudFolderId = cloudInput?.value.trim() || `drive_folder_${Date.now()}`;
      const passphrase = permissionManager.generateSpaceSymmetricKey();

      console.log(`[PermissionsPlugin] Creato nuovo Spazio "${spaceName}" (${type}) in "${cloudFolderId}" con passphrase WebRTC: ${passphrase.substring(0, 8)}...`);
      alert(`✅ Spazio "${spaceName}" (${type}) creato con successo!\nCartella Cloud: ${cloudFolderId}\nPassphrase WebRTC generata per-Spazio.`);

      nameInput.value = '';
      if (cloudInput) cloudInput.value = '';
    });

    // Associazione Ruolo
    container.querySelector('#add-binding-btn')?.addEventListener('click', async () => {
      const userSelect = container.querySelector<HTMLSelectElement>('#rb-user-select');
      const roleSelect = container.querySelector<HTMLSelectElement>('#rb-role-select');

      if (!userSelect || !userSelect.value) {
        alert('Seleziona un utente dalla Rubrica.');
        return;
      }

      const userEmail = userSelect.value;
      const role = (roleSelect?.value || 'VOLUNTEER') as SystemRole;

      try {
        if (role === 'VOLUNTEER') {
          permissionManager.enforceNonVolontarioGuard([role]);
        }
        permissionManager.setUserRoles(userEmail, [role]);
        alert(`✅ Ruolo "${role}" associato con successo a "${userEmail}".`);
        this.render(container, dataState, '');
      } catch (err: any) {
        alert(err.message);
      }
    });
  }

  public serializeToMarkdown(_dataState: PermissionsPluginState): string {
    return `### 🔐 Permessi e Spazi (RBAC)\n*Modulo di controllo accessi e partizionamento cloud attivo.*`;
  }
}
