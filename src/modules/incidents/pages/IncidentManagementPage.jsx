import { useState, useEffect, useRef } from "react";
import {
  getIncidents,
  updateIncidentStatus,
} from "@/modules/incidents/services/incidentService";
import { getEvidencePreviewUrl } from "@/services/appwriteStorage";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { PATROL_TYPES, SHIFT_TYPES } from "@/config/constants";
import "./IncidentManagementPage.css";

// ─── Translation & Styling Maps ───
const SEVERITY_MAP = {
  critical: {
    label: "Crítico",
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.15)",
    border: "rgba(239, 68, 68, 0.4)",
  },
  high: {
    label: "Alto",
    color: "#f97316",
    bg: "rgba(249, 115, 22, 0.15)",
    border: "rgba(249, 115, 22, 0.4)",
  },
  medium: {
    label: "Medio",
    color: "#eab308",
    bg: "rgba(234, 179, 8, 0.15)",
    border: "rgba(234, 179, 8, 0.4)",
  },
  low: {
    label: "Bajo",
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.15)",
    border: "rgba(59, 130, 246, 0.4)",
  },
};

const TYPE_MAP = {
  security: { label: "Seguridad", icon: "🛡️" },
  maintenance: { label: "Mantenimiento", icon: "🔧" },
  emergency: { label: "Emergencia", icon: "🚨" },
  observation: { label: "Observación", icon: "👁️" },
};

const STATUS_MAP = {
  open: {
    label: "Abierto",
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.15)",
    border: "rgba(59, 130, 246, 0.3)",
  },
  investigating: {
    label: "En Investigación",
    color: "#eab308",
    bg: "rgba(234, 179, 8, 0.15)",
    border: "rgba(234, 179, 8, 0.3)",
  },
  resolved: {
    label: "Resuelto",
    color: "#22c55e",
    bg: "rgba(34, 197, 94, 0.15)",
    border: "rgba(34, 197, 94, 0.3)",
  },
  closed: {
    label: "Cerrado",
    color: "#6b7280",
    bg: "rgba(107, 114, 128, 0.15)",
    border: "rgba(107, 114, 128, 0.3)",
  },
};

/**
 * IncidentManagementPage — Admin view for managing incidents
 * Phase 19: Appwrite media preview + Guard identity display
 */
