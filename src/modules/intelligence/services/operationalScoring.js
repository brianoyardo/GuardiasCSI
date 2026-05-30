/**
 * SentinelOps — Operational Scoring
 * Generates an operational score (0-100) based on multiple spatial and temporal dimensions.
 * 
 * Phase 20.5: Updated criteria
 *   - Adherence: 50 pts (spatial fidelity)
 *   - Checkpoints: 50 pts (completion rate)
 *   - Penalties: GPS anomalies, late start, voice failure
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
      adherence: 50,    // Did they walk the line?
      checkpoints: 50,  // Did they validate the required points?
    }

    const breakdown = {
      adherenceScore: 0,
      checkpointsScore: 0,
    }

    // 1. Spatial Adherence (50 pts)
    const adherencePercent = complianceResults?.adherencePercentage || 0
    breakdown.adherenceScore = (adherencePercent / 100) * WEIGHTS.adherence

    // 2. Checkpoints (50 pts)
    const totalCheckpoints = execution.checkpointIds?.length || 0
    const completedCheckpoints = execution.completedCheckpoints?.length || 0
    
    if (totalCheckpoints > 0) {
      breakdown.checkpointsScore = (completedCheckpoints / totalCheckpoints) * WEIGHTS.checkpoints
    } else {
      breakdown.checkpointsScore = WEIGHTS.checkpoints // Free points if no checkpoints assigned
    }

    // 3. Penalties
    let penalty = 0

    // GPS Anomalies: -2 per anomaly
    const anomalyEvents = (execution.events || []).filter(e => e.type === 'GPS_ANOMALY').length
    penalty += (anomalyEvents * 2)

    // Late start: -5
    if (execution.startedLate) {
      penalty += 5
    }

    // Voice validation failure: -3
    if (execution.voicePassphrase && !execution.voiceValidated) {
      penalty += 3
    }

    // Calculate total
    let totalScore = breakdown.adherenceScore + breakdown.checkpointsScore - penalty
    if (totalScore < 0) totalScore = 0
    if (totalScore > 100) totalScore = 100

    return {
      score: Math.round(totalScore),
      breakdown: {
        adherence: Math.round(breakdown.adherenceScore),
        checkpoints: Math.round(breakdown.checkpointsScore),
        penalties: penalty
      }
    }
  } catch (error) {
//console.error(`${LOG_PREFIX} Scoring failed:`, error)
    return { score: 0, breakdown: null }
  }
}

