export type EventCallback = (...args: any[]) => void;

/**
 * EventBus fortemente tipizzato basato su pattern Publisher-Subscriber.
 * Consente la comunicazione sicura e disaccoppiata tra il Core dell'applicazione,
 * i Moduli di connessione ed i singoli Plugin.
 */
export class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  /**
   * Registra un listener per un determinato evento.
   * Restituisce una funzione di unsubscribe per rimuovere facilmente il listener.
   */
  public on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.off(event, callback);
    };
  }

  /**
   * Rimuove un listener registrato per un determinato evento.
   */
  public off(event: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Notifica tutti i sottoscrittori registrati inviando i dati forniti.
   */
  public emit(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(...args);
        } catch (error) {
          console.error(`[EventBus] Error executing callback for event "${event}":`, error);
        }
      });
    }
  }
}
