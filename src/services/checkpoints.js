import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'

export async function getCheckpoints() {
  const checkpointsRef = collection(db, 'checkpoints')

  const q = query(
    checkpointsRef,
    where('active', '==', true)
  )

  const snapshot = await getDocs(q)

  return snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    .sort((a, b) => a.order - b.order)
}