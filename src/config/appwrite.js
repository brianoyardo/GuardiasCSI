import { Client, Storage, ID } from 'appwrite'

/**
 * Appwrite Configuration
 * Used exclusively for multimedia/evidence storage
 * Decoupled from Firebase operational backend
 */
const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID)

export const storage = new Storage(client)
export const appwriteId = ID

/**
 * Bucket IDs — centralized for future expansion
 * Currently using single bucket for evidence on free plan
 */
export const BUCKETS = {
  EVIDENCE: import.meta.env.VITE_APPWRITE_BUCKET_EVIDENCE || 'evidence-bucket',
}

export { client }
export default client
