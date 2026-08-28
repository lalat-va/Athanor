/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import { eventBus, EventBus } from '../base/EventBus.js';

export interface SandboxMessage {
  type: string;
  pluginId: string;
  payload?: any;
}

export class SandboxContainer {
  private iframe: HTMLIFrameElement;
  private containerEl: HTMLElement;
  private pluginId: string;
  private bus: EventBus;
  private messageListener: ((event: MessageEvent) => void) | null = null;

  constructor(containerEl: HTMLElement, pluginId: string) {
    this.containerEl = containerEl;
    this.pluginId = pluginId;
    this.bus = eventBus;
    this.iframe = document.createElement('iframe');
    this.setupIframeSandbox();
  }

  /**
   * Configurazione Sandbox dell'Iframe:
   *
   * // SECURITY CONSTRAINT: Do NOT combine 'allow-scripts' with 'allow-same-origin' on plugin iframe. Combining both would allow iframe scripts to bypass origin isolation and inspect/exfiltrate sensitive parent IndexedDB data.
   */
  private setupIframeSandbox(): void {
    this.iframe.className = 'plugin-sandbox-iframe w-full border-0 rounded-md bg-transparent';
    this.iframe.style.height = '350px';

    /**
     * VINCOLO DI SICUREZZA ASSOLUTO:
     * È tassativamente vietato inserire 'allow-same-origin' insieme ad 'allow-scripts'.
     * La combinazione annullerebbe la sandbox permettendo attacchi XSS verso IndexedDB.
     */
    this.iframe.setAttribute('sandbox', 'allow-scripts');

    // Mappatura dei messaggi postMessage bidirezionali verso l'EventBus del Core
    this.messageListener = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      const msg = event.data as SandboxMessage;

      if (msg.pluginId === this.pluginId) {
        console.log(`[SandboxContainer] Ricevuto postMessage dal plugin "${this.pluginId}":`, msg);
        this.bus.emit(`sandbox:${this.pluginId}:${msg.type}`, msg.payload);
      }
    };

    window.addEventListener('message', this.messageListener);
  }

  public mount(srcHtml?: string): void {
    this.containerEl.appendChild(this.iframe);

    if (srcHtml) {
      this.iframe.srcdoc = srcHtml;
    } else {
      this.iframe.srcdoc = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { margin: 0; padding: 12px; font-family: system-ui, sans-serif; color: #f8fafc; background: #0f172a; }
            </style>
          </head>
          <body>
            <div id="plugin-root">
              <div style="font-size:12px; color:#94a3b8;">Plugin Sandbox Container: <b>${this.pluginId}</b></div>
            </div>
          </body>
        </html>
      `;
    }
  }

  public sendMessageToPlugin(type: string, payload?: any): void {
    if (this.iframe.contentWindow) {
      const msg: SandboxMessage = { type, pluginId: this.pluginId, payload };
      this.iframe.contentWindow.postMessage(msg, '*');
    }
  }

  public destroy(): void {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
    }
    if (this.iframe.parentElement) {
      this.iframe.parentElement.removeChild(this.iframe);
    }
  }
}
