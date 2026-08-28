/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { AppPlugin } from './AppPlugin.js';
import { EventBus } from '../base/EventBus.js';
import { I18nManager } from '../base/I18nManager.js';

// --- INTERFACCE E CONTRATTI DATI V3 ---

export interface LocationData {
  hasLocation: boolean;
  name: string | null;
  address: string | null;
  coordinates: [number, number] | null; // [lat, lng]
  elevationMeters: number | null;
}

export interface WaypointPOI {
  id: string;
  name: string;
  coordinates: [number, number]; // [lat, lng]
  iconConfig: {
    iconUrl: string; // URL o SVG o simbolo emoji
    size: number; // 16px - 64px
    offset: [number, number]; // Offset etichetta/marker
  };
  legend: {
    publicNotes: string; // Visibile a tutti i partecipanti
    organizerNotes: string; // Riservato agli organizzatori / capi
  };
}

export interface RouteStep {
  id: string;
  title: string;
  coordinates: [number, number];
}

export interface TrackStats {
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  estimatedTimeHours: number;
}

export interface GeoJsonTrackFeature {
  type: 'Feature' | 'FeatureCollection';
  geometry: {
    type: 'LineString';
    coordinates: number[][]; // [lng, lat, ele?]
  };
  properties?: Record<string, any>;
}

export interface TrackData {
  hasTrack: boolean;
  fileName: string | null;
  stats: TrackStats;
  geoJson: GeoJsonTrackFeature | null;
}

export interface MapPluginState {
  pluginId: string;
  activeMode: 'location' | 'route' | 'track';
  isMapCollapsed: boolean; // Pulsante "Chiudi Visuale Mappa" -> Vertical Stack Flow per Mobile
  mapConfig: {
    center: [number, number];
    zoom: number;
    baseLayer: 'OpenStreetMap' | 'OpenTopoMap' | 'CustomXYZ';
    customXYZUrl?: string;
    overlays: string[];
    overlayOpacity: number;
  };
  locationData: LocationData;
  routeData: {
    transportMode: 'foot' | 'bike' | 'car' | 'transit';
    start: RouteStep | null;
    destination: RouteStep | null;
    waypoints: RouteStep[];
    writtenDescription: string;
    isDescriptionExpanded: boolean;
    securityNotes: string;
    generalNotes: string;
  };
  trackData: TrackData;
  waypoints: WaypointPOI[];
  tempWaypoint?: Partial<WaypointPOI> | null;
  editingWaypointId?: string | null;
  isPickingPointFromMap?: boolean;
  exportSettings: {
    includeElevationInKidsDoc: boolean;
    includeMapInKidsDoc: boolean;
  };
}

// Palette di colori per tracciati vettoriali
const TRACK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

export class MapPlugin implements AppPlugin {
  public id = 'map-tool';
  public name = 'Mappe, Tracciati & Spostamenti';
  public isCollaborative = true;

  public locales = {
    it: {
      title: 'Mappe, Tracciati & Spostamenti',
      modeLocation: '📍 Posizione',
      modeRoute: '🗺️ Percorso',
      modeTrack: '🥾 Carica Traccia',
      collapseMapBtn: '🗗 Chiudi Visuale Mappa',
      expandMapBtn: '🗺️ Mostra Mappa Intera',
      removeLocationBtn: '🗑️ Rimuovi Posizione',
      calcRouteBtn: '🏎️ Calcola Percorso',
      addWaypointBtn: '📍 Aggiungi Waypoint (POI)',
      deleteWaypointBtn: '🗑️ Elimina Waypoint',
      resetRouteBtn: '🗑️ Resetta Intero Percorso',
      removeTrackBtn: '🗑️ Rimuovi Traccia',
      writeRouteBtn: '✍️ Scrivi Percorso',
      showAllBtn: 'Mostra tutto',
      showLessBtn: 'Mostra meno',
      participantsVersion: 'Informazioni Pubbliche (Partecipanti)',
      organizersVersion: 'Informazioni Riservate (Organizzatori)',
      osmLayer: 'OpenStreetMap Standard',
      topoLayer: 'OpenTopoMap Escursionistica',
      waymarkedOverlay: 'Sentieri Escursionistici (Waymarked Trails)',
      uploadGpxBtn: '📁 Carica GPX / KML / GeoJSON',
      noDataNotice: 'Nessun elemento caricato. Usa i controlli per inserire posizioni, percorsi o tracciati.'
    },
    en: {
      title: 'Maps, Trails & Routing',
      modeLocation: '📍 Location',
      modeRoute: '🗺️ Route',
      modeTrack: '🥾 Upload Track',
      collapseMapBtn: '🗗 Collapse Map View',
      expandMapBtn: '🗺️ Show Full Map',
      removeLocationBtn: '🗑️ Remove Location',
      calcRouteBtn: '🏎️ Calculate Route',
      addWaypointBtn: '📍 Add Waypoint (POI)',
      deleteWaypointBtn: '🗑️ Delete Waypoint',
      resetRouteBtn: '🗑️ Reset Entire Route',
      removeTrackBtn: '🗑️ Remove Track',
      writeRouteBtn: '✍️ Write Route',
      showAllBtn: 'Show all',
      showLessBtn: 'Show less',
      participantsVersion: 'Public Notes (Participants)',
      organizersVersion: 'Private Notes (Organizers)',
      osmLayer: 'OpenStreetMap Standard',
      topoLayer: 'OpenTopoMap Hiking',
      waymarkedOverlay: 'Hiking Trails (Waymarked Trails)',
      uploadGpxBtn: '📁 Upload GPX / KML / GeoJSON',
      noDataNotice: 'No data loaded. Use controls to insert locations, routes or tracks.'
    }
  };

