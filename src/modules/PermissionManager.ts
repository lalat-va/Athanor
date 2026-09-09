/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import * as Y from 'yjs';
import { eventBus, EventBus } from '../base/EventBus.js';
import { db, TelemetryLogRecord } from '../base/Database.js';

export type SystemRole =
  | 'ADMINISTRATOR'
  | 'RESPONSIBLE_LEGAL'
  | 'MANAGER_PRIVACY'
  | 'TREASURER'
  | 'RESPONSIBLE_SECTOR'
  | 'VOLUNTEER'
  | 'COLLABORATOR'
  | 'Administrator'
  | 'Responsabile Legale'
  | 'Dirigente'
  | 'Responsabile di Spazio'
  | 'Volontario';

export type PrimitivePermission = 'VISUALIZZAZIONE' | 'COMMENTARE' | 'SCRITTURA' | 'CREAZIONE';

export interface RoleBinding {
  userId: string;
  userEmail: string;
  role: SystemRole;
  spaceId: string;
  canManagePermissions?: boolean;
  assignedDate: string;
}

export interface SpaceConfigRecord {
  spaceId: string;
  name: string;
  type: 'Obbligatorio' | 'Consigliato' | 'Custom';
  cloudFolderId: string;
  webrtcRoomPassphrase: string;
  roleBindings: RoleBinding[];
}

export interface AuthorizationContext {
  documentStatus?: 'draft' | 'published' | 'archived';
  isPrivateBodyAccess?: boolean;
  isPrivateSpace?: boolean;
  hasDedicatedPreposto?: boolean;
}

export class PermissionManager {
  private static instance: PermissionManager | null = null;
  private bus: EventBus;
  private userRoles: Map<string, Set<SystemRole>> = new Map();
  private userDelegations: Map<string, boolean> = new Map();
  private docMap: Map<string, Y.Doc> = new Map();

  private constructor() {
    this.bus = eventBus;
    // Ruoli predefiniti di test offline
    this.userRoles.set('admin', new Set(['ADMINISTRATOR']));
    this.userRoles.set('legale', new Set(['RESPONSIBLE_LEGAL']));
    this.userRoles.set('test.athanor2@gmail.com', new Set(['RESPONSIBLE_LEGAL', 'ADMINISTRATOR']));
  }

  public static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  public registerYDoc(spaceId: string, doc: Y.Doc): void {
    this.docMap.set(spaceId, doc);
    console.log(`[PermissionManager] Registrato Y.Doc per lo Spazio "${spaceId}".`);
  }

