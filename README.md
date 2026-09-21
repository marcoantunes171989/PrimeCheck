# PrimeCheck

**Conversão & Homologação de Dados**

O PrimeCheck é uma aplicação web client-side para importar, comparar, validar e homologar dados entre arquivos de origem e destino sem banco de dados.

## O que já está implementado

- Importação múltipla de arquivos por lado (origem/destino).
- Formatos: CSV, TXT, TSV, XLS, XLSX, XLSM, XLSB e ODS.
- Leitura totalmente no navegador.
- Mapeamento automático e ajuste manual de 31 campos do checklist de clientes.
- Cruzamento pela chave `Código interno`.
- Normalização de texto, códigos, telefone, datas, valores e PF/PJ.
- Validação de CPF e CNPJ.
- Suporte ao CNPJ alfanumérico (14 posições, DV por módulo 11).
- Regra especial de homologação de CPF/CNPJ:
  - documento válido na origem + destino diferente = **DIVERGENTE / erro**;
  - documento ausente ou inválido na origem + destino diferente/gerado = **ATENÇÃO / aviso**.
- Detecção de duplicidades de CPF/CNPJ e Inscrição Estadual.
- Registros não encontrados no destino e registros somente no destino.
- Dashboard, comparação por campo e análise individual do cliente.
- Exportação do relatório completo em Excel.
- Exportação CSV do filtro de clientes.
- Impressão / salvar como PDF pelo navegador.
- PWA básica com cache do shell para reabertura offline após o primeiro acesso.

## Privacidade

Os dados importados não são enviados a banco de dados ou API. O processamento ocorre na memória da aba do navegador. Ao recarregar/fechar a página, os arquivos deixam de estar disponíveis.

## Desenvolvimento local

Requisitos: Node.js 20+.

```bash
npm install
npm run dev
```

Build de produção:

```bash
npm run build
npm run preview
```

## Vercel

O projeto é compatível com Vite e inclui `vercel.json` para fallback SPA.

Configuração recomendada:

- Framework Preset: **Vite**
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`
- Production Branch: `main`

## Fluxo Git sugerido

- `main`: produção
- `homologacao`: validação antes da promoção
- `feat/*`: desenvolvimento de novas funcionalidades

## Próximas evoluções

- Perfis de mapeamento salvos por sistema (ex.: Donaire → InterSolid).
- Web Worker para arquivos muito grandes.
- Exportação PDF estruturada sem depender do diálogo de impressão.
- Perfis de checklist: clientes, produtos, fornecedores, estoque e fiscal.
- PWA para instalação no Windows e funcionamento offline após o primeiro acesso.
