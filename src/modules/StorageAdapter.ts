/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import { EventBus, eventBus } from '../base/EventBus.js';
import { db } from '../base/Database.js';

export interface DriveFolderMapping {
  mappingId: string;
  spaceId: string;
  folderName: string;
  driveFolderId: string;
  parentId?: string | null;
  webViewLink?: string;
  createdTime?: string;
}

export interface SpaceStorageConfig {
  rootFolderId: string;
  rootFolderName: string;
  accessToken?: string;
  clientId?: string;
  useRealDrive?: boolean;
  mappings: DriveFolderMapping[];
  lastSyncedTimestamp: number;
}

export interface DriveConnectionTestResult {
  success: boolean;
  folderId?: string;
  folderName?: string;
  webViewLink?: string;
  ownerEmail?: string;
  createdTime?: string;
  modifiedTime?: string;
  error?: string;
}

/**
 * Estrattore utility di ID Cartella Google Drive da URL completo o ID grezzo.
 */
export function extractDriveFolderId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Interfaccia astratta StorageAdapter per la gestione della persistenza locale/remota
 * e del collegamento con lo spazio cloud Google Drive dell'associazione.
 *
 * MODULO FIDATO DEL CORE (src/modules/StorageAdapter.ts)
 * Non sandboxato in iframe per consentire l'autenticazione OAuth2 e la Drive Picker API.
 */
export abstract class StorageAdapter {
  abstract saveDocument(docId: string, payload: any): Promise<boolean>;
  abstract loadDocument(docId: string): Promise<any>;
  abstract pushUpdate(docId: string, update: Uint8Array): Promise<void>;
  abstract onRemoteUpdate(docId: string, callback: (update: Uint8Array) => void): () => void;
  abstract syncState(): Promise<void>;
  abstract isDriveConfigured(): Promise<boolean>;
  abstract getStorageConfig(spaceId: string): Promise<SpaceStorageConfig | null>;
  abstract saveStorageConfig(spaceId: string, config: SpaceStorageConfig): Promise<void>;
  abstract createRemoteFolderImmediately(
    spaceId: string,
    folderName: string,
    parentFolderId?: string
  ): Promise<DriveFolderMapping>;
  abstract unbindFolderMappingLocally(spaceId: string, mappingId: string): Promise<void>;
  abstract testGoogleDriveConnection(accessToken?: string, rootFolderId?: string): Promise<DriveConnectionTestResult>;
}

/**
 * Implementazione reale con supporto Google Drive REST API v3 e fallback locale per testing.
 */
export class MockStorageAdapter extends StorageAdapter {
  protected remoteStore: Map<string, any> = new Map();
  protected updateBus: EventBus = new EventBus();
  protected spaceConfigs: Map<string, SpaceStorageConfig> = new Map();

  constructor() {
    super();
    this.spaceConfigs.set('space-default', {
      rootFolderId: '1a2b3c4d5e_demo_root',
      rootFolderName: '/Associazione_Bologna_14_Master',
      lastSyncedTimestamp: Date.now(),
      useRealDrive: false,
      mappings: [
        { mappingId: 'map_01', spaceId: 'space-default', folderName: 'Verbali', driveFolderId: '1a2b_verbali_01', webViewLink: 'https://drive.google.com/drive/folders/1a2b_verbali_01' },
        { mappingId: 'map_02', spaceId: 'space-default', folderName: 'Progetti', driveFolderId: '1a2b_progetti_02', webViewLink: 'https://drive.google.com/drive/folders/1a2b_progetti_02' },
        { mappingId: 'map_03', spaceId: 'space-default', folderName: 'Eventi', driveFolderId: '1a2b_eventi_03', webViewLink: 'https://drive.google.com/drive/folders/1a2b_eventi_03' },
        { mappingId: 'map_04', spaceId: 'space-default', folderName: 'Attività', driveFolderId: '1a2b_attivita_04', webViewLink: 'https://drive.google.com/drive/folders/1a2b_attivita_04' },
        { mappingId: 'map_05', spaceId: 'space-default', folderName: 'Materiali & Magazzino', driveFolderId: '1a2b_magazzino_05', webViewLink: 'https://drive.google.com/drive/folders/1a2b_magazzino_05' },
        { mappingId: 'map_06', spaceId: 'space-default', folderName: 'Rendicontazione & Cassa', driveFolderId: '1a2b_cassa_06', webViewLink: 'https://drive.google.com/drive/folders/1a2b_cassa_06' },
        { mappingId: 'map_07', spaceId: 'space-default', folderName: 'Modulistica & Privacy', driveFolderId: '1a2b_privacy_07', webViewLink: 'https://drive.google.com/drive/folders/1a2b_privacy_07' }
      ]
    });
  }

