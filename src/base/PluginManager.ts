import { EventBus } from './EventBus.js';
import { I18nManager } from './I18nManager.js';

/**
 * Contratto/Interfaccia che ogni Plugin dell'applicazione deve implementare.
 */
export interface AppPlugin {
  id: string;
  name: string;
  locales: {
    it: Record<string, string>;
    en: Record<string, string>;
  };
  /**
   * VINCOLO 3: Se true, dataState deve mappare a un tipo condiviso Yjs (Y.Map/Y.Array).
   * Se false, usa un JSON piatto (last-write-wins per plugin non collaborativi).
   */
  isCollaborative: boolean;
  init(eventBus: EventBus, i18n: I18nManager): Promise<void>;
  render(container: HTMLElement, dataState: any, currentLocale: string): void;
  serializeToMarkdown(dataState: any): string; // Per il serializzatore esterno
}

export class PluginManager {
  private static instance: PluginManager;
  private plugins: Map<string, AppPlugin> = new Map();
  private eventBus: EventBus;
  private i18n: I18nManager;

  constructor(eventBus: EventBus, i18n: I18nManager) {
    this.eventBus = eventBus;
    this.i18n = i18n;
  }

  public static getInstance(eventBus?: EventBus, i18n?: I18nManager): PluginManager {
    if (!PluginManager.instance) {
      if (!eventBus || !i18n) {
        throw new Error('[PluginManager] eventBus and i18n must be provided when instantiating PluginManager for the first time.');
      }
      PluginManager.instance = new PluginManager(eventBus, i18n);
    }
    return PluginManager.instance;
  }

  /**
   * Registra, attiva ed esegue il bootstrap di un plugin, registrando le traduzioni
   * ed iniettando l'istanza dell'EventBus e dell'I18nManager.
   */
  public async registerPlugin(plugin: AppPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      console.warn(`[PluginManager] Plugin with ID "${plugin.id}" is already registered.`);
      return;
    }

    // Registra le traduzioni multilingua del plugin nel gestore I18n centralizzato
    this.i18n.registerPluginTranslations(plugin.id, plugin.locales);

    // Bootstrap asincrono del plugin
    await plugin.init(this.eventBus, this.i18n);

    this.plugins.set(plugin.id, plugin);
    this.eventBus.emit('plugin:registered', plugin.id);
    console.log(`[PluginManager] Plugin "${plugin.name}" (${plugin.id}) successfully registered.`);
  }

  public getPlugin(id: string): AppPlugin | undefined {
    return this.plugins.get(id);
  }

  public getAllPlugins(): AppPlugin[] {
    return Array.from(this.plugins.values());
  }
}
