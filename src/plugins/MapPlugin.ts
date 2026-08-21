import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
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

export interface MapPluginState {
  isExpanded?: boolean;
  isFullscreen?: boolean; // Attiva la vista a tutto schermo della mappa
  activeTab?: 'none' | 'views' | 'settings' | 'waypointModal';
  isPickingPointFromMap?: boolean;
  trackGeoJson?: GeoJsonTrackFeature | null;
  waypoints: WaypointPOI[];
  activeBaseLayer: 'osm' | 'opentopo' | 'custom';
  activeOverlays: string[];
  customTileUrl?: string;
  showLegendInExport: boolean;
  isOrganizational: boolean;
  hasElevationData: boolean;
  tempWaypoint?: Partial<WaypointPOI> | null;
  editingWaypointId?: string | null; // Traccia l'ID del waypoint in fase di modifica
  stats?: {
    distanceKm: number;
    ascentMeters: number;
    descentMeters: number;
    durationMinutes: number;
    isNaismithEstimate: boolean;
  };
}

export class MapPlugin implements AppPlugin {
  public id = 'map-plugin';
  public name = 'Mappe & Logistica Percorsi';
  public isCollaborative = true;

  public locales = {
    it: {
      title: 'Mappa ed Analisi Percorso Escursionistico',
      openMapBtn: '📍 Apri Mappa ed Analisi Logistica',
      closeMapBtn: '✖️ Riduci Mappa',
      fullscreenBtn: '🖥️ Schermo Intero',
      exitFullscreenBtn: '🗗 Esci da Schermo Intero',
      changeViewBtn: '🎨 Cambia Vista',
      settingsBtn: '⚙️ Impostazioni Plugin',
      osmLayer: 'OpenStreetMap Standard',
      topoLayer: 'OpenTopoMap Escursionistica',
      waymarkedOverlay: 'Sentieri Escursionistici (Waymarked Trails)',
      customXYZTitle: 'Configurazione Tile Server XYZ Custom (Modulo Impostazioni)',
      customXYZLabel: 'URL Tile Server XYZ Personalizzato',
      customXYZPlaceholder: 'https://server.tile.org/{z}/{x}/{y}.png',
      xyzWarning: '⚠️ Avviso di Responsabilità: Verificare la licenza d\'uso del server XYZ personalizzato ed inserire i corretti crediti d\'autore nel documento finale.',
      trackSectionTitle: '📁 Inserimento Traccia Escursionista',
      trackSubtitle: 'Selezionate la o le tracce GPX e KML che volete visualizzare',
      uploadGpxBtn: 'Carica File (.gpx / .kml)',
      waypointSectionTitle: '📍 Inserimento Waypoint / Presidio Logistico',
      pickFromMapBtn: '🎯 Seleziona punto da mappa',
      manualCoordsBtn: '✍️ Inserisci coordinate',
      pickingBanner: '🎯 Clicca in qualsiasi punto della mappa per catturare le coordinate del Waypoint',
      cancelPicking: 'Annulla Selezione',
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
      statsTitle: 'Statistiche Percorso (Regola di Naismith)',
      elevationProfileTitle: 'Profilo Altimetrico',
      legendTitle: 'Legenda Logistica dei Waypoint',
      showLegendExport: 'Includi la legenda dettagliata dei waypoint nell\'esportazione finale',
      participantsVersion: 'Versione Partecipanti',
      organizersVersion: 'Versione Responsabili / Sicurezza'
    },
    en: {
      title: 'Hiking Trail Map & Analysis',
      openMapBtn: '📍 Open Map & Logistics View',
      closeMapBtn: '✖️ Collapse Map',
      fullscreenBtn: '🖥️ Fullscreen',
      exitFullscreenBtn: '🗗 Exit Fullscreen',
      changeViewBtn: '🎨 Change View',
      settingsBtn: '⚙️ Plugin Settings',
      osmLayer: 'OpenStreetMap Standard',
      topoLayer: 'OpenTopoMap Hiking',
      waymarkedOverlay: 'Hiking Trails (Waymarked Trails)',
      customXYZTitle: 'Custom XYZ Tile Server Configuration (Settings Module)',
      customXYZLabel: 'Custom XYZ Tile Server URL',
      customXYZPlaceholder: 'https://server.tile.org/{z}/{x}/{y}.png',
      xyzWarning: '⚠️ Responsibility Notice: Verify custom XYZ server license and include proper attributions.',
      trackSectionTitle: '📁 Upload Trail Track',
      trackSubtitle: 'Select the GPX and KML tracks you want to display',
      uploadGpxBtn: 'Upload File (.gpx / .kml)',
      waypointSectionTitle: '📍 Add Waypoint / POI',
      pickFromMapBtn: '🎯 Select point from map',
      manualCoordsBtn: '✍️ Enter coordinates',
      pickingBanner: '🎯 Click anywhere on the map to pick Waypoint coordinates',
      cancelPicking: 'Cancel Selection',
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
      statsTitle: 'Trail Statistics (Naismith\'s Rule)',
      elevationProfileTitle: 'Elevation Profile',
      legendTitle: 'Logistics Waypoints Legend',
      showLegendExport: 'Include detailed waypoints legend in document export',
      participantsVersion: 'Participants Version',
      organizersVersion: 'Organizers / Safety Version'
    }
  };

