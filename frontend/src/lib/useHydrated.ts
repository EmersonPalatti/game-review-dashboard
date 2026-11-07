import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * `false` no SSR e durante a hidratação; `true` depois. Ilhas que leem o cache compartilhado do
 * TanStack Query (ou stores do cliente) usam isto para que o primeiro render bata com o HTML do
 * servidor, mesmo quando outra ilha já trouxe os dados antes desta hidratar.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
