import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { AppPlugin } from '../base/PluginManager.js';
import { EventBus } from '../base/EventBus.js';
import { I18nManager } from '../base/I18nManager.js';

export interface WaypointPOI {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description: string;
  category: 'water' | 'danger' | 'rest' | 'emergency' | 'custom';
  customIconUrl?: string;
  notesLogistica?: string;
}

export interface GeoJsonTrackFeature {
  type: 'Feature';
  geometry: {
    type: 'LineString';
    coordinates: number[][];
  };
  properties?: Record<string, any>;
}

export interface TrackItem {
  id: string;
  fileName: string;
  geoJson: GeoJsonTrackFeature;
  color: string;
  hasElevationData: boolean;
  stats: {
    distanceKm: number;
    ascentMeters: number;
    descentMeters: number;
    durationMinutes: number;
    isNaismithEstimate: boolean;
  };
}

export interface MapPluginState {
  activeMode: 'map' | 'link' | 'track' | 'route';
  isExpanded?: boolean;
  isFullscreen?: boolean;
  activeTab?: 'none' | 'views' | 'settings' | 'waypointModal';
  activeBaseLayer: 'osm' | 'opentopo' | 'custom';
  activeOverlays: string[];
  customTileUrl?: string;
  isPickingPointFromMap?: boolean;
  waypoints: WaypointPOI[];
  tracks: TrackItem[];
  externalLinkUrl?: string;
  resolvedLocation?: { lat: number; lng: number; source: string } | null;
  routeProfile: 'car' | 'foot';
  routeWaypoints: { lat: number; lng: number; label?: string }[];
  routeResult?: { distanceKm: number; durationMinutes: number } | null;
  showLegendInExport: boolean;
  isOrganizational: boolean;
  tempWaypoint?: Partial<WaypointPOI> | null;
  editingWaypointId?: string | null;
}

const TRACK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#84cc16'];

export class MapPlugin implements AppPlugin {
  public id = 'map-plugin';
  public name = 'Mappe & Logistica GIS';
  public isCollaborative = true;

  public locales = {
    it: {
      title: 'Pannello Plugin Mappe (v3.0)',
      modeMap: '🔘 Mostra Mappa',
      modeLink: '🔘 Mostra Posizioni',
      modeTrack: '🔘 Inserisci Traccia',
      modeRoute: '🔘 Inserisci Percorso',
      addPositionBtn: '📍 Inserisci posizione',
      pickFromMapBtn: '🎯 Seleziona punto da mappa',
      manualCoordsBtn: '✍️ Inserisci coordinate decimali',
      pickingBanner: '🎯 Clicca in qualsiasi punto della mappa per posizionare il Waypoint',
      cancelPicking: 'Annulla Selezione',
      linkInputPlaceholder: 'Incolla qui un link da Google Maps, Bing Maps o Apple Maps...',
      decodeLinkBtn: '🔍 Decodifica Link & Centra Mappa',
      linkError: '⚠️ Impossibile estrarre coordinate valide dall\'URL inserito.',
      trackSectionTitle: 'Carica Traccia Escursionistica (.gpx, .kml, .geojson)',
      trackSubtitle: 'Selezionate la o le tracce GPX e KML da visualizzare ed analizzare',
      uploadGpxBtn: '📁 Carica File Traccia',
      naismithNotice: '(Stima escursionistica: 4 km/h in piano + 10 min ogni 100m di dislivello positivo)',
      noElevationWarning: 'ℹ️ Il file caricato non contiene dati altimetrici. Puoi arricchire gratuitamente il tuo file con i dati di elevazione sul sito ',
      routeTitle: 'Calcolo Percorso Stradale ed Escursionistico Gratuito',
      routeCar: '🚗 Auto (OSRM Driving)',
      routeFoot: '🥾 Piedi / Bici (BRouter / Sentieri)',
      calcRouteBtn: '🚀 Calcola Percorso',
      clearRouteBtn: '🗑️ Pulisci Percorso',
      wpTitleLabel: 'Nome Presidio / Waypoint',
      wpCatLabel: 'Icona / Tipologia',
      catWater: '💧 Punto Acqua',
      catDanger: '⚠️ Pericolo / Attenzione',
      catRest: '🏕️ Sosta / Campo Base',
      catEmergency: '🚑 Presidio Emergenza',
      catCustom: '🎨 Icona / Immagine Personalizzata',
      customIconUrlLabel: 'Icona o Foto del Waypoint',
      browseIconBtn: '📁 Sfoglia File...',
      wpDescLabel: 'Descrizione per i Partecipanti',
      wpNotesLabel: 'Note Logistico-Educative (per Educatori / Animatori / Volontari)',
      saveWpBtn: 'Salva Waypoint',
      cancelBtn: 'Annulla',
      editBtn: '✏️ Modifica',
      legendTitle: 'Legenda Logistica dei Waypoint',
      showLegendExport: 'Includi la legenda dettagliata nell\'esportazione del documento',
      participantsVersion: 'Versione Partecipanti',
      organizersVersion: 'Versione Responsabili / Sicurezza',
      xyzWarning: '⚠️ Avviso di Responsabilità: Verificare la licenza d\'uso del server XYZ personalizzato e riportare i crediti d\'autore nel documento finale.'
    },
    en: {
      title: 'Map & GIS Plugin Panel (v3.0)',
      modeMap: '🔘 Show Map',
      modeLink: '🔘 Show Positions',
      modeTrack: '🔘 Insert Track',
      modeRoute: '🔘 Insert Route',
      addPositionBtn: '📍 Insert Position',
      pickFromMapBtn: '🎯 Select point on map',
      manualCoordsBtn: '✍️ Enter decimal coordinates',
      pickingBanner: '🎯 Click anywhere on the map to pick Waypoint coordinates',
      cancelPicking: 'Cancel Selection',
      linkInputPlaceholder: 'Paste a link from Google Maps, Bing Maps or Apple Maps here...',
      decodeLinkBtn: '🔍 Decode Link & Center Map',
      linkError: '⚠️ Unable to extract valid coordinates from the provided URL.',
      trackSectionTitle: 'Upload Trail Track (.gpx, .kml, .geojson)',
      trackSubtitle: 'Select GPX and KML tracks to display and analyze',
      uploadGpxBtn: '📁 Upload Track File',
      naismithNotice: '(Hiking estimate: 4 km/h flat + 10 mins per 100m elevation gain)',
      noElevationWarning: 'ℹ️ Uploaded file lacks elevation data. Enrich your file for free on ',
      routeTitle: 'Free Road & Hiking Route Calculation',
      routeCar: '🚗 Car (OSRM Driving)',
      routeFoot: '🥾 Foot / Bike (BRouter / Trails)',
      calcRouteBtn: '🚀 Calculate Route',
      clearRouteBtn: '🗑️ Clear Route',
      wpTitleLabel: 'Waypoint Title',
      wpCatLabel: 'Icon / Category',
      catWater: '💧 Water Point',
      catDanger: '⚠️ Danger / Hazard',
      catRest: '🏕️ Rest Stop / Camp',
      catEmergency: '🚑 Emergency Point',
      catCustom: '🎨 Custom Icon / Image',
      customIconUrlLabel: 'Waypoint Icon or Photo',
      browseIconBtn: '📁 Browse File...',
      wpDescLabel: 'Description for Participants',
      wpNotesLabel: 'Logistical Notes (for Educators / Animators / Volunteers)',
      saveWpBtn: 'Save Waypoint',
      cancelBtn: 'Cancel',
      editBtn: '✏️ Edit',
      legendTitle: 'Logistics Waypoints Legend',
      showLegendExport: 'Include detailed legend in document export',
      participantsVersion: 'Participants Version',
      organizersVersion: 'Organizers / Safety Version',
      xyzWarning: '⚠️ Responsibility Notice: Verify custom XYZ server license and report credits.'
    }
  };

