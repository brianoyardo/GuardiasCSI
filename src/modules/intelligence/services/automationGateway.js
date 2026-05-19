import { eventBus } from '../events/eventBus'
import { OPERATIONAL_EVENTS } from '../events/eventTaxonomy'
import { db } from '@/config/firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { COLLECTIONS } from '@/config/constants'

/**
 * SentinelOps — Automation Gateway
 * Acts as the bridge between internal Operational Events and external systems (n8n, APIs).
 */

const LOG_PREFIX = '[AutomationGateway]'

class AutomationGateway {
  constructor() {
    this.isInitialized = false
    this.webhookUrl = null
    this.criticalEventsOnly = false
  }

  /**
   * Initialize gateway settings from Firestore
   */
  async initialize() {
    if (this.isInitialized) return

    try {
      // Fetch settings (using a hardcoded doc ID for settings)
      const settingsRef = doc(db, 'settings', 'automation')
      const snap = await getDoc(settingsRef)
      
      if (snap.exists()) {
        const data = snap.data()
        this.webhookUrl = data.webhookUrl || null
        this.criticalEventsOnly = data.criticalEventsOnly ?? true
      }

      // Listen to ALL events (Wildcard subscription)
      eventBus.subscribe('*', this.handleEvent.bind(this))

      this.isInitialized = true
      // console.log(`${LOG_PREFIX} Initialized. Webhook: ${this.webhookUrl ? 'Configured' : 'Disabled'}`)
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to initialize:`, error)
    }
  }

  /**
   * Save new webhook configuration
   * @param {string} url 
   * @param {boolean} criticalOnly 
   */
  async configure(url, criticalOnly = true) {
    this.webhookUrl = url
    this.criticalEventsOnly = criticalOnly

    try {
      await setDoc(doc(db, 'settings', 'automation'), {
        webhookUrl: url,
        criticalEventsOnly: criticalOnly,
        updatedAt: serverTimestamp()
      }, { merge: true })
      
      // console.log(`${LOG_PREFIX} Configuration saved.`)
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to save configuration:`, err)
      throw err
    }
  }

  /**
   * Determine if an event is considered critical for automation
   */
  isCriticalEvent(eventType) {
    const criticalTypes = new Set([
      OPERATIONAL_EVENTS.INCIDENT_CRITICAL,
      OPERATIONAL_EVENTS.SOS_TRIGGERED,
      OPERATIONAL_EVENTS.GEOFENCE_EXIT,
      OPERATIONAL_EVENTS.PATROL_DEVIATION,
      OPERATIONAL_EVENTS.GUARD_INACTIVE
    ])
    return criticalTypes.has(eventType)
  }

  /**
   * Handle incoming event from the EventBus
   * @param {object} payload 
   */
  async handleEvent(payload) {
    if (!this.webhookUrl) return

    const { _type } = payload

    if (this.criticalEventsOnly && !this.isCriticalEvent(_type)) {
      return // Skip non-critical events if configured so
    }

    // Fire and forget webhook
    try {
      // console.log(`${LOG_PREFIX} 🚀 Dispatching event to Webhook: ${_type}`)
      
      // We don't await this to avoid blocking the event loop
      fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => {
        // console.warn(`${LOG_PREFIX} ⚠ Webhook dispatch failed:`, err)
      })
    } catch (err) {
      console.error(`${LOG_PREFIX} ❌ Dispatch error:`, err)
    }
  }
}

export const automationGateway = new AutomationGateway()
