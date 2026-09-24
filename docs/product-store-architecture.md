# Arquitetura de Produto por Loja

## Princípio

`Produto por Loja` é o núcleo principal da camada de produtos do PrimeCheck.

O cadastro-base de produto permanece separado para preservar a referência global do item, enquanto vínculos e análises por estabelecimento ficam centralizados no módulo `Produto por Loja`.

## Estrutura de navegação

- Produto por Loja
  - Produto por Loja
  - Cadastro Base do Produto
  - Códigos de Barras
  - Produtos Similares
  - Produto por Fornecedor
- Fiscal e Conteúdo
  - NCM
  - CEST
  - IBPT
  - IBS/CBS
  - Benefício Fiscal
  - Receitas
  - Informações Nutricionais

## Cadeia de dependências planejada

1. Seções
2. Grupos
3. Subgrupos
4. Cadastro Base do Produto
5. Produto por Loja

Vínculos derivados:
- Códigos de Barras -> Produto / Produto por Loja
- Produtos Similares -> Produto / Produto por Loja
- Produto por Fornecedor -> Produto + Fornecedor
- Fiscal -> Produto por Loja + referências fiscais
- Receita -> Produto por Loja
- Informação Nutricional -> Produto por Loja

## Chaves de comparação planejadas

As chaves somente devem ser fixadas depois da análise dos arquivos reais de origem/destino e do SELECT do Intersolid.

Direção esperada:
- Produto: `COD_PRODUTO`
- Produto por Loja: `COD_LOJA + COD_PRODUTO`
- Código de Barras: `COD_PRODUTO + COD_BARRA` ou `COD_LOJA + COD_PRODUTO + COD_BARRA`
- Produto por Fornecedor: `COD_PRODUTO + COD_FORNECEDOR`
- Produto Similar: `COD_PRODUTO + COD_PRODUTO_SIMILAR`

## Análises planejadas no hub

- produtos por loja;
- produtos ausentes entre lojas;
- múltiplos códigos de barras;
- códigos duplicados;
- comparação de custo e preço;
- produto abaixo do custo;
- margem divergente;
- NCM/CEST/benefício fiscal faltante;
- integridade de vínculos fiscais;
- produtos sem fornecedor;
- múltiplos fornecedores;
- similares ausentes ou inconsistentes;
- receitas;
- informações nutricionais;
- auditorias de origem x destino.

## Regra de implementação

A comparação de arquivo e a integridade referencial devem permanecer separadas.

Exemplo:
- arquivo origem x destino pode estar 100% conforme;
- o mesmo registro pode ter um NCM inexistente no cadastro de referência.

Essa situação deve aparecer como problema de integridade, não como divergência do arquivo.