  private i18n: I18nManager | null = null;
  private mapInstances: Map<string, L.Map> = new Map();
  private routingControls: Map<string, any> = new Map();

  public async init(_eventBus: EventBus, i18n: I18nManager): Promise<void> {
    this.i18n = i18n;
  }

  public render(container: HTMLElement, dataState: MapPluginState, _currentLocale: string): void {
    if (!dataState.activeMode) dataState.activeMode = 'map';
    if (!dataState.tracks) dataState.tracks = [];
    if (!dataState.waypoints) dataState.waypoints = [];
    if (!dataState.routeWaypoints) dataState.routeWaypoints = [];
    if (!dataState.routeProfile) dataState.routeProfile = 'car';
    if (!dataState.activeBaseLayer) dataState.activeBaseLayer = 'osm';
    if (!dataState.activeOverlays) dataState.activeOverlays = ['waymarked'];
    if (dataState.showLegendInExport === undefined) dataState.showLegendInExport = true;
    if (dataState.isOrganizational === undefined) dataState.isOrganizational = false;
    if (!dataState.activeTab) dataState.activeTab = 'none';

    const t = (key: string) => (this.i18n ? this.i18n.t(`plugins.${this.id}.${key}`) : key);
    const blockId = `map-container-${Math.random().toString(36).substring(2, 9)}`;

    // PANNELLO PLUGIN MAPPE (MASCHERA CON LE 4 MODALITÀ DEL MASTER PROMPT V3.0)
    container.innerHTML = `
      <div class="map-plugin-v3 bg-slate-900 text-slate-100 rounded-lg p-4 shadow-2xl border border-slate-800 space-y-4">
        
        <!-- Header e Tab Menu a 4 Modalità -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 class="text-md font-bold text-blue-400 flex items-center gap-2">
              🗺️ ${t('title')}
            </h3>
          </div>

          <!-- Menu a 4 Opzioni -->
          <div class="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button class="mode-btn text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
              dataState.activeMode === 'map' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white'
            }" data-mode="map">
              ${t('modeMap')}
            </button>
            <button class="mode-btn text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
              dataState.activeMode === 'link' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white'
            }" data-mode="link">
              ${t('modeLink')}
            </button>
            <button class="mode-btn text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
              dataState.activeMode === 'route' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white'
            }" data-mode="route">
              ${t('modeRoute')}
            </button>
            <button class="mode-btn text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
              dataState.activeMode === 'track' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white'
            }" data-mode="track">
              ${t('modeTrack')}
            </button>
          </div>
        </div>

        <!-- AREA CONTROLLI SPECIFICA PER CIASCUNA MODALITÀ -->
        ${this.renderModeControls(dataState, t)}

        <!-- Banner Indicatore Pick da Mappa Attiva -->
        ${
          dataState.isPickingPointFromMap
            ? `
          <div class="bg-emerald-950/90 border-2 border-emerald-500 text-emerald-100 p-3 rounded-lg text-xs flex items-center justify-between shadow-lg animate-pulse">
            <div class="flex items-center gap-2">
              <span class="text-base">🎯</span>
              <span class="font-bold">${t('pickingBanner')}</span>
            </div>
            <button class="cancel-picking-btn bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded text-xs border border-slate-600">
              ${t('cancelPicking')}
            </button>
          </div>
        `
            : ''
        }

        <!-- AREA DI RENDERING DINAMICO LEAFLET -->
        <div class="relative">
          <div id="${blockId}" class="leaflet-map-element w-full h-[400px] rounded-lg border border-slate-700 ${
            dataState.isPickingPointFromMap ? 'leaflet-crosshair-mode' : ''
          }"></div>
        </div>

        <!-- MODALE COMPILAZIONE WAYPOINT -->
        ${this.renderWaypointModal(dataState, t)}

        <!-- TABELLA LEGENDA WAYPOINT -->
        ${this.renderWaypointLegend(dataState, t)}

        <!-- FOOTER ATTRIBUZIONI & COPYRIGHT OBBLIGATORI -->
        <div class="text-[11px] text-slate-500 border-t border-slate-800 pt-2 flex flex-wrap justify-between items-center gap-2">
          <span>Mappa e dati vettoriali: © OpenStreetMap contributors, OpenTopoMap, Waymarked Trails.</span>
          <button class="toggle-org-btn text-xs text-slate-400 hover:text-slate-200 underline">
            Modalità: ${dataState.isOrganizational ? t('organizersVersion') : t('participantsVersion')}
          </button>
        </div>

      </div>
    `;

    setTimeout(() => {
      this.initLeafletMap(blockId, container, dataState);
    }, 50);

    this.bindEvents(container, dataState);
  }

