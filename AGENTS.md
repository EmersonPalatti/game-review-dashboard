# Dashboard de Análise de Reviews da Steam

A análise exploratória já está concluída em `analysis.ipynb`.  
O objetivo agora é construir o dashboard interativo a partir desses insights.

## Stack

**Frontend** (Astro + TypeScript + Tailwind):
- Apache ECharts (gráficos)
- Nanostores (estado e filtragem cruzada)
- Lucide (ícones)

**Backend** (Python):
- FastAPI + Pydantic + SQLAlchemy
- SQLite (prototipação) → Supabase/PostgreSQL (produção)

## Regras do agente

A conversa principal usa o modelo principal (orquestrador). Ele planeja, escreve os prompts de delegação, revisa os arquivos e toma as decisões de arquitetura e lógica.

### Quando delegar

Delegue quando a tarefa for larga, visual/multimodal, ou encheria o contexto da conversa principal.

- Exploração de estrutura, busca de padrões ou resumo de arquivos → subagente `explorer`
- Mudanças em vários arquivos, implementação ou refatoração → subagente `executor`
- Geração ou edição de assets visuais, feedback de UI, paleta, hierarquia, ícones ou vídeo → use o **Gemini CLI** (`gemini-api`)
- Trabalho pequeno e localizado, com o contexto já presente → faça direto

### Como delegar

O subagente começa sem o histórico da conversa. O prompt deve conter:
- Objetivo claro
- Arquivos ou diretórios relevantes
- Critério de pronto
- Como verificar o resultado

Antes de aceitar qualquer resultado, confira os arquivos alterados.

### Ferramentas disponíveis

Você tem acesso ao comando `gemini-api` no shell. Use-o como subagente especializado em visual e multimodal.

Use para:
- Gerar ou editar imagens, ícones e assets (`gemini-api image`)
- Gerar vídeos ou animações (`gemini-api video`)
- Analisar screenshots, frames ou arquivos (`gemini-api analyze -i ...`)
- Rodar tarefas de research ou design longas (`gemini-api agent run ... --background`)

Regras de uso do Gemini CLI:
1. Em caso de dúvida, rode `gemini-api --help` ou `--dry-run` antes.
2. Capture o caminho do arquivo gerado e use-o nos próximos passos.
3. Para feedback de UI, tire screenshot e envie para `gemini-api analyze`.
4. Prefira o Gemini para decisões visuais, paleta, hierarquia, ícones e assets. Use o modelo principal para lógica, dados, arquitetura e orquestração.
5. Mantenha o visual clean: sem gradients roxos genéricos, glows excessivos ou cara de “AI slop”.

### O que volta

- `explorer`: caminhos, trechos relevantes e resumo
- `executor`: arquivos alterados + comando de verificação + resultado
- Gemini CLI: caminho do arquivo gerado ou análise em texto