import React from 'react';
import Modal from './Modal';
import Button from './Button';

interface ConfirmModalProps {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Красная кнопка подтверждения (удаление). По умолчанию true. */
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Кастомная замена window.confirm: backdrop + карточка + Cancel / Delete. */
const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  onConfirm,
  onClose
}) => (
  <Modal onClose={onClose} className="modal-confirm" width={420}>
    <h3>{title}</h3>
    <p className="modal-confirm-text">{message}</p>
    <div className="modal-actions">
      <Button variant="secondary" onClick={onClose}>
        {cancelLabel}
      </Button>
      <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </div>
  </Modal>
);

export default ConfirmModal;