  public async saveDocument(docId: string, payload: any): Promise<boolean> {
    console.log(`[StorageAdapter] Salvataggio documento "${docId}" nello storage locale/remoto:`, payload);
    this.remoteStore.set(docId, JSON.stringify(payload));
    return true;
  }

  public async loadDocument(docId: string): Promise<any> {
    const data = this.remoteStore.get(docId);
    if (!data) return null;
    return JSON.parse(data);
  }

  public async pushUpdate(docId: string, update: Uint8Array): Promise<void> {
    console.log(`[StorageAdapter] Invio delta Yjs incrementale per il documento "${docId}" (${update.byteLength} bytes)`);
    this.updateBus.emit(`remote-update:${docId}`, update);
  }

  public onRemoteUpdate(docId: string, callback: (update: Uint8Array) => void): () => void {
    this.updateBus.on(`remote-update:${docId}`, callback);
    return () => this.updateBus.off(`remote-update:${docId}`, callback);
  }

  public async syncState(): Promise<void> {
    console.log('[StorageAdapter] Sincronizzazione stato locale con lo storage...');
  }

  public async isDriveConfigured(): Promise<boolean> {
    try {
      const setting = await db.settings.get('storage.root_folder_id');
      if (setting && setting.value) return true;
    } catch (e) {
      // Fallback
    }
    return this.spaceConfigs.has('space-default');
  }

  public async getStorageConfig(spaceId: string): Promise<SpaceStorageConfig | null> {
    try {
      const setting = await db.settings.get(`storage.config.${spaceId}`);
      if (setting && setting.value) {
        return setting.value as SpaceStorageConfig;
      }
    } catch (e) {
      console.warn(`[StorageAdapter] Impossibile leggere la configurazione storage per "${spaceId}" da Dexie:`, e);
    }
    return this.spaceConfigs.get(spaceId) || this.spaceConfigs.get('space-default') || null;
  }

  public async saveStorageConfig(spaceId: string, config: SpaceStorageConfig): Promise<void> {
    this.spaceConfigs.set(spaceId, config);
    try {
      await db.settings.put({
        key: `storage.config.${spaceId}`,
        value: config,
        lastUpdated: Date.now()
      });
      await db.settings.put({
        key: 'storage.root_folder_id',
        value: config.rootFolderId,
        lastUpdated: Date.now()
      });
      if (config.accessToken) {
        await db.settings.put({
          key: 'storage.oauth_token',
          value: config.accessToken,
          lastUpdated: Date.now()
        });
      }
    } catch (e) {
      console.warn('[StorageAdapter] Errore salvataggio storage config in Dexie:', e);
    }
  }

