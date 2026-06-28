import React, { useEffect } from 'react';
import './Modal.css';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  /** Доп. класс на карточку (.modal). */
  className?: string;
  /** Переопределить ширину карточки (px). Инлайн-стиль бьёт глобальный .modal. */
  width?: number;
}

/**
 * Базовая модалка: затемнённый backdrop + центрированная карточка.
 * Esc и клик по фону закрывают. Структурные классы (.modal-overlay/.modal/
 * .modal-actions) переиспользуются из глобальной темы.
 */
const Modal: React.FC<ModalProps> = ({ onClose, children, className = '', width }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal ${className}`}
        style={width ? { width } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
