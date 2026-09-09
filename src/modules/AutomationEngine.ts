/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import * as Y from 'yjs';
import { eventBus, EventBus, TaskItemAttributes } from '../base/EventBus.js';
import { keywordManager } from '../base/KeywordManager.js';

export interface AutomationCondition {
  field: string;
  operator: 'EQUALS' | 'CONTAINS' | 'GREATER_THAN' | 'LESS_THAN';
  value: any;
}

export interface AutomationAction {
  targetModule: 'task' | 'magazzino' | 'accounting';
  actionType: 'CREATE_SUB_TASK' | 'ADD_INVENTORY' | 'RECORD_EXPENSE';
  payloadTemplate: Record<string, any>;
  isAndChain?: boolean;
}

export interface AutomationRule {
  ruleId: string;
  spaceId: string;
  name: string;
  triggerEvent: string; // es. 'task:completed'
  condition?: AutomationCondition;
  actions: AutomationAction[];
}

export class AutomationEngine {
  private static instance: AutomationEngine | null = null;
  private bus: EventBus;
  private activeSpaceId: string = 'space-default';
  private docMap: Map<string, Y.Doc> = new Map();
  private executedRules: Set<string> = new Set(); // Indice locale dei ruleExecutionId

  private constructor() {
    this.bus = eventBus;
    this.setupListeners();
  }

  public static getInstance(): AutomationEngine {
    if (!AutomationEngine.instance) {
      AutomationEngine.instance = new AutomationEngine();
    }
    return AutomationEngine.instance;
  }

  public registerYDoc(spaceId: string, doc: Y.Doc): void {
    this.activeSpaceId = spaceId;
    this.docMap.set(spaceId, doc);
    console.log(`[AutomationEngine] Registrato Y.Doc condiviso per lo Spazio "${spaceId}".`);
  }

  private setupListeners(): void {
    // Intercetta il completamento di un task per innescare le regole
    this.bus.on('task:completed', async (taskData: TaskItemAttributes) => {
      await this.evaluateTrigger('task:completed', taskData, 0);
    });

    this.bus.on('task:created', async (taskData: TaskItemAttributes) => {
      await this.evaluateTrigger('task:created', taskData, 0);
    });
  }

