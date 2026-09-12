/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

export type SyncStatusType = 'offline' | 'connecting' | 'synced' | 'error';

export interface TaskItemAttributes {
  taskId: string;
  parentId?: string | null;
  taskType: 'OPERATIVO' | 'AMMINISTRATIVO' | 'BUROCRATICO';
  category: 'GENERALE' | 'MAGAZZINO' | 'RENDICONTAZIONE' | 'MENU';
  description: string;
  dueDate?: string | null;
  assigneeId?: string | null;
  completed: boolean;
  completedAt?: number | null;
  completedBy?: string | null;
  openedBy: string;
  interaction?: {
    actionType?: 'ACQUISTA' | 'PRELEVA' | 'RENDICONTA' | 'NESSUNA';
    targetItemId?: string | null;
    quantity?: number;
    cost?: number;
    payload?: Record<string, any>;
  };
}

export interface EventMap {
  'i18n:locale_changed': string;
  'todo:created': any;
  'todo:completed': any;
  'task:created': TaskItemAttributes;
  'task:completed': TaskItemAttributes;
  'task:updated': TaskItemAttributes;
  'sync:status': SyncStatusType;
  'space:changed': { spaceId: string; spaceName: string };
  'storage:mapping_updated': { spaceId: string; mapping: any };
  [key: string]: any;
}

export type EventCallback<T = any> = (data: T) => void;

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  public constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on<K extends keyof EventMap>(event: K | string, callback: EventCallback<EventMap[K]>): void {
    const eventName = String(event);
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(callback as EventCallback);
  }

  public off<K extends keyof EventMap>(event: K | string, callback: EventCallback<EventMap[K]>): void {
    const eventName = String(event);
    const handlers = this.listeners.get(eventName);
    if (handlers) {
      handlers.delete(callback as EventCallback);
      if (handlers.size === 0) {
        this.listeners.delete(eventName);
      }
    }
  }

  public emit<K extends keyof EventMap>(event: K | string, data: EventMap[K]): void {
    const eventName = String(event);
    const handlers = this.listeners.get(eventName);
    if (handlers) {
      handlers.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EventBus] Errore durante l'esecuzione del listener per l'evento "${eventName}":`, error);
        }
      });
    }
  }
}

export const eventBus = EventBus.getInstance();
