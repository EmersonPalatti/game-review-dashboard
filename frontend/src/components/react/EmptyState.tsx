import { resetFilters } from '../../stores/filters';

export const EMPTY_MESSAGE = 'Nenhuma avaliação neste recorte.';

type EmptyStateProps = {
  /** Texto do vazio; o padrão vale para gráficos e tabela. */
  message?: string;
  /** `start` alinha à esquerda (cards de gráfico); `center` centraliza (tabela). */
  align?: 'start' | 'center';
  className?: string;
  hidden?: boolean;
};

/**
 * Estado vazio com saída: todo recorte sem avaliações oferece a mesma ação de recuperação,
 * para que gráficos e tabela não terminem em beco sem saída.
 */
export function EmptyState({ message = EMPTY_MESSAGE, align = 'center', className, hidden }: EmptyStateProps) {
  const classes = ['empty-state', align === 'start' ? 'empty-state-start' : null, className].filter(Boolean).join(' ');
  return (
    <div className={classes} hidden={hidden}>
      <p className="meta">{message}</p>
      <button type="button" className="btn btn-secondary btn-small" onClick={() => resetFilters()}>
        Limpar filtros
      </button>
    </div>
  );
}
