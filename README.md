# App Angulação RX

Protótipo local para medir ângulos e eixos em radiografias, com foco inicial em panorâmica AP de membros inferiores.

## Site publicado

Vercel:

https://angulacao-rx.vercel.app/

Domínio customizado reservado na Vercel:

https://angulacao.drpiterlacerda.com.br/

Status do domínio customizado: funcionando em produção.

GitHub Pages:

https://piterlacerda.github.io/angulacao-rx/

Repositório público do app:

https://github.com/piterlacerda/angulacao-rx

## Deploy na Vercel

Projeto publicado na Vercel e conectado ao repositório:

https://github.com/piterlacerda/angulacao-rx

Domínio customizado:

angulacao.drpiterlacerda.com.br

DNS esperado no Cloudflare:

A angulacao.drpiterlacerda.com.br -> 76.76.21.21

## Escopo do MVP

- Carregar uma imagem local da radiografia.
- Marcar pontos anatômicos no canvas.
- Medir ângulo por 3 pontos.
- Medir ângulo entre duas linhas.
- Calibrar escala por marcador conhecido.
- Ocultar a marcação visual da calibração após aplicar a escala.
- Medir distância com régua em px ou mm quando calibrado.
- Traçar eixo mecânico com dois pontos: centro da cabeça femoral e centro do tornozelo.
- Medir MAD como ferramenta separada, usando eixo mecânico e centro do joelho.
- Marcar CORA por eixos proximal e distal.
- Medir mLDFA, MPTA, aPDFA, PPTA e ADTA por linhas de referência.
- Escolher cor e espessura das linhas para reduzir confusão visual.
- Adicionar anotações curtas sobre a radiografia.
- Ocultar, travar ou apagar medidas individualmente.
- Contornar fragmentos e simular rotação em torno de um pivô.
- Usar zoom/mover para marcação fina de pontos.
- Salvar PNG limpo da área da radiografia com medidas e angulações.
- Desenhar linhas independentes, mover uma linha inteira, ajustar pontas e apagar linha selecionada com Delete.
- Mostrar comprimento da linha selecionada/registrada quando a escala estiver calibrada.
- Selecionar segmentos individuais pelo painel de medidas para mover, girar ou apagar cada linha separadamente.
- Controlar autoângulos, passo de ajuste fino e passo de rotação.
- Estender linhas de eixo para simular referências longas de planejamento.
- Ajustar brilho, contraste e inversão da radiografia antes da marcação.
- Dividir linha em metade, terços ou quintos para marcações auxiliares.
- Mostrar os quatro ângulos formados por duas linhas, cada um no seu quadrante ao redor do cruzamento.
- Ajustar linha selecionada com controles de eixo, paralelo e rotação fina; atalhos: setas para mover, [ e ] para girar.
- Rotacionar fragmento diretamente ao arrastar sobre ele, usando o pivô como centro, com ajuste fino de 1 grau.
- Preencher painel MAP para organizar análise e planejamento.
- Seguir checklist MAP: escala, eixo/MAD, ângulos articulares, CORA e simulação.
- Consultar guia rápido de como medir e para que serve cada medida principal.
- Consultar aba de referências AP/perfil com valores normais orientativos baseados em Paley.
- Adaptar automaticamente a interface para tablet quando houver tela intermediária com toque.
- Baixar as medidas em arquivo de texto legível.

## Testes

```bash
node --check app.js
node tests/measurement-calculations.test.js
```

## Referência técnica inicial

O livro do Paley e o guia público do Bone Ninja foram usados como base de nomenclatura, estrutura de raciocínio e requisitos de fluxo, sem reproduzir texto, imagens ou tabelas protegidas.

Melhorias incorporadas do estudo:

- Separar medição global do eixo mecânico da medição do MAD.
- Usar CORA como ferramenta própria para interseção dos eixos dos segmentos.
- Manter autoângulos, nudge e espessura de linha como controles explícitos.
- Usar ferramentas de linhas, régua, fragmento/pivô e exportação como fluxo de ensino e planejamento.
- Trazer do tutorial Bone Ninja o foco em fluxo guiado, linhas de eixo estendidas e ajuste visual da imagem.

Primeira versão clinicamente útil:

- AP panorâmico de membros inferiores.
- Centro da cabeça femoral.
- Centro do joelho.
- Centro do tornozelo.
- Linha articular distal do fêmur.
- Linha articular proximal da tíbia.
- Medidas prioritárias: eixo mecânico, MAD, CORA, mLDFA, MPTA e ângulo tibiofemoral mecânico.
- Ferramentas de perfil: aPDFA, PPTA e ADTA para análise de deformidade no plano sagital.

## Uso

Abra index.html no navegador ou sirva a pasta localmente:

python3 -m http.server 4173

Depois acesse http://127.0.0.1:4173.

## Privacidade e segurança clínica

- As imagens carregadas ficam no navegador do usuário.
- O protótipo não envia radiografias para servidor.
- A ferramenta é apoio de medição; interpretação e conduta dependem de revisão médica.
