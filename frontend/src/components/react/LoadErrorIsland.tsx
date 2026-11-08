import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { QueryRoot } from './QueryRoot';

/**
 * Falha sem dados: alguma consulta em erro, nenhuma com dados e nenhuma buscando. No TanStack Query v5
 * uma consulta em erro que volta a buscar mantém `status: 'error'` (só `fetchStatus` muda), então
 * sem a checagem de busca o banner não sairia durante o "Tentar de novo".
 */
function hasLoadFailure(queryClient: QueryClient): boolean {
  const queries = queryClient.getQueryCache().getAll();
  const hasError = queries.some((query) => query.state.status === 'error');
  const hasAnyData = queries.some((query) => query.state.data !== undefined);
  const isFetching = queries.some((query) => query.state.fetchStatus === 'fetching');
  return hasError && !hasAnyData && !isFetching;
}

const getServerSnapshot = (): boolean => false;

function LoadErrorContent() {
  const queryClient = useQueryClient();
  const subscribe = useCallback(
    (onChange: () => void) => queryClient.getQueryCache().subscribe(onChange),
    [queryClient],
  );
  const getSnapshot = useCallback(() => hasLoadFailure(queryClient), [queryClient]);
  const failed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // "Tentar de novo" esconde o banner na hora. Quando a falha some do cache (o refetch já começou),
  // a dispensa é zerada: se o refetch falhar de novo, o banner volta.
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!failed) setDismissed(false);
  }, [failed]);

  const show = failed && !dismissed;

  // Gancho só de CSS no shell: `#dashboard-main[data-error='true'] section`.
  useEffect(() => {
    const main = document.getElementById('dashboard-main');
    if (!main || !show) return;
    main.dataset.error = 'true';
    return () => {
      delete main.dataset.error;
    };
  }, [show]);

  return (
    <div
      id="load-error"
      role="alert"
      aria-hidden={show ? 'false' : 'true'}
      hidden={!show}
      className="card"
    >
      <p className="title">Não conseguimos carregar as avaliações.</p>
      <p id="load-error-detail" className="meta mt-1">
        O serviço de dados não respondeu. Tente de novo em alguns segundos; se continuar, o servidor local pode estar desligado.
      </p>
      <button
        id="retry"
        type="button"
        className="btn btn-primary mt-4"
        onClick={() => {
          setDismissed(true);
          void queryClient.refetchQueries();
        }}
      >
        Tentar de novo
      </button>
    </div>
  );
}

export function LoadErrorIsland() {
  return (
    <QueryRoot>
      <LoadErrorContent />
    </QueryRoot>
  );
}
