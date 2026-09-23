# Validação local — PrimeCheck

Branch preparada: `homologacao-local-validacao`

Esta branch parte da versão consolidada da `main` e foi criada para validar todas as funcionalidades localmente, sem consumir deployments da Vercel.

## Opção mais simples no Windows

1. Abra o projeto no computador de desenvolvimento.
2. Atualize o repositório e entre na branch:

```bash
git fetch origin
git checkout homologacao-local-validacao
git pull origin homologacao-local-validacao
```

3. Execute:

```bat
validar-local.cmd
```

O script instala dependências se necessário, gera o build e inicia o Preview Vite.

### Endereços

Nesta máquina:

```text
http://localhost:4173
```

Em tablet, notebook ou outro dispositivo conectado à mesma rede, utilize o endereço `Network` exibido no terminal pelo Vite.

## Comandos manuais

```bash
npm install --no-audit --no-fund
npm run build
npm run preview:lan
```

Para desenvolvimento com atualização automática:

```bash
npm run dev:lan
```

O modo `preview:lan` é recomendado para a homologação final porque valida o build compilado, mais próximo do que será publicado na Vercel.

## Fluxo recomendado

Desenvolvimento → validação local → ajustes → aprovação → consolidação na main → um único deployment na Vercel → smoke test.
