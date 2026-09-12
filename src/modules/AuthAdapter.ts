/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

// PRODUCTION SAFEGUARD: Default admin credentials ("demo") are strictly restricted to the client-side MockAuthAdapter and environment-gated. Never compile MockAuthAdapter in production builds.

import { db } from '../base/Database.js';

export interface UserSession {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  groups: string[];
  spacePermissions: Record<string, string[]>;
  isAuthenticated: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  doesNotContainAccountName: boolean;
  errors: string[];
}

export abstract class AuthAdapter {
  public abstract login(emailOrUser: string, passOrPin: string): Promise<UserSession | null>;
  public abstract logout(): Promise<void>;
  public abstract getSession(): Promise<UserSession | null>;
  public abstract setLocalPin(pin: string): Promise<boolean>;
  public abstract unlockLocalStore(pin: string): Promise<boolean>;
  public abstract changePassword(emailOrUser: string, oldPass: string, newPass: string): Promise<boolean>;
  public abstract isPasswordConfigured(emailOrUser: string): Promise<boolean>;

  /**
   * VALIDAZIONE STANDARD MEDIO DI SICUREZZA PER PASSWORD:
   * - Minimo 14 caratteri
   * - Almeno 1 numero (0-9)
   * - Almeno 1 lettera maiuscola (A-Z)
   * - Almeno 1 carattere speciale (!@#$%^&*...)
   * - Non deve contenere il nome o l'email dell'account
   */
  public static validatePasswordSecurity(password: string, accountNameOrEmail: string): PasswordValidationResult {
    const p = password || '';
    const acc = accountNameOrEmail || '';

    const hasMinLength = p.length >= 14;
    const hasUppercase = /[A-Z]/.test(p);
    const hasNumber = /[0-9]/.test(p);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(p);

    const username = acc.includes('@') ? acc.split('@')[0].toLowerCase() : acc.toLowerCase();
    const usernameClean = username.replace(/[^a-z0-9]/gi, '');
    const passLower = p.toLowerCase();

    const containsAccountName =
      (usernameClean.length >= 3 && passLower.includes(usernameClean)) ||
      (acc.length >= 3 && passLower.includes(acc.toLowerCase()));

    const doesNotContainAccountName = !containsAccountName;

    const errors: string[] = [];
    if (!hasMinLength) errors.push('La password deve contenere almeno 14 caratteri.');
    if (!hasUppercase) errors.push('La password deve contenere almeno una lettera maiuscola (A-Z).');
    if (!hasNumber) errors.push('La password deve contenere almeno un numero (0-9).');
    if (!hasSpecialChar) errors.push('La password deve contenere almeno un carattere speciale (!@#$%^&*...).');
    if (!doesNotContainAccountName) errors.push("La password non può contenere il nome o l'email dell'account.");

    const isValid = hasMinLength && hasUppercase && hasNumber && hasSpecialChar && doesNotContainAccountName;

    return {
      isValid,
      hasMinLength,
      hasUppercase,
      hasNumber,
      hasSpecialChar,
      doesNotContainAccountName,
      errors
    };
  }
}

export class MockAuthAdapter extends AuthAdapter {
  private currentSession: UserSession | null = null;
  private localPinHash: string | null = null;

  constructor() {
    super();

    // Production Build Safeguard
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD === true) {
      throw new Error('[SECURITY FATAL] MockAuthAdapter e le credenziali di default ("demo") non possono essere utilizzate in ambiente di produzione!');
    }