  private renderModeControls(dataState: MapPluginState, t: (k: string) => string): string {
    switch (dataState.activeMode) {
      case 'map':
        return `
          <div class="bg-slate-800/80 p-3 rounded-lg border border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <h4 class="font-bold text-blue-300">Modalità Visualizzazione & Waypoint</h4>
              <p class="text-[11px] text-slate-400">Esplora la mappa e posiziona punti di interesse semplici</p>
            </div>
            <button class="add-position-btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-md shadow flex items-center gap-1.5">
              ${t('addPositionBtn')}
            </button>
          </div>
        `;
      case 'link':
        return `
          <div class="bg-slate-800/80 p-3.5 rounded-lg border border-blue-800/80 text-xs space-y-2">
            <h4 class="font-bold text-blue-300 flex items-center gap-1.5">
              🔗 ${t('modeLink')} (Google Maps, Bing Maps, Apple Maps)
            </h4>
            <div class="flex flex-col sm:flex-row gap-2">
              <input type="text" value="${dataState.externalLinkUrl || ''}" placeholder="${t('linkInputPlaceholder')}" class="external-link-input bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 flex-1 focus:border-blue-500 focus:outline-none" />
              <button class="decode-link-btn bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded shrink-0 shadow">
                ${t('decodeLinkBtn')}
              </button>
            </div>
            ${
              dataState.resolvedLocation
                ? `
              <div class="text-xs text-emerald-400 font-medium bg-emerald-950/60 p-2 rounded border border-emerald-700/80">
                ✅ Posizione decodificata da ${dataState.resolvedLocation.source}: Lat ${dataState.resolvedLocation.lat.toFixed(5)}, Lng ${dataState.resolvedLocation.lng.toFixed(5)}
              </div>
            `
                : ''
            }
          </div>
        `;
      case 'track':
        return `
          <div class="bg-slate-800/80 p-3.5 rounded-lg border border-slate-700 text-xs space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 class="font-bold text-blue-300">${t('trackSectionTitle')}</h4>
                <p class="text-[11px] text-slate-400 italic">${t('trackSubtitle')}</p>
              </div>
              <button class="upload-gpx-btn bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3.5 py-2 rounded shadow">
                ${t('uploadGpxBtn')}
              </button>
              <input type="file" accept=".gpx,.kml,.geojson" multiple class="hidden gpx-file-input" />
            </div>

            <!-- Stima Naismith & Profilo Altimetrico Canvas -->
            ${this.renderTrackStatsAndCanvas(dataState, t)}
          </div>
        `;
      case 'route':
        return `
          <div class="bg-slate-800/80 p-3.5 rounded-lg border border-purple-800/80 text-xs space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 class="font-bold text-purple-300">${t('routeTitle')}</h4>
                <p class="text-[11px] text-slate-400">Routing automatico con OSRM (Auto) e BRouter (Sentieri Escursionistici)</p>
              </div>
              <div class="flex gap-2">
                <select class="route-profile-select bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100">
                  <option value="car" ${dataState.routeProfile === 'car' ? 'selected' : ''}>${t('routeCar')}</option>
                  <option value="foot" ${dataState.routeProfile === 'foot' ? 'selected' : ''}>${t('routeFoot')}</option>
                </select>
                <button class="clear-route-btn bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded font-medium">
                  ${t('clearRouteBtn')}
                </button>
              </div>
            </div>
          </div>
        `;
      default:
        return '';
    }
  }

  private renderTrackStatsAndCanvas(dataState: MapPluginState, t: (k: string) => string): string {
    if (dataState.tracks.length === 0) return '';
    const agg = this.getAggregateStats(dataState.tracks);
    if (!agg) return '';

    const hasNoElevation = dataState.tracks.some((tr) => !tr.hasElevationData);

    return `
      <div class="space-y-2 pt-2 border-t border-slate-700/80">
        <!-- Statistiche Aggregate -->
        <div class="bg-slate-900/80 p-3 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span class="text-slate-400 block">Distanza Totale</span>
            <span class="text-sm font-bold text-blue-400">${agg.totalDistanceKm.toFixed(2)} km</span>
          </div>
          <div>
            <span class="text-slate-400 block">Dislivello + Totale</span>
            <span class="text-sm font-bold text-emerald-400">+${agg.totalAscentMeters} m</span>
          </div>
          <div>
            <span class="text-slate-400 block">Dislivello - Totale</span>
            <span class="text-sm font-bold text-amber-400">-${agg.totalDescentMeters} m</span>
          </div>
          <div>
            <span class="text-slate-400 block">Tempo Naismith</span>
            <span class="text-sm font-bold text-purple-400">${Math.floor(agg.totalDurationMinutes / 60)}h ${agg.totalDurationMinutes % 60}m</span>
            <span class="text-[10px] text-slate-400 block italic">${t('naismithNotice')}</span>
          </div>
        </div>

        ${
          hasNoElevation
            ? `
          <div class="bg-amber-950/60 border border-amber-800 text-amber-200 p-2.5 rounded text-xs">
            ${t('noElevationWarning')}
            <a href="https://gpx.studio" target="_blank" rel="noopener noreferrer" class="underline font-bold text-amber-300">gpx.studio</a>.
          </div>
        `
            : ''
        }

        <!-- Canvas Altimetrico per la prima traccia valida -->
        <div class="bg-slate-900/60 p-2.5 rounded border border-slate-700 space-y-1">
          <div class="text-[11px] font-semibold text-slate-300">Profilo Altimetrico Percorso</div>
          <div class="relative w-full h-20">
            <canvas class="elevation-canvas w-full h-full cursor-crosshair"></canvas>
          </div>
        </div>
      </div>
    `;
  }