export default function IncidentManagementPage() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [filter, setFilter] = useState("open");
  const [activeIncidentId, setActiveIncidentId] = useState(null);
  const [mediaModal, setMediaModal] = useState(null); // { url, name } or null
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imgErrors, setImgErrors] = useState({});

  const detailRef = useRef(null);

  useEffect(() => {
    if (detailRef.current) {
      detailRef.current.scrollTop = 0;
    }
  }, [activeIncidentId]);

  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    try {
      const data = await getIncidents();
      const sorted = data.sort(
        (a, b) => b.createdAt?.toMillis?.() - a.createdAt?.toMillis?.(),
      );
      setIncidents(sorted);
      // Set the first active incident if none is active
      if (sorted.length > 0 && !activeIncidentId) {
        setActiveIncidentId(sorted[0].id);
      }
    } catch (err) {
      console.error("Failed to load incidents:", err);
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await updateIncidentStatus(id, newStatus, {
        resolvedBy: newStatus === "resolved" ? user.uid : null,
      });
      await loadIncidents();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const filteredList = incidents.filter((i) => {
    if (filter === "open") return i.status === "open";
    if (filter === "investigating") return i.status === "investigating";
    if (filter === "resolved")
      return i.status === "resolved" || i.status === "closed";
    return true;
  });

  const activeIncident = incidents.find((i) => i.id === activeIncidentId);

  // Badge counts
  const countOpen = incidents.filter((i) => i.status === "open").length;
  const countInvestigating = incidents.filter(
    (i) => i.status === "investigating",
  ).length;
  const countResolved = incidents.filter(
    (i) => i.status === "resolved" || i.status === "closed",
  ).length;
  const countAll = incidents.length;

  const getSeverityConfig = (sev) => SEVERITY_MAP[sev] || SEVERITY_MAP.medium;
  const getTypeConfig = (t) =>
    TYPE_MAP[t] || { label: t || "Incidente", icon: "⚠️" };
  const getStatusConfig = (s) =>
    STATUS_MAP[s] || {
      label: s || "Desconocido",
      color: "#999",
      bg: "rgba(255,255,255,0.1)",
    };

  // Get evidence preview URLs
  const getEvidenceThumbnails = (evidenceIds) => {
    if (!evidenceIds || evidenceIds.length === 0) return [];
    return evidenceIds.map((id) => ({
      id,
      url: getEvidencePreviewUrl(id),
    }));
  };

  const openMediaModal = (url) => {
    setMediaModal({ url });
    setZoomLevel(1);
  };

  const closeMediaModal = () => {
    setMediaModal(null);
    setZoomLevel(1);
  };

  const formatTimestamp = (ts) => {
    if (!ts) return "—";
    const d = ts.toMillis ? new Date(ts.toMillis()) : new Date(ts);
    return d.toLocaleString("es-BO", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getDisplayTitle = (inc) => {
    if (!inc) return "";
    const typeLabel = getTypeConfig(inc.type).label;
    const dateStr = formatTimestamp(inc.createdAt);
    return `Reporte ${typeLabel} - ${dateStr}`;
  };

  return (
    <div className="inc-mgmt">
      <div className="inc-mgmt__header">
        <h1 className="inc-mgmt__title">Gestión de Incidentes</h1>
      </div>

      <div className="inc-mgmt__content">
        {/* Sidebar List */}
        <div
          className={`inc-mgmt__sidebar ${activeIncidentId ? "inc-mgmt__sidebar--hidden-mobile" : ""}`}
        >
          <div className="inc-mgmt__filters">
            <button
              className={`inc-mgmt__filter-btn ${filter === "open" ? "inc-mgmt__filter-btn--active" : ""}`}
              onClick={() => setFilter("open")}
            >
              Abiertos <span className="inc-mgmt__tab-count">{countOpen}</span>
            </button>
            <button
              className={`inc-mgmt__filter-btn ${filter === "investigating" ? "inc-mgmt__filter-btn--active" : ""}`}
              onClick={() => setFilter("investigating")}
            >
              En Investigación{" "}
              <span className="inc-mgmt__tab-count">{countInvestigating}</span>
            </button>
            <button
              className={`inc-mgmt__filter-btn ${filter === "resolved" ? "inc-mgmt__filter-btn--active" : ""}`}
              onClick={() => setFilter("resolved")}
            >
              Resueltos{" "}
              <span className="inc-mgmt__tab-count">{countResolved}</span>
            </button>
            <button
              className={`inc-mgmt__filter-btn ${filter === "all" ? "inc-mgmt__filter-btn--active" : ""}`}
              onClick={() => setFilter("all")}
            >
              Todos <span className="inc-mgmt__tab-count">{countAll}</span>
            </button>
          </div>

          <div className="inc-mgmt__list">
            {filteredList.length === 0 ? (
              <div className="inc-mgmt__empty">
                No hay incidentes en esta sección
              </div>
            ) : (
              filteredList.map((inc) => {
                const thumbnails = getEvidenceThumbnails(inc.evidenceIds);
                const sevConfig = getSeverityConfig(inc.severity);
                const typeConfig = getTypeConfig(inc.type);
                const statusConfig = getStatusConfig(inc.status);

                return (
                  <div
                    key={inc.id}
                    className={`inc-mgmt__card ${activeIncidentId === inc.id ? "inc-mgmt__card--active" : ""}`}
                    onClick={() => setActiveIncidentId(inc.id)}
                  >
                    <div
                      className="inc-mgmt__card-severity"
                      style={{ background: sevConfig.color }}
                    />
                    <div className="inc-mgmt__card-info">
                      <div className="inc-mgmt__card-title">
                        {typeConfig.icon} {getDisplayTitle(inc)}
                      </div>
                      <div className="inc-mgmt__card-meta">
                        {inc.guardCode && (
                          <span className="inc-mgmt__card-guard">
                            {inc.guardCode}
                          </span>
                        )}
                        <span
                          className="inc-mgmt__card-status-dot"
                          style={{ backgroundColor: statusConfig.color }}
                          title={statusConfig.label}
                        />
                        <span className="inc-mgmt__card-status-text">
                          {statusConfig.label}
                        </span>
                      </div>
                      {inc.geofenceName && (
                        <div className="inc-mgmt__card-location">
                          📍 {inc.geofenceName}
                        </div>
                      )}
                    </div>
                    {/* Thumbnail preview in card */}
                    {thumbnails.length > 0 && (
                      <div className="inc-mgmt__card-thumb">
                        {imgErrors[thumbnails[0].id] ? (
                          <div
                            className="inc-mgmt__card-thumb-error"
                            title="Error de permisos Appwrite"
                          >
                            ⚠️
                          </div>
                        ) : (
                          <img
                            src={thumbnails[0].url}
                            alt="Evidencia"
                            loading="lazy"
                            onError={() =>
                              setImgErrors((prev) => ({
                                ...prev,
                                [thumbnails[0].id]: true,
                              }))
                            }
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Detail View */}
        <div
          className={`inc-mgmt__detail ${!activeIncident ? "inc-mgmt__detail--hidden-mobile" : ""}`}
          ref={detailRef}
        >
          {!activeIncident ? (
            <div className="inc-mgmt__empty">
              Selecciona un incidente para ver detalles
            </div>
          ) : (
            <>
              <div className="inc-mgmt__back-mobile">
                <button
                  className="inc-mgmt__back-btn"
                  onClick={() => setActiveIncidentId(null)}
                >
                  ← Volver a la Lista
                </button>
              </div>
              <div className="inc-mgmt__detail-header">
                <div>
                  <h2 className="inc-mgmt__detail-title">
                    {getTypeConfig(activeIncident.type).icon}{" "}
                    {getDisplayTitle(activeIncident)}
                  </h2>
                  <div className="inc-mgmt__detail-badges">
                    <span
                      className="inc-mgmt__badge"
                      style={{
                        background: getSeverityConfig(activeIncident.severity)
                          .bg,
                        color: getSeverityConfig(activeIncident.severity).color,
                        border: `1px solid ${getSeverityConfig(activeIncident.severity).border}`,
                      }}
                    >
                      Prioridad:{" "}
                      {getSeverityConfig(activeIncident.severity).label}
                    </span>
                    <span
                      className="inc-mgmt__badge"
                      style={{
                        background: "var(--color-dark-surface)",
                        border: "1px solid var(--color-dark-border)",
                        color: "#fff",
                      }}
                    >
                      Tipo: {getTypeConfig(activeIncident.type).label}
                    </span>
                    <span
                      className="inc-mgmt__badge"
                      style={{
                        background: getStatusConfig(activeIncident.status).bg,
                        color: getStatusConfig(activeIncident.status).color,
                        border: `1px solid ${getStatusConfig(activeIncident.status).color}`,
                      }}
                    >
                      Estado: {getStatusConfig(activeIncident.status).label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Guard Reporter Section */}
              <div className="inc-mgmt__reporter">
                <div className="inc-mgmt__reporter-label">Reportado por</div>
                <div className="inc-mgmt__reporter-info">
                  <span className="inc-mgmt__reporter-code">
                    {activeIncident.guardCode ||
                      activeIncident.reportedBy?.slice(0, 8) ||
                      "—"}
                  </span>
                  <span className="inc-mgmt__reporter-name">
                    {activeIncident.guardName || "Guardia no identificado"}
                  </span>
                </div>
                <div className="inc-mgmt__reporter-location">
                  📍 {activeIncident.geofenceName || "Ubicación General"}
                  {activeIncident.routeName
                    ? ` · ${activeIncident.routeName}`
                    : ""}
                </div>
              </div>

              <div className="inc-mgmt__detail-desc">
                <strong>Descripción:</strong>
                <br />
                <div className="inc-mgmt__desc-box">
                  {activeIncident.description ||
                    "Sin descripción proporcionada."}
                </div>
              </div>

              {/* Evidence Gallery */}
              {activeIncident.evidenceIds &&
                activeIncident.evidenceIds.length > 0 && (
                  <div className="inc-mgmt__evidence">
                    <div className="inc-mgmt__evidence-title">
                      📎 Evidencia Multimedia (
                      {activeIncident.evidenceIds.length})
                    </div>
                    <div className="inc-mgmt__evidence-grid">
                      {getEvidenceThumbnails(activeIncident.evidenceIds).map(
                        (thumb) => (
                          <div
                            key={thumb.id}
                            className="inc-mgmt__evidence-item"
                            onClick={() =>
                              !imgErrors[thumb.id] && openMediaModal(thumb.url)
                            }
                          >
                            {imgErrors[thumb.id] ? (
                              <div className="inc-mgmt__media-error">
                                <span className="inc-mgmt__error-icon">⚠️</span>
                                <span className="inc-mgmt__error-text">
                                  Permisos Appwrite
                                </span>
                                <span className="inc-mgmt__error-subtext">
                                  Verifique lectura pública en consola
                                </span>
                              </div>
                            ) : (
                              <img
                                src={thumb.url}
                                alt="Evidencia"
                                loading="lazy"
                                onError={() =>
                                  setImgErrors((prev) => ({
                                    ...prev,
                                    [thumb.id]: true,
                                  }))
                                }
                              />
                            )}
                          </div>
                        ),
                      )}
                    </div>
                    {/*                   {Object.keys(imgErrors).some(id => activeIncident.evidenceIds.includes(id)) && (
                    <div className="inc-mgmt__permissions-tip">
                      💡 <strong>Nota del Desarrollador:</strong> Si las imágenes no se visualizan, asegúrese de haber configurado los permisos de lectura de la colección o bucket de almacenamiento como <strong>públicos (Role: Any -> Read)</strong> en su panel de administración de Appwrite.
                    </div>
                  )} */}
                  </div>
                )}

              {/* Actions */}
              {activeIncident.status !== "resolved" &&
                activeIncident.status !== "closed" && (
                  <div className="inc-mgmt__actions">
                    {activeIncident.status === "open" && (
                      <button
                        className="inc-mgmt__btn inc-mgmt__btn--investigate"
                        onClick={() =>
                          handleStatusUpdate(activeIncident.id, "investigating")
                        }
                      >
                        🔎 Marcar En Investigación
                      </button>
                    )}
                    {activeIncident.status === "investigating" && (
                      <button
                        className="inc-mgmt__btn inc-mgmt__btn--reopen"
                        onClick={() =>
                          handleStatusUpdate(activeIncident.id, "open")
                        }
                      >
                        ↩️ Reabrir Incidente (Abierto)
                      </button>
                    )}
                    <button
                      className="inc-mgmt__btn inc-mgmt__btn--resolve"
                      onClick={() =>
                        handleStatusUpdate(activeIncident.id, "resolved")
                      }
                    >
                      ✅ Resolver Incidente
                    </button>
                  </div>
                )}
            </>
          )}
        </div>
      </div>

      {/* Glassmorphic Media Modal */}
      {mediaModal && (
        <div className="inc-mgmt__media-overlay" onClick={closeMediaModal}>
          <div
            className="inc-mgmt__media-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inc-mgmt__media-controls">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
              >
                −
              </button>
              <span>{Math.round(zoomLevel * 100)}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
              >
                +
              </button>
              <button onClick={() => setZoomLevel(1)}>100%</button>
              <button
                className="inc-mgmt__media-close"
                onClick={closeMediaModal}
              >
                ✕ Cerrar
              </button>
            </div>
            <div className="inc-mgmt__media-container">
              <img
                src={mediaModal.url}
                alt="Evidencia ampliada"
                style={{ transform: `scale(${zoomLevel})` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
