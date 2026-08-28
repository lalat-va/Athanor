/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import { EventBus } from '../base/EventBus.js';
import { I18nManager } from '../base/I18nManager.js';

export interface AppPlugin {
  id: string;
  name: string;
  isCollaborative?: boolean;
  locales?: Record<string, any>;
  init?(eventBus: EventBus, i18n: I18nManager): Promise<void>;
  render(container: HTMLElement, dataState: any, locale: string): void;
  serializeToMarkdown(dataState: any): string;
}
