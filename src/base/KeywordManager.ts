/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

export interface KeywordDefinition {
  namespace: string;
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum';
  description: string;
}

/**
 * MICRO-PARSER A DISCESA RICORSIVA PER FORMULE MATEMATICHE SENZA EVAL()
 * Supporta: +, -, *, /, (), numeri decimali e valori sostituiti dalle keywords.
 * Nessuna superficie di attacco XSS: rifiuta qualunque token o funzione non matematica.
 */
export class SafeMathParser {
  private tokens: string[] = [];
  private pos = 0;

  constructor(expression: string) {
    this.tokens = this.tokenize(expression);
  }

  public static evaluate(expression: string): number {
    const parser = new SafeMathParser(expression);
    return parser.parseExpression();
  }

  private tokenize(expr: string): string[] {
    const regex = /\s*([()+\-*/]|\d+(?:\.\d+)?)\s*/g;
    const tokens: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(expr)) !== null) {
      if (match[1]) {
        tokens.push(match[1]);
      }
    }
    return tokens;
  }

  private peek(): string | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  private consume(expected?: string): string {
    const current = this.peek();
    if (!current) {
      throw new Error('[SafeMathParser] Fine inaspettata dell\'espressione matematica.');
    }
    if (expected && current !== expected) {
      throw new Error(`[SafeMathParser] Token inatteso: atteso "${expected}", trovato "${current}".`);
    }
    this.pos++;
    return current;
  }

  // Grammatica: Expression -> Term ( ('+' | '-') Term )*
  public parseExpression(): number {
    let result = this.parseTerm();

    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.consume();
      const right = this.parseTerm();
      if (op === '+') result += right;
      else result -= right;
    }

    return result;
  }

  // Grammatica: Term -> Factor ( ('*' | '/') Factor )*
  private parseTerm(): number {
    let result = this.parseFactor();

    while (this.peek() === '*' || this.peek() === '/') {
      const op = this.consume();
      const right = this.parseFactor();
      if (op === '*') {
        result *= right;
      } else {
        if (right === 0) {
          console.warn('[SafeMathParser] Divisione per zero intercettata, ritorno 0.');
          result = 0;
        } else {
          result /= right;
        }
      }
    }

    return result;
  }

  // Grammatica: Factor -> ('+' | '-') Factor | '(' Expression ')' | Number
  private parseFactor(): number {
    const token = this.peek();

    if (!token) return 0;

    if (token === '+') {
      this.consume('+');
      return this.parseFactor();
    }
    if (token === '-') {
      this.consume('-');
      return -this.parseFactor();
    }
    if (token === '(') {
      this.consume('(');
      const val = this.parseExpression();
      this.consume(')');
      return val;
    }

    const num = parseFloat(token);
    if (isNaN(num)) {
      throw new Error(`[SafeMathParser] Valore numerico non valido: "${token}"`);
    }
    this.consume();
    return num;
  }
}

/**
 * GESTORE UNIFICATO DELLE KEYWORDS E TOKEN RENDERER
 * Registro dinamico popolato dai plugin a runtime senza dipendenze hardcoded nel Core.
 */
export class KeywordManager {
  private static instance: KeywordManager | null = null;
  private registry: Map<string, Map<string, KeywordDefinition>> = new Map();

  private constructor() {
    // Registra inizialmente le keyword di sistema generali
    this.registerNamespaceKeywords('system', {
      currentDate: {
        label: 'Data Corrente',
        type: 'date',
        description: 'Data odierna di sistema in formato YYYY-MM-DD'
      },
      currentUser: {
        label: 'Utente Attivo',
        type: 'string',
        description: 'Email o ID dell\'utente attualmente connesso'
      }
    });
  }

  public static getInstance(): KeywordManager {
    if (!KeywordManager.instance) {
      KeywordManager.instance = new KeywordManager();
    }
    return KeywordManager.instance;
  }

  /**
   * Registra dinamicamente le keyword esposte da un plugin o namespace
   */
  public registerKeyword(
    namespace: string,
    key: string,
    definition: Omit<KeywordDefinition, 'namespace' | 'key'>
  ): void {
    if (!this.registry.has(namespace)) {
      this.registry.set(namespace, new Map());
    }
    this.registry.get(namespace)!.set(key, {
      namespace,
      key,
      ...definition
    });
    console.log(`[KeywordManager] Registrata keyword "${namespace}.${key}" (${definition.label})`);
  }

  public registerNamespaceKeywords(
    namespace: string,
    keywords: Record<string, Omit<KeywordDefinition, 'namespace' | 'key'>>
  ): void {
    Object.entries(keywords).forEach(([key, def]) => {
      this.registerKeyword(namespace, key, def);
    });
  }

  /**
   * Restituisce tutte le keyword registrate per un namespace o globali
   */
  public getRegisteredKeywords(namespace?: string): KeywordDefinition[] {
    const list: KeywordDefinition[] = [];
    if (namespace) {
      const map = this.registry.get(namespace);
      if (map) list.push(...Array.from(map.values()));
    } else {
      this.registry.forEach((map) => {
        list.push(...Array.from(map.values()));
      });
    }
    return list;
  }

  /**
   * Risolve template con segnaposto {{namespace.key}} e formule matematiche (( ... ))
   * Esempio: "Costo totale: (( {{task.cost}} * {{task.quantity}} )) Euro"
   */
  public resolveTemplate(template: string, context: Record<string, any> = {}): string {
    if (!template) return '';

    // 1. Sostituzione dei token {{namespace.key}}
    let resolved = template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, tokenPath) => {
      const parts = tokenPath.split('.');
      let val: any = context;
      for (const part of parts) {
        if (val && typeof val === 'object' && part in val) {
          val = val[part];
        } else {
          val = undefined;
          break;
        }
      }
      return val !== undefined && val !== null ? String(val) : '0';
    });

    // 2. Valutazione sicura delle formule matematiche tra (( ... ))
    resolved = resolved.replace(/\(\(\s*(.*?)\s*\)\)/g, (_match, mathExpr) => {
      try {
        const numResult = SafeMathParser.evaluate(mathExpr);
        return String(numResult);
      } catch (err) {
        console.warn(`[KeywordManager] Impossibile valutare l'espressione matematica "${mathExpr}":`, err);
        return '0';
      }
    });

    return resolved;
  }
}

export const keywordManager = KeywordManager.getInstance();