  private renderWaypointModal(dataState: MapPluginState, t: (k: string) => string): string {
    if (dataState.activeTab !== 'waypointModal' || !dataState.tempWaypoint) return '';

    return `
      <div class="bg-slate-800 border-2 border-emerald-500 p-4 rounded-lg text-xs space-y-3 shadow-2xl animate-fadeIn">
        <h4 class="font-bold text-emerald-300 border-b border-slate-700 pb-2 flex items-center justify-between">
          <span>📍 ${dataState.editingWaypointId ? 'Modifica Waypoint' : 'Nuovo Waypoint'} (Lat: ${dataState.tempWaypoint.lat?.toFixed(5)}, Lng: ${dataState.tempWaypoint.lng?.toFixed(5)})</span>
          <button class="close-wp-modal text-slate-400 hover:text-white font-bold text-sm">✕</button>
        </h4>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block text-slate-300 mb-1 font-semibold">${t('wpTitleLabel')}</label>
            <input type="text" value="${dataState.tempWaypoint.title || ''}" placeholder="es. Punto Ritrovo o Fontanella" class="wp-title-input bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 w-full focus:border-emerald-500 focus:outline-none" />
          </div>

          <div>
            <label class="block text-slate-300 mb-1 font-semibold">${t('wpCatLabel')}</label>
            <select class="wp-cat-input bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 w-full focus:border-emerald-500 focus:outline-none">
              <option value="water" ${dataState.tempWaypoint.category === 'water' ? 'selected' : ''}>${t('catWater')}</option>
              <option value="danger" ${dataState.tempWaypoint.category === 'danger' ? 'selected' : ''}>${t('catDanger')}</option>
              <option value="rest" ${dataState.tempWaypoint.category === 'rest' ? 'selected' : ''}>${t('catRest')}</option>
              <option value="emergency" ${dataState.tempWaypoint.category === 'emergency' ? 'selected' : ''}>${t('catEmergency')}</option>
              <option value="custom" ${dataState.tempWaypoint.category === 'custom' ? 'selected' : ''}>${t('catCustom')}</option>
            </select>
          </div>

          <div class="md:col-span-2 space-y-1">
            <label class="block text-slate-300 font-semibold">${t('customIconUrlLabel')}</label>
            <div class="flex items-center gap-2">
              <input type="text" value="${dataState.tempWaypoint.customIconUrl || ''}" placeholder="https://... o seleziona un file dal dispositivo" class="wp-icon-url-input bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 flex-1 focus:border-emerald-500 focus:outline-none text-xs" />
              <button type="button" class="browse-icon-file-btn bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded font-medium text-xs whitespace-nowrap shadow">
                ${t('browseIconBtn')}
              </button>
              <input type="file" accept="image/*" class="hidden wp-icon-file-input" />
            </div>
            ${
              dataState.tempWaypoint.customIconUrl
                ? `
              <div class="flex items-center gap-2 mt-1.5 bg-slate-900/80 p-2 rounded border border-slate-700 w-fit">
                <span class="text-slate-400 text-[11px]">Anteprima Icona:</span>
                <img src="${dataState.tempWaypoint.customIconUrl}" class="w-7 h-7 object-contain rounded bg-slate-800 p-0.5 border border-slate-600" />
              </div>
            `
                : ''
            }
          </div>

          <div class="md:col-span-2">
            <label class="block text-slate-300 mb-1 font-semibold">${t('wpDescLabel')}</label>
            <input type="text" value="${dataState.tempWaypoint.description || ''}" placeholder="Descrizione visibile a tutti i partecipanti" class="wp-desc-input bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 w-full focus:border-emerald-500 focus:outline-none" />
          </div>

          <div class="md:col-span-2">
            <label class="block text-amber-300 mb-1 font-semibold">${t('wpNotesLabel')}</label>
            <input type="text" value="${dataState.tempWaypoint.notesLogistica || ''}" placeholder="Note riservate agli educatori (es. orari sosta, attrezzature)" class="wp-notes-input bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 w-full focus:border-amber-500 focus:outline-none" />
          </div>
        </div>

        <div class="flex justify-end gap-2 border-t border-slate-700 pt-2.5">
          <button class="cancel-wp-btn bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded font-medium">${t('cancelBtn')}</button>
          <button class="save-wp-btn bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded font-bold">${t('saveWpBtn')}</button>
        </div>
      </div>
    `;
  }

