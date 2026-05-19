import { useState } from 'react'
import styled from 'styled-components'
import { FaExclamationTriangle } from 'react-icons/fa'

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
`

const ModalContent = styled.div`
  position: relative;
  width: 100%;
  max-width: 360px;
  background: var(--color-dark-card, #1e1e2e);
  border: 2px solid var(--color-danger-500, #dc2626);
  border-radius: 16px;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  box-shadow: 0 8px 40px rgba(220, 38, 38, 0.3);
`

const PanicIconLarge = styled(FaExclamationTriangle)`
  font-size: 3rem;
  color: var(--color-danger-500, #dc2626);
  filter: drop-shadow(0 0 12px rgba(220, 38, 38, 0.5));
`

const ModalTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-danger-400, #f87171);
  margin: 0;
  text-align: center;
`

const ModalText = styled.p`
  font-size: 0.9rem;
  color: var(--color-dark-text-muted, #888);
  margin: 0;
  text-align: center;
  line-height: 1.5;
`

const ActionsRow = styled.div`
  display: flex;
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.5rem;
`

const ActionBtn = styled.button`
  flex: 1;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
`

const CancelBtn = styled(ActionBtn)`
  background: transparent;
  border: 1px solid var(--color-dark-border, #444);
  color: var(--color-dark-text-muted, #888);

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-dark-text, #e0e0e0);
  }
`

const ConfirmBtn = styled(ActionBtn)`
  background: var(--color-danger-500, #dc2626);
  color: white;

  &:hover {
    background: #b91c1c;
    box-shadow: 0 0 12px rgba(220, 38, 38, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

const SuccessContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
`

const SuccessIcon = styled.div`
  font-size: 3rem;
  animation: pulse 1s ease-in-out infinite;
`

export default function PanicModal({ onConfirm, onCancel, isSending }) {
  const [sent, setSent] = useState(false)

  const handleConfirm = async () => {
    await onConfirm()
    setSent(true)
    setTimeout(onCancel, 2000)
  }

  return (
    <Overlay onClick={onCancel}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <SuccessContent>
            <SuccessIcon>🚨</SuccessIcon>
            <ModalTitle>Alerta Enviada</ModalTitle>
            <ModalText>Mantén la calma. Ayuda en camino.</ModalText>
          </SuccessContent>
        ) : (
          <>
            <PanicIconLarge />
            <ModalTitle>¿Activar Alerta de Pánico?</ModalTitle>
            <ModalText>
              Se enviará tu ubicación exacta al centro de comando.
              Esta acción queda registrada para auditoría.
            </ModalText>
            <ActionsRow>
              <CancelBtn onClick={onCancel}>Cancelar</CancelBtn>
              <ConfirmBtn onClick={handleConfirm} disabled={isSending}>
                {isSending ? 'Enviando...' : 'Confirmar'}
              </ConfirmBtn>
            </ActionsRow>
          </>
        )}
      </ModalContent>
    </Overlay>
  )
}
