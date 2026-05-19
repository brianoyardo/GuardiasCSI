import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { eventBus } from '@/modules/intelligence/events/eventBus'
import { OPERATIONAL_EVENTS } from '@/modules/intelligence/events/eventTaxonomy'
import { openDB } from 'idb'

const LOG_PREFIX = '[IndexedDB/Telemetry]'

/**
 * SentinelOps — Telemetry Buffer Service
 * Offline-first persistent layer using IndexedDB for durability.
 */
class TelemetryBufferService {
  constructor() {
    this.isOnline = navigator.onLine
    this.isFlushing = false
    this.flushIntervals = new Map() // Store intervals per executionId

    this.MAX_BUFFER_POINTS = 5000 // Huge limit because IndexedDB handles this easily
    this.BATCH_SIZE = 20 // Points per chunk

    this.dbPromise = this.initDB()

    // Listen to network changes
    window.addEventListener('online', () => this.setOnlineStatus(true))
    window.addEventListener('offline', () => this.setOnlineStatus(false))
  }

  async initDB() {
    return openDB('SentinelOpsDB', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('telemetry_queue')) {
          const store = db.createObjectStore('telemetry_queue', { keyPath: 'id', autoIncrement: true })
          store.createIndex('executionId', 'executionId', { unique: false })
          store.createIndex('enqueuedAt', 'enqueuedAt', { unique: false })
        }
      }
    })
  }

  setOnlineStatus(status) {
    if (this.isOnline !== status) {
      this.isOnline = status
      // console.log(`${LOG_PREFIX} Network status changed: ${status ? 'ONLINE' : 'OFFLINE'}`)
      if (status) {
        // Recover flush process
        this.recoverPendingFlushes()
      }
    }
  }

  async recoverPendingFlushes() {
    if (!this.isOnline) return
    const idb = await this.dbPromise
    const tx = idb.transaction('telemetry_queue', 'readonly')
    const store = tx.objectStore('telemetry_queue')
    // Get unique executionIds that have pending data
    let cursor = await store.index('executionId').openCursor()
    const execIds = new Set()
    while (cursor) {
      execIds.add(cursor.value.executionId)
      cursor = await cursor.continue()
    }
    
    for (const execId of execIds) {
      // console.log(`${LOG_PREFIX} Auto-rehydrating pending flush for execution ${execId}`)
      this.flush(execId)
    }
  }

  startFlushTimer(executionId) {
    if (!this.flushIntervals.has(executionId)) {
      const interval = setInterval(() => {
        this.flush(executionId)
      }, 10000) // 10 seconds timeout limit
      this.flushIntervals.set(executionId, interval)
    }
  }

  async enqueue(guardId, executionId, point) {
    this.startFlushTimer(executionId)

    const idb = await this.dbPromise
    const count = await idb.count('telemetry_queue')
    
    // Antiflooding protection
    if (count >= this.MAX_BUFFER_POINTS) {
      // console.warn(`${LOG_PREFIX} IndexedDB limit reached (${this.MAX_BUFFER_POINTS}), dropping point to prevent infinite growth.`)
      return
    }

    await idb.add('telemetry_queue', {
      guardId,
      executionId,
      ...point,
      enqueuedAt: Date.now()
    })

    // If batch size reached, flush immediately
    const execCount = await idb.countFromIndex('telemetry_queue', 'executionId', IDBKeyRange.only(executionId))
    if (execCount >= this.BATCH_SIZE) {
      this.flush(executionId)
    }
  }

  async flush(executionId, retryCount = 0) {
    if (this.isFlushing || !this.isOnline) return

    const idb = await this.dbPromise
    const tx = idb.transaction('telemetry_queue', 'readonly')
    const index = tx.objectStore('telemetry_queue').index('executionId')
    
    // Get up to BATCH_SIZE points for this execution
    let cursor = await index.openCursor(IDBKeyRange.only(executionId))
    const chunk = []
    const idsToDelete = []
    
    while (cursor && chunk.length < this.BATCH_SIZE) {
      chunk.push(cursor.value)
      idsToDelete.push(cursor.primaryKey)
      cursor = await cursor.continue()
    }

    if (chunk.length === 0) return

    this.isFlushing = true
    const startTime = performance.now()

    try {
      const chunkId = `chunk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      const chunkRef = doc(db, 'rondaExecutions', executionId, 'telemetryChunks', chunkId)

      const payload = {
        startedAt: chunk[0].timestamp || Date.now(),
        endedAt: chunk[chunk.length - 1].timestamp || Date.now(),
        count: chunk.length,
        points: chunk,
        createdAt: serverTimestamp()
      }

      await setDoc(chunkRef, payload)
      const flushDurationMs = Math.round(performance.now() - startTime)
      
      // Delete successfully persisted items from IDB
      const deleteTx = idb.transaction('telemetry_queue', 'readwrite')
      const deleteStore = deleteTx.objectStore('telemetry_queue')
      await Promise.all(idsToDelete.map(id => deleteStore.delete(id)))
      await deleteTx.done
      
      // console.log(`${LOG_PREFIX} Flushed ${chunk.length} points for execution ${executionId} in ${flushDurationMs}ms.`)
      eventBus.publish(OPERATIONAL_EVENTS.TELEMETRY_FLUSHED, { executionId, chunkId, count: chunk.length, flushDurationMs })
      
      this.isFlushing = false
      
      // If there are still items, flush again
      const remainingCount = await idb.countFromIndex('telemetry_queue', 'executionId', IDBKeyRange.only(executionId))
      if (remainingCount > 0) {
        this.flush(executionId)
      }
    } catch (error) {
      this.isFlushing = false
      console.error(`${LOG_PREFIX} Failed to flush telemetry chunk. It remains safely in IDB.`, error)
      
      // Exponential backoff retry if online
      if (this.isOnline && retryCount < 5) {
        const delay = Math.pow(2, retryCount) * 1000
        // console.log(`${LOG_PREFIX} Retrying flush in ${delay}ms...`)
        setTimeout(() => this.flush(executionId, retryCount + 1), delay)
      }
    }
  }

  async clear(executionId) {
    const interval = this.flushIntervals.get(executionId)
    if (interval) {
      clearInterval(interval)
      this.flushIntervals.delete(executionId)
    }
  }

  async clearAll() {
    for (const interval of this.flushIntervals.values()) {
      clearInterval(interval)
    }
    this.flushIntervals.clear()
  }
}

export const telemetryBufferService = new TelemetryBufferService()