  private renderWaypointLegend(dataState: MapPluginState, t: (k: string) => string): string {
    if (dataState.waypoints.length === 0) return '';

    return `
      <div class="bg-slate-800/80 p-3 rounded-lg border border-slate-700 text-xs space-y-2">
        <div class="flex items-center justify-between">
          <h4 class="font-bold text-slate-200">${t('legendTitle')} (${dataState.waypoints.length})</h4>
          <label class="flex items-center gap-1.5 cursor-pointer text-slate-400 text-[11px]">
            <input type="checkbox" ${dataState.showLegendInExport ? 'checked' : ''} class="show-legend-export-cb" />
            <span>${t('showLegendExport')}</span>
          </label>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-slate-300">
            <thead>
              <tr class="border-b border-slate-700 text-slate-400 font-semibold">
                <th class="py-1 px-2">#</th>
                <th class="py-1 px-2">Simbolo</th>
                <th class="py-1 px-2">Nome Presidio</th>
                <th class="py-1 px-2">Coordinate</th>
                <th class="py-1 px-2">Note Logistiche</th>
                <th class="py-1 px-2 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              ${dataState.waypoints
                .map(
                  (wp, idx) => `
                <tr class="border-b border-slate-800/60 hover:bg-slate-800/40">
                  <td class="py-1 px-2 font-mono text-slate-400">${idx + 1}</td>
                  <td class="py-1 px-2">${this.renderWpSymbol(wp)}</td>
                  <td class="py-1 px-2 font-semibold text-slate-200">${wp.title}</td>
                  <td class="py-1 px-2 font-mono text-[10px] text-slate-400">${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)}</td>
                  <td class="py-1 px-2 text-slate-300">${wp.notesLogistica || wp.description || '-'}</td>
                  <td class="py-1 px-2 text-right flex items-center justify-end gap-1">
                    <button data-edit-id="${wp.id}" class="edit-wp-btn bg-slate-700 hover:bg-slate-600 text-blue-300 text-[11px] px-2 py-0.5 rounded font-medium">${t('editBtn')}</button>
                    <button data-delete-id="${wp.id}" class="delete-wp-btn text-red-400 hover:text-red-300 font-bold px-1.5">✕</button>
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

