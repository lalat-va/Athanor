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

export abstract class AuthAdapter {
  public abstract login(emailOrUser: string, passOrPin: string): Promise<UserSession | null>;
  public abstract logout(): Promise<void>;
  public abstract getSession(): Promise<UserSession | null>;
  public abstract setLocalPin(pin: string): Promise<boolean>;
  public abstract unlockLocalStore(pin: string): Promise<boolean>;
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

    // Sessione predefinita di test offline
    this.currentSession = {
      userId: 'user-001',
      email: 'responsabile@associazione.org',
      firstName: 'Mario',
      lastName: 'Rossi',
      roles: ['Responsabile Legale', 'Responsabile di Spazio'],
      groups: ['direttivo', 'educatori'],
      spacePermissions: {
        'space-general': ['read', 'write', 'delete', 'admin'],
        'space-private': ['read', 'write']
      },
      isAuthenticated: true
    };
  }

  /**
   * Login Mock con Bypass Demo per Administrator ("demo")
   */
  public async login(emailOrUser: string, passOrPin: string): Promise<UserSession | null> {
    if (!emailOrUser || !passOrPin) return null;

    const normalizedUser = emailOrUser.trim().toLowerCase();

    // 1. Validazione credenziali Administrator Demo ("Administrator" / "demo")
    if (normalizedUser === 'administrator' || normalizedUser === 'administrator@local.internal') {
      if (passOrPin !== 'demo') {
        console.warn('[MockAuthAdapter] Password errata per l\'account Administrator.');
        return null;
      }

      this.currentSession = {
        userId: 'admin-001',
        email: 'administrator@local.internal',
        firstName: 'Administrator',
        lastName: 'System',
        roles: ['Administrator'],
        groups: ['amministrazione', 'direttivo'],
        spacePermissions: {
          '*': ['read', 'write', 'delete', 'admin']
        },
        isAuthenticated: true
      };

      try {
        await db.settings.put({
          key: 'current_session',
          value: this.currentSession,
          lastUpdated: Date.now()
        });
      } catch (e) {
        console.warn('[MockAuthAdapter] Errore nel salvataggio della sessione in Dexie:', e);
      }

      console.log('[MockAuthAdapter] Accesso Administrator convalidato (Modalità Demo).');
      return this.currentSession;
    }

    // 2. Login per altri account di test
    this.currentSession = {
      userId: `user-${Date.now()}`,
      email: emailOrUser.trim().toLowerCase(),
      firstName: 'Operatore',
      lastName: 'Locale',
      roles: ['Responsabile di Spazio'],
      groups: ['volontari'],
      spacePermissions: {
        'space-general': ['read', 'write']
      },
      isAuthenticated: true
    };

    try {
      await db.settings.put({
        key: 'current_session',
        value: this.currentSession,
        lastUpdated: Date.now()
      });
    } catch (e) {
      console.warn('[MockAuthAdapter] Errore nel salvataggio della sessione in Dexie:', e);
    }

    return this.currentSession;
  }

  public async logout(): Promise<void> {
    this.currentSession = null;
    try {
      await db.settings.delete('current_session');
    } catch (e) {
      console.warn('[MockAuthAdapter] Errore nell\'eliminazione della sessione da Dexie:', e);
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
      console.warn('[MockAuthAdapter] Errore nel recupero della sessione da Dexie:', e);
    }

    return null;
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
      console.error('[MockAuthAdapter] Errore nel salvataggio del PIN:', e);
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
      console.error('[MockAuthAdapter] Errore durante la verifica del PIN:', e);
      return false;
    }
  }
}