  private i18n: I18nManager | null = null;
  private mapInstances: Map<string, L.Map> = new Map();

  public async init(_eventBus: EventBus, i18n: I18nManager): Promise<void> {
    this.i18n = i18n;
  }

  public render(container: HTMLElement, dataState: MapPluginState, _currentLocale: string): void {
    if (!dataState.waypoints) dataState.waypoints = [];
    if (!dataState.activeBaseLayer) dataState.activeBaseLayer = 'osm';
    if (!dataState.activeOverlays) dataState.activeOverlays = ['waymarked'];
    if (dataState.showLegendInExport === undefined) dataState.showLegendInExport = true;
    if (dataState.isOrganizational === undefined) dataState.isOrganizational = false;
    if (dataState.isExpanded === undefined) dataState.isExpanded = false;
    if (dataState.isFullscreen === undefined) dataState.isFullscreen = false;
    if (!dataState.activeTab) dataState.activeTab = 'none';

    const t = (key: string) => (this.i18n ? this.i18n.t(`plugins.${this.id}.${key}`) : key);
    const blockId = `map-container-${Math.random().toString(36).substring(2, 9)}`;

    // VISTA CONTRATTA
    if (!dataState.isExpanded && !dataState.isFullscreen) {
      container.innerHTML = `
        <div class="map-collapsed-card bg-slate-900 border border-slate-800 rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-blue-950 border border-blue-800 flex items-center justify-center text-xl shrink-0">
              🗺️
            </div>
            <div>
              <h4 class="font-bold text-slate-100 text-sm">${t('title')}</h4>
              <p class="text-xs text-slate-400">
                ${dataState.stats ? `${dataState.stats.distanceKm.toFixed(2)} km | +${dataState.stats.ascentMeters}m | ` : ''}
                ${dataState.waypoints.length} Waypoint inseriti | 
                <span class="${dataState.isOrganizational ? 'text-amber-400' : 'text-blue-400'} font-medium">
                  ${dataState.isOrganizational ? t('organizersVersion') : t('participantsVersion')}
                </span>
              </p>
            </div>
          </div>
          <button class="open-map-btn bg-blue-600 hover:bg-blue-700 text-white text-xs px-3.5 py-2 rounded-md font-semibold transition-colors shrink-0 shadow">
            ${t('openMapBtn')}
          </button>
        </div>
      `;

      container.querySelector('.open-map-btn')?.addEventListener('click', () => {
        dataState.isExpanded = true;
        this.render(container, dataState, _currentLocale);
      });
      return;
    }

    // VISTA ESPANSA O FULLSCREEN
    const wrapperClass = dataState.isFullscreen
      ? 'fixed inset-0 z-[9999] w-screen h-screen bg-slate-950 p-4 sm:p-6 overflow-y-auto text-slate-100 space-y-4'
      : 'map-expanded-view bg-slate-900 text-slate-100 rounded-lg p-4 shadow-xl border border-slate-800 space-y-4';

    const mapHeightClass = dataState.isFullscreen ? 'h-[calc(100vh-280px)] min-h-[450px]' : 'h-[380px]';

    container.innerHTML = `
      <div class="${wrapperClass}">
        
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <h3 class="text-md font-bold text-blue-400 flex items-center gap-1.5">
              🗺️ ${t('title')} ${dataState.isFullscreen ? '(Modalità Schermo Intero)' : ''}
            </h3>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <!-- Pulsante Fullscreen -->
            <button class="toggle-fullscreen-btn text-xs px-2.5 py-1.5 rounded font-medium border transition-colors ${
              dataState.isFullscreen ? 'bg-amber-600 text-white border-amber-500' : 'bg-blue-600 text-white border-blue-500 hover:bg-blue-700'
            }">
              ${dataState.isFullscreen ? t('exitFullscreenBtn') : t('fullscreenBtn')}
            </button>

            <!-- Pulsante Cambia Vista -->
            <button class="toggle-views-btn text-xs px-2.5 py-1.5 rounded font-medium border transition-colors ${
              dataState.activeTab === 'views'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }">
              ${t('changeViewBtn')}
            </button>

            <!-- Pulsante Impostazioni Plugin -->
            <button class="toggle-settings-btn text-xs px-2.5 py-1.5 rounded font-medium border transition-colors ${
              dataState.activeTab === 'settings'
                ? 'bg-purple-600 text-white border-purple-500'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }">
              ${t('settingsBtn')}
            </button>

            <!-- Toggle Versione Partecipanti/Organizzatori -->
            <button class="toggle-org-version-btn text-xs px-2.5 py-1.5 rounded font-medium border transition-colors ${
              dataState.isOrganizational ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-800 text-slate-200 border-slate-700'
            }">
              ${dataState.isOrganizational ? t('organizersVersion') : t('participantsVersion')}
            </button>

            <!-- Pulsante Riduci Mappa -->
            ${
              !dataState.isFullscreen
                ? `
              <button class="close-map-btn bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs px-2.5 py-1.5 rounded font-medium">
                ${t('closeMapBtn')}
              </button>
            `
                : ''
            }
          </div>
        </div>

        <!-- Pannello "Cambia Vista" -->
        ${
          dataState.activeTab === 'views'
            ? `
          <div class="bg-slate-800/90 border border-blue-800 p-3 rounded-lg text-xs space-y-2">
            <h4 class="font-bold text-blue-300">Seleziona Tipo Mappa & Sovrapposizioni</h4>
            <div class="flex flex-wrap gap-4">
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="base-layer-${blockId}" value="osm" ${dataState.activeBaseLayer === 'osm' ? 'checked' : ''} class="layer-radio" />
                <span>${t('osmLayer')}</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="base-layer-${blockId}" value="opentopo" ${dataState.activeBaseLayer === 'opentopo' ? 'checked' : ''} class="layer-radio" />
                <span>${t('topoLayer')}</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" ${dataState.activeOverlays.includes('waymarked') ? 'checked' : ''} class="overlay-waymarked-cb" />
                <span>${t('waymarkedOverlay')}</span>
              </label>
            </div>
          </div>
        `
            : ''
        }

        <!-- Pannello "⚙️ Impostazioni Plugin" -->
        ${
          dataState.activeTab === 'settings'
            ? `
          <div class="bg-slate-800/90 border border-purple-800 p-3 rounded-lg text-xs space-y-2">
            <h4 class="font-bold text-purple-300">${t('customXYZTitle')}</h4>
            <div class="flex flex-col gap-1.5">
              <label class="text-slate-400 font-medium">${t('customXYZLabel')}</label>
              <div class="flex gap-2">
                <input type="text" value="${dataState.customTileUrl || ''}" placeholder="${t('customXYZPlaceholder')}" class="custom-xyz-input bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 flex-1 text-slate-200 focus:outline-none focus:border-purple-500" />
                <button class="apply-xyz-btn bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded font-medium">Applica</button>
              </div>
              <p class="text-[11px] text-amber-400 mt-1">${t('xyzWarning')}</p>
            </div>
          </div>
        `
            : ''
        }

        <!-- Banner Indicatore "Modalità Pick da Mappa Attiva" -->
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

        <!-- Contenitore Mappa Leaflet -->
        <div class="relative">
          <div id="${blockId}" class="leaflet-map-element w-full ${mapHeightClass} rounded-lg border border-slate-700 ${
            dataState.isPickingPointFromMap ? 'leaflet-crosshair-mode' : ''
          }"></div>
        </div>

        <!-- CONTROLLI SEMPLIFICATI SOTTO LA MAPPA -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          
          <div class="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3 space-y-1.5 flex flex-col justify-between">
            <div>
              <h4 class="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                ${t('trackSectionTitle')}
              </h4>
              <p class="text-[11px] text-slate-400 italic mt-0.5">
                ${t('trackSubtitle')}
              </p>
            </div>
            <div class="pt-1">
              <button class="upload-gpx-btn w-full bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded font-medium transition-colors flex items-center justify-center gap-1.5 shadow">
                📁 ${t('uploadGpxBtn')}
              </button>
              <input type="file" accept=".gpx,.kml,.geojson" class="hidden gpx-file-input" />
            </div>
          </div>

          <div class="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3 space-y-1.5 flex flex-col justify-between">
            <div>
              <h4 class="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                ${t('waypointSectionTitle')}
              </h4>
              <p class="text-[11px] text-slate-400 mt-0.5">
                Seleziona la modalità di posizionamento del punto geografico:
              </p>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-1">
              <button class="pick-map-btn ${
                dataState.isPickingPointFromMap
                  ? 'bg-emerald-500 text-white font-bold ring-2 ring-emerald-300'
                  : 'bg-emerald-700 hover:bg-emerald-600 text-white'
              } text-xs px-2 py-2 rounded font-medium transition-colors text-center shadow">
                ${t('pickFromMapBtn')}
              </button>
              <button class="manual-coords-btn bg-slate-700 hover:bg-slate-600 text-white text-xs px-2 py-2 rounded font-medium transition-colors text-center shadow">
                ${t('manualCoordsBtn')}
              </button>
            </div>
          </div>

        </div>

        <!-- Modale / Form Inserimento o Modifica Waypoint -->
        ${
          dataState.activeTab === 'waypointModal' && dataState.tempWaypoint
            ? `
          <div class="bg-slate-800 border-2 border-emerald-500 p-4 rounded-lg text-xs space-y-3 shadow-2xl">
            <h4 class="font-bold text-emerald-300 border-b border-slate-700 pb-2 flex items-center justify-between">
              <span>📍 ${dataState.editingWaypointId ? 'Modifica Waypoint Esistente' : 'Nuovo Waypoint'} (Lat: ${dataState.tempWaypoint.lat?.toFixed(5)}, Lng: ${dataState.tempWaypoint.lng?.toFixed(5)})</span>
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

              <!-- Selezione Icona / Immagine Custom -->
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
                    <span class="text-slate-400 text-[11px]">Anteprima Icona Selezionata:</span>
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
        `
            : ''
        }

        <!-- Statistiche & Naismith Rule -->
        ${
          dataState.stats
            ? `
          <div class="bg-slate-800/80 p-3 rounded-lg border border-slate-700 text-xs grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <span class="text-slate-400 block">Distanza Totale</span>
              <span class="text-sm font-bold text-blue-400">${dataState.stats.distanceKm.toFixed(2)} km</span>
            </div>
            <div>
              <span class="text-slate-400 block">Dislivello +</span>
              <span class="text-sm font-bold text-emerald-400">+${dataState.stats.ascentMeters} m</span>
            </div>
            <div>
              <span class="text-slate-400 block">Dislivello -</span>
              <span class="text-sm font-bold text-amber-400">-${dataState.stats.descentMeters} m</span>
            </div>
            <div>
              <span class="text-slate-400 block">Tempo Previsto</span>
              <span class="text-sm font-bold text-purple-400">${Math.floor(dataState.stats.durationMinutes / 60)}h ${dataState.stats.durationMinutes % 60}m</span>
            </div>
          </div>
        `
            : ''
        }

        <!-- Profilo Altimetrico Canvas -->
        ${
          dataState.hasElevationData && dataState.trackGeoJson
            ? `
          <div class="bg-slate-800/60 p-3 rounded-lg border border-slate-700 space-y-1">
            <div class="text-xs font-semibold text-slate-300">${t('elevationProfileTitle')}</div>
            <div class="relative w-full h-20">
              <canvas class="elevation-canvas w-full h-full cursor-crosshair"></canvas>
            </div>
          </div>
        `
            : ''
        }

        <!-- Legenda Tabellare Esterna Waypoint con Pulsanti Modifica/Elimina -->
        ${
          dataState.waypoints.length > 0
            ? `
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
        `
            : ''
        }

      </div>
    `;

    setTimeout(() => {
      this.initLeafletMap(blockId, container, dataState);
    }, 50);

    this.bindEvents(container, dataState);
  }

