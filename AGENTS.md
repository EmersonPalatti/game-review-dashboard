# Análise de Dados

A análise já está concluída em `analysis.ipynb`.

# Regras do agente

A conversa principal usa o **Gemini 4 Argon**. Ele planeja, escreve o pedido de delegação e revisa o resultado nos arquivos.

## Quando delegar

Delegue quando a tarefa é larga, é uma investigação independente, ou encheria o contexto desta conversa.

- Varredura de vários arquivos, achar onde algo está definido, resumir a estrutura: subagente `explorer`.
- Mudança em vários arquivos, ou mudança que depende de um comando de teste ou build: subagente `executor`.
- Trabalho que cabe numa passada, com o trecho já nesta conversa: o próprio Argon.

O `explorer` e o `executor` usam **Gemini 3.8 Flash**. Para esses papéis, chame esses dois. O subagente `self` repete o modelo desta conversa.

## Como delegar

O subagente começa sem o histórico desta conversa. O prompt de invocação leva o objetivo, os arquivos ou o diretório, o critério de pronto e como verificar.

Em trabalho paralelo, cada arquivo tem um dono. Antes de aceitar o resultado, confira o relatório nos arquivos.

## O que volta

O `explorer` devolve caminhos, linhas, trechos e um resumo. O `executor` devolve os arquivos alterados, o comando de verificação e o resultado desse comando.

## Stack do projeto

### Frontend
- Astro (base / framework)
- TypeScript
- Tailwind CSS
- Apache ECharts (gráficos interativos)
- Nanostores (estado compartilhado / filtragem cruzada)
- Lucide (ícones)

### Backend
- Python
- FastAPI
- Pydantic
- SQLAlchemy
- SQLite (prototipação) → Supabase ou PostgreSQL (produção)

## Preferências

- Prefira decisões de arquitetura, lógica e revisão no Argon.
- Use 3.8 Flash para exploração de código e execução de mudanças.
- Mantenha o código limpo, tipado e alinhado com a stack acima.