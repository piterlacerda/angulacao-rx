# Verificação privada baseada em Paley - 2026-05-22

Este registro documenta testes técnicos do app Angulação RX usando o livro de Paley apenas como referência privada de nomenclatura e sequência de raciocínio. Nenhuma página, imagem, tabela ou trecho extenso do livro foi incorporado ao app ou ao repositório público.

## Escopo testado

- Ângulo por 3 pontos.
- Ângulo entre duas linhas.
- Eixo mecânico com dois pontos: centro da cabeça femoral e centro do tornozelo.
- MAD como desvio perpendicular do centro do joelho ao eixo mecânico.
- CORA como interseção dos eixos proximal e distal.
- mLDFA e MPTA como ângulos entre eixo mecânico e linha articular.
- Conversão linear após calibração pixel/mm.
- Rotação de fragmento em torno de pivô.

## Resultado

- Os testes geométricos controlados passaram.
- Casos de referência: 90 graus, 45 graus, eixo mecânico com 2 pontos, MAD de 10 px, CORA de 90 graus, régua calibrada 10 px = 5 mm quando escala = 2 px/mm, rotação de 90 graus em torno de pivô.
- A lógica básica está coerente para validação técnica inicial.

## Limites

- Estes testes não validam indicação clínica, escolha anatômica dos pontos, qualidade de radiografia, magnificação, DICOM, nem planejamento cirúrgico.
- A próxima validação deve usar casos reais anonimizados marcados pelo Piter, comparando as medidas do app com medida manual/esperada.
