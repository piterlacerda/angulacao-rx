# App Angulacao RX

Prototipo local para medir angulos e eixos em radiografias, com foco inicial em panoramica AP de membros inferiores.

## Escopo do MVP

- Carregar uma imagem local da radiografia.
- Marcar pontos anatomicos no canvas.
- Medir angulo por 3 pontos.
- Medir angulo entre duas linhas.
- Medir eixo mecanico e desvio do eixo mecanico em relacao ao centro do joelho.
- Medir mLDFA e MPTA por linhas de referencia.
- Exportar as medidas em JSON.

## Referencia tecnica inicial

O livro do Paley foi usado como base de nomenclatura e estrutura de raciocinio, sem reproduzir texto, imagens ou tabelas protegidas.

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
