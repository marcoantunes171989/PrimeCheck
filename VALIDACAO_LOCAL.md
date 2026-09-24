# Validação local — PrimeCheck

Branch de homologação: `homologacao-local-validacao`.

O PrimeCheck volta a utilizar o fluxo simples de homologação local com **Vite Preview em primeiro plano**. Não há daemon, launcher PowerShell, PID oculto ou servidor intermediário.

## Fluxo normal no Windows

Na pasta do projeto:

```bat
cd /d C:\Projetos\PrimeCheck
atualizar-validar-local.cmd
```

O atualizador:

1. sincroniza a branch `homologacao-local-validacao` com o GitHub;
2. confirma o SHA local e remoto;
3. confirma as alterações funcionais esperadas;
4. chama `validar-local.cmd`.

O `validar-local.cmd`:

1. instala dependências apenas se necessário;
2. gera um build limpo;
3. grava o SHA atual no build;
4. inicia diretamente o Vite Preview em primeiro plano.

## Endereço local fixo do PrimeCheck

```text
http://127.0.0.1:4177
```

A porta 4177 é exclusiva para a homologação local do PrimeCheck e evita conflito com outros projetos locais.

## Regra importante

A janela do CMD que mostra o Vite deve permanecer aberta durante a validação.

Quando aparecer algo semelhante a:

```text
Local: http://127.0.0.1:4177/
```

o servidor está ativo. Pressionar `Ctrl+C` ou fechar a janela encerra o acesso local.

## Execução manual

Caso seja necessário validar sem atualizar a branch:

```bat
cd /d C:\Projetos\PrimeCheck
validar-local.cmd
```

Equivalente técnico:

```bash
npm install --no-audit --no-fund
npm run build
npm run preview:local
```

## Promoção

Desenvolvimento → homologação local → validação humana → aprovação → `main` → produção/Vercel → smoke test.

Nenhuma alteração da homologação deve ser promovida para `main` antes da validação humana.
