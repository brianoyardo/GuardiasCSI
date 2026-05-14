import { OPERATIONAL_EVENTS } from './eventTaxonomy'

/**
 * SentinelOps — Event Bus
 * Centralized, decoupled Pub/Sub architecture for Operational Intelligence.
 * 
 * Flow:
 * Component/Service → emits to EventBus → EventBus distributes to Listeners (Analytics, Automation)
 * 
 * This abstracts away n8n/MQTT/Webhooks from the core logic.
 */

class EventBus {
  constructor() {
    this.listeners = new Map()
    
    // Auto-register core topics from taxonomy
    Object.values(OPERATIONAL_EVENTS).forEach(event => {
      this.listeners.set(event, new Set())
    })
    
    // Wildcard listener (receives all events)
    this.listeners.set('*', new Set())
  }

  /**
   * Subscribe to an event
   * @param {string} eventName - From OPERATIONAL_EVENTS or '*'
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set())
    }
    
    this.listeners.get(eventName).add(callback)

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(eventName)
      if (callbacks) {
        callbacks.delete(callback)
      }
    }
  }

  /**
   * Publish an operational event
   * @param {string} eventName - From OPERATIONAL_EVENTS
   * @param {object} payload - Structured event payload
   */
  publish(eventName, payload) {
    if (!eventName || !payload) return

    const standardizedPayload = {
      ...payload,
      _timestamp: Date.now(),
      _eventId: crypto.randomUUID(),
      _type: eventName,
    }

    // 1. Notify specific listeners
    const specificCallbacks = this.listeners.get(eventName)
    if (specificCallbacks) {
      specificCallbacks.forEach(cb => {
        try { cb(standardizedPayload) } 
        catch (err) { console.error(`[EventBus] Error in listener for ${eventName}:`, err) }
      })
    }

    // 2. Notify wildcard listeners (e.g., Audit Logger, Automation Gateway)
    const wildcardCallbacks = this.listeners.get('*')
    if (wildcardCallbacks) {
      wildcardCallbacks.forEach(cb => {
        try { cb(standardizedPayload) } 
        catch (err) { console.error(`[EventBus] Error in wildcard listener:`, err) }
      })
    }
  }
}

// Singleton instance
export const eventBus = new EventBus()
