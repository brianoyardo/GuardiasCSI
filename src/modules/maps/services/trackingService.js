import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { COLLECTIONS } from "@/config/constants";

/**
 * SentinelOps — Tracking Service
 * Handles persistence of guard GPS positions to Firestore
 *
 * Responsibilities:
 *   - Save guard position updates
 *   - Build GPS trail in Firestore
 *   - Manage live location documents
 *   - Prepared for batch uploads (offline-first)
 *
 * Architecture note: This service writes to Firestore.
 * Reading/subscribing is handled by useRealtimeLocation hook.
 * Transport layer can be swapped (Socket.IO, MQTT) in the future.
 */

const LOG_PREFIX = "[TrackingService]";

/**
 * Update guard's live position in Firestore
 * This is the primary write for real-time monitoring
 *
 * @param {string} guardId
 * @param {{ lat: number, lng: number }} position
 * @param {object} [metadata]
 * @param {number} [metadata.accuracy]
 * @param {number} [metadata.heading]
 * @param {number} [metadata.speed]
 */
export async function updateLivePosition(guardId, position, metadata = {}) {
  try {
    const liveRef = doc(db, COLLECTIONS.LIVE_GUARDS, `live_${guardId}`);

    await setDoc(
      liveRef,
      {
        guardId,
        lastPosition: {
          lat: position.lat,
          lng: position.lng,
          accuracy: metadata.accuracy || null,
          heading: metadata.heading || null,
          speed: metadata.speed || null,
          timestamp: Date.now(),
        },
        status: "tracking",
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to update live position:`, error);
  }
}

/**
 * Append a position to a ronda execution's GPS trail
 * Used during active ronda to build the full tracking history
 *
 * @param {string} executionId
 * @param {{ lat: number, lng: number }} position
 * @param {number} [accuracy]
 */
export async function appendTrackPoint(executionId, position, accuracy = null) {
  try {
    const execRef = doc(db, COLLECTIONS.RONDA_EXECUTIONS, executionId);

    const trackPoint = {
      lat: position.lat,
      lng: position.lng,
      accuracy,
      timestamp: Date.now(),
    };

    await updateDoc(execRef, {
      gpsTrack: arrayUnion(trackPoint),
      lastPosition: trackPoint,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to append track point:`, error);
  }
}

/**
 * Batch upload GPS trail (for offline-first sync)
 * Sends accumulated offline positions in a single write
 *
 * @param {string} executionId
 * @param {{ lat: number, lng: number, timestamp: number }[]} positions
 */
export async function batchUploadTrail(executionId, positions) {
  if (!positions.length) return;

  try {
    const execRef = doc(db, COLLECTIONS.RONDA_EXECUTIONS, executionId);

    // arrayUnion has a limit, so for large batches we may need
    // to use a subcollection. For now this works for moderate trails.
    await updateDoc(execRef, {
      gpsTrack: arrayUnion(...positions),
      lastPosition: positions[positions.length - 1],
      updatedAt: serverTimestamp(),
    });

    // console.log(`${LOG_PREFIX} Batch uploaded ${positions.length} track points`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Batch upload failed:`, error);
    throw error;
  }
}

/**
 * Clear live position (when guard stops tracking)
 * @param {string} guardId
 */
export async function clearLivePosition(guardId) {
  try {
    const liveRef = doc(db, "Live", `live_${guardId}`);
    await setDoc(
      liveRef,
      {
        guardId,
        status: "offline",
        lastPosition: null,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    // console.log(`${LOG_PREFIX} Live position cleared for: ${guardId}`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to clear live position:`, error);
  }
}
