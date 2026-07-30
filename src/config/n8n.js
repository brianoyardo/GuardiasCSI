/**
 * SentinelOps — Configuración Centralizada de n8n
 *
 * Construye las URLs de Webhook dinámicamente desde las variables de entorno.
 * Para cambiar de ambiente, solo edita el archivo .env:
 *
 *   🟡 DESARROLLO LOCAL   → VITE_N8N_BASE_URL=http://localhost:5678    + VITE_N8N_ENV=test
 *   🔵 RED LOCAL          → VITE_N8N_BASE_URL=http://192.168.1.6:5678  + VITE_N8N_ENV=prod
 *   🟢 PRODUCCIÓN VPS     → VITE_N8N_BASE_URL=https://tu-dominio.com   + VITE_N8N_ENV=prod
 *
 * VITE_N8N_ENV controla el prefijo de la ruta:
 *   'test'  → /webhook-test/  (activa los nodos de prueba en n8n)
 *   'prod'  → /webhook/       (activa los nodos de producción en n8n)
 */

const BASE_URL = import.meta.env.VITE_N8N_BASE_URL
const ENV      = import.meta.env.VITE_N8N_ENV || 'prod'

const RUTA_ALERTA       = import.meta.env.VITE_N8N_WEBHOOK_ALERTA       || 'alerta-operativa'
const RUTA_CIERRE_RONDA = import.meta.env.VITE_N8N_WEBHOOK_CIERRE_RONDA || 'cierre-ronda-ia'

// El prefijo determina si n8n usa el nodo test o el de producción
const PREFIX = ENV === 'test' ? 'webhook-test' : 'webhook'

if (!BASE_URL) {
  console.warn(
    '[n8n] ⚠ VITE_N8N_BASE_URL no está definida en .env. ' +
    'Los webhooks operativos no funcionarán. Verifica tu archivo .env.'
  )
}

/**
 * URL del webhook de alertas operativas.
 * Usado para: Abandono de Geocerca, Inactividad Prolongada, Suplantación Biométrica.
 *
 * @example
 * // Red local (prod)  → http://192.168.1.6:5678/webhook/alerta-operativa
 * // Desarrollo (test) → http://localhost:5678/webhook-test/alerta-operativa
 */
export const N8N_WEBHOOK_ALERTA = BASE_URL
  ? `${BASE_URL}/${PREFIX}/${RUTA_ALERTA}`
  : null

/**
 * URL del webhook de cierre de ronda por IA.
 * Recibe el audio del guardia (FormData) para transcripción y análisis con LLaMA 3.3.
 *
 * @example
 * // Red local (prod)  → http://192.168.1.6:5678/webhook/cierre-ronda-ia
 * // Desarrollo (test) → http://localhost:5678/webhook-test/cierre-ronda-ia
 */
export const N8N_WEBHOOK_CIERRE_RONDA = BASE_URL
  ? `${BASE_URL}/${PREFIX}/${RUTA_CIERRE_RONDA}`
  : null
