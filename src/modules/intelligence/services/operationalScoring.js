/**
 * SentinelOps — Operational Scoring
 * Generates an operational score (0-100) based on multiple spatial and temporal dimensions.
 */

const LOG_PREFIX = '[OperationalScoring]'

/**
 * Calculates final score for a completed ronda execution.
 * 
 * @param {object} execution - RondaExecution document
 * @param {object} complianceResults - From patrolCompliance.js
 * @returns {object} { score: number, breakdown: object }
 */
export function calculateOperationalScore(execution, complianceResults) {
  try {
    // Breakdown weights (Total = 100)
    const WEIGHTS = {
      adherence: 40,    // Did they walk the line?
      checkpoints: 40,  // Did they validate the required points?
      punctuality: 20,  // Did they finish on time?
    }

    const breakdown = {
      adherenceScore: 0,
      checkpointsScore: 0,
      punctualityScore: 0,
    }

    // 1. Spatial Adherence (40 pts)
    // If adherencePercentage is 90%, they get 0.9 * 40 = 36 pts
    const adherencePercent = complianceResults?.adherencePercentage || 0
    breakdown.adherenceScore = (adherencePercent / 100) * WEIGHTS.adherence

    // 2. Checkpoints (40 pts)
    const totalCheckpoints = execution.checkpointIds?.length || 0
    const completedCheckpoints = execution.completedCheckpoints?.length || 0
    
    if (totalCheckpoints > 0) {
      breakdown.checkpointsScore = (completedCheckpoints / totalCheckpoints) * WEIGHTS.checkpoints
    } else {
      breakdown.checkpointsScore = WEIGHTS.checkpoints // Free points if no checkpoints assigned
    }

    // 3. Punctuality (20 pts)
    // For now, if state is COMPLETED it's 20. If LATE, it's 5. If MISSED, 0.
    if (execution.status === 'completed') {
      breakdown.punctualityScore = WEIGHTS.punctuality
    } else if (execution.status === 'late') {
      breakdown.punctualityScore = WEIGHTS.punctuality * 0.25
    }

    // 4. Penalties (Incidentes críticos durante la ronda, anomalías)
    // If there were GPS anomalies detected, subtract 5 points (min 0)
    let penalty = 0
    const anomalyEvents = (execution.events || []).filter(e => e.type === 'GPS_ANOMALY').length
    penalty += (anomalyEvents * 2)

    // Calculate total
    let totalScore = breakdown.adherenceScore + breakdown.checkpointsScore + breakdown.punctualityScore - penalty
    if (totalScore < 0) totalScore = 0
    if (totalScore > 100) totalScore = 100

    return {
      score: Math.round(totalScore),
      breakdown: {
        adherence: Math.round(breakdown.adherenceScore),
        checkpoints: Math.round(breakdown.checkpointsScore),
        punctuality: Math.round(breakdown.punctualityScore),
        penalties: penalty
      }
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Scoring failed:`, error)
    return { score: 0, breakdown: null }
  }
}