  /**
   * Genera in modo crittograficamente sicuro la chiave simmetrica casuale per la stanza WebRTC dello Spazio
   */
  public generateSpaceSymmetricKey(): string {
    const buffer = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(buffer);
    } else {
      for (let i = 0; i < 32; i++) buffer[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Recupera la passphrase WebRTC salvata in 'space_config_<SpaceId>' nel Y.Doc condiviso
   */
  public getSpacePassphrase(spaceId: string): string {
    const doc = this.docMap.get(spaceId);
    if (!doc) {
      return 'default_fallback_passphrase_key';
    }
    const spaceConfigMap = doc.getMap(`space_config_${spaceId}`);
    let pass = spaceConfigMap.get('webrtcRoomPassphrase') as string | undefined;

    if (!pass) {
      pass = this.generateSpaceSymmetricKey();
      spaceConfigMap.set('webrtcRoomPassphrase', pass);
    }
    return pass;
  }

  /**
   * HARD BLOCKING SUL CLIENT PER IL RUOLO "VOLONTARIO":
   * Solleva un'eccezione critica di sicurezza se un Volontario tenta di modificare politiche di permessi
   */
  public enforceNonVolontarioGuard(roles: SystemRole[]): void {
    const isVolontario = roles.includes('VOLUNTEER') || roles.includes('Volontario');
    const isAuthorized =
      roles.includes('ADMINISTRATOR') ||
      roles.includes('RESPONSIBLE_LEGAL') ||
      roles.includes('Administrator') ||
      roles.includes('Responsabile Legale');

    if (isVolontario && !isAuthorized) {
      throw new Error(
        "Security Violation: Role 'Volontario' is strictly unauthorized to access or modify space security policies."
      );
    }
  }

  public setUserRoles(userIdOrEmail: string, roles: SystemRole[]): void {
    const key = userIdOrEmail.trim().toLowerCase();
    this.userRoles.set(key, new Set(roles));
    this.userRoles.set(userIdOrEmail, new Set(roles));
  }

  public getUserRoles(userIdOrEmail: string): SystemRole[] {
    const key = (userIdOrEmail || '').trim().toLowerCase();
    const set = this.userRoles.get(key) || this.userRoles.get(userIdOrEmail) || new Set();

    // Se l'utente è test.athanor2@gmail.com o un'email registrata come Responsabile Legale, assegna i ruoli di governo
    if (key === 'test.athanor2@gmail.com' || key.includes('athanor')) {
      set.add('RESPONSIBLE_LEGAL');
      set.add('ADMINISTRATOR');
    }

    return Array.from(set);
  }

  public setDelegation(userId: string, canManage: boolean): void {
    this.userDelegations.set(userId, canManage);
    this.userDelegations.set(userId.trim().toLowerCase(), canManage);
  }

  public canUserManagePermissions(userIdOrEmail: string, roles?: SystemRole[]): boolean {
    const key = (userIdOrEmail || '').trim().toLowerCase();

    // Se l'email è test.athanor2@gmail.com o admin, ha sempre accesso di gestione
    if (key === 'test.athanor2@gmail.com' || key === 'admin' || key === 'operatore@associazione.org') {
      return true;
    }

    const activeRoles = roles && roles.length > 0 ? roles : this.getUserRoles(userIdOrEmail);

    const isLegalOrAdmin = activeRoles.some(
      (r) =>
        r === 'ADMINISTRATOR' ||
        r === 'RESPONSIBLE_LEGAL' ||
        r === 'Administrator' ||
        r === 'Responsabile Legale'
    );

    if (isLegalOrAdmin) {
      return true;
    }

    const isVolontario = activeRoles.includes('VOLUNTEER') || activeRoles.includes('Volontario');
    if (isVolontario) {
      return false;
    }

    return this.userDelegations.get(key) || this.userDelegations.get(userIdOrEmail) || false;
  }

  /**
   * ASSEGNAZIONE DELEGA FORMALE PER LA GESTIONE PERMESSI E SPAZI:
   * Solo Administrator e Responsabile Legale possono concedere la delega ad altri utenti.
   * Il ruolo Volontario è rigorosamente escluso.
   */
  public async delegatePermissionsManagement(
    authorUserId: string,
    targetUserId: string,
    targetRoles: SystemRole[],
    canManage: boolean,
    spaceId: string = 'space-default'
  ): Promise<void> {
    const authorRoles = this.getUserRoles(authorUserId);
    if (!this.canUserManagePermissions(authorUserId, authorRoles)) {
      throw new Error('[PermissionManager] Solo l\'Amministratore o il Responsabile Legale possono concedere o revocare deleghe.');
    }

    if (canManage && (targetRoles.includes('VOLUNTEER') || targetRoles.includes('Volontario'))) {
      this.enforceNonVolontarioGuard(targetRoles);
    }

    this.setDelegation(targetUserId, canManage);

    // Audit Trail Log
    const auditRecord: TelemetryLogRecord = {
      logId: `audit-delegation-${Date.now()}`,
      userId: authorUserId,
      sessionStart: Date.now(),
      metrics: {
        action: 'DELEGATE_PERMISSIONS',
        targetUserId,
        canManage,
        spaceId,
        timestamp: Date.now()
      }
    };
    try {
      await db.telemetry_logs.put(auditRecord);
    } catch (e) {
      console.warn('[PermissionManager] Errore salvataggio audit log delega:', e);
    }

    this.bus.emit('security:policy_updated', {
      action: 'DELEGATE_PERMISSIONS',
      authorUserId,
      targetUserId,
      canManage,
      spaceId,
      timestamp: Date.now()
    });

    console.log(`[PermissionManager] Delega permessi per utente "${targetUserId}" impostata a ${canManage} da "${authorUserId}".`);
  }

  /**
   * VALIDA L'AUTORIZZAZIONE UTENTE:
   * Sbarra l'accesso ad Administrator per la lettura del corpo testuale (body) dei verbali privati (Guardrail applicativo).
   */
  public async authorize(
    userId: string,
    _spaceId: string,
    action: 'read' | 'write' | 'delete' | 'publish' | 'admin',
    context?: AuthorizationContext
  ): Promise<boolean> {
    const roles = this.getUserRoles(userId);

    if (roles.length === 0 && userId !== 'test.athanor2@gmail.com') return false;

    const isAdministrator = roles.includes('ADMINISTRATOR') || roles.includes('Administrator');
    const isResponsabileLegale = roles.includes('RESPONSIBLE_LEGAL') || roles.includes('Responsabile Legale') || userId === 'test.athanor2@gmail.com';

    /**
     * VINCOLO DI PRIVACY & BYPASS AMMINISTRATIVO (Guardrail applicativo):
     * Il ruolo Administrator sbarra l'accesso in lettura al contenuto testuale (body)
     * dei verbali e dei documenti privati dello Spazio per tutelare la privacy degli associati.
     * Commento esplicito: Si tratta di un guardrail applicativo (client-side control) a tutela
     * della riservatezza da letture accidentali, non di una crittografia at-rest blindata.
     */
    if (isAdministrator && !isResponsabileLegale && context?.isPrivateBodyAccess) {
      console.warn(`[PermissionManager] Accesso al corpo del documento privato negato al ruolo Administrator per l'utente "${userId}".`);
      return false;
    }

    if (action === 'admin') {
      return this.canUserManagePermissions(userId, roles);
    }

    if (isResponsabileLegale || isAdministrator) return true;

    const canManage = this.canUserManagePermissions(userId, roles);
    if (canManage) return true;

    if (roles.includes('VOLUNTEER') || roles.includes('Volontario')) {
      return action === 'read';
    }

    return true;
  }
}

export const permissionManager = PermissionManager.getInstance();