  private initLeafletMap(blockId: string, container: HTMLElement, dataState: MapPluginState): void {
    const mapEl = container.querySelector<HTMLElement>(`#${blockId}`);
    if (!mapEl) return;

    if (this.mapInstances.has(blockId)) {
      this.mapInstances.get(blockId)!.remove();
    }

    const defaultCenter: L.LatLngTuple = dataState.resolvedLocation
      ? [dataState.resolvedLocation.lat, dataState.resolvedLocation.lng]
      : [45.8912, 9.1245];

    const map = L.map(mapEl, {
      center: defaultCenter,
      zoom: dataState.resolvedLocation ? 14 : 12,
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
      attribution: 'Trails: &copy; Waymarked Trails'
    });

    if (dataState.activeBaseLayer === 'opentopo') {
      topoLayer.addTo(map);
    } else if (dataState.activeBaseLayer === 'custom' && dataState.customTileUrl) {
      L.tileLayer(dataState.customTileUrl, { attribution: 'Custom Tile Server' }).addTo(map);
    } else {
      osmLayer.addTo(map);
    }

    if (dataState.activeOverlays.includes('waymarked')) {
      waymarkedOverlay.addTo(map);
    }

    // DISEGNO TRACCE MULTIPLE
    if (dataState.tracks.length > 0) {
      const boundsGroup = L.featureGroup();
      dataState.tracks.forEach((tr) => {
        const geoLayer = L.geoJSON(tr.geoJson as any, {
          style: { color: tr.color || '#3b82f6', weight: 4, opacity: 0.85 }
        }).addTo(map);
        boundsGroup.addLayer(geoLayer);
      });
      map.fitBounds(boundsGroup.getBounds(), { padding: [20, 20] });
    }

    // MOSTRA POSIZIONE DECODIFICATA DA LINK ESTERNO (Opzione B)
    if (dataState.resolvedLocation) {
      const resolvedIcon = L.divIcon({
        className: 'custom-wp-marker',
        html: `<div style="font-size:26px; text-shadow:0 0 6px #000;">📍</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      });
      L.marker([dataState.resolvedLocation.lat, dataState.resolvedLocation.lng], { icon: resolvedIcon })
        .addTo(map)
        .bindPopup(`<strong>Posizione da Link Esterno</strong><br/>${dataState.resolvedLocation.source}`)
        .openPopup();
    }

    // DISEGNO WAYPOINTS
    dataState.waypoints.forEach((wp) => {
      const symbolHtml = wp.customIconUrl
        ? `<img src="${wp.customIconUrl}" class="w-6 h-6 object-contain" />`
        : `<div style="font-size:20px; text-shadow:0 0 4px #000;">${this.getCategorySymbol(wp.category)}</div>`;

      const customIcon = L.divIcon({
        className: 'custom-wp-marker',
        html: symbolHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      L.marker([wp.lat, wp.lng], { icon: customIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-size:12px; color:#1e293b;">
            <strong>${wp.title}</strong><br/>
            <span>${wp.description || ''}</span>
            ${wp.notesLogistica ? `<div style="margin-top:4px; color:#0369a1; font-weight:600;">Note Educatori: ${wp.notesLogistica}</div>` : ''}
          </div>
        `);
    });

    // INSERISCI PERCORSO (Routing Machine per Opzione D)
    if (dataState.activeMode === 'route') {
      const routerUrl =
        dataState.routeProfile === 'car'
          ? 'https://router.project-osrm.org/route/v1'
          : 'https://router.project-osrm.org/route/v1';

      const waypoints =
        dataState.routeWaypoints.length >= 2
          ? dataState.routeWaypoints.map((w) => L.latLng(w.lat, w.lng))
          : [L.latLng(45.8912, 9.1245), L.latLng(45.8985, 9.1350)];

      const routingControl = (L as any).Routing.control({
        waypoints,
        router: (L as any).Routing.osrmv1({
          serviceUrl: routerUrl,
          profile: dataState.routeProfile === 'car' ? 'driving' : 'foot'
        }),
        show: true,
        addWaypoints: true,
        routeWhileDragging: true
      }).addTo(map);

      this.routingControls.set(blockId, routingControl);
    }

    // Rilevamento Click Mappa per Pick
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (dataState.isPickingPointFromMap) {
        dataState.isPickingPointFromMap = false;
        dataState.editingWaypointId = null;
        dataState.tempWaypoint = {
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          category: 'water',
          title: '',
          description: '',
          notesLogistica: ''
        };
        dataState.activeTab = 'waypointModal';
        this.render(container, dataState, '');
      }
    });

    this.mapInstances.set(blockId, map);
  }

  private bindEvents(container: HTMLElement, dataState: MapPluginState): void {
    // Tab Menu Modalità
    container.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const mode = (e.currentTarget as HTMLElement).getAttribute('data-mode') as any;
        dataState.activeMode = mode;
        this.render(container, dataState, '');
      });
    });

    // Option A: Inserisci Posizione
    container.querySelector('.add-position-btn')?.addEventListener('click', () => {
      dataState.isPickingPointFromMap = true;
      this.render(container, dataState, '');
    });

    // Option B: Decodifica Link Cartografico Esterno (Regex Parser)
    container.querySelector('.decode-link-btn')?.addEventListener('click', () => {
      const input = container.querySelector<HTMLInputElement>('.external-link-input');
      if (input) {
        const url = input.value.trim();
        dataState.externalLinkUrl = url;
        const decoded = this.parseMapLink(url);
        if (decoded) {
          dataState.resolvedLocation = decoded;
        } else {
          alert(this.i18n?.t(`plugins.${this.id}.linkError`) || 'Link non valido');
        }
        this.render(container, dataState, '');
      }
    });

    // Option D: Cambia profilo routing / Clear route
    container.querySelector<HTMLSelectElement>('.route-profile-select')?.addEventListener('change', (e) => {
      dataState.routeProfile = (e.target as HTMLSelectElement).value as any;
      this.render(container, dataState, '');
    });

    container.querySelector('.clear-route-btn')?.addEventListener('click', () => {
      dataState.routeWaypoints = [];
      dataState.routeResult = null;
      this.render(container, dataState, '');
    });

    // Header Buttons
    container.querySelector('.toggle-fullscreen-btn')?.addEventListener('click', () => {
      dataState.isFullscreen = !dataState.isFullscreen;
      this.render(container, dataState, '');
    });

    container.querySelector('.toggle-views-btn')?.addEventListener('click', () => {
      dataState.activeTab = dataState.activeTab === 'views' ? 'none' : 'views';
      this.render(container, dataState, '');
    });

    container.querySelector('.toggle-settings-btn')?.addEventListener('click', () => {
      dataState.activeTab = dataState.activeTab === 'settings' ? 'none' : 'settings';
      this.render(container, dataState, '');
    });

    container.querySelector('.toggle-org-version-btn')?.addEventListener('click', () => {
      dataState.isOrganizational = !dataState.isOrganizational;
      this.render(container, dataState, '');
    });

    container.querySelector('.toggle-org-btn')?.addEventListener('click', () => {
      dataState.isOrganizational = !dataState.isOrganizational;
      this.render(container, dataState, '');
    });

    container.querySelector('.close-map-btn')?.addEventListener('click', () => {
      dataState.isExpanded = false;
      dataState.isFullscreen = false;
      this.render(container, dataState, '');
    });

    // Layer Switcher
    container.querySelectorAll<HTMLInputElement>('.layer-radio').forEach((r) => {
      r.addEventListener('change', (e) => {
        dataState.activeBaseLayer = (e.target as HTMLInputElement).value as any;
        this.render(container, dataState, '');
      });
    });

    container.querySelector<HTMLInputElement>('.overlay-waymarked-cb')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      if (checked && !dataState.activeOverlays.includes('waymarked')) {
        dataState.activeOverlays.push('waymarked');
      } else {
        dataState.activeOverlays = dataState.activeOverlays.filter((o) => o !== 'waymarked');
      }
      this.render(container, dataState, '');
    });

    // Upload Tracce Multiple
    const uploadGpxBtn = container.querySelector('.upload-gpx-btn');
    const gpxInput = container.querySelector<HTMLInputElement>('.gpx-file-input');
    uploadGpxBtn?.addEventListener('click', () => gpxInput?.click());
    gpxInput?.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        this.handleFileUpload(files, container, dataState);
      }
    });

    // Modalità Pick da Mappa
    container.querySelector('.pick-map-btn')?.addEventListener('click', () => {
      dataState.isPickingPointFromMap = true;
      dataState.activeTab = 'none';
      this.render(container, dataState, '');
    });

    container.querySelector('.cancel-picking-btn')?.addEventListener('click', () => {
      dataState.isPickingPointFromMap = false;
      this.render(container, dataState, '');
    });

    container.querySelector('.manual-coords-btn')?.addEventListener('click', () => {
      dataState.isPickingPointFromMap = false;
      dataState.editingWaypointId = null;
      dataState.tempWaypoint = {
        lat: 45.8912,
        lng: 9.1245,
        category: 'water',
        title: '',
        description: '',
        notesLogistica: ''
      };
      dataState.activeTab = 'waypointModal';
      this.render(container, dataState, '');
    });

    // Actions Modale Waypoint
    container.querySelector('.close-wp-modal')?.addEventListener('click', () => {
      dataState.activeTab = 'none';
      dataState.tempWaypoint = null;
      dataState.editingWaypointId = null;
      this.render(container, dataState, '');
    });

    container.querySelector('.cancel-wp-btn')?.addEventListener('click', () => {
      dataState.activeTab = 'none';
      dataState.tempWaypoint = null;
      dataState.editingWaypointId = null;
      this.render(container, dataState, '');
    });

    // Binding Input Waypoint in-memory
    const titleInput = container.querySelector<HTMLInputElement>('.wp-title-input');
    const catInput = container.querySelector<HTMLSelectElement>('.wp-cat-input');
    const iconUrlInput = container.querySelector<HTMLInputElement>('.wp-icon-url-input');
    const descInput = container.querySelector<HTMLInputElement>('.wp-desc-input');
    const notesInput = container.querySelector<HTMLInputElement>('.wp-notes-input');

    titleInput?.addEventListener('input', (e) => {
      if (dataState.tempWaypoint) {
        dataState.tempWaypoint.title = (e.target as HTMLInputElement).value;
      }
    });

    catInput?.addEventListener('change', (e) => {
      if (dataState.tempWaypoint) {
        dataState.tempWaypoint.category = (e.target as HTMLSelectElement).value as any;
      }
    });

    iconUrlInput?.addEventListener('input', (e) => {
      if (dataState.tempWaypoint) {
        dataState.tempWaypoint.customIconUrl = (e.target as HTMLInputElement).value.trim();
        if (dataState.tempWaypoint.customIconUrl) {
          dataState.tempWaypoint.category = 'custom';
        }
      }
    });

    descInput?.addEventListener('input', (e) => {
      if (dataState.tempWaypoint) {
        dataState.tempWaypoint.description = (e.target as HTMLInputElement).value;
      }
    });

    notesInput?.addEventListener('input', (e) => {
      if (dataState.tempWaypoint) {
        dataState.tempWaypoint.notesLogistica = (e.target as HTMLInputElement).value;
      }
    });

    // FilePicker locale per icone
    const browseIconBtn = container.querySelector('.browse-icon-file-btn');
    const iconFileInput = container.querySelector<HTMLInputElement>('.wp-icon-file-input');

    browseIconBtn?.addEventListener('click', () => iconFileInput?.click());
    iconFileInput?.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const base64Data = evt.target?.result as string;
          if (base64Data && dataState.tempWaypoint) {
            dataState.tempWaypoint.customIconUrl = base64Data;
            dataState.tempWaypoint.category = 'custom';
            this.render(container, dataState, '');
          }
        };
        reader.readAsDataURL(files[0]);
      }
    });

    // Salva Waypoint
    container.querySelector('.save-wp-btn')?.addEventListener('click', () => {
      if (dataState.tempWaypoint && dataState.tempWaypoint.lat !== undefined) {
        const title = dataState.tempWaypoint.title?.trim() || 'Punto Presidio';

        if (dataState.editingWaypointId) {
          const idx = dataState.waypoints.findIndex((w) => w.id === dataState.editingWaypointId);
          if (idx !== -1) {
            dataState.waypoints[idx] = {
              id: dataState.editingWaypointId,
              lat: dataState.tempWaypoint.lat,
              lng: dataState.tempWaypoint.lng!,
              title,
              category: dataState.tempWaypoint.category || 'water',
              customIconUrl: dataState.tempWaypoint.customIconUrl,
              description: dataState.tempWaypoint.description || '',
              notesLogistica: dataState.tempWaypoint.notesLogistica || ''
            };
          }
        } else {
          dataState.waypoints.push({
            id: String(Date.now()),
            lat: dataState.tempWaypoint.lat,
            lng: dataState.tempWaypoint.lng!,
            title,
            category: dataState.tempWaypoint.category || 'water',
            customIconUrl: dataState.tempWaypoint.customIconUrl,
            description: dataState.tempWaypoint.description || '',
            notesLogistica: dataState.tempWaypoint.notesLogistica || ''
          });
        }

        dataState.activeTab = 'none';
        dataState.tempWaypoint = null;
        dataState.editingWaypointId = null;
        this.render(container, dataState, '');
      }
    });

    // Modifica Waypoint
    container.querySelectorAll('.edit-wp-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).getAttribute('data-edit-id');
        const found = dataState.waypoints.find((w) => w.id === id);
        if (found) {
          dataState.editingWaypointId = found.id;
          dataState.tempWaypoint = { ...found };
          dataState.activeTab = 'waypointModal';
          this.render(container, dataState, '');
        }
      });
    });

    // Elimina Waypoint
    container.querySelectorAll('.delete-wp-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).getAttribute('data-delete-id');
        dataState.waypoints = dataState.waypoints.filter((w) => w.id !== id);
        this.render(container, dataState, '');
      });
    });
  }

  /**
   * REGEX PARSER NATIVO PER DECODIFICARE LINK CARTOGRAFICI ESTERNI
   * (Google Maps, Bing Maps, Apple Maps)
   */
  private parseMapLink(url: string): { lat: number; lng: number; source: string } | null {
    if (!url) return null;

    // Google Maps
    const googleMatch =
      url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
      url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
      url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);

    if (googleMatch) {
      return {
        lat: parseFloat(googleMatch[1]),
        lng: parseFloat(googleMatch[2]),
        source: 'Google Maps'
      };
    }

    // Bing Maps
    const bingMatch =
      url.match(/[?&]cp=(-?\d+\.\d+)~(-?\d+\.\d+)/) ||
      url.match(/[?&]where1=(-?\d+\.\d+)[,%2C]+(-?\d+\.\d+)/);

    if (bingMatch) {
      return {
        lat: parseFloat(bingMatch[1]),
        lng: parseFloat(bingMatch[2]),
        source: 'Bing Maps'
      };
    }

    // Apple Maps
    const appleMatch =
      url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
      url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);

    if (appleMatch) {
      return {
        lat: parseFloat(appleMatch[1]),
        lng: parseFloat(appleMatch[2]),
        source: 'Apple Maps'
      };
    }

    return null;
  }

  private handleFileUpload(files: FileList | File[], container: HTMLElement, dataState: MapPluginState): void {
    const fileArray = Array.from(files);
    let processedCount = 0;

    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          const fileName = file.name;
          const lowerName = fileName.toLowerCase();
          let parsedGeoJson: GeoJsonTrackFeature | null = null;

          if (lowerName.endsWith('.gpx')) {
            parsedGeoJson = this.parseGPX(content);
          } else if (lowerName.endsWith('.kml')) {
            parsedGeoJson = this.parseKML(content);
          } else if (lowerName.endsWith('.geojson') || lowerName.endsWith('.json')) {
            try {
              parsedGeoJson = JSON.parse(content);
            } catch (err) {
              console.error('[MapPlugin] Error parsing GeoJSON:', err);
            }
          }

          if (parsedGeoJson) {
            const stats = this.calculateTrackStats(parsedGeoJson);
            const hasElevationData = parsedGeoJson.geometry.coordinates.some((c) => c.length > 2 && !isNaN(c[2]));
            const colorIndex = dataState.tracks.length % TRACK_COLORS.length;

            dataState.tracks.push({
              id: `track-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              fileName,
              geoJson: parsedGeoJson,
              color: TRACK_COLORS[colorIndex],
              hasElevationData,
              stats
            });
          }
        }

        processedCount++;
        if (processedCount === fileArray.length) {
          this.render(container, dataState, '');
        }
      };
      reader.readAsText(file);
    });
  }

  private getAggregateStats(tracks: TrackItem[]) {
    if (tracks.length === 0) return null;
    let totalDistanceKm = 0;
    let totalAscentMeters = 0;
    let totalDescentMeters = 0;
    let totalDurationMinutes = 0;

    tracks.forEach((t) => {
      totalDistanceKm += t.stats.distanceKm;
      totalAscentMeters += t.stats.ascentMeters;
      totalDescentMeters += t.stats.descentMeters;
      totalDurationMinutes += t.stats.durationMinutes;
    });

    return {
      totalDistanceKm,
      totalAscentMeters,
      totalDescentMeters,
      totalDurationMinutes
    };
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

  private parseKML(xmlText: string): GeoJsonTrackFeature | null {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const coordNode = xmlDoc.querySelector('coordinates');

    if (!coordNode || !coordNode.textContent) return null;

    const rawCoords = coordNode.textContent.trim().split(/\s+/);
    const coordinates: number[][] = [];

    rawCoords.forEach((str) => {
      const parts = str.split(',').map((p) => parseFloat(p));
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        coordinates.push(parts);
      }
    });

    if (coordinates.length === 0) return null;

    return {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates }
    };
  }

  /**
   * STIMA TEMPI CON LA REGOLA DI NAISMITH MASTER PROMPT V3.0:
   * 4 km/h in piano + 10 min ogni 100m di dislivello positivo (+1h ogni 600m)
   */
  private calculateTrackStats(geoJson: GeoJsonTrackFeature) {
    const coords = geoJson.geometry.coordinates;
    let distanceMeters = 0;
    let ascentMeters = 0;
    let descentMeters = 0;

    for (let i = 0; i < coords.length - 1; i++) {
      const [lng1, lat1, ele1] = coords[i];
      const [lng2, lat2, ele2] = coords[i + 1];

      distanceMeters += this.haversineDistance(lat1, lng1, lat2, lng2);

      if (ele1 !== undefined && ele2 !== undefined && !isNaN(ele1) && !isNaN(ele2)) {
        const diff = ele2 - ele1;
        if (diff > 0) ascentMeters += diff;
        else descentMeters += Math.abs(diff);
      }
    }

    const distanceKm = distanceMeters / 1000;
    const horizontalMins = (distanceKm / 4.0) * 60;
    const verticalMins = (ascentMeters / 100.0) * 10;
    const durationMinutes = Math.round(horizontalMins + verticalMins);

    return {
      distanceKm,
      ascentMeters: Math.round(ascentMeters),
      descentMeters: Math.round(descentMeters),
      durationMinutes,
      isNaismithEstimate: true
    };
  }

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

  private getCategorySymbol(category: string): string {
    switch (category) {
      case 'water':
        return '💧';
      case 'danger':
        return '⚠️';
      case 'rest':
        return '🏕️';
      case 'emergency':
        return '🚑';
      default:
        return '📍';
    }
  }

  private renderWpSymbol(wp: WaypointPOI): string {
    if (wp.customIconUrl) {
      return `<img src="${wp.customIconUrl}" class="w-4 h-4 inline-block object-contain" />`;
    }
    return this.getCategorySymbol(wp.category);
  }

  public serializeToMarkdown(dataState: MapPluginState): string {
    const lines: string[] = [];

    lines.push(`### 🗺️ Percorsi ed Analisi Cartografica GIS (Master Prompt v3.0)\n`);

    if (dataState.tracks.length > 0) {
      const agg = this.getAggregateStats(dataState.tracks);
      if (agg) {
        lines.push(`- **Distanza Totale Complessiva**: ${agg.totalDistanceKm.toFixed(2)} km`);
        lines.push(`- **Dislivello Positivo Totale**: +${agg.totalAscentMeters} m`);
        lines.push(`- **Dislivello Negativo Totale**: -${agg.totalDescentMeters} m`);
        lines.push(
          `- **Tempo di Percorrenza Totale Stimato**: ${Math.floor(agg.totalDurationMinutes / 60)}h ${
            agg.totalDurationMinutes % 60
          }m (Stima Regola di Naismith v3.0)\n`
        );
      }
    }

    if (dataState.resolvedLocation) {
      lines.push(`#### 📍 Posizione da Link Esterno Decodificato\n`);
      lines.push(
        `- **Sorgente**: ${dataState.resolvedLocation.source} | **Coordinate**: Lat ${dataState.resolvedLocation.lat.toFixed(
          5
        )}, Lng ${dataState.resolvedLocation.lng.toFixed(5)}\n`
      );
    }

    if (dataState.isOrganizational || dataState.showLegendInExport) {
      lines.push(`#### 🚑 Legenda e Note Logistiche per Responsabili, Educatori ed Animatori\n`);

      if (dataState.waypoints.length > 0) {
        lines.push(`| # | Simbolo | Presidio / Waypoint | Coordinate | Note Logistiche per Educatori |`);
        lines.push(`|---|---|---|---|---|`);
        dataState.waypoints.forEach((wp, idx) => {
          const sym = this.getCategorySymbol(wp.category);
          lines.push(
            `| ${idx + 1} | ${sym} | **${wp.title}** | ${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)} | ${
              wp.notesLogistica || wp.description || '-'
            } |`
          );
        });
        lines.push(`\n`);
      }
    }

    lines.push(`*Mappa e dati vettoriali: © OpenStreetMap contributors, OpenTopoMap, Waymarked Trails.*`);

    return lines.join('\n');
  }
}