  private i18n: I18nManager | null = null;
  private mapInstances: Map<string, L.Map> = new Map();

  /**
   * RIGOROSO STATO INIZIALE PULITO (Clean Default State - Nessun dato di esempio/seed)
   */
  public createCleanInitialState(): MapPluginState {
    return {
      pluginId: this.id,
      activeMode: 'location',
      isMapCollapsed: false,
      mapConfig: {
        center: [44.4949, 11.3426],
        zoom: 13,
        baseLayer: 'OpenStreetMap',
        overlays: ['WaymarkedTrails'],
        overlayOpacity: 0.8
      },
      locationData: {
        hasLocation: false,
        name: null,
        address: null,
        coordinates: null,
        elevationMeters: null
      },
      routeData: {
        transportMode: 'foot',
        start: null,
        destination: null,
        waypoints: [],
        writtenDescription: '',
        isDescriptionExpanded: false,
        securityNotes: '',
        generalNotes: ''
      },
      trackData: {
        hasTrack: false,
        fileName: null,
        stats: {
          distanceKm: 0,
          elevationGainM: 0,
          elevationLossM: 0,
          estimatedTimeHours: 0
        },
        geoJson: null
      },
      waypoints: [],
      exportSettings: {
        includeElevationInKidsDoc: true,
        includeMapInKidsDoc: true
      }
    };
  }

  public async init(_eventBus: EventBus, i18n: I18nManager): Promise<void> {
    this.i18n = i18n;
  }

  public render(container: HTMLElement, dataState: MapPluginState, _currentLocale: string): void {
    // Garantisce che lo stato sia pulito e senza null pointer
    if (!dataState || !dataState.mapConfig) {
      Object.assign(dataState, this.createCleanInitialState());
    }
    if (!dataState.waypoints) dataState.waypoints = [];
    if (!dataState.locationData) dataState.locationData = { hasLocation: false, name: null, address: null, coordinates: null, elevationMeters: null };
    if (!dataState.trackData) dataState.trackData = { hasTrack: false, fileName: null, stats: { distanceKm: 0, elevationGainM: 0, elevationLossM: 0, estimatedTimeHours: 0 }, geoJson: null };
    if (!dataState.routeData) dataState.routeData = { transportMode: 'foot', start: null, destination: null, waypoints: [], writtenDescription: '', isDescriptionExpanded: false, securityNotes: '', generalNotes: '' };

    const t = (key: string) => (this.i18n ? this.i18n.t(`plugins.${this.id}.${key}`) : key);
    const blockId = `map-v3-container-${Math.random().toString(36).substring(2, 9)}`;

    // STRUTTURA UI CLEAN & COMPACT (Map-First Viewport con Collapsible Mobile Flow)
    container.innerHTML = `
      <div class="map-plugin-v3 bg-slate-900 text-slate-100 rounded-xl p-4 shadow-2xl border border-slate-800 space-y-4">
        
        <!-- HEADER TOPBAR: Titolo, Selettore Modalità & Pulsante Chiudi Visuale Mappa -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-bold text-blue-400 flex items-center gap-1.5">
              🗺️ ${t('title')}
            </h3>
          </div>

          <!-- Tre Modalità Operative -->
          <div class="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button class="mode-tab-btn px-3 py-1.5 rounded-md font-medium transition-colors ${
              dataState.activeMode === 'location' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white'
            }" data-mode="location">
              ${t('modeLocation')}
            </button>
            <button class="mode-tab-btn px-3 py-1.5 rounded-md font-medium transition-colors ${
              dataState.activeMode === 'route' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white'
            }" data-mode="route">
              ${t('modeRoute')}
            </button>
            <button class="mode-tab-btn px-3 py-1.5 rounded-md font-medium transition-colors ${
              dataState.activeMode === 'track' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white'
            }" data-mode="track">
              ${t('modeTrack')}
            </button>
          </div>

          <!-- Pulsante "Chiudi Visuale Mappa" / "Minimizza Mappa" (Mobile Flow Ergonomico) -->
          <button class="toggle-map-collapse-btn text-xs px-3 py-1.5 rounded-md font-semibold border transition-colors ${
            dataState.isMapCollapsed
              ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-500'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
          }">
            ${dataState.isMapCollapsed ? t('expandMapBtn') : t('collapseMapBtn')}
          </button>
        </div>

        <!-- FLOATING CONTROL PANEL (FCP): Layer, Overlays & Geocoding -->
        <div class="bg-slate-800/90 border border-slate-700 p-3 rounded-lg text-xs space-y-2.5 shadow-md">
          <div class="flex flex-wrap items-center justify-between gap-3">
            
            <!-- Selettore Base Layer -->
            <div class="flex items-center gap-3">
              <span class="text-slate-400 font-semibold">Base Layer:</span>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="base-layer-${blockId}" value="OpenStreetMap" ${dataState.mapConfig.baseLayer === 'OpenStreetMap' ? 'checked' : ''} class="layer-radio" />
                <span>${t('osmLayer')}</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="base-layer-${blockId}" value="OpenTopoMap" ${dataState.mapConfig.baseLayer === 'OpenTopoMap' ? 'checked' : ''} class="layer-radio" />
                <span>${t('topoLayer')}</span>
              </label>
            </div>

            <!-- Overlays Toggle & Opacità -->
            <div class="flex items-center gap-3">
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" ${dataState.mapConfig.overlays.includes('WaymarkedTrails') ? 'checked' : ''} class="overlay-waymarked-cb" />
                <span>${t('waymarkedOverlay')}</span>
              </label>
              <input type="range" min="0.1" max="1.0" step="0.1" value="${dataState.mapConfig.overlayOpacity}" class="overlay-opacity-slider w-20 cursor-pointer" title="Opacità Overlay" />
            </div>

            <!-- Pulsante Inserimento Waypoint -->
            <button class="add-waypoint-btn bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3 py-1.5 rounded shadow">
              ${t('addWaypointBtn')}
            </button>

          </div>
        </div>

        <!-- AREA MAPPA LEAFLET (Collassabile per Vertical Stack Flow Mobile) -->
        <div class="relative transition-all duration-300 ${dataState.isMapCollapsed ? 'h-0 min-h-0 overflow-hidden border-0' : 'block'}">
          <div id="${blockId}" class="leaflet-map-element w-full h-[400px] rounded-lg border border-slate-700 ${
            dataState.isPickingPointFromMap ? 'leaflet-crosshair-mode' : ''
          }"></div>
        </div>

        <!-- CONTENUTO OPERATIVO SPECIFICO (MODALITÀ ATTIVA) -->
        <div class="operational-content-area space-y-4">
          ${this.renderActiveModeContent(dataState, t)}
        </div>

        <!-- GRAFICO ALTIMETRICO BOTTOM SHEET (SOLO IN MODALITÀ TRACCIA O SE PRESENTE TRACCIA) -->
        ${
          dataState.trackData.hasTrack && dataState.trackData.geoJson
            ? `
          <div class="bottom-drawer-altimetria bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
            <div class="flex items-center justify-between text-xs border-b border-slate-800 pb-1.5">
              <span class="font-bold text-blue-300">📈 Profilo Altimetrico & Statistiche Traccia (Interattivo)</span>
              <button class="remove-track-btn text-red-400 hover:text-red-300 font-bold text-xs">${t('removeTrackBtn')}</button>
            </div>
            
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-900/80 p-2.5 rounded border border-slate-800">
              <div><span class="text-slate-400 block">Distanza Totale</span><span class="font-bold text-blue-400">${dataState.trackData.stats.distanceKm.toFixed(2)} km</span></div>
              <div><span class="text-slate-400 block">Dislivello + (D+)</span><span class="font-bold text-emerald-400">+${dataState.trackData.stats.elevationGainM} m</span></div>
              <div><span class="text-slate-400 block">Dislivello - (D-)</span><span class="font-bold text-amber-400">-${dataState.trackData.stats.elevationLossM} m</span></div>
              <div><span class="text-slate-400 block">Tempo Tobler Stimato</span><span class="font-bold text-purple-400">${dataState.trackData.stats.estimatedTimeHours.toFixed(1)} h</span></div>
            </div>

            <div class="relative w-full h-24 bg-slate-900 rounded border border-slate-800 p-1">
              <canvas class="elevation-canvas w-full h-full cursor-crosshair"></canvas>
            </div>
          </div>
        `
            : ''
        }

        <!-- MODALE / FORM DI COMPILAZIONE WAYPOINT -->
        ${this.renderWaypointModal(dataState, t)}

        <!-- LEGENDA DEI WAYPOINT INSERITI (PRIVACY BY DESIGN: PUBBLICA VS ORGANIZZATORI) -->
        ${this.renderWaypointsLegend(dataState, t)}

      </div>
    `;

    // Inizializzazione della mappa Leaflet solo se non collassata
    if (!dataState.isMapCollapsed) {
      setTimeout(() => {
        this.initLeafletMap(blockId, container, dataState);
      }, 50);
    }

    this.bindEvents(container, dataState);
  }