  private initLeafletMap(blockId: string, container: HTMLElement, dataState: MapPluginState): void {
    const mapEl = container.querySelector<HTMLElement>(`#${blockId}`);
    if (!mapEl) return;

    if (this.mapInstances.has(blockId)) {
      this.mapInstances.get(blockId)!.remove();
    }

    const defaultCenter: L.LatLngTuple = [45.8912, 9.1245];
    const map = L.map(mapEl, {
      center: defaultCenter,
      zoom: 12,
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

    let hoverMarker: L.CircleMarker | null = null;
    if (dataState.trackGeoJson) {
      const geoJsonLayer = L.geoJSON(dataState.trackGeoJson as any, {
        style: { color: '#3b82f6', weight: 4, opacity: 0.85 }
      }).addTo(map);

      map.fitBounds(geoJsonLayer.getBounds(), { padding: [20, 20] });

      if (dataState.hasElevationData) {
        this.renderElevationCanvas(container, dataState.trackGeoJson, (lat, lng) => {
          if (!hoverMarker) {
            hoverMarker = L.circleMarker([lat, lng], {
              radius: 6,
              color: '#ef4444',
              fillColor: '#ef4444',
              fillOpacity: 1
            }).addTo(map);
          } else {
            hoverMarker.setLatLng([lat, lng]);
          }
        });
      }
    }

    // Disegno Waypoints
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

      const marker = L.marker([wp.lat, wp.lng], { icon: customIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-size:12px; color:#1e293b;">
          <strong>${wp.title}</strong><br/>
          <span>${wp.description || ''}</span>
          ${wp.notesLogistica ? `<div style="margin-top:4px; color:#0369a1; font-weight:600;">Note Educatori: ${wp.notesLogistica}</div>` : ''}
        </div>
      `);
    });

    // RILEVAMENTO CLICK SU MAPPA
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

    // Invalida le dimensioni se in Schermo Intero
    if (dataState.isFullscreen) {
      setTimeout(() => map.invalidateSize(), 150);
    }

    this.mapInstances.set(blockId, map);
  }

  private bindEvents(container: HTMLElement, dataState: MapPluginState): void {
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

    container.querySelector('.close-map-btn')?.addEventListener('click', () => {
      dataState.isExpanded = false;
      dataState.isFullscreen = false;
      this.render(container, dataState, '');
    });

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

    container.querySelector('.apply-xyz-btn')?.addEventListener('click', () => {
      const input = container.querySelector<HTMLInputElement>('.custom-xyz-input');
      if (input) {
        dataState.customTileUrl = input.value.trim();
        dataState.activeBaseLayer = 'custom';
        this.render(container, dataState, '');
      }
    });

    // Upload Traccia GPX/KML
    const uploadGpxBtn = container.querySelector('.upload-gpx-btn');
    const gpxInput = container.querySelector<HTMLInputElement>('.gpx-file-input');
    uploadGpxBtn?.addEventListener('click', () => gpxInput?.click());
    gpxInput?.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        this.handleFileUpload(files[0], container, dataState);
      }
    });

    // Modalità Pick da Mappa
    const pickMapBtn = container.querySelector('.pick-map-btn');
    pickMapBtn?.addEventListener('click', () => {
      dataState.isPickingPointFromMap = true;
      dataState.activeTab = 'none';
      this.render(container, dataState, '');
    });

    container.querySelector('.cancel-picking-btn')?.addEventListener('click', () => {
      dataState.isPickingPointFromMap = false;
      this.render(container, dataState, '');
    });

    const manualCoordsBtn = container.querySelector('.manual-coords-btn');
    manualCoordsBtn?.addEventListener('click', () => {
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

    // Pulsante Salva Waypoint (Crea o Aggiorna)
    container.querySelector('.save-wp-btn')?.addEventListener('click', () => {
      if (dataState.tempWaypoint && dataState.tempWaypoint.lat !== undefined) {
        const title = dataState.tempWaypoint.title?.trim() || 'Punto Presidio';

        if (dataState.editingWaypointId) {
          // MODIFICA WAYPOINT ESISTENTE
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
          // INSERIMENTO NUOVO WAYPOINT
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

    // MODIFICA WAYPOINT ESISTENTE
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

    // ELIMINAZIONE WAYPOINT
    container.querySelectorAll('.delete-wp-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).getAttribute('data-delete-id');
        dataState.waypoints = dataState.waypoints.filter((w) => w.id !== id);
        this.render(container, dataState, '');
      });
    });

    container.querySelector<HTMLInputElement>('.show-legend-export-cb')?.addEventListener('change', (e) => {
      dataState.showLegendInExport = (e.target as HTMLInputElement).checked;
    });
  }

  private handleFileUpload(file: File, container: HTMLElement, dataState: MapPluginState): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      const fileName = file.name.toLowerCase();
      let parsedGeoJson: GeoJsonTrackFeature | null = null;

      if (fileName.endsWith('.gpx')) {
        parsedGeoJson = this.parseGPX(content);
      } else if (fileName.endsWith('.kml')) {
        parsedGeoJson = this.parseKML(content);
      } else if (fileName.endsWith('.geojson') || fileName.endsWith('.json')) {
        try {
          parsedGeoJson = JSON.parse(content);
        } catch (err) {
          console.error('[MapPlugin] Error parsing GeoJSON file:', err);
        }
      }

      if (parsedGeoJson) {
        dataState.trackGeoJson = parsedGeoJson;
        dataState.stats = this.calculateTrackStats(parsedGeoJson);
        dataState.hasElevationData = parsedGeoJson.geometry.coordinates.some((c) => c.length > 2 && !isNaN(c[2]));
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
      const timeNode = pt.querySelector('time');

      const ele = eleNode ? parseFloat(eleNode.textContent || '0') : undefined;
      const time = timeNode ? new Date(timeNode.textContent || '').getTime() : undefined;

      const tuple = [lng, lat];
      if (ele !== undefined && !isNaN(ele)) tuple.push(ele);
      if (time !== undefined && !isNaN(time)) tuple.push(time);

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
    const horizontalMins = (distanceKm / 5.0) * 60;
    const verticalMins = (ascentMeters / 600.0) * 60;
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
    const height = (canvas.height = 80);

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

    lines.push(`### 🗺️ Percorso Escursionistico: Dettagli Logistici\n`);

    if (dataState.stats) {
      lines.push(`- **Distanza Totale**: ${dataState.stats.distanceKm.toFixed(2)} km`);
      lines.push(`- **Dislivello Positivo**: +${dataState.stats.ascentMeters} m`);
      lines.push(`- **Dislivello Negativo**: -${dataState.stats.descentMeters} m`);
      lines.push(
        `- **Tempo di Percorrenza Previsto**: ${Math.floor(dataState.stats.durationMinutes / 60)}h ${
          dataState.stats.durationMinutes % 60
        }m (Stima Regola di Naismith)\n`
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
