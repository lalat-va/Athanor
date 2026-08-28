/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

export type SystemRole =
  | 'Administrator'
  | 'Responsabile Legale'
  | 'Dirigente'
  | 'Responsabile Sicurezza Aziendale'
  | 'Preposto'
  | 'Responsabile di Spazio'
  | 'Scrittore'
  | 'Commentatore'
  | 'Visualizzatore';

export interface AuthorizationContext {
  documentStatus?: 'draft' | 'published' | 'archived';
  isPrivateBodyAccess?: boolean;
  isPrivateSpace?: boolean;
  hasDedicatedPreposto?: boolean;
}

export class PermissionManager {
  private static instance: PermissionManager | null = null;

  // Mappatura simulata dei ruoli utente negli Spazi (sostituibile con query su DB o Sessione)
  private userRoles: Map<string, Set<SystemRole>> = new Map();
  private spacePrepostoConfigured: Map<string, boolean> = new Map();

  private constructor() {
    // Ruoli predefiniti di test
    this.userRoles.set('user-admin', new Set(['Administrator']));
    this.userRoles.set('user-legale', new Set(['Responsabile Legale']));
    this.userRoles.set('user-001', new Set(['Responsabile Legale', 'Responsabile di Spazio']));
  }

  public static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  /**
   * Registra o imposta la presenza di un Preposto alla sicurezza per uno Spazio
   */
  public setSpacePrepostoConfigured(spaceId: string, configured: boolean): void {
    this.spacePrepostoConfigured.set(spaceId, configured);
  }

  /**
   * Assegna ruoli ad un utente per la gestione delle autorizzazioni
   */
  public setUserRoles(userId: string, roles: SystemRole[]): void {
    this.userRoles.set(userId, new Set(roles));
  }

  public getUserRoles(userId: string): SystemRole[] {
    return Array.from(this.userRoles.get(userId) || []);
  }

  /**
   * Valida l'autorizzazione di un utente per compiere un'azione specifica all'interno di uno Spazio.
   *
   * Client-side ACLs are guardrails to prevent accidental errors, not cryptographic enforcement against local database inspection via browser DevTools.
   */
  public async authorize(
    userId: string,
    spaceId: string,
    action: 'read' | 'write' | 'delete' | 'publish' | 'safety_audit' | 'admin',
    context?: AuthorizationContext
  ): Promise<boolean> {
    const roles = this.getUserRoles(userId);

    if (roles.length === 0) {
      return false;
    }

    const isAdministrator = roles.includes('Administrator');
    const isResponsabileLegale = roles.includes('Responsabile Legale');
    const isDirigente = roles.includes('Dirigente');
    const isResponsabileSicurezza = roles.includes('Responsabile Sicurezza Aziendale');
    const isPreposto = roles.includes('Preposto');
    const isResponsabileSpazio = roles.includes('Responsabile di Spazio');
    const isScrittore = roles.includes('Scrittore');
    const isCommentatore = roles.includes('Commentatore');
    const isVisualizzatore = roles.includes('Visualizzatore');

    /**
     * VINCOLO DI PRIVACY & BYPASS AMMINISTRATIVO (Guardrail applicativo):
     * Il ruolo Administrator sbarra l'accesso in lettura al contenuto testuale (body)
     * dei verbali e dei documenti privati dello Spazio per tutelare la privacy degli associati.
     */
    if (isAdministrator && context?.isPrivateBodyAccess) {
      console.warn(`[PermissionManager] Accesso al corpo del documento privato negato al ruolo Administrator per l'utente "${userId}".`);
      return false;
    }

    // Gli Amministratori possono gestire configurazioni di sistema
    if (isAdministrator && action === 'admin') {
      return true;
    }

    // Responsabile Legale ha accesso globale amministrativo e di controllo
    if (isResponsabileLegale) {
      return true;
    }

    // Dirigente ha accesso standard, ma non automatico alla riservatezza di Spazio non delegata
    if (isDirigente && action !== 'safety_audit') {
      return true;
    }

    /**
     * FALLBACK AUTOMATICO DI SICUREZZA:
     * Se un Preposto alla sicurezza non è configurato per uno Spazio,
     * il ruolo Responsabile di Spazio assume automaticamente i doveri e permessi della sicurezza locale.
     */
    const hasDedicatedPreposto = context?.hasDedicatedPreposto ?? (this.spacePrepostoConfigured.get(spaceId) || false);

    if (action === 'safety_audit') {
      if (isResponsabileSicurezza || isPreposto) return true;
      if (!hasDedicatedPreposto && isResponsabileSpazio) {
        console.log(`[PermissionManager] Fallback sicurezza attivato: Responsabile di Spazio autorizzato come Preposto per lo Spazio "${spaceId}".`);
        return true;
      }
      return false;
    }

    // Autorizzazioni per Responsabile di Spazio
    if (isResponsabileSpazio) {
      return true;
    }

    // Autorizzazioni per Scrittore
    if (isScrittore && (action === 'read' || action === 'write')) {
      return true;
    }

    // Autorizzazioni per Commentatore / Visualizzatore
    if ((isCommentatore || isVisualizzatore) && action === 'read') {
      return true;
    }

    return false;
  }
}

export const permissionManager = PermissionManager.getInstance();