  // --- RENDERING MODALITÀ OPERATIVE ---

  private renderActiveModeContent(dataState: MapPluginState, t: (k: string) => string): string {
    switch (dataState.activeMode) {
      case 'location':
        return `
          <div class="bg-slate-800/80 p-3.5 rounded-lg border border-slate-700/80 space-y-3 text-xs">
            <h4 class="font-bold text-blue-300">📍 Modalità Posizione Singola</h4>
            
            <div class="flex flex-col sm:flex-row gap-2">
              <input type="text" placeholder="Incolla link (Google/Bing/Apple Maps), indirizzo o coordinate (es. 44.49, 11.34)..." class="geocoding-input bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 flex-1 focus:border-blue-500 focus:outline-none" />
              <button class="search-location-btn bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded shadow shrink-0">
                🔍 Cerca / Decodifica
              </button>
            </div>

            ${
              dataState.locationData.hasLocation
                ? `
              <div class="bg-slate-900/90 p-3 rounded border border-blue-800/80 space-y-2">
                <div class="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span class="font-bold text-blue-200">${dataState.locationData.name || 'Posizione Selezionata'}</span>
                  <button class="remove-location-btn bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 text-xs px-2.5 py-1 rounded">
                    ${t('removeLocationBtn')}
                  </button>
                </div>
                <div class="text-[11px] text-slate-300 space-y-1">
                  <div><strong>Coordinate:</strong> ${dataState.locationData.coordinates?.[0].toFixed(5)}, ${dataState.locationData.coordinates?.[1].toFixed(5)}</div>
                  <div><strong>Quota s.l.m.:</strong> ${dataState.locationData.elevationMeters ? `${dataState.locationData.elevationMeters} m` : 'Calcolata da OpenTopoMap'}</div>
                </div>
                <div class="pt-1 flex justify-end">
                  <button class="calc-route-from-loc-btn bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded shadow">
                    ${t('calcRouteBtn')}
                  </button>
                </div>
              </div>
            `
                : `<p class="text-[11px] text-slate-400 italic">${t('noDataNotice')}</p>`
            }
          </div>
        `;

      case 'route':
        return `
          <div class="bg-slate-800/80 p-3.5 rounded-lg border border-slate-700/80 space-y-3 text-xs">
            <div class="flex items-center justify-between border-b border-slate-700/80 pb-2">
              <h4 class="font-bold text-purple-300">🗺️ Modalità Percorso & Trasferimenti</h4>
              <button class="reset-route-btn bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 px-2.5 py-1 rounded">
                ${t('resetRouteBtn')}
              </button>
            </div>

            <!-- Mezzi di Trasporto -->
            <div class="flex items-center gap-2">
              <span class="text-slate-400 font-semibold">Mezzo:</span>
              <button class="transport-btn ${dataState.routeData.transportMode === 'foot' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-300'} px-2.5 py-1 rounded border border-slate-700" data-mode="foot">🚶 A piedi</button>
              <button class="transport-btn ${dataState.routeData.transportMode === 'bike' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-300'} px-2.5 py-1 rounded border border-slate-700" data-mode="bike">🚴 In Bici</button>
              <button class="transport-btn ${dataState.routeData.transportMode === 'car' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-300'} px-2.5 py-1 rounded border border-slate-700" data-mode="car">🚗 In Auto</button>
            </div>

            <!-- Elenco Tappe del Tragitto (Modificabile & Eliminabile) -->
            <div class="space-y-2">
              <div class="flex items-center justify-between text-[11px] text-slate-400">
                <span>Tappe del Tragitto:</span>
                <button class="add-route-step-btn text-blue-400 hover:text-blue-300 font-bold">+ Aggiungi Tappa</button>
              </div>

              ${dataState.routeData.waypoints
                .map(
                  (step, idx) => `
                <div class="flex items-center justify-between bg-slate-900/90 p-2 rounded border border-slate-700">
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-slate-400">${idx + 1}.</span>
                    <span class="font-semibold text-slate-200">${step.title}</span>
                    <span class="text-[10px] text-slate-400">(${step.coordinates[0].toFixed(4)}, ${step.coordinates[1].toFixed(4)})</span>
                  </div>
                  <button data-step-id="${step.id}" class="delete-step-btn text-red-400 hover:text-red-300 font-bold px-1.5">🗑️</button>
                </div>
              `
                )
                .join('')}
            </div>

            <!-- Box Descrittivo Comprimibile "Scrivi Percorso" -->
            <div class="space-y-1.5 border-t border-slate-700/80 pt-2">
              <button class="toggle-write-route-btn text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1">
                ${t('writeRouteBtn')} ${dataState.routeData.isDescriptionExpanded ? '▲' : '▼'}
              </button>

              <div class="relative ${dataState.routeData.isDescriptionExpanded ? 'max-h-none' : 'max-h-20 overflow-hidden'} transition-all duration-200">
                <textarea class="written-route-desc bg-slate-900 border border-slate-700 rounded p-2.5 w-full text-slate-100 text-xs focus:border-purple-500 focus:outline-none" rows="4" placeholder="Descrivi l'itinerario a parole tue (es. Prendere il sentiero 101, svoltare a sinistra dopo la quercia...)...">${dataState.routeData.writtenDescription || ''}</textarea>
                ${
                  !dataState.routeData.isDescriptionExpanded
                    ? `<div class="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none"></div>`
                    : ''
                }
              </div>
            </div>

            <!-- Note di Sicurezza ed Informazioni Generali -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-700/80">
              <div>
                <label class="block text-amber-300 font-semibold mb-1">Informazioni di Sicurezza</label>
                <textarea class="security-notes-input bg-slate-900 border border-slate-700 rounded p-2 w-full text-slate-100 text-xs" rows="2" placeholder="es. Scarponi alti necessari, assenza d'acqua...">${dataState.routeData.securityNotes || ''}</textarea>
              </div>
              <div>
                <label class="block text-blue-300 font-semibold mb-1">Informazioni Generali</label>
                <textarea class="general-notes-input bg-slate-900 border border-slate-700 rounded p-2 w-full text-slate-100 text-xs" rows="2" placeholder="es. Orari pullman di linea, numeri rifugio...">${dataState.routeData.generalNotes || ''}</textarea>
              </div>
            </div>

          </div>
        `;

      case 'track':
        return `
          <div class="bg-slate-800/80 p-3.5 rounded-lg border border-slate-700/80 space-y-3 text-xs">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="font-bold text-emerald-300">🥾 Modalità Carica Traccia Escursionistica</h4>
                <p class="text-[11px] text-slate-400">Analisi locale GPX / KML / GeoJSON con profilo altimetrico</p>
              </div>
              <button class="upload-gpx-btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded shadow">
                ${t('uploadGpxBtn')}
              </button>
              <input type="file" accept=".gpx,.kml,.geojson" multiple class="hidden gpx-file-input" />
            </div>
          </div>
        `;
    }
  }

