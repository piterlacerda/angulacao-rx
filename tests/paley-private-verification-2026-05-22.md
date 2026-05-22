# Verificacao privada baseada em Paley - 2026-05-22

Este registro documenta testes tecnicos do app Angulacao RX usando o livro de Paley apenas como referencia privada de nomenclatura e sequencia de raciocinio. Nenhuma pagina, imagem, tabela ou trecho extenso do livro foi incorporado ao app ou ao repositorio publico.

## Escopo testado

- Angulo por 3 pontos.
- Angulo entre duas linhas.
- MAD/eixo mecanico com distancia ponto-linha.
- mLDFA e MPTA como angulos entre eixo mecanico e linha articular.
- Conversao linear apos calibracao pixel/mm.
- Rotacao de fragmento em torno de pivo.

## Resultado

- Os testes geometricos controlados passaram.
- Casos de referencia: 90 graus, 45 graus, MAD de 10 px, regua calibrada 10 px = 5 mm quando escala = 2 px/mm, rotacao de 90 graus em torno de pivo.
- A logica basica esta coerente para validacao tecnica inicial.

## Limites

- Estes testes nao validam indicacao clinica, escolha anatomica dos pontos, qualidade de radiografia, magnificacao, DICOM, nem planejamento cirurgico.
- A proxima validacao deve usar casos reais anonimizados marcados pelo Piter, comparando as medidas do app com medida manual/esperada.
