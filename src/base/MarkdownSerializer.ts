import { JsonAstNode } from './Database.js';
import { PluginManager } from './PluginManager.js';

export class MarkdownSerializer {
  /**
   * VINCOLO 5: Serializza l'albero JSON-AST in una stringa Markdown.
   * Percorre l'albero JSON-AST, serializza i nodi strutturali core (Paragraph, Heading, ecc.)
   * in Markdown standard e delega ai plugin la serializzazione dei nodi PluginBlock
   * tramite plugin.serializeToMarkdown(dataState).
   */
  public static serialize(doc: JsonAstNode): string {
    if (!doc || !doc.content || !Array.isArray(doc.content)) {
      return '';
    }

    const outputLines: string[] = [];
    const pluginManager = PluginManager.getInstance();

    for (const node of doc.content) {
      switch (node.type) {
        case 'heading': {
          const level = node.attrs?.level || 1;
          const text = this.extractInlineText(node.content);
          outputLines.push(`${'#'.repeat(level)} ${text}\n`);
          break;
        }
        case 'paragraph': {
          const text = this.extractInlineText(node.content);
          if (text.trim()) {
            outputLines.push(`${text}\n`);
          }
          break;
        }
        case 'pluginBlock': {
          const pluginId = node.attrs?.pluginId || '';
          const dataState = node.attrs?.dataState || {};
          const isOrganizational = Boolean(node.attrs?.isOrganizational);
          const plugin = pluginManager.getPlugin(pluginId);

          let pluginMarkdown = '';
          if (plugin) {
            pluginMarkdown = plugin.serializeToMarkdown(dataState);
          } else {
            pluginMarkdown = `<!-- Block: ${pluginId} -->`;
          }

          // Formattazione con commento HTML per consentire l'import ed il parsing bidirezionale
          outputLines.push(`<!-- plugin:${pluginId} data:${JSON.stringify(dataState)} org:${isOrganizational} -->`);
          outputLines.push(pluginMarkdown);
          outputLines.push(`<!-- /plugin:${pluginId} -->\n`);
          break;
        }
        default: {
          const text = this.extractInlineText(node.content);
          if (text) {
            outputLines.push(`${text}\n`);
          }
          break;
        }
      }
    }

    return outputLines.join('\n');
  }

  private static extractInlineText(content?: JsonAstNode[]): string {
    if (!content || !Array.isArray(content)) return '';
    return content
      .map((child) => {
        if (child.type === 'text') {
          return child.text || '';
        }
        return this.extractInlineText(child.content);
      })
      .join('');
  }

  /**
   * VINCOLO 5: Parse bidirezionale da Markdown esistente a JSON-AST.
   * Ricostruisce l'albero JSON-AST da un file Markdown esistente,
   * trattando i blocchi non riconosciuti come Paragraph semplici (nessuna perdita silenziosa di contenuto).
   */
  public static parse(markdown: string): JsonAstNode {
    const nodes: JsonAstNode[] = [];
    const lines = markdown.split(/\r?\n/);

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Controlla se la riga è l'intestazione di un PluginBlock
      const pluginMatch = line.match(/^<!-- plugin:([^\s]+)\s+data:(.*?)\s+org:(true|false)\s*-->$/);
      if (pluginMatch) {
        const pluginId = pluginMatch[1];
        let dataState = {};
        try {
          dataState = JSON.parse(pluginMatch[2]);
        } catch (e) {
          console.warn(`[MarkdownSerializer] Failed to parse JSON dataState for plugin ${pluginId}`, e);
        }
        const isOrganizational = pluginMatch[3] === 'true';

        // Legge le righe interne del blocco fino al tag di chiusura
        i++;
        while (i < lines.length && !lines[i].match(new RegExp(`^<!-- /plugin:${pluginId} -->$`))) {
          i++;
        }

        nodes.push({
          type: 'pluginBlock',
          attrs: {
            pluginId,
            dataState,
            isOrganizational
          }
        });
        i++;
        continue;
      }

      // Matching per le intestazioni Markdown (# Heading)
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2];
        nodes.push({
          type: 'heading',
          attrs: { level },
          content: [{ type: 'text', text }]
        });
        i++;
        continue;
      }

      // Per qualsiasi altra riga o blocco non riconosciuto, lo converte in Paragraph semplice
      if (line.trim().length > 0) {
        nodes.push({
          type: 'paragraph',
          content: [{ type: 'text', text: line.trim() }]
        });
      }

      i++;
    }

    return {
      type: 'doc',
      content: nodes
    };
  }
}