  private renderWaypointModal(dataState: MapPluginState, t: (k: string) => string): string {
    if (!dataState.tempWaypoint) return '';

    return `
      <div class="bg-slate-800 border-2 border-emerald-500 p-4 rounded-lg text-xs space-y-3 shadow-2xl">
        <h4 class="font-bold text-emerald-300 border-b border-slate-700 pb-2 flex items-center justify-between">
          <span>📍 ${dataState.editingWaypointId ? 'Modifica Waypoint' : 'Nuovo Waypoint'}</span>
          <button class="close-wp-modal text-slate-400 hover:text-white font-bold text-sm">✕</button>
        </h4>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-slate-300 font-semibold mb-1">Nome Waypoint *</label>
            <input type="text" value="${dataState.tempWaypoint.name || ''}" placeholder="es. Sorgente d'acqua o Campo Bivacco" class="wp-name-input bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 w-full focus:border-emerald-500 focus:outline-none" />
          </div>

          <div>
            <label class="block text-slate-300 font-semibold mb-1">Dimensione Icona (16px - 64px)</label>
            <input type="range" min="16" max="64" value="${dataState.tempWaypoint.iconConfig?.size || 32}" class="wp-icon-size-slider w-full cursor-pointer" />
          </div>

          <div class="sm:col-span-2">
            <label class="block text-slate-300 font-semibold mb-1">${t('participantsVersion')} (Note Pubbliche)</label>
            <input type="text" value="${dataState.tempWaypoint.legend?.publicNotes || ''}" placeholder="Note visibili a tutti i partecipanti (es. Fontana d'acqua potabile)" class="wp-public-notes bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 w-full focus:border-emerald-500 focus:outline-none" />
          </div>

          <div class="sm:col-span-2">
            <label class="block text-amber-300 font-semibold mb-1">${t('organizersVersion')} (Note Riservate Capi)</label>
            <input type="text" value="${dataState.tempWaypoint.legend?.organizerNotes || ''}" placeholder="Note riservate agli organizzatori (es. Punto evacuazione soccorsi)" class="wp-organizer-notes bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 w-full focus:border-amber-500 focus:outline-none" />
          </div>
        </div>

        <div class="flex justify-end gap-2 border-t border-slate-700 pt-2.5">
          <button class="cancel-wp-btn bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded font-medium">Annulla</button>
          <button class="save-wp-btn bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded font-bold">Salva Waypoint</button>
        </div>
      </div>
    `;
  }

