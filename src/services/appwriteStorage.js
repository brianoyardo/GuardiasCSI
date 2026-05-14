import { storage, appwriteId, BUCKETS } from '@/config/appwrite'

/**
 * Appwrite Storage Service — decoupled multimedia handling
 * Handles evidence photos, incident images, and future media
 * Completely separate from Firebase operational backend
 */

/**
 * Upload evidence file (image/photo)
 * @param {File} file - File to upload
 * @param {string} [bucketId] - Target bucket (defaults to EVIDENCE)
 * @returns {Promise<{fileId: string, url: string}>}
 */
export async function uploadEvidence(file, bucketId = BUCKETS.EVIDENCE) {
  const fileId = appwriteId.unique()

  const response = await storage.createFile(
    bucketId,
    fileId,
    file
  )

  const url = getEvidencePreviewUrl(response.$id, bucketId)

  return {
    fileId: response.$id,
    url,
    name: response.name,
    size: response.sizeOriginal,
  }
}

/**
 * Get preview URL for a file
 * @param {string} fileId
 * @param {string} [bucketId]
 * @returns {string}
 */
export function getEvidencePreviewUrl(fileId, bucketId = BUCKETS.EVIDENCE) {
  return storage.getFilePreview(bucketId, fileId).toString()
}

/**
 * Get download URL for a file
 * @param {string} fileId
 * @param {string} [bucketId]
 * @returns {string}
 */
export function getEvidenceDownloadUrl(fileId, bucketId = BUCKETS.EVIDENCE) {
  return storage.getFileDownload(bucketId, fileId).toString()
}

/**
 * Delete evidence file
 * @param {string} fileId
 * @param {string} [bucketId]
 */
export async function deleteEvidence(fileId, bucketId = BUCKETS.EVIDENCE) {
  return storage.deleteFile(bucketId, fileId)
}

/**
 * Upload multiple evidence files
 * @param {File[]} files
 * @param {string} [bucketId]
 * @returns {Promise<Array<{fileId: string, url: string}>>}
 */
export async function uploadMultipleEvidence(files, bucketId = BUCKETS.EVIDENCE) {
  const results = await Promise.all(
    files.map((file) => uploadEvidence(file, bucketId))
  )
  return results
}
