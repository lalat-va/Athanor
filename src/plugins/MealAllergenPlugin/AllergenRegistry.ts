/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

/**
 * ============================================================================
 * NOME FILE: src/plugins/MealAllergenPlugin/AllergenRegistry.ts
 * ============================================================================
 * DESCRIZIONE:
 * Registro ufficiale dei 14 Allergeni Alimentari normati (Regolamento UE 1169/2011):
 * - Codici, icone, descrizioni conformi alla legislazione sulla sicurezza alimentare
 * - Helper di formattazione badge e validazione
 * ============================================================================
 */

import { AllergenDefinition } from './types.js';

export class AllergenRegistry {
  private static instance: AllergenRegistry;

  private allergens: AllergenDefinition[] = [
    { id: 'all_gluten', code: 'GLUTEN', name: 'Glutine', icon: '🌾', description: 'Cereali contenenti glutine (grano, segale, orzo, avena, farro, kamut).' },
    { id: 'all_crustaceans', code: 'CRUSTACEANS', name: 'Crostacei', icon: '🦐', description: 'Gamberi, scampi, aragoste, granchi e derivati.' },
    { id: 'all_eggs', code: 'EGGS', name: 'Uova', icon: '🥚', description: 'Uova e prodotti a base di uova (maionese, paste all\'uovo, torte).' },
    { id: 'all_fish', code: 'FISH', name: 'Pesce', icon: '🐟', description: 'Pesce fresco o conservato e derivati.' },
    { id: 'all_peanuts', code: 'PEANUTS', name: 'Arachidi', icon: '🥜', description: 'Arachidi, burro d\'arachidi, snack tostati e oli non raffinati.' },
    { id: 'all_soy', code: 'SOY', name: 'Soia', icon: '🌱', description: 'Soia, latte di soia, tofu, salse e proteine vegetali concentrate.' },
    { id: 'all_milk', code: 'MILK', name: 'Latte & Lattosio', icon: '🥛', description: 'Latte di vaccino/capra, yogurt, formaggi, burro e panna.' },
    { id: 'all_nuts', code: 'NUTS', name: 'Frutta a guscio', icon: '🌰', description: 'Mandorle, nocciole, noci, noci di acagiù, noci pecan, pistacchi.' },
    { id: 'all_celery', code: 'CELERY', name: 'Sedano', icon: '🥬', description: 'Sedano da costa o rapa, soffritti, dadi e zuppe pronte.' },
    { id: 'all_mustard', code: 'MUSTARD', name: 'Senape', icon: '🟡', description: 'Semi di senape, salse condimento e marinate.' },
    { id: 'all_sesame', code: 'SESAME', name: 'Sesamo', icon: '🥯', description: 'Semi di sesamo, tahina, pane e cracker arricchiti.' },
    { id: 'all_sulfites', code: 'SULFITES', name: 'Solfiti', icon: '🍷', description: 'Anidride solforosa e solfiti in concentrazione > 10 mg/kg o 10 mg/l.' },
    { id: 'all_lupin', code: 'LUPIN', name: 'Lupini', icon: '🫘', description: 'Lupini in salamoia, farine arricchite e cibi vegani.' },
    { id: 'all_molluscs', code: 'MOLLUSCS', name: 'Molluschi', icon: '🦪', description: 'Cozze, vongole, polpi, seppie, calamari e ostriche.' }
  ];

  public static getInstance(): AllergenRegistry {
    if (!AllergenRegistry.instance) {
      AllergenRegistry.instance = new AllergenRegistry();
    }
    return AllergenRegistry.instance;
  }

  public getAll(): AllergenDefinition[] {
    return [...this.allergens];
  }

  public getByName(name: string): AllergenDefinition | undefined {
    const n = name.trim().toLowerCase();
    return this.allergens.find(
      (a) => a.name.toLowerCase() === n || a.code.toLowerCase() === n
    );
  }

  public getIconForName(name: string): string {
    const allergen = this.getByName(name);
    return allergen ? allergen.icon : '⚠️';
  }

  public renderBadge(name: string): string {
    const icon = this.getIconForName(name);
    return `
      <span class="inline-flex items-center gap-1 bg-amber-950/80 border border-amber-800 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm" title="${name}">
        <span>${icon}</span>
        <span>${name}</span>
      </span>
    `;
  }
}

export const allergenRegistry = AllergenRegistry.getInstance();