  private renderWaypointsLegend(dataState: MapPluginState, t: (k: string) => string): string {
    if (dataState.waypoints.length === 0) return '';

    return `
      <div class="bg-slate-800/80 p-3.5 rounded-lg border border-slate-700 text-xs space-y-2">
        <h4 class="font-bold text-slate-200">Legenda Punti di Interesse / Waypoint (${dataState.waypoints.length})</h4>
        
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-slate-300">
            <thead>
              <tr class="border-b border-slate-700 text-slate-400 font-semibold">
                <th class="py-1 px-2">#</th>
                <th class="py-1 px-2">Nome Waypoint</th>
                <th class="py-1 px-2">Coordinate</th>
                <th class="py-1 px-2">${t('participantsVersion')}</th>
                <th class="py-1 px-2 text-amber-300">${t('organizersVersion')}</th>
                <th class="py-1 px-2 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              ${dataState.waypoints
                .map(
                  (wp, idx) => `
                <tr class="border-b border-slate-800/60 hover:bg-slate-800/40">
                  <td class="py-1 px-2 font-mono text-slate-400">${idx + 1}</td>
                  <td class="py-1 px-2 font-semibold text-slate-200">${wp.name}</td>
                  <td class="py-1 px-2 font-mono text-[10px] text-slate-400">${wp.coordinates[0].toFixed(4)}, ${wp.coordinates[1].toFixed(4)}</td>
                  <td class="py-1 px-2 text-slate-300">${wp.legend?.publicNotes || '-'}</td>
                  <td class="py-1 px-2 text-amber-200">${wp.legend?.organizerNotes || '-'}</td>
                  <td class="py-1 px-2 text-right flex items-center justify-end gap-1">
                    <button data-edit-wp-id="${wp.id}" class="edit-wp-btn bg-slate-700 hover:bg-slate-600 text-blue-300 text-[11px] px-2 py-0.5 rounded font-medium">✏️ Modifica</button>
                    <button data-delete-wp-id="${wp.id}" class="delete-wp-btn text-red-400 hover:text-red-300 font-bold px-1.5">${t('deleteWaypointBtn')}</button>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // --- LEAFLET MAP & BINDINGS ---

  private initLeafletMap(blockId: string, container: HTMLElement, dataState: MapPluginState): void {
    const mapEl = container.querySelector<HTMLElement>(`#${blockId}`);
    if (!mapEl) return;

    if (this.mapInstances.has(blockId)) {
      this.mapInstances.get(blockId)!.remove();
    }

    const defaultCenter: L.LatLngTuple = dataState.locationData.coordinates || dataState.mapConfig.center || [44.4949, 11.3426];
    const map = L.map(mapEl, {
      center: defaultCenter,
      zoom: dataState.mapConfig.zoom || 13,
      attributionControl: false
    });

    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    });

    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Style: OpenTopoMap'
    });

    const waymarkedOverlay = L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
      attribution: 'Trails: &copy; Waymarked Trails',
      opacity: dataState.mapConfig.overlayOpacity
    });

    if (dataState.mapConfig.baseLayer === 'OpenTopoMap') {
      topoLayer.addTo(map);
    } else {
      osmLayer.addTo(map);
    }

    if (dataState.mapConfig.overlays.includes('WaymarkedTrails')) {
      waymarkedOverlay.addTo(map);
    }

    // POSIZIONE SINGOLA
    if (dataState.locationData.hasLocation && dataState.locationData.coordinates) {
      const mainMarker = L.marker(dataState.locationData.coordinates, { draggable: true }).addTo(map);
      mainMarker.bindPopup(`<strong>${dataState.locationData.name || 'Posizione Selezionata'}</strong>`).openPopup();

      mainMarker.on('dragend', (e) => {
        const latlng = (e.target as L.Marker).getLatLng();
        dataState.locationData.coordinates = [latlng.lat, latlng.lng];
        this.render(container, dataState, '');
      });
    }

    // TRACCE MULTIPLE VETTORIALI
    if (dataState.trackData.hasTrack && dataState.trackData.geoJson) {
      const geoLayer = L.geoJSON(dataState.trackData.geoJson as any, {
        style: { color: TRACK_COLORS[0], weight: 4, opacity: 0.85 }
      }).addTo(map);

      map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });

      // Rendering Profilo Altimetrico Canvas con Hover sincronizzato bidirezionale
      let hoverMarker: L.CircleMarker | null = null;
      this.renderElevationCanvas(container, dataState.trackData.geoJson, (lat, lng) => {
        if (!hoverMarker) {
          hoverMarker = L.circleMarker([lat, lng], { radius: 6, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }).addTo(map);
        } else {
          hoverMarker.setLatLng([lat, lng]);
        }
      });
    }

    // WAYPOINTS / POI CON ELASTIC OFFSET VETTORIALE
    dataState.waypoints.forEach((wp) => {
      const markerIcon = L.divIcon({
        className: 'custom-wp-marker',
        html: `<div style="font-size:${wp.iconConfig.size}px; text-shadow:0 0 4px #000;">📍</div>`,
        iconSize: [wp.iconConfig.size, wp.iconConfig.size],
        iconAnchor: [wp.iconConfig.size / 2, wp.iconConfig.size / 2]
      });

      L.marker(wp.coordinates, { icon: markerIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-size:12px; color:#1e293b;">
            <strong>${wp.name}</strong><br/>
            <span>${wp.legend?.publicNotes || ''}</span>
          </div>
        `);
    });

    // MAP CLICK PER NUOVO WAYPOINT O SELEZIONE
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (dataState.isPickingPointFromMap) {
        dataState.isPickingPointFromMap = false;
        dataState.tempWaypoint = {
          name: 'Nuovo Waypoint',
          coordinates: [e.latlng.lat, e.latlng.lng],
          iconConfig: { iconUrl: '📍', size: 32, offset: [0, 0] },
          legend: { publicNotes: '', organizerNotes: '' }
        };
        this.render(container, dataState, '');
      }
    });

    this.mapInstances.set(blockId, map);
  }

  private bindEvents(container: HTMLElement, dataState: MapPluginState): void {
    // Mode Switcher
    container.querySelectorAll<HTMLButtonElement>('.mode-tab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        dataState.activeMode = (e.currentTarget as HTMLElement).getAttribute('data-mode') as any;
        this.render(container, dataState, '');
      });
    });

    // Pulsante Chiudi Visuale Mappa (Mobile Vertical Stack Flow)
    container.querySelector('.toggle-map-collapse-btn')?.addEventListener('click', () => {
      dataState.isMapCollapsed = !dataState.isMapCollapsed;
      this.render(container, dataState, '');
    });

    // Layer Switcher
    container.querySelectorAll<HTMLInputElement>('.layer-radio').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        dataState.mapConfig.baseLayer = (e.target as HTMLInputElement).value as any;
        this.render(container, dataState, '');
      });
    });

    container.querySelector<HTMLInputElement>('.overlay-waymarked-cb')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      if (checked && !dataState.mapConfig.overlays.includes('WaymarkedTrails')) {
        dataState.mapConfig.overlays.push('WaymarkedTrails');
      } else {
        dataState.mapConfig.overlays = dataState.mapConfig.overlays.filter((o) => o !== 'WaymarkedTrails');
      }
      this.render(container, dataState, '');
    });

    // Modalità Posizione: Geocoding & Rimuovi Posizione
    container.querySelector('.search-location-btn')?.addEventListener('click', () => {
      const input = container.querySelector<HTMLInputElement>('.geocoding-input');
      if (input && input.value.trim()) {
        const parsed = this.parseCoordinatesOrLink(input.value.trim());
        if (parsed) {
          dataState.locationData = {
            hasLocation: true,
            name: 'Posizione Decodificata',
            address: input.value.trim(),
            coordinates: parsed,
            elevationMeters: null
          };
          this.render(container, dataState, '');
        } else {
          alert('Impossibile estrarre coordinate valide dall\'input.');
        }
      }
    });

    container.querySelector('.remove-location-btn')?.addEventListener('click', () => {
      dataState.locationData = { hasLocation: false, name: null, address: null, coordinates: null, elevationMeters: null };
      this.render(container, dataState, '');
    });

    container.querySelector('.calc-route-from-loc-btn')?.addEventListener('click', () => {
      if (dataState.locationData.coordinates) {
        dataState.activeMode = 'route';
        dataState.routeData.destination = {
          id: `step-dest-${Date.now()}`,
          title: dataState.locationData.name || 'Destinazione',
          coordinates: dataState.locationData.coordinates
        };
        this.render(container, dataState, '');
      }
    });

    // Modalità Percorso: Mezzi Trasporto & Resetta Percorso
    container.querySelectorAll('.transport-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        dataState.routeData.transportMode = (e.currentTarget as HTMLElement).getAttribute('data-mode') as any;
        this.render(container, dataState, '');
      });
    });

    container.querySelector('.reset-route-btn')?.addEventListener('click', () => {
      dataState.routeData.start = null;
      dataState.routeData.destination = null;
      dataState.routeData.waypoints = [];
      dataState.routeData.writtenDescription = '';
      this.render(container, dataState, '');
    });

    container.querySelector('.add-route-step-btn')?.addEventListener('click', () => {
      dataState.isPickingPointFromMap = true;
      this.render(container, dataState, '');
    });

    container.querySelectorAll('.delete-step-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-step-id');
        dataState.routeData.waypoints = dataState.routeData.waypoints.filter((w) => w.id !== id);
        this.render(container, dataState, '');
      });
    });

    container.querySelector('.toggle-write-route-btn')?.addEventListener('click', () => {
      dataState.routeData.isDescriptionExpanded = !dataState.routeData.isDescriptionExpanded;
      this.render(container, dataState, '');
    });

    container.querySelector<HTMLTextAreaElement>('.written-route-desc')?.addEventListener('input', (e) => {
      dataState.routeData.writtenDescription = (e.target as HTMLTextAreaElement).value;
    });

    // Upload & Rimozione Traccia GPX
    const uploadBtn = container.querySelector('.upload-gpx-btn');
    const gpxInput = container.querySelector<HTMLInputElement>('.gpx-file-input');
    uploadBtn?.addEventListener('click', () => gpxInput?.click());
    gpxInput?.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        this.handleFileUpload(files[0], container, dataState);
      }
    });

    container.querySelector('.remove-track-btn')?.addEventListener('click', () => {
      dataState.trackData = { hasTrack: false, fileName: null, stats: { distanceKm: 0, elevationGainM: 0, elevationLossM: 0, estimatedTimeHours: 0 }, geoJson: null };
      this.render(container, dataState, '');
    });

    // Waypoints Modal Actions
    container.querySelector('.add-waypoint-btn')?.addEventListener('click', () => {
      dataState.isPickingPointFromMap = true;
      this.render(container, dataState, '');
    });

    container.querySelector('.save-wp-btn')?.addEventListener('click', () => {
      if (dataState.tempWaypoint && dataState.tempWaypoint.coordinates) {
        const name = (container.querySelector('.wp-name-input') as HTMLInputElement)?.value.trim() || 'Waypoint';
        const publicNotes = (container.querySelector('.wp-public-notes') as HTMLInputElement)?.value.trim() || '';
        const organizerNotes = (container.querySelector('.wp-organizer-notes') as HTMLInputElement)?.value.trim() || '';

        if (dataState.editingWaypointId) {
          const idx = dataState.waypoints.findIndex((w) => w.id === dataState.editingWaypointId);
          if (idx !== -1) {
            dataState.waypoints[idx] = {
              id: dataState.editingWaypointId,
              name,
              coordinates: dataState.tempWaypoint.coordinates,
              iconConfig: dataState.tempWaypoint.iconConfig || { iconUrl: '📍', size: 32, offset: [0, 0] },
              legend: { publicNotes, organizerNotes }
            };
          }
        } else {
          dataState.waypoints.push({
            id: `wp-${Date.now()}`,
            name,
            coordinates: dataState.tempWaypoint.coordinates,
            iconConfig: dataState.tempWaypoint.iconConfig || { iconUrl: '📍', size: 32, offset: [0, 0] },
            legend: { publicNotes, organizerNotes }
          });
        }

        dataState.tempWaypoint = null;
        dataState.editingWaypointId = null;
        this.render(container, dataState, '');
      }
    });

    container.querySelector('.cancel-wp-btn')?.addEventListener('click', () => {
      dataState.tempWaypoint = null;
      dataState.editingWaypointId = null;
      this.render(container, dataState, '');
    });

    container.querySelectorAll('.edit-wp-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-edit-wp-id');
        const found = dataState.waypoints.find((w) => w.id === id);
        if (found) {
          dataState.editingWaypointId = found.id;
          dataState.tempWaypoint = { ...found };
          this.render(container, dataState, '');
        }
      });
    });

    container.querySelectorAll('.delete-wp-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-delete-wp-id');
        dataState.waypoints = dataState.waypoints.filter((w) => w.id !== id);
        this.render(container, dataState, '');
      });
    });
  }

  // --- MOTORE ALGORITMICO E CALCOLI GIIS ---

  private parseCoordinatesOrLink(input: string): [number, number] | null {
    // Regex Google / Bing / Apple Maps
    const match =
      input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
      input.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
      input.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
      input.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);

    if (match) {
      return [parseFloat(match[1]), parseFloat(match[2])];
    }
    return null;
  }

  private handleFileUpload(file: File, container: HTMLElement, dataState: MapPluginState): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      const parsedGeoJson = this.parseGPX(content);
      if (parsedGeoJson) {
        const stats = this.calculateTrackStatsAndToblerTime(parsedGeoJson);
        dataState.trackData = {
          hasTrack: true,
          fileName: file.name,
          stats,
          geoJson: parsedGeoJson
        };
        this.render(container, dataState, '');
      }
    };
    reader.readAsText(file);
  }

  private parseGPX(xmlText: string): GeoJsonTrackFeature | null {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const trkpts = xmlDoc.querySelectorAll('trkpt');

    const coordinates: number[][] = [];
    trkpts.forEach((pt) => {
      const lat = parseFloat(pt.getAttribute('lat') || '0');
      const lng = parseFloat(pt.getAttribute('lon') || '0');
      const eleNode = pt.querySelector('ele');
      const ele = eleNode ? parseFloat(eleNode.textContent || '0') : undefined;

      const tuple = [lng, lat];
      if (ele !== undefined && !isNaN(ele)) tuple.push(ele);
      coordinates.push(tuple);
    });

    if (coordinates.length === 0) return null;

    return {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates }
    };
  }

  /**
   * STATISTICHE ED ALGORITMO FUNZIONE DI TOBLER PER TEMPI DI CAMMINO IN PENDENZA:
   * v = 6 * e^(-3.5 * |s + 0.05|) [km/h]
   */
  private calculateTrackStatsAndToblerTime(geoJson: GeoJsonTrackFeature): TrackStats {
    const coords = geoJson.geometry.coordinates;
    let distanceMeters = 0;
    let elevationGainM = 0;
    let elevationLossM = 0;
    let totalTimeHours = 0;

    for (let i = 0; i < coords.length - 1; i++) {
      const [lng1, lat1, ele1] = coords[i];
      const [lng2, lat2, ele2] = coords[i + 1];

      const segDistM = this.haversineDistance(lat1, lng1, lat2, lng2);
      distanceMeters += segDistM;

      let deltaEleM = 0;
      if (ele1 !== undefined && ele2 !== undefined && !isNaN(ele1) && !isNaN(ele2)) {
        deltaEleM = ele2 - ele1;
        if (deltaEleM > 0) elevationGainM += deltaEleM;
        else elevationLossM += Math.abs(deltaEleM);
      }

      // Funzione di Tobler (Tobler's Hiking Function)
      if (segDistM > 0) {
        const slope = deltaEleM / segDistM; // pendenza s = deltaH / d
        const speedKmH = 6 * Math.exp(-3.5 * Math.abs(slope + 0.05));
        const segDistKm = segDistM / 1000;
        totalTimeHours += segDistKm / speedKmH;
      }
    }

    return {
      distanceKm: distanceMeters / 1000,
      elevationGainM: Math.round(elevationGainM),
      elevationLossM: Math.round(elevationLossM),
      estimatedTimeHours: totalTimeHours > 0 ? totalTimeHours : (distanceMeters / 1000) / 4.0
    };
  }

  /**
   * FORMULA DI HAVERSINE PER IL CALCOLO DELLA DISTANZA GEODETICA
   */
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private renderElevationCanvas(
    container: HTMLElement,
    geoJson: GeoJsonTrackFeature,
    onHoverLocation: (lat: number, lng: number) => void
  ): void {
    const canvas = container.querySelector<HTMLCanvasElement>('.elevation-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = geoJson.geometry.coordinates.filter((c) => c.length > 2 && !isNaN(c[2]));
    if (coords.length < 2) return;

    const width = (canvas.width = canvas.parentElement?.clientWidth || 600);
    const height = (canvas.height = 96);

    const elevations = coords.map((c) => c[2]);
    const minEle = Math.min(...elevations);
    const maxEle = Math.max(...elevations);
    const eleRange = maxEle - minEle || 1;

    ctx.clearRect(0, 0, width, height);

    ctx.beginPath();
    ctx.moveTo(0, height);
    coords.forEach((c, idx) => {
      const x = (idx / (coords.length - 1)) * width;
      const y = height - ((c[2] - minEle) / eleRange) * (height - 16) - 8;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    coords.forEach((c, idx) => {
      const x = (idx / (coords.length - 1)) * width;
      const y = height - ((c[2] - minEle) / eleRange) * (height - 16) - 8;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.stroke();

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const index = Math.min(coords.length - 1, Math.max(0, Math.floor((mouseX / width) * coords.length)));
      const targetCoord = coords[index];
      onHoverLocation(targetCoord[1], targetCoord[0]);
    });
  }

  public serializeToMarkdown(dataState: MapPluginState): string {
    const lines: string[] = [];

    lines.push(`### 🗺️ Mappe, Tracciati & Spostamenti (v3)\n`);

    if (dataState.locationData.hasLocation && dataState.locationData.coordinates) {
      lines.push(`#### 📍 Posizione Principale\n`);
      lines.push(`- **Nome**: ${dataState.locationData.name || 'Posizione Selezionata'}`);
      lines.push(`- **Coordinate**: ${dataState.locationData.coordinates[0].toFixed(5)}, ${dataState.locationData.coordinates[1].toFixed(5)}\n`);
    }

    if (dataState.trackData.hasTrack) {
      lines.push(`#### 🥾 Dettagli Traccia Escursionistica\n`);
      lines.push(`- **Distanza Totale**: ${dataState.trackData.stats.distanceKm.toFixed(2)} km`);
      lines.push(`- **Dislivello Positivo (D+)**: +${dataState.trackData.stats.elevationGainM} m`);
      lines.push(`- **Dislivello Negativo (D-)**: -${dataState.trackData.stats.elevationLossM} m`);
      lines.push(`- **Tempo di Cammino Stimato (Tobler)**: ${dataState.trackData.stats.estimatedTimeHours.toFixed(1)} ore\n`);
    }

    if (dataState.waypoints.length > 0) {
      lines.push(`#### 📌 Legenda Punti di Interesse (Waypoint)\n`);
      lines.push(`| # | Nome Waypoint | Coordinate | Note Pubbliche (Partecipanti) |`);
      lines.push(`|---|---|---|---|`);
      dataState.waypoints.forEach((wp, idx) => {
        lines.push(`| ${idx + 1} | **${wp.name}** | ${wp.coordinates[0].toFixed(4)}, ${wp.coordinates[1].toFixed(4)} | ${wp.legend?.publicNotes || '-'} |`);
      });
      lines.push(`\n`);
    }

    lines.push(`*Mappa e dati vettoriali: © OpenStreetMap contributors, OpenTopoMap, Waymarked Trails.*`);

    return lines.join('\n');
  }
}
