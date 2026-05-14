import CheckpointMarker from '@/modules/maps/markers/CheckpointMarker'

/**
 * CheckpointLayer — Renders all checkpoints for a route
 * Decoupled layer component: receives data, renders markers
 * 
 * @param {object} props
 * @param {Array} props.checkpoints - Array of checkpoint objects
 * @param {Set|Array} [props.completedIds] - IDs of completed checkpoints
 * @param {string} [props.activeId] - Currently active checkpoint ID
 * @param {Function} [props.onCheckpointClick]
 */
export default function CheckpointLayer({
  checkpoints = [],
  completedIds = [],
  activeId = null,
  onCheckpointClick,
}) {
  if (!checkpoints.length) return null

  const completedSet = completedIds instanceof Set
    ? completedIds
    : new Set(completedIds)

  return (
    <>
      {checkpoints.map((cp, index) => {
        const state = completedSet.has(cp.id)
          ? 'completed'
          : cp.id === activeId
          ? 'active'
          : 'pending'

        return (
          <CheckpointMarker
            key={cp.id || index}
            position={{ lat: cp.lat || cp.latitude, lng: cp.lng || cp.longitude }}
            state={state}
            order={cp.order || index + 1}
            name={cp.name}
            description={cp.description}
            onClick={onCheckpointClick ? () => onCheckpointClick(cp) : undefined}
          />
        )
      })}
    </>
  )
}
