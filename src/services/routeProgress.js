import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

export async function saveCheckpointProgress({
  userId,
  checkpointId,
  lat,
  lng,
}) {
  const progressRef = collection(db, 'route_progress')

  const existingQuery = query(
    progressRef,
    where('userId', '==', userId),
    where('checkpointId', '==', checkpointId),
    where('completed', '==', true)
  )

  const existingSnapshot = await getDocs(existingQuery)

  if (!existingSnapshot.empty) {
    return { alreadyExists: true }
  }

  await addDoc(progressRef, {
    userId,
    checkpointId,
    completed: true,
    completedAt: serverTimestamp(),
    lat,
    lng,
  })

  return { alreadyExists: false }
}

export async function getCompletedCheckpoints(userId) {
  const progressRef = collection(db, 'route_progress')
  const q = query(
    progressRef,
    where('userId', '==', userId),
    where('completed', '==', true)
  )

  const snapshot = await getDocs(q)

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }))
}