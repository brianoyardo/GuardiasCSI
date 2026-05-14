import {
  collection, doc, getDocs, setDoc, updateDoc,
  query, where, orderBy, serverTimestamp, limit,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS } from '@/config/constants'

/**
 * SentinelOps — Notification Service
 * Manages operational notifications in Firestore
 * 
 * Prepared for: push notifications, n8n webhooks, escalation policies
 */

const LOG_PREFIX = '[NotificationService]'

/**
 * Send a notification to a user
 * @param {string} userId - Target user UID
 * @param {object} data
 * @param {string} data.title
 * @param {string} data.message
 * @param {string} data.type - info | warning | alert | critical
 * @param {string} [data.module] - source module (rondas, incidents, etc.)
 * @param {object} [data.actionData] - Deep link / action payload
 */
export async function sendNotification(userId, data) {
  try {
    const ref = doc(collection(db, COLLECTIONS.NOTIFICATIONS))
    await setDoc(ref, {
      userId,
      title: data.title,
      message: data.message,
      type: data.type || 'info',
      module: data.module || 'system',
      actionData: data.actionData || null,
      read: false,
      createdAt: serverTimestamp(),
    })
    console.log(`${LOG_PREFIX} → Notification sent to ${userId}: ${data.title}`)
    return ref.id
  } catch (error) {
    console.error(`${LOG_PREFIX} Error sending notification:`, error)
    throw error
  }
}

/**
 * Get notifications for a user
 * @param {string} userId
 * @param {number} [maxResults=50]
 */
export async function getUserNotifications(userId, maxResults = 50) {
  try {
    const q = query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      where('userId', '==', userId),
      limit(maxResults)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching notifications:`, error)
    throw error
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId) {
  try {
    await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notificationId), {
      read: true,
    })
  } catch (error) {
    console.error(`${LOG_PREFIX} Error marking read:`, error)
  }
}

/**
 * Broadcast notification to multiple users
 * @param {string[]} userIds
 * @param {object} data
 */
export async function broadcastNotification(userIds, data) {
  const promises = userIds.map((uid) => sendNotification(uid, data))
  await Promise.allSettled(promises)
  console.log(`${LOG_PREFIX} Broadcast sent to ${userIds.length} users`)
}
