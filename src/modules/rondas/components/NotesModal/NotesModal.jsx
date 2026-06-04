import './NotesModal.css'

export default function NotesModal({ notes, onClose }) {
  return (
    <div className="notes-modal" id="notes-modal">
      <div className="notes-modal__overlay" onClick={onClose} />
      
      <div className="notes-modal__sheet">
        <div className="notes-modal__header">
          <div className="notes-modal__drag-handle" />
          <h3 className="notes-modal__title">📝 Indicaciones de la Ronda</h3>
        </div>
        
        <div className="notes-modal__content">
          <p className="notes-modal__text">
            {notes || 'Sin indicaciones adicionales.'}
          </p>
        </div>

        <div className="notes-modal__footer">
          <button className="notes-modal__close-btn" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
