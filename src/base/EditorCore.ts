/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import { Editor, Node, mergeAttributes } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Heading from '@tiptap/extension-heading';
import { PluginManager } from '../plugins/PluginManager.js';
import { I18nManager } from './I18nManager.js';

/**
 * VINCOLO FONDAMENTALE: TipTap come editor strutturato semantico, non come rich-text editor libero.
 * Le estensioni di formattazione libera da StarterKit (bold, italic, elenchi non vincolati) sono ESPLICITAMENTE DISABILITATE.
 * L'unico modo per inserire contenuto strutturato è tramite il nodo 'pluginBlock'.
 */
export const PluginBlockNode = Node.create({
  name: 'pluginBlock',
  group: 'block',
  content: '',
  selectable: true,
  draggable: true,
  atom: true,

  addAttributes() {
    return {
      pluginId: {
        default: ''
      },
      dataState: {
        default: {}
      },
      isOrganizational: {
        default: false
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-plugin-block]',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return false;
          const element = dom as HTMLElement;
          let dataState = {};
          try {
            dataState = JSON.parse(element.getAttribute('data-state') || '{}');
          } catch (e) {
            console.warn('[PluginBlockNode] Impossibile parsare l\'attributo data-state:', e);
          }
          return {
            pluginId: element.getAttribute('data-plugin-id') || '',
            dataState,
            isOrganizational: element.getAttribute('data-is-organizational') === 'true'
          };
        }
      }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-plugin-block': '',
        'data-plugin-id': HTMLAttributes.pluginId,
        'data-state': JSON.stringify(HTMLAttributes.dataState || {}),
        'data-is-organizational': String(HTMLAttributes.isOrganizational)
      })
    ];
  },

  /**
   * NodeView per PluginBlock con isolamento completo degli eventi ProseMirror (stopEvent & ignoreMutation).
   */
  addNodeView() {
    return ({ node }) => {
      const container = document.createElement('div');
      container.className = 'plugin-block-container my-3 rounded-md border border-slate-700 bg-slate-900 p-3 shadow-sm';
      container.setAttribute('data-plugin-id', node.attrs.pluginId);

      // Blocco della propagazione degli eventi da tastiera ed input verso ProseMirror
      ['keydown', 'keyup', 'keypress', 'input', 'change'].forEach((eventType) => {
        container.addEventListener(eventType, (e) => {
          e.stopPropagation();
        });
      });

      const pluginManager = PluginManager.getInstance();
      const i18n = I18nManager.getInstance();
      const plugin = pluginManager.getPlugin(node.attrs.pluginId);

      if (plugin) {
        plugin.render(container, node.attrs.dataState, i18n.getLocale());
      } else {
        container.innerHTML = `<div class="text-slate-400 text-xs italic p-2 border border-dashed border-slate-700 rounded bg-slate-950/40">In attesa del widget plugin: <span class="font-bold font-mono text-blue-400">${node.attrs.pluginId}</span></div>`;
      }

      return {
        dom: container,

        stopEvent() {
          return true;
        },

        ignoreMutation() {
          return true;
        },

        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) return false;
          if (updatedNode.attrs.pluginId !== node.attrs.pluginId) return false;
          return true;
        }
      };
    };
  }
});

export class EditorCore {
  private editor: Editor;

  constructor(element: HTMLElement, initialContent?: any) {
    this.editor = new Editor({
      element,
      extensions: [
        Document,
        Paragraph,
        Text,
        Heading.configure({
          levels: [1, 2, 3]
        }),
        PluginBlockNode
      ],
      content: initialContent || {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Canvas Reattivo Inizializzato' }]
          }
        ]
      }
    });
  }

  public getEditor(): Editor {
    return this.editor;
  }

  public getJsonAst(): any {
    return this.editor.getJSON();
  }

  public insertPluginBlock(pluginId: string, dataState: any = {}, isOrganizational: boolean = false): void {
    this.editor.chain().focus().insertContent({
      type: 'pluginBlock',
      attrs: {
        pluginId,
        dataState,
        isOrganizational
      }
    }).run();
  }

  public setContent(content: any): void {
    this.editor.commands.setContent(content);
  }

  public destroy(): void {
    this.editor.destroy();
  }
}
