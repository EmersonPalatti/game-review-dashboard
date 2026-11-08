import { atom } from 'nanostores';

export type Theme = 'dark' | 'light';

// Tema aplicado no <html>. Ilhas que pintam com tokens lidos em JS (ECharts) assinam este
// store para repintar, sem que o script da página precise importar o código delas.
export const theme = atom<Theme>('light');
