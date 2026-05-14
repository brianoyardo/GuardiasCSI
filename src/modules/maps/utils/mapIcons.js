import L from 'leaflet'

/**
 * SentinelOps — Map Icon System
 * Tactical marker iconography with dynamic state support
 * 
 * All icons are SVG-based for crisp rendering at any zoom level.
 * Each icon type supports multiple states (active, completed, alert, etc.)
 */

// ─── SVG Icon Generator ───

function svgIcon(svgContent, size = [32, 32]) {
  return L.divIcon({
    html: svgContent,
    className: 'sentinel-marker',
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1]],
    popupAnchor: [0, -size[1]],
  })
}

// ─── Color Palette ───
const COLORS = {
  primary: '#3380ff',
  active: '#22c55e',
  completed: '#16a34a',
  pending: '#f59e0b',
  danger: '#ef4444',
  inactive: '#64748b',
  guard: '#3380ff',
  guardActive: '#22c55e',
  checkpoint: '#f59e0b',
  checkpointDone: '#16a34a',
  incident: '#ef4444',
  geofence: 'rgba(51, 128, 255, 0.15)',
  geofenceBorder: '#3380ff',
}

// ─── Guard Marker ───

function guardSvg(color = COLORS.guard, pulseColor = COLORS.guardActive) {
  return `
    <div class="sentinel-guard-marker" style="position:relative;width:32px;height:32px;">
      <svg viewBox="0 0 32 32" width="32" height="32">
        <circle cx="16" cy="16" r="12" fill="${color}" stroke="white" stroke-width="2.5" opacity="0.95"/>
        <circle cx="16" cy="16" r="5" fill="white" opacity="0.9"/>
      </svg>
      <div style="
        position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
        width:32px; height:32px; border-radius:50%;
        border:2px solid ${pulseColor}; opacity:0.6;
        animation: pulseRing 2s ease-out infinite;
      "></div>
    </div>
  `
}

export function createGuardIcon(state = 'active') {
  const colorMap = {
    active: COLORS.guardActive,
    tracking: COLORS.primary,
    inactive: COLORS.inactive,
    alert: COLORS.danger,
  }
  return svgIcon(guardSvg(colorMap[state] || COLORS.guard), [32, 32])
}

// ─── Checkpoint Marker ───

function checkpointSvg(color = COLORS.checkpoint, order = '') {
  return `
    <div style="position:relative;width:28px;height:36px;">
      <svg viewBox="0 0 28 36" width="28" height="36">
        <path d="M14 0 C6.3 0 0 6.3 0 14 C0 24.5 14 36 14 36 S28 24.5 28 14 C28 6.3 21.7 0 14 0Z" 
              fill="${color}" stroke="white" stroke-width="1.5"/>
        <circle cx="14" cy="13" r="8" fill="white" opacity="0.95"/>
        <text x="14" y="17" text-anchor="middle" font-size="10" font-weight="700" 
              fill="${color}" font-family="Inter, sans-serif">${order}</text>
      </svg>
    </div>
  `
}

export function createCheckpointIcon(state = 'pending', order = '') {
  const colorMap = {
    pending: COLORS.checkpoint,
    active: COLORS.primary,
    completed: COLORS.checkpointDone,
    missed: COLORS.danger,
  }
  return svgIcon(checkpointSvg(colorMap[state] || COLORS.checkpoint, order), [28, 36])
}

// ─── Incident Marker ───

function incidentSvg(severity = 'medium') {
  const colorMap = {
    low: COLORS.pending,
    medium: '#f97316',
    high: COLORS.danger,
    critical: '#dc2626',
  }
  const color = colorMap[severity] || COLORS.danger

  return `
    <div style="position:relative;width:30px;height:30px;">
      <svg viewBox="0 0 30 30" width="30" height="30">
        <polygon points="15,2 28,26 2,26" fill="${color}" stroke="white" stroke-width="1.5" 
                 stroke-linejoin="round"/>
        <text x="15" y="22" text-anchor="middle" font-size="14" font-weight="800" 
              fill="white" font-family="Inter, sans-serif">!</text>
      </svg>
    </div>
  `
}

export function createIncidentIcon(severity = 'medium') {
  return svgIcon(incidentSvg(severity), [30, 30])
}

// ─── Geofence Styles ───

export const GEOFENCE_STYLES = {
  default: {
    color: COLORS.geofenceBorder,
    weight: 2,
    opacity: 0.7,
    fillColor: COLORS.geofence,
    fillOpacity: 0.15,
    dashArray: '6, 4',
    className: 'tactical-path tactical-path--geofence',
  },
  active: {
    color: COLORS.guardActive,
    weight: 2,
    opacity: 0.8,
    fillColor: 'rgba(34, 197, 94, 0.1)',
    fillOpacity: 0.1,
    className: 'tactical-path tactical-path--geofence-active',
  },
  alert: {
    color: COLORS.danger,
    weight: 3,
    opacity: 0.9,
    fillColor: 'rgba(239, 68, 68, 0.15)',
    fillOpacity: 0.15,
    dashArray: '4, 4',
    className: 'tactical-path tactical-path--alert',
  },
}

// ─── Route/Polyline Styles ───

export const ROUTE_STYLES = {
  default: {
    color: COLORS.primary,
    weight: 3,
    opacity: 0.7,
    dashArray: null,
    className: 'tactical-path tactical-path--route',
  },
  active: {
    color: COLORS.guardActive,
    weight: 4,
    opacity: 0.9,
    className: 'tactical-path tactical-path--route-active',
  },
  completed: {
    color: COLORS.completed,
    weight: 3,
    opacity: 0.6,
    className: 'tactical-path',
  },
  tracking: {
    color: COLORS.primary,
    weight: 3,
    opacity: 0.5,
    dashArray: '8, 6',
    className: 'tactical-path tactical-path--tracking',
  },
}

// ─── Export Colors for external use ───
export { COLORS as MAP_COLORS }