  /**
   * Calcola in modo deterministico il ruleExecutionId per garantire l'idempotenza CRDT:
   * hash(ruleId + "_" + parentTaskId)
   */
  public generateRuleExecutionId(ruleId: string, parentTaskId: string): string {
    const rawStr = `${ruleId}_${parentTaskId}`;
    let hash = 0;
    for (let i = 0; i < rawStr.length; i++) {
      const char = rawStr.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `exec_${ruleId}_${Math.abs(hash)}`;
  }

  /**
   * Recupera le regole salvate ESCLUSIVAMENTE nella Y.Map condivisa dallo Spazio ('space_config_<SpaceId>')
   */
  public getSpaceRules(spaceId: string): AutomationRule[] {
    const doc = this.docMap.get(spaceId);
    if (!doc) return [];

    const spaceConfigMap = doc.getMap(`space_config_${spaceId}`);
    const rulesJson = spaceConfigMap.get('automation_rules') as string | undefined;

    if (!rulesJson) return [];
    try {
      return JSON.parse(rulesJson);
    } catch (e) {
      console.warn('[AutomationEngine] Impossibile parsare automation_rules da Y.Map:', e);
      return [];
    }
  }

  /**
   * Salva una nuova regola nella Y.Map condivisa dello Spazio
   */
  public async saveSpaceRule(rule: AutomationRule): Promise<void> {
    const doc = this.docMap.get(rule.spaceId);
    if (!doc) {
      console.warn(`[AutomationEngine] Y.Doc per lo Spazio "${rule.spaceId}" non trovato.`);
      return;
    }

    const spaceConfigMap = doc.getMap(`space_config_${rule.spaceId}`);
    const currentRules = this.getSpaceRules(rule.spaceId);
    currentRules.push(rule);

    spaceConfigMap.set('automation_rules', JSON.stringify(currentRules));
    console.log(`[AutomationEngine] Regola "${rule.name}" (${rule.ruleId}) salvata in Y.Map condivisa.`);
  }

  /**
   * Valuta le regole condizionali con LOOP GUARD ricorsivo (max 10 livelli di profondità)
   */
  public async evaluateTrigger(
    eventName: string,
    eventData: Record<string, any>,
    depth: number = 0
  ): Promise<void> {
    // LOOP GUARD: Blocco immediato se supera 10 livelli di ricorsione
    if (depth > 10) {
      console.error(`[AutomationEngine] 🚨 LOOP GUARD TRIGGERED! Ricorsione massima superata (depth: ${depth}). Interruzione di sicurezza per evitare DoS locale.`);
      if (typeof alert !== 'undefined') {
        alert('⚠️ ATTENZIONE SICUREZZA: Ciclo di automazioni infinito intercettato e bloccato.');
      }
      return;
    }

    const rules = this.getSpaceRules(this.activeSpaceId);
    const matchingRules = rules.filter((r) => r.triggerEvent === eventName);

    for (const rule of matchingRules) {
      if (this.checkCondition(rule.condition, eventData)) {
        console.log(`[AutomationEngine] Innescata regola "${rule.name}" (Profondità: ${depth})`);
        await this.executeRuleActions(rule, eventData, depth);
      }
    }
  }

  private checkCondition(condition: AutomationCondition | undefined, data: Record<string, any>): boolean {
    if (!condition) return true;

    const val = data[condition.field];
    switch (condition.operator) {
      case 'EQUALS':
        return String(val) === String(condition.value);
      case 'CONTAINS':
        return String(val || '').toLowerCase().includes(String(condition.value).toLowerCase());
      case 'GREATER_THAN':
        return Number(val) > Number(condition.value);
      case 'LESS_THAN':
        return Number(val) < Number(condition.value);
      default:
        return true;
    }
  }

  /**
   * Esegue le azioni definite nella regola garantendo l'IDEMPOTENZA e deduplicazione offline CRDT
   */
  private async executeRuleActions(
    rule: AutomationRule,
    triggerData: Record<string, any>,
    depth: number
  ): Promise<void> {
    const parentTaskId = triggerData.taskId || `task-root-${Date.now()}`;
    const ruleExecutionId = this.generateRuleExecutionId(rule.ruleId, parentTaskId);

    // IDEMPOTENZA: Verifica se l'automazione è già stata eseguita per questo parentTaskId
    if (this.executedRules.has(ruleExecutionId)) {
      console.log(`[AutomationEngine] RuleExecutionId "${ruleExecutionId}" già eseguito in precedenza. Salto per idempotenza CRDT.`);
      return;
    }

    for (const action of rule.actions) {
      // Risoluzione dei template di keyword e formule matematiche sicure via KeywordManager
      const resolvedPayload: Record<string, any> = {};
      Object.entries(action.payloadTemplate).forEach(([k, v]) => {
        if (typeof v === 'string') {
          resolvedPayload[k] = keywordManager.resolveTemplate(v, { task: triggerData, ...triggerData });
        } else {
          resolvedPayload[k] = v;
        }
      });

      if (action.targetModule === 'task' && action.actionType === 'CREATE_SUB_TASK') {
        const subTaskData: TaskItemAttributes = {
          taskId: ruleExecutionId, // Usa l'idempotent ruleExecutionId come taskId
          parentId: parentTaskId,
          taskType: resolvedPayload.taskType || 'OPERATIVO',
          category: resolvedPayload.category || 'GENERALE',
          description: resolvedPayload.description || `Sub-task generato da regola: ${rule.name}`,
          dueDate: resolvedPayload.dueDate || null,
          assigneeId: resolvedPayload.assigneeId || null,
          completed: false,
          completedAt: null,
          completedBy: null,
          openedBy: triggerData.completedBy || triggerData.openedBy || 'system@automation',
          interaction: resolvedPayload.interaction || { actionType: 'NESSUNA' }
        };

        this.executedRules.add(ruleExecutionId);
        console.log(`[AutomationEngine] Generato Sub-Task idempotente "${ruleExecutionId}" con parentId "${parentTaskId}"`);
        this.bus.emit('task:created', subTaskData);

        // Propagazione ricorsiva controllata con depth + 1
        await this.evaluateTrigger('task:created', subTaskData, depth + 1);
      } else if (action.targetModule === 'magazzino') {
        this.executedRules.add(ruleExecutionId);
        console.log(`[AutomationEngine] Innescata mutazione magazzino (${action.actionType}):`, resolvedPayload);
        this.bus.emit('magazzino:update', resolvedPayload);
      } else if (action.targetModule === 'accounting') {
        this.executedRules.add(ruleExecutionId);
        console.log(`[AutomationEngine] Innescata registrazione contabile (${action.actionType}):`, resolvedPayload);
        this.bus.emit('accounting:entry', resolvedPayload);
      }
    }
  }

  public clearExecutedCache(): void {
    this.executedRules.clear();
  }
}

export const automationEngine = AutomationEngine.getInstance();