    // Sessione predefinita
    this.currentSession = {
      userId: 'user-legale-001',
      email: 'test.athanor2@gmail.com',
      firstName: 'Alessio',
      lastName: 'Folli',
      roles: ['Responsabile Legale', 'Administrator'],
      groups: ['direttivo', 'amministrazione'],
      spacePermissions: {
        '*': ['read', 'write', 'delete', 'admin']
      },
      isAuthenticated: true
    };
  }

  public async isPasswordConfigured(emailOrUser: string): Promise<boolean> {
    const normalized = emailOrUser.trim().toLowerCase();
    if (normalized === 'administrator' || normalized === 'administrator@local.internal') {
      return true; // Administrator ha la password demo di default
    }

    try {
      const savedPass = await db.settings.get(`pass_${normalized}`);
      return !!(savedPass && savedPass.value);
    } catch (e) {
      return false;
    }
  }

  /**
   * Login Mock con supporto per Administrator ("demo") e validazione password standard per utenti
   */
  public async login(emailOrUser: string, passOrPin: string): Promise<UserSession | null> {
    if (!emailOrUser || !passOrPin) return null;

    const normalizedUser = emailOrUser.trim().toLowerCase();

    // 1. Account Administrator Master ("Administrator" / "demo")
    if (normalizedUser === 'administrator' || normalizedUser === 'administrator@local.internal') {
      const savedAdminPass = (await db.settings.get('pass_administrator'))?.value || 'demo';
      if (passOrPin !== savedAdminPass) {
        console.warn('[MockAuthAdapter] Password errata per l\'account Administrator.');
        return null;
      }

      this.currentSession = {
        userId: 'admin-001',
        email: 'administrator@local.internal',
        firstName: 'Administrator',
        lastName: 'System',
        roles: ['Administrator', 'ADMINISTRATOR'],
        groups: ['amministrazione', 'direttivo'],
        spacePermissions: { '*': ['read', 'write', 'delete', 'admin'] },
        isAuthenticated: true
      };

      await this.saveSessionToDexie(this.currentSession);
      console.log('[MockAuthAdapter] Accesso Administrator convalidato.');
      return this.currentSession;
    }

    // 2. Login per Responsabile Legale o altri utenti censiti
    const isConfigured = await this.isPasswordConfigured(normalizedUser);

    if (isConfigured) {
      const saved = await db.settings.get(`pass_${normalizedUser}`);
      if (saved && saved.value && saved.value !== passOrPin) {
        console.warn(`[MockAuthAdapter] Password errata per l'account "${normalizedUser}".`);
        return null;
      }
    } else {
      // Prima configurazione password obbligatoria a standard medio di sicurezza (tranne Administrator)
      const val = AuthAdapter.validatePasswordSecurity(passOrPin, normalizedUser);
      if (!val.isValid) {
        throw new Error(`Standard di sicurezza password non soddisfatto: ${val.errors.join(' ')}`);
      }
      await db.settings.put({
        key: `pass_${normalizedUser}`,
        value: passOrPin,
        lastUpdated: Date.now()
      });
      console.log(`[MockAuthAdapter] Prima password configurata con successo a standard medio per "${normalizedUser}".`);
    }

    // Cerca in Rubrica per ricavare nome e ruoli reali
    let firstName = 'Utente';
    let lastName = 'Locale';
    let roles = ['VOLUNTEER'];

    if (normalizedUser === 'test.athanor2@gmail.com') {
      firstName = 'Alessio';
      lastName = 'Folli';
      roles = ['Responsabile Legale', 'Administrator', 'RESPONSIBLE_LEGAL', 'ADMINISTRATOR'];
    } else {
      try {
        const contact = await db.rubrica.filter((c) => c.email.toLowerCase() === normalizedUser).first();
        if (contact) {
          firstName = contact.firstName;
          lastName = contact.lastName;
          const isLegal = contact.metadata?.role === 'Responsabile Legale' || contact.metadata?.isLegalRepresentative;
          roles = isLegal ? ['Responsabile Legale', 'Administrator', 'RESPONSIBLE_LEGAL'] : ['VOLUNTEER'];
        }
      } catch (e) {
        // Fallback
      }
    }

    this.currentSession = {
      userId: `usr-${Date.now()}`,
      email: normalizedUser,
      firstName,
      lastName,
      roles,
      groups: ['associazione'],
      spacePermissions: { '*': ['read', 'write'] },
      isAuthenticated: true
    };

    await this.saveSessionToDexie(this.currentSession);
    return this.currentSession;
  }

  /**
   * CAMBIO PASSWORD PER ADMINISTRATOR E RESPONSABILE LEGALE
   */
  public async changePassword(emailOrUser: string, oldPass: string, newPass: string): Promise<boolean> {
    const normalizedUser = emailOrUser.trim().toLowerCase();

    // Validazione ruoli autorizzati
    const session = await this.getSession();
    const isAuthorized =
      normalizedUser === 'administrator' ||
      normalizedUser === 'test.athanor2@gmail.com' ||
      session?.roles.includes('Administrator') ||
      session?.roles.includes('ADMINISTRATOR') ||
      session?.roles.includes('Responsabile Legale') ||
      session?.roles.includes('RESPONSIBLE_LEGAL');

    if (!isAuthorized) {
      throw new Error('Sicurezza: Il cambio password è riservato esclusivamente all\'Amministratore o al Responsabile Legale.');
    }

    // Per account non-administrator, convalida il nuovo standard di sicurezza
    if (normalizedUser !== 'administrator') {
      const val = AuthAdapter.validatePasswordSecurity(newPass, normalizedUser);
      if (!val.isValid) {
        throw new Error(`Nuova password non valida: ${val.errors.join(' ')}`);
      }
    } else {
      if (newPass.length < 4) {
        throw new Error('La password per Administrator deve contenere almeno 4 caratteri.');
      }
    }

    // Verifica vecchia password
    const currentPass = (await db.settings.get(`pass_${normalizedUser}`))?.value || (normalizedUser === 'administrator' ? 'demo' : '');
    if (currentPass && currentPass !== oldPass) {
      throw new Error('La vecchia password inserita non è corretta.');
    }

    await db.settings.put({
      key: `pass_${normalizedUser}`,
      value: newPass,
      lastUpdated: Date.now()
    });

    console.log(`[MockAuthAdapter] Password modificata con successo per l'account "${normalizedUser}".`);
    return true;
  }

  public async logout(): Promise<void> {
    this.currentSession = null;
    try {
      await db.settings.delete('current_session');
    } catch (e) {
      console.warn('[MockAuthAdapter] Errore eliminazione sessione da Dexie:', e);
    }
  }

  public async getSession(): Promise<UserSession | null> {
    if (this.currentSession) return this.currentSession;

    try {
      const saved = await db.settings.get('current_session');
      if (saved && saved.value) {
        this.currentSession = saved.value;
        return this.currentSession;
      }
    } catch (e) {
      console.warn('[MockAuthAdapter] Errore recupero sessione da Dexie:', e);
    }

    return null;
  }

  private async saveSessionToDexie(session: UserSession): Promise<void> {
    try {
      await db.settings.put({
        key: 'current_session',
        value: session,
        lastUpdated: Date.now()
      });
    } catch (e) {
      console.warn('[MockAuthAdapter] Errore salvataggio sessione in Dexie:', e);
    }
  }

  public async setLocalPin(pin: string): Promise<boolean> {
    if (pin.length < 4) return false;
    this.localPinHash = btoa(pin);
    try {
      await db.settings.put({
        key: 'local_pin_hash',
        value: this.localPinHash,
        lastUpdated: Date.now()
      });
      return true;
    } catch (e) {
      console.error('[MockAuthAdapter] Errore salvataggio PIN:', e);
      return false;
    }
  }

  public async unlockLocalStore(pin: string): Promise<boolean> {
    try {
      const saved = await db.settings.get('local_pin_hash');
      const expectedHash = saved ? saved.value : this.localPinHash;
      if (!expectedHash) return true;
      return btoa(pin) === expectedHash;
    } catch (e) {
      console.error('[MockAuthAdapter] Errore verifica PIN:', e);
      return false;
    }
  }
}
