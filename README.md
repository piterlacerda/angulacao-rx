# App Angulacao RX

Prototipo local para medir angulos e eixos em radiografias, com foco inicial em panoramica AP de membros inferiores.

## Site publicado

Vercel:

https://angulacao-rx.vercel.app/

Dominio customizado reservado na Vercel:

https://angulacao.drpiterlacerda.com.br/

Status do dominio customizado: pendente de DNS.

GitHub Pages:

https://piterlacerda.github.io/angulacao-rx/

Repositorio publico do app:

https://github.com/piterlacerda/angulacao-rx

## Deploy na Vercel

Projeto publicado na Vercel e conectado ao repositorio:

https://github.com/piterlacerda/angulacao-rx

Dominio customizado:

angulacao.drpiterlacerda.com.br

DNS esperado no Cloudflare:

A angulacao.drpiterlacerda.com.br -> 76.76.21.21

## Escopo do MVP

- Carregar uma imagem local da radiografia.
- Marcar pontos anatomicos no canvas.
- Medir angulo por 3 pontos.
- Medir angulo entre duas linhas.
- Calibrar escala por marcador conhecido.
- Medir distancia com regua em px ou mm quando calibrado.
- Medir eixo mecanico e desvio do eixo mecanico em relacao ao centro do joelho.
- Medir mLDFA e MPTA por linhas de referencia.
- Preencher painel MAP para organizar analise e planejamento.
- Baixar as medidas em arquivo de texto legivel.

## Referencia tecnica inicial

O livro do Paley e o guia publico do Bone Ninja foram usados como base de nomenclatura, estrutura de raciocinio e requisitos de fluxo, sem reproduzir texto, imagens ou tabelas protegidas.

Primeira versao clinicamente util:

- AP panoramico de membros inferiores.
- Centro da cabeca femoral.
- Centro do joelho.
- Centro do tornozelo.
- Linha articular distal do femur.
- Linha articular proximal da tibia.
- Medidas prioritarias: MAD, mLDFA, MPTA e angulo tibiofemoral mecanico.

## Uso

Abra index.html no navegador ou sirva a pasta localmente:

python3 -m http.server 4173

Depois acesse http://127.0.0.1:4173.

## Privacidade e seguranca clinica

- As imagens carregadas ficam no navegador do usuario.
- O prototipo nao envia radiografias para servidor.
- A ferramenta e apoio de medicao; interpretacao e conduta dependem de revisao medica.
