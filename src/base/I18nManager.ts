import { LocalDatabase } from './Database.js';
import { EventBus } from './EventBus.js';

export type SupportedLocale = 'it' | 'en';

export interface LocaleDictionary {
  [locale: string]: Record<string, any>;
}

export class I18nManager {
  private static instance: I18nManager;
  private currentLocale: SupportedLocale = 'it';
  private dictionaries: Map<string, Record<string, any>> = new Map();
  private db: LocalDatabase | null = null;
  private eventBus: EventBus | null = null;
  private isLoaded: boolean = false;

  private constructor() {
    // Dizionari Core di default per Italiano ed Inglese
    this.dictionaries.set('it', {
      base: {
        editor: {
          save: 'Salva documento',
          statusDraft: 'Bozza',
          statusPublished: 'Pubblicato',
          statusRevision: 'In Revisione'
        },
        system: {
          localeChanged: 'Lingua cambiata in'
        }
      }
    });

    this.dictionaries.set('en', {
      base: {
        editor: {
          save: 'Save document',
          statusDraft: 'Draft',
          statusPublished: 'Published',
          statusRevision: 'Revision'
        },
        system: {
          localeChanged: 'Language changed to'
        }
      }
    });
  }

  public static getInstance(): I18nManager {
    if (!I18nManager.instance) {
      I18nManager.instance = new I18nManager();
    }
    return I18nManager.instance;
  }

  /**
   * Flusso di bootstrap esplicito:
   * All'avvio t() funziona in modo sincrono con la lingua di default ('it')
   * mentre la preferenza reale viene caricata asincronamente da IndexedDB.
   * Una volta caricata, il manager notifica il cambio lingua tramite EventBus.
   */
  public async init(db: LocalDatabase, eventBus: EventBus): Promise<void> {
    this.db = db;
    this.eventBus = eventBus;

    try {
      const savedLocale = await this.db.getSetting('locale');
      if (savedLocale && (savedLocale === 'it' || savedLocale === 'en')) {
        this.currentLocale = savedLocale;
      }
    } catch (error) {
      console.warn('[I18nManager] Failed to load saved locale from IndexedDB, falling back to default:', error);
    } finally {
      this.isLoaded = true;
      if (this.eventBus) {
        this.eventBus.emit('locale:changed', this.currentLocale);
      }
    }
  }

  public getLocale(): SupportedLocale {
    return this.currentLocale;
  }

  public isInitialized(): boolean {
    return this.isLoaded;
  }

  public async setLocale(locale: SupportedLocale): Promise<void> {
    if (this.currentLocale === locale) return;
    this.currentLocale = locale;

    if (this.db) {
      await this.db.setSetting('locale', locale);
    }

    if (this.eventBus) {
      this.eventBus.emit('locale:changed', this.currentLocale);
    }
  }

  /**
   * Contratto per consentire ai plugin di registrare le proprie chiavi di traduzione nel gestore centrale.
   */
  public registerPluginTranslations(pluginId: string, locales: { it: Record<string, string>; en: Record<string, string> }): void {
    (['it', 'en'] as const).forEach((lang) => {
      const existing = this.dictionaries.get(lang) || {};
      if (!existing.plugins) {
        existing.plugins = {};
      }
      existing.plugins[pluginId] = {
        ...existing.plugins[pluginId],
        ...locales[lang]
      };
      this.dictionaries.set(lang, existing);
    });
  }

  /**
   * Funzione di traduzione t() per risolvere chiavi nidificate (es. 'base.editor.save').
   */
  public t(key: string, variables?: Record<string, string>): string {
    const keys = key.split('.');
    let dict = this.dictionaries.get(this.currentLocale);

    let result: any = dict;
    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = result[k];
      } else {
        result = undefined;
        break;
      }
    }

    if (typeof result !== 'string') {
      // Fallback alla lingua di default 'it' se la chiave non viene trovata
      const fallbackDict = this.dictionaries.get('it');
      let fallbackResult: any = fallbackDict;
      for (const k of keys) {
        if (fallbackResult && typeof fallbackResult === 'object' && k in fallbackResult) {
          fallbackResult = fallbackResult[k];
        } else {
          fallbackResult = undefined;
          break;
        }
      }
      if (typeof fallbackResult === 'string') {
        result = fallbackResult;
      } else {
        result = key; // Ritorna la chiave stessa come estremo fallback
      }
    }

    if (variables) {
      Object.entries(variables).forEach(([varKey, varVal]) => {
        result = (result as string).replace(new RegExp(`\\{${varKey}\\}`, 'g'), varVal);
      });
    }

    return result as string;
  }
}
