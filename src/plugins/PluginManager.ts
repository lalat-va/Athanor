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
import { EventBus, eventBus as globalEventBus } from '../base/EventBus.js';
import { I18nManager, i18nManager as globalI18n } from '../base/I18nManager.js';

export class PluginManager {
  private static instance: PluginManager | null = null;
  private plugins: Map<string, AppPlugin> = new Map();
  private eventBus: EventBus;
  private i18n: I18nManager;

  constructor(bus?: EventBus, i18n?: I18nManager) {
    this.eventBus = bus || globalEventBus;
    this.i18n = i18n || globalI18n;
  }

  public static getInstance(bus?: EventBus, i18n?: I18nManager): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager(bus, i18n);
    }
    return PluginManager.instance;
  }

  public async registerPlugin(plugin: AppPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      console.warn(`[PluginManager] Plugin "${plugin.id}" già registrato.`);
      return;
    }

    if (plugin.locales) {
      this.i18n.registerPluginTranslations(plugin.id, plugin.locales);
    }

    if (plugin.init) {
      await plugin.init(this.eventBus, this.i18n);
    }

    this.plugins.set(plugin.id, plugin);
    this.eventBus.emit('plugin:registered', plugin.id);
    console.log(`[PluginManager] Plugin "${plugin.name}" (${plugin.id}) registrato con successo.`);
  }

  public getPlugin(id: string): AppPlugin | undefined {
    return this.plugins.get(id);
  }

  public getAllPlugins(): AppPlugin[] {
    return Array.from(this.plugins.values());
  }
}

export const pluginManager = PluginManager.getInstance();
