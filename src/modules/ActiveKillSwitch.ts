/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import { Dexie } from 'dexie';
import { StorageAdapter, MockStorageAdapter } from './StorageAdapter.js';

export interface SecurityBlacklistPayload {
  revokedUsers?: string[];
  revokedSessions?: string[];
  revokedDevices?: string[];
}

export class ActiveKillSwitch {
  private static instance: ActiveKillSwitch | null = null;
  private storageAdapter: StorageAdapter;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private isExecutingKillSwitch: boolean = false;

  private constructor(adapter?: StorageAdapter) {
    this.storageAdapter = adapter || new MockStorageAdapter();
  }

  public static getInstance(adapter?: StorageAdapter): ActiveKillSwitch {
    if (!ActiveKillSwitch.instance) {
      ActiveKillSwitch.instance = new ActiveKillSwitch(adapter);
    }
    return ActiveKillSwitch.instance;
  }

  /**
   * Avvia il monitoraggio in background con polling debounced ogni 5 minuti (300.000 ms)
   */
  public startSecurityPolling(userId: string, sessionId: string, deviceId: string, intervalMs: number = 300000): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }

    // Esegui immediatamente una prima verifica
    this.checkSecurityStatus(userId, sessionId, deviceId);

    // Polling periodico
    this.pollingTimer = setInterval(async () => {
      await this.checkSecurityStatus(userId, sessionId, deviceId);
    }, intervalMs);
  }

  /**
   * Interroga il file di sicurezza dal cloud ('_Configurazione/session-security.json')
   * e verifica se l'utente, la sessione o il dispositivo fa parte della blacklist.
   */
  public async checkSecurityStatus(userId: string, sessionId: string, deviceId: string): Promise<boolean> {
    if (this.isExecutingKillSwitch) return true;

    try {
      const securityFile = await this.storageAdapter.loadDocument('_Configurazione/session-security.json');

      if (securityFile) {
        const blacklist: SecurityBlacklistPayload = typeof securityFile === 'string' ? JSON.parse(securityFile) : securityFile;

        const isUserRevoked = !!(blacklist.revokedUsers && blacklist.revokedUsers.includes(userId));
        const isSessionRevoked = !!(blacklist.revokedSessions && blacklist.revokedSessions.includes(sessionId));
        const isDeviceRevoked = !!(blacklist.revokedDevices && blacklist.revokedDevices.includes(deviceId));

        if (isUserRevoked || isSessionRevoked || isDeviceRevoked) {
          console.error(`[ActiveKillSwitch] 🚨 TRIGGER SICUREZZA: Revoca rilevata per userId: "${userId}", sessionId: "${sessionId}", deviceId: "${deviceId}". Avvio auto-distruzione locale!`);
          await this.executeLocalSelfDestructSequence();
          return true;
        }
      }
    } catch (err) {
      console.warn('[ActiveKillSwitch] Impossibile verificare il file session-security.json dal cloud:', err);
    }

    return false;
  }

  /**
   * SEQUENZA DI AUTO-DISTRUZIONE LOCALE ATOMICA (Kill-Switch Sequence):
   * 1. Cancellazione Dexie AthanorLocalDB
   * 2. Cancellazione Yjs Storage y-indexeddb
   * 3. Clear localStorage, sessionStorage e cookie
   * 4. Disinstallazione Service Worker PWA
   * 5. Blocco definitivo UI con schermata rossa di sicurezza
   */
  public async executeLocalSelfDestructSequence(): Promise<void> {
    if (this.isExecutingKillSwitch) return;
    this.isExecutingKillSwitch = true;

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    console.error('[ActiveKillSwitch] Executing local self-destruct wipe sequence...');

    // a) Cancellazione Dexie LocalDatabase
    try {
      await new Dexie('AthanorLocalDB').delete();
      console.log('[ActiveKillSwitch] Database Dexie "AthanorLocalDB" eliminato.');
    } catch (e) {
      console.error('[ActiveKillSwitch] Errore nell\'eliminazione del DB Dexie:', e);
    }

    // b) Cancellazione Yjs Storage (y-indexeddb)
    try {
      if (typeof indexedDB !== 'undefined') {
        indexedDB.deleteDatabase('y-indexeddb');
        console.log('[ActiveKillSwitch] Database "y-indexeddb" eliminato.');
      }
    } catch (e) {
      console.error('[ActiveKillSwitch] Errore nell\'eliminazione del DB y-indexeddb:', e);
    }

    // c) Wipe di memoria localStorage & sessionStorage
    try {
      if (typeof localStorage !== 'undefined') localStorage.clear();
      if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
    } catch (e) {
      console.error('[ActiveKillSwitch] Errore nel wipe dello storage del browser:', e);
    }

    // d) Disinstallazione PWA / Service Worker
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.log('[ActiveKillSwitch] Service Worker disinstallato.');
        }
      }
    } catch (e) {
      console.error('[ActiveKillSwitch] Errore nella disinstallazione dei Service Worker:', e);
    }

    // e) Blocco Interfaccia con Schermata Invalicabile
    if (typeof document !== 'undefined') {
      document.body.innerHTML = `
        <div style="position:fixed; inset:0; z-index:999999; background:#0f172a; color:#f8fafc; display:flex; align-items:center; justify-content:center; padding:24px; font-family:system-ui, sans-serif; text-align:center;">
          <div style="max-width:540px; background:#1e293b; border:2px solid #ef4444; padding:32px; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
            <div style="font-size:48px; margin-bottom:16px;">⚠️</div>
            <h1 style="font-size:20px; font-weight:bold; color:#ef4444; margin-bottom:12px; text-transform:uppercase;">Accesso Negato - Sessione Revocata</h1>
            <p style="font-size:13px; color:#94a3b8; line-height:1.6; margin-bottom:20px;">
              Questo dispositivo, utente o sessione è stato revocato dall'amministratore di sicurezza. Tutti i dati locali ed i delta di sincronizzazione presenti su questo dispositivo sono stati distrutti.
            </p>
            <div style="font-size:11px; color:#64748b; border-t:1px solid #334155; pt:12px;">
              Codice Sicurezza: LOCAL_KILL_SWITCH_TRIGGERED
            </div>
          </div>
        </div>
      `;
    }
  }

  public destroy(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    ActiveKillSwitch.instance = null;
  }
}

export const activeKillSwitch = ActiveKillSwitch.getInstance();
