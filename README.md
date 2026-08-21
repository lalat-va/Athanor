# Ecosistema Digitale per il Terzo Settore (Local-First Core Shell)

Questo repository contiene il **Livello BASE** e l'ossatura strutturale di un'applicazione web collaborativa, offline-first e modulare, progettata specificamente per le esigenze gestionali, logistiche e amministrative delle associazioni del Terzo Settore [198, 200]. 

L'applicazione si basa sul principio **"Data-to-Document"**: non è un editor di testo libero tradizionale, ma un layer grafico reattivo che consente agli educatori, volontari e associati di strutturare dati operativi complessi (tabelle spese, inventari materiali, cronoprogrammi, menu alimentari) [198, 199]. Tali dati vengono orchestrati in un albero sintattico JSON interno (JSON-AST) e, solo in fase di pubblicazione, convertiti in documenti formattati di interscambio (Markdown) o di presentazione ufficiale (Google Docs, Fogli o PDF) [198, 202].

## 🏗️ Architettura del Sistema

L'applicazione è strutturata su tre livelli ad accoppiamento debole per garantire sicurezza, modularità ed estensibilità non distruttiva [201]:

1.  **BASE (Core Engine):** Racchiude il motore dell'editor (TipTap/ProseMirror), il database locale offline (IndexedDB gestito tramite Dexie.js), il gestore di sincronizzazione in tempo reale (Yjs CRDT) e il modulo di internazionalizzazione (i18n) [202].
2.  **MODULI (System Services):** Servizi infrastrutturali di sistema (non accessibili direttamente all'utente comune) come la gestione delle connessioni cloud (Storage & Auth Adapter), l'orchestratore di dati, il **Modulo di Gestione Account, Sessioni e Sicurezza**, l'access control list (ACL) e l'interfaccia utente globale [202].
3.  **PLUGIN (User Applications):** Micro-applicativi JavaScript isolati in sandbox che estendono le funzionalità inserendo widget visivi e nodi strutturati all'interno del canvas dell'editor (es. Plugin Attività, Menù, Spese, Verbali, Mappe) [201].

---

## 🌐 Internazionalizzazione (i18n)

La localizzazione è nativa e integrata direttamente nel livello **BASE**. Il sistema è configurato per supportare nativamente la localizzazione dell'interfaccia utente e degli schemi dei plugin, partendo con:
*   🇮🇹 **Italiano (it)** (Lingua di default del sistema locale)
*   🇬🇧 **English (en)**

### Come funziona la localizzazione
*   **Core Locale Manager:** Gestisce lo stato della lingua attiva memorizzandolo nelle preferenze locali di IndexedDB.
*   **Plugin Localization Contract:** Ogni plugin definisce un dizionario di traduzioni (`locales`) associato alle chiavi dei propri schemi e componenti UI, consentendo la traduzione automatica in base alla lingua di sistema selezionata.

---

## 🛠️ Struttura delle Cartelle

```directory
local-first-app-core/
├── src/
│   ├── base/               # Livello BASE (Core Engine)
│   │   ├── Database.ts     # Database locale IndexedDB (Dexie.js)
│   │   ├── EditorCore.ts   # Configurazione TipTap e schema dei Nodi Custom
│   │   ├── EventBus.ts     # Canale eventi centralizzato (Pub/Sub)
│   │   ├── PluginManager.ts# Caricamento e ciclo di vita dei Plugin
│   │   ├── CollabService.ts# Sincronizzazione in tempo reale (Yjs CRDT)
│   │   └── I18nManager.ts  # Servizio di localizzazione (IT/EN)
│   │
│   ├── modules/            # Livello MODULI (Servizi di Sistema)
│   │   ├── StorageAdapter.ts# Interfaccia astratta e Mock di sincronizzazione cloud
│   │   ├── AuthAdapter.ts   # Astrazione autenticazione (Google OAuth2 / Local)
│   │   └── PermissionMgr.ts # Gestione di Gruppi, Ruoli e Permessi (ACL)
│   │
│   ├── plugins/            # Livello PLUGIN (Micro-applicativi utente)
│   │   └── mock/           # Semplice plugin di prova per debug
│   │
│   ├── main.ts             # Entry point di bootstrap dell'applicazione
│   └── index.html          # Shell HTML della Web App / PWA
├── package.json            # Gestione dipendenze e script npm
├── tsconfig.json           # Configurazione TypeScript (Strict Mode)
└── README.md               # Questa guida tecnica
```

---

## 🚀 Requisiti e Avvio in Locale

### Prerequisiti
*   **Node.js** v20 o superiore (LTS consigliata)
*   **NPM** v10 o superiore

### Installazione ed Esecuzione
1.  Installa le dipendenze locali di progetto:
    ```bash
    npm install
    ```
2.  Avvia l'ambiente di sviluppo locale (Vite):
    ```bash
    npm run dev
    ```
3.  Compila l'applicazione per la produzione (TypeScript + Vite Bundler):
    ```bash
    npm run build
    ```

---


---

## 🔐 Modulo Gestione Account, Sessioni e Sicurezza (Componente Critico)

Questo modulo, operando a cavallo tra il livello **BASE** (per l'esecuzione del Kill-Switch locale e la cifratura del database) e il livello **MODULI** (per l'interfacciamento con il controllo accessi e il cloud), è un componente critico per garantire la sicurezza "Privacy by Design" e la conformità rigorosa al GDPR [189].

### Funzionalità Principali:

1.  **Sincronizzazione delle Preferenze (Zero-Server):** Memorizza le impostazioni dell'utente (tema grafico visivo, impostazioni i18n, layout della dashboard) in locale (IndexedDB) e le sincronizza tramite file di configurazione cifrati nel cloud dell'organizzazione, mantenendo l'architettura a costo di gestione zero [102, 103].
2.  **Cifratura Locale At-Rest (PIN/Password):** Per computer o tablet condivisi (es. in sede associativa o dispositivi di famiglia), il modulo permette di impostare una password o un PIN locale a 6 cifre che funge da chiave crittografica per IndexedDB. Senza questa chiave, i dati locali rimangono inaccessibili ed indecifrabili.
3.  **Cancellazione Remota & Kill-Switch (Remote Wipe):**
    Un meccanismo flessibile ed efficace per mitigare il rischio di violazione dei dati (Data Breach) in caso di furto, smarrimento del dispositivo, o de-provisioning dell'utente [189]:
    *   **Iniziatore Utente:** L'utente può accedere da un dispositivo sicuro e dichiarare lo smarrimento di un altro suo terminale, revocando i token OAuth e scrivendo l'ID del device smarrito nel file di sicurezza cloud (`session-security.json`).
    *   **Iniziatore Amministrativo (Administrator):** L'utente con ruolo "Administrator" ha il controllo centralizzato e può avviare la disconnessione e la cancellazione remota per qualsiasi account e dispositivo registrato nell'organizzazione.
    *   **Delega dei Poteri Amministrativi:** L'Administrator può delegare questa facoltà critica di revoca e cancellazione esclusivamente a ruoli con comprovata responsabilità amministrativa e di rappresentanza legale (es. il **"Responsabile Legale"** dell'associazione) [220, 279].
    *   **Cancellazione Automatica su Rimozione Account:** Se un account viene eliminato o disattivato dall'albero dei permessi e dei ruoli (ACL), il sistema innesca **automaticamente** l'evento di cancellazione remota (Kill-Switch) per tutte le sessioni e i dispositivi legati a quell'account.
