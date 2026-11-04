# Análise de Dados

A análise já está concluída em `analysis.ipynb`.

# Regras do agente

A conversa principal usa o **Grok 4.7 High**. Ele planeja, orquestra a delegação e revisa o resultado nos arquivos.

## Quando delegar

Delegue quando a tarefa é larga, é uma investigação independente, ou encheria o contexto desta conversa.

- Varredura de vários arquivos, achar onde algo está definido, resumir a estrutura: subagente `explorer`.
- Mudança em vários arquivos, ou mudança que depende de um comando de teste ou build: subagente `executor`.
- Trabalho que cabe numa passada, com o trecho já nesta conversa: o próprio Grok 4.7 High.

O `explorer` e o `executor` usam **Composer 2.5 Fast**. Para esses papéis, chame esses dois com o modelo `composer-2.5-fast`. O subagente `self` repete o modelo desta conversa.

## Como delegar

O subagente começa sem o histórico desta conversa. O prompt de invocação leva o objetivo, os arquivos ou o diretório, o critério de pronto e como verificar.

Em trabalho paralelo, cada arquivo tem um dono. Antes de aceitar o resultado, confira o relatório nos arquivos.

## O que volta

O `explorer` devolve caminhos, linhas, trechos e um resumo. O `executor` devolve os arquivos alterados, o comando de verificação e o resultado desse comando.

## Stack do projeto

### Frontend
- Astro — casca estática (layout, sidebar, cabeçalho). Não envia JavaScript para o que é só markup.
- React islands — interatividade em `client:load` (filtros, KPIs, presets) e `client:visible` (gráficos, tabela).
- TypeScript — contratos do frontend alinhados aos schemas do Pydantic.
- Tailwind CSS — layout do dashboard, tokens e tema claro/escuro.
- Lucide — ícones da navegação e dos filtros.
- Apache ECharts — séries e barras dentro da ilha de gráficos.
- Nanostores — filtros e ordenação compartilhados entre ilhas, sem um Provider cobrindo a página.
- TanStack Query — cache, carregamento e refetch de `/api/summary`, `/api/charts` e `/api/reviews`. A tabela usa infinite query em janelas de 100.
- TanStack Table + TanStack Virtual — colunas da tabela de avaliações e renderização só das linhas visíveis.

### Backend
- Python
- FastAPI
- Pydantic
- SQLAlchemy
- SQLite (prototipação) → Supabase ou PostgreSQL (produção)

## Preferências

- Prefira decisões de arquitetura, lógica e revisão no Grok 4.7 High.
- Use Composer 2.5 Fast para exploração de código e execução de mudanças.
- Mantenha o código limpo, tipado e alinhado com a stack acima.