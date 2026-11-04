import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { queryClient } from '../../lib/queryClient';

type QueryRootProps = {
  children: ReactNode;
};

export function QueryRoot({ children }: QueryRootProps) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
