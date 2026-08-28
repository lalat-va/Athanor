/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import { LocalDatabase } from './Database.js';
import { EventBus } from './EventBus.js';

export type LocaleCode = 'it' | 'en';

export interface LocaleDictionary {
  [key: string]: string | LocaleDictionary;
}

const DEFAULT_IT_DICTIONARY: LocaleDictionary = {
  base: {
    app: {
      name: 'Ecosistema Digitale Terzo Settore',
      subtitle: 'Piattaforma reattiva a blocchi strutturati per associazioni ed enti del Terzo Settore'
    },
    editor: {
      save: 'Salva Documento',
      saving: 'Salvataggio in corso...',
      saved: 'Documento salvato',
      error: 'Errore durante il salvataggio'
    },
    sync: {
      offline: 'Modalità Offline',
      connecting: 'Connessione in corso...',
      synced: 'Sincronizzato',
      error: 'Errore di sincronizzazione'
    },
    rubrica: {
      contact: 'Contatto',
      members: 'Membri',
      spaces: 'Spazi'
    }
  }
};

const DEFAULT_EN_DICTIONARY: LocaleDictionary = {
  base: {
    app: {
      name: 'Third Sector Digital Ecosystem',
      subtitle: 'Reactive structured block platform for Non-Profit associations and entities'
    },
    editor: {
      save: 'Save Document',
      saving: 'Saving...',
      saved: 'Document saved',
      error: 'Error saving document'
    },
    sync: {
      offline: 'Offline Mode',
      connecting: 'Connecting...',
      synced: 'Synced',
      error: 'Sync error'
    },
    rubrica: {
      contact: 'Contact',
      members: 'Members',
      spaces: 'Spaces'
    }
  }
};

export class I18nManager {
  private static instance: I18nManager | null = null;
  private currentLocale: LocaleCode = 'it';
  private dictionaries: Record<LocaleCode, LocaleDictionary> = {
    it: DEFAULT_IT_DICTIONARY,
    en: DEFAULT_EN_DICTIONARY
  };
  private pluginDictionaries: Record<string, Record<string, any>> = {};
  private db: LocalDatabase | null = null;
  private eventBus: EventBus | null = null;

  private constructor() {}

  public static getInstance(): I18nManager {
    if (!I18nManager.instance) {
      I18nManager.instance = new I18nManager();
    }
    return I18nManager.instance;
  }

  /**
   * Inizializzazione asincrona: carica la lingua salvata in Dexie 'settings' e notifica l'EventBus
   */
  public async init(database: LocalDatabase, eventBus: EventBus): Promise<void> {
    this.db = database;
    this.eventBus = eventBus;

    try {
      const savedSetting = await this.db.settings.get('user_locale');
      if (savedSetting && (savedSetting.value === 'it' || savedSetting.value === 'en')) {
        const previousLocale = this.currentLocale;
        this.currentLocale = savedSetting.value as LocaleCode;
        if (previousLocale !== this.currentLocale) {
          this.eventBus.emit('i18n:locale_changed', this.currentLocale);
        }
      }
    } catch (error) {
      console.warn('[I18nManager] Impossibile caricare le preferenze lingua da Dexie, uso fallback default:', error);
    }
  }

  /**
   * Traduzione sincrona immediata con supporto a interpolazione variabili {var}
   */
  public t(key: string, variables?: Record<string, string>): string {
    let result = this.resolveKey(key, this.currentLocale);

    if (!result && this.currentLocale !== 'it') {
      result = this.resolveKey(key, 'it');
    }

    if (!result) {
      return key;
    }

    if (variables) {
      Object.keys(variables).forEach((varKey) => {
        result = result!.replace(new RegExp(`\\{${varKey}\\}`, 'g'), variables[varKey]);
      });
    }

    return result;
  }

  private resolveKey(key: string, locale: LocaleCode): string | null {
    const parts = key.split('.');

    // Cerca nei dizionari plugin se il percorso inizia con 'plugins.'
    if (parts[0] === 'plugins' && parts.length >= 3) {
      const pluginId = parts[1];
      const subKey = parts.slice(2).join('.');
      const pluginDict = this.pluginDictionaries[pluginId]?.[locale];
      if (pluginDict) {
        const val = this.getNestedValue(pluginDict, subKey);
        if (typeof val === 'string') return val;
      }
    }

    // Altrimenti cerca nei dizionari di sistema
    const val = this.getNestedValue(this.dictionaries[locale], key);
    return typeof val === 'string' ? val : null;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((prev, curr) => (prev && prev[curr] !== undefined ? prev[curr] : undefined), obj);
  }

  /**
   * Cambia la lingua corrente, persiste la scelta in Dexie ed emette l'evento 'i18n:locale_changed'
   */
  public async setLocale(locale: LocaleCode): Promise<void> {
    if (this.currentLocale === locale) return;

    this.currentLocale = locale;

    if (this.db) {
      try {
        await this.db.settings.put({
          key: 'user_locale',
          value: locale,
          lastUpdated: Date.now()
        });
      } catch (error) {
        console.error('[I18nManager] Errore durante il salvataggio della lingua in Dexie:', error);
      }
    }

    if (this.eventBus) {
      this.eventBus.emit('i18n:locale_changed', locale);
    }
  }

  public getLocale(): LocaleCode {
    return this.currentLocale;
  }

  /**
   * Consente ai plugin utente di registrare dizionari multilingua dinamici
   */
  public registerPluginLocales(pluginId: string, dicts: Record<string, any>): void {
    this.pluginDictionaries[pluginId] = dicts;
    console.log(`[I18nManager] Registrati dizionari multilingua per il plugin "${pluginId}".`);
  }

  public registerPluginTranslations(pluginId: string, dicts: Record<string, any>): void {
    this.registerPluginLocales(pluginId, dicts);
  }
}

export const i18nManager = I18nManager.getInstance();
