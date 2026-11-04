import { useEffect, useState } from 'react';

/** Espera antes de mostrar barra, dimming e “Atualizando…”. Respostas mais rápidas ficam quietas. */
export const FETCH_FEEDBACK_DELAY_MS = 180;

/**
 * Fica true só se `active` continuar true pelo atraso inteiro.
 * Volta a false no mesmo instante em que `active` cai.
 */
export function useDelayedFlag(active: boolean, delay = FETCH_FEEDBACK_DELAY_MS): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [active, delay]);

  return visible;
}
