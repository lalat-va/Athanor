/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import { JsonAstNode } from './Database.js';
import { PluginManager } from '../plugins/PluginManager.js';

export class MarkdownSerializer {
  /**
   * Converte l'albero JSON-AST in testo formattato Markdown.
   * Quando incontra un nodo 'pluginBlock', delega la compilazione al plugin relativo.
   */
  public static serialize(doc: JsonAstNode): string {
    if (!doc || !doc.content || !Array.isArray(doc.content)) {
      return '';
    }

    const lines: string[] = [];
    const pluginManager = PluginManager.getInstance();

    doc.content.forEach((node) => {
      switch (node.type) {
        case 'heading': {
          const level = node.attrs?.level || 1;
          const prefix = '#'.repeat(level);
          const text = this.extractTextContent(node);
          lines.push(`${prefix} ${text}\n`);
          break;
        }

        case 'paragraph': {
          const text = this.extractTextContent(node);
          if (text.trim().length > 0) {
            lines.push(`${text}\n`);
          }
          break;
        }

        case 'pluginBlock': {
          const pluginId = node.attrs?.pluginId || '';
          const dataState = node.attrs?.dataState || {};
          const plugin = pluginManager.getPlugin(pluginId);

          lines.push(`<!-- START_PLUGIN_BLOCK:${pluginId} -->`);
          if (plugin && typeof plugin.serializeToMarkdown === 'function') {
            try {
              const pluginMd = plugin.serializeToMarkdown(dataState);
              lines.push(pluginMd);
            } catch (err) {
              console.error(`[MarkdownSerializer] Errore durante la serializzazione del plugin "${pluginId}":`, err);
              lines.push(`*Errore di serializzazione per il modulo ${pluginId}*`);
            }
          } else {
            lines.push(`*Modulo ${pluginId} (dati preservati in JSON)*`);
          }
          lines.push(`<!-- END_PLUGIN_BLOCK:${pluginId} -->\n`);
          break;
        }

        default: {
          const text = this.extractTextContent(node);
          if (text) {
            lines.push(`${text}\n`);
          }
          break;
        }
      }
    });

    return lines.join('\n');
  }

  /**
   * Ricostruisce l'albero JSON-AST da una stringa Markdown.
   * Nessun blocco viene perso silenziosamente: le righe non riconosciute vengono importate come nodi 'paragraph'.
   */
  public static parse(markdown: string): JsonAstNode {
    const rawLines = markdown.split('\n');
    const contentNodes: JsonAstNode[] = [];
    let i = 0;

    while (i < rawLines.length) {
      const line = rawLines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('#')) {
        const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (match) {
          const level = match[1].length;
          const text = match[2];
          contentNodes.push({
            type: 'heading',
            attrs: { level },
            content: [{ type: 'text', text }]
          });
          i++;
          continue;
        }
      }

      if (trimmed.startsWith('<!-- START_PLUGIN_BLOCK:')) {
        const pluginIdMatch = trimmed.match(/<!-- START_PLUGIN_BLOCK:(.*?) -->/);
        const pluginId = pluginIdMatch ? pluginIdMatch[1] : 'unknown';
        i++;
        while (i < rawLines.length && !rawLines[i].trim().startsWith('<!-- END_PLUGIN_BLOCK:')) {
          i++;
        }
        contentNodes.push({
          type: 'pluginBlock',
          attrs: {
            pluginId,
            dataState: {},
            isOrganizational: false
          }
        });
        i++;
        continue;
      }

      if (trimmed.length > 0) {
        contentNodes.push({
          type: 'paragraph',
          content: [{ type: 'text', text: line }]
        });
      }

      i++;
    }

    return {
      type: 'doc',
      content: contentNodes.length > 0 ? contentNodes : [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }]
    };
  }

  private static extractTextContent(node: JsonAstNode): string {
    if (!node.content || !Array.isArray(node.content)) return '';
    return node.content.map((c) => c.text || '').join('');
  }
}