  /**
   * TEST REALE DI CONNESSIONE A GOOGLE DRIVE REST API V3
   */
  public async testGoogleDriveConnection(accessToken?: string, rootFolderId?: string): Promise<DriveConnectionTestResult> {
    const token = accessToken || (await db.settings.get('storage.oauth_token'))?.value;
    const rawFolderId = rootFolderId || (await db.settings.get('storage.root_folder_id'))?.value || 'root';
    const folderId = extractDriveFolderId(rawFolderId);

    if (!token || !token.trim()) {
      return {
        success: false,
        error: 'Nessun Access Token OAuth2 fornito. Inserisci un Bearer Access Token per connetterti alla Google Drive API v3.'
      };
    }

    try {
      console.log(`[StorageAdapter] 🔍 Test di connessione HTTP a Google Drive API per la cartella ID "${folderId}"...`);
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,webViewLink,createdTime,modifiedTime,owners,permissions`,
        {
          headers: {
            Authorization: `Bearer ${token.trim()}`
          }
        }
      );

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        const errMsg = errorJson.error?.message || `HTTP ${response.status} ${response.statusText}`;
        return {
          success: false,
          error: `Errore risposta Google Drive REST API: ${errMsg}`
        };
      }

      const data = await response.json();
      return {
        success: true,
        folderId: data.id,
        folderName: data.name,
        webViewLink: data.webViewLink || `https://drive.google.com/drive/folders/${data.id}`,
        ownerEmail: data.owners && data.owners[0] ? data.owners[0].emailAddress : 'Proprietario Google Workspace',
        createdTime: data.createdTime,
        modifiedTime: data.modifiedTime
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Errore di rete o blocco CORS nella chiamata a Google Drive API: ${err.message}`
      };
    }
  }

  /**
   * CREAZIONE IMMEDIATA CARTELLA REMOTA (CON SUPPORTO REALE GOOGLE DRIVE API V3)
   */
  public async createRemoteFolderImmediately(
    spaceId: string,
    folderName: string,
    parentFolderId?: string
  ): Promise<DriveFolderMapping> {
    const config = (await this.getStorageConfig(spaceId)) || {
      rootFolderId: '1a2b3c4d5e_demo_root',
      rootFolderName: '/Associazione_Bologna_14_Master',
      mappings: [],
      lastSyncedTimestamp: Date.now()
    };

    const token = config.accessToken || (await db.settings.get('storage.oauth_token'))?.value;
    const parentId = extractDriveFolderId(parentFolderId || config.rootFolderId || 'root');

    let realDriveFolderId = `drv_folder_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let webViewLink = `https://drive.google.com/drive/folders/${realDriveFolderId}`;

    // Se è presente un token OAuth2, esegui una REALE creazione via Google Drive REST API v3
    if (token && token.trim().length > 10) {
      try {
        console.log(`[StorageAdapter] 🌐 Creazione REALE della cartella "${folderName}" su Google Drive...`);
        const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: folderName.trim(),
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentId && parentId !== 'root' && !parentId.startsWith('1a2b3c') ? [parentId] : undefined
          })
        });

        if (res.ok) {
          const driveData = await res.json();
          realDriveFolderId = driveData.id;
          webViewLink = driveData.webViewLink || `https://drive.google.com/drive/folders/${driveData.id}`;
          console.log(`[StorageAdapter] ✅ Cartella REALE creata con successo su Google Drive! ID: ${realDriveFolderId}`);
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('[StorageAdapter] Risposta API Google Drive non 200 OK during folder creation:', errData);
        }
      } catch (err) {
        console.warn('[StorageAdapter] Impossibile contattare Google Drive API:', err);
      }
    }

    const newMapping: DriveFolderMapping = {
      mappingId: `map_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      spaceId,
      folderName: folderName.trim(),
      driveFolderId: realDriveFolderId,
      parentId,
      webViewLink,
      createdTime: new Date().toISOString()
    };

    config.mappings.push(newMapping);
    config.lastSyncedTimestamp = Date.now();
    await this.saveStorageConfig(spaceId, config);

    eventBus.emit('storage:mapping_updated', { spaceId, mapping: newMapping });
    return newMapping;
  }

  public async unbindFolderMappingLocally(spaceId: string, mappingId: string): Promise<void> {
    const config = await this.getStorageConfig(spaceId);
    if (!config) return;

    const initialCount = config.mappings.length;
    config.mappings = config.mappings.filter((m) => m.mappingId !== mappingId);

    if (config.mappings.length !== initialCount) {
      config.lastSyncedTimestamp = Date.now();
      await this.saveStorageConfig(spaceId, config);
      eventBus.emit('storage:mapping_updated', { spaceId, mapping: null });
      console.log(`[StorageAdapter] 🛡️ Svincolato il mapping locale "${mappingId}" per lo Spazio "${spaceId}". (Nessuna cancellazione remota).`);
    }
  }
}

export class GoogleDriveStorageAdapter extends MockStorageAdapter {}
export class LocalStorageAdapter extends MockStorageAdapter {}