4.  **Trigger di Auto-distruzione Locale (Local Self-Destruct):**
    Al primo handshake/sincronizzazione o in caso di errore di autenticazione (`401 Unauthorized`), il client rileva lo stato di revoca o smarrimento e avvia la procedura immediata:
    *   Rimozione e svuotamento completo del database IndexedDB locale (`Dexie.delete()`).
    *   Cancellazione del LocalStorage, SessionStorage e della cache del browser.
    *   Disinstallazione del Service Worker della PWA per rimuovere fisicamente l'applicazione dal dispositivo.
    *   Reindirizzamento dell'utente alla schermata di login principale.


## 🛡️ Sicurezza e Protezione dei Dati (Privacy by Design)

*   **Offline-First & Local-First:** Tutti i dati inseriti vengono elaborati ed archiviati localmente nel browser (IndexedDB) [200]. Non esiste un server centrale vulnerabile proprietario, annullando il rischio di data breach di massa.
*   **Isolamento dei Plugin:** I plugin esterni lavorano esclusivamente in ambiente isolato JavaScript (Sandbox), comunicando con il sistema tramite l'Event Bus sicuro del Core, impedendo accessi non autorizzati alle chiavi API o ai dati di altri moduli.
*   **Data Retention semi-automatizzata:** Il sistema supporta la data retention tramite un modulo di pulizia locale periodico, mantenendo archiviati nel cloud i file protetti per i tempi prescritti dalla legge (es. 10 anni per la contabilità ai sensi dell'Art. 2220 C.C.) e scaricando localmente solo i metadati indicizzati [186, 189].
