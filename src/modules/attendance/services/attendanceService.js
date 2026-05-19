import {
  collection, doc, getDocs, setDoc, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS } from '@/config/constants'

/**
 * SentinelOps — Attendance Service
 * Guard check-in / check-out with GPS and timestamp
 * 
 * Prepared for: QR, NFC, biometric, geofence-based check-in
 */

const LOG_PREFIX = '[AttendanceService]'

/**
 * Register check-in
 * @param {string} guardId
 * @param {{ lat: number, lng: number }} position
 * @param {string} [method='manual'] - manual | qr | nfc | geofence
 */
export async function checkIn(guardId, position, method = 'manual') {
  try {
    const ref = doc(collection(db, COLLECTIONS.ATTENDANCE))
    await setDoc(ref, {
      guardId,
      type: 'check_in',
      position: position || null,
      method,
      timestamp: serverTimestamp(),
      date: new Date().toISOString().split('T')[0],
      createdAt: serverTimestamp(),
    })
    // console.log(`${LOG_PREFIX} ✅ Check-in: ${guardId}`)
    return ref.id
  } catch (error) {
    console.error(`${LOG_PREFIX} Check-in error:`, error)
    throw error
  }
}

/**
 * Register check-out
 */
export async function checkOut(guardId, position, method = 'manual') {
  try {
    const ref = doc(collection(db, COLLECTIONS.ATTENDANCE))
    await setDoc(ref, {
      guardId,
      type: 'check_out',
      position: position || null,
      method,
      timestamp: serverTimestamp(),
      date: new Date().toISOString().split('T')[0],
      createdAt: serverTimestamp(),
    })
    // console.log(`${LOG_PREFIX} ✅ Check-out: ${guardId}`)
    return ref.id
  } catch (error) {
    console.error(`${LOG_PREFIX} Check-out error:`, error)
    throw error
  }
}

/**
 * Get attendance records for a guard
 */
export async function getGuardAttendance(guardId, date = null) {
  try {
    let constraints = [where('guardId', '==', guardId)]
    if (date) constraints.push(where('date', '==', date))

    const q = query(collection(db, COLLECTIONS.ATTENDANCE), ...constraints)
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching attendance:`, error)
    throw error
  }
}

/**
 * Get all attendance for today (admin view)
 */
export async function getTodayAttendance() {
  const today = new Date().toISOString().split('T')[0]
  try {
    const q = query(
      collection(db, COLLECTIONS.ATTENDANCE),
      where('date', '==', today)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching today attendance:`, error)
    throw error
  }
}
