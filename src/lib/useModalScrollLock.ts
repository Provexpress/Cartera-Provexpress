import { useEffect } from 'react';

let activeModalsCount = 0;
let originalOverflow = '';
let originalPaddingRight = '';

/**
 * Bloquea el scroll del fondo (body) mientras un modal esté abierto,
 * evita el salto de layout por la barra de desplazamiento y permite
 * cerrar el modal con la tecla Escape.
 */
export function useModalScrollLock(isOpen: boolean = true, onClose?: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    if (activeModalsCount === 0) {
      originalOverflow = document.body.style.overflow;
      originalPaddingRight = document.body.style.paddingRight;

      // Compensar el ancho del scrollbar para evitar saltos horizontales
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
    }
    activeModalsCount++;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      activeModalsCount--;
      if (activeModalsCount <= 0) {
        activeModalsCount = 0;
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
        document.body.classList.remove('modal-open');
      }
    };
  }, [isOpen, onClose]);
}
