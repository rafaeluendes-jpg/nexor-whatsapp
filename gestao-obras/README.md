# R2ON · Gestão inteligente de obras

Aplicativo web (PWA) de gestão inteligente de obras: funciona no celular como aplicativo
instalável e no computador em tela cheia. Vive na pasta `gestao-obras/`, separado do robô
de WhatsApp que está na raiz deste repositório.

## Marca

- Nome: **R2ON** · frase: **Gestão inteligente de obras**
- Laranja `#FF6A00` (ação, destaque, progresso) · Carvão `#111315` (fundo, sidebar) · Branco `#FFFFFF`
- Apoio: Grafite `#25282B` (cards, menus) · Cinza claro `#F4F5F6` (fundo claro) · Cinza médio `#8B9097` (texto secundário)
- Regra: laranja é cor de ação, não de preenchimento. Os tokens estão em `src/index.css`.
- Arquivos: `src/shared/assets/marca/` (wordmark, lockup, símbolo), `public/icons/` (PWA), `public/splash.jpg` (abertura).
- Abertura: `src/app/abertura.tsx` mostra a arte e esmaece para o login (uma vez por sessão).

## Stack

| Camada | Ferramenta | Por quê |
|---|---|---|
| Interface | React 19 + TypeScript + Vite | rápido, tipado, padrão de mercado |
| Estilo | Tailwind CSS v4 + shadcn/ui (Radix) | componentes acessíveis, visual moderno, tema próprio |
| Rotas | React Router v7 | rotas por módulo, guardas de autenticação |
| Dados | TanStack Query | cache, revalidação, estados de carregamento |
| Formulários | react-hook-form + zod | validação forte no cliente |
| Backend | Supabase (Postgres + Auth + Storage) | login seguro, RLS, arquivos privados |
| App no celular | vite-plugin-pwa | instalável, ícones, tela cheia |
| Deploy | Netlify (`netlify.toml`) | cabeçalhos de segurança e CSP já configurados |

## Estrutura de pastas (um módulo = uma pasta)

```
gestao-obras/
├── supabase/migrations/     # banco versionado, um arquivo por assunto
├── src/
│   ├── app/                 # router, providers, página de erro
│   ├── shared/              # o que todos os módulos usam
│   │   ├── components/ui/   # shadcn/ui
│   │   ├── components/layout/ # AppShell (sidebar + barra inferior), cabeçalhos
│   │   ├── lib/             # supabase, env, erros, query-client
│   │   └── hooks/
│   └── modules/
│       ├── auth/            # login, cadastro, recuperar senha, sessão, guardas
│       ├── dashboard/
│       ├── configuracoes/   # perfil e senha
│       ├── obras/           # (próximas etapas) cada módulo com pages/, components/, hooks/, api/
│       ├── clientes/  cronograma/  etapas/  financeiro/  equipe/
│       ├── documentos/  diario/  fotos/  portal-cliente/
│       └── quantitativos/  orcamento/  relatorios/
```

## Segurança (o que já está na base)

- **Autenticação**: Supabase Auth, fluxo PKCE, confirmação de e-mail, senha forte validada no cliente e no servidor.
- **Chave pública só**: o frontend usa apenas a chave *publishable*. A `service_role` nunca entra no app.
- **Row Level Security em todas as tabelas**: nada é visível sem política explícita. Anônimo não lê nada.
- **Multi-tenant por organização**: cada conta de profissional/empresa isola seus dados.
- **Papéis**: proprietário, administrador, engenheiro, mestre de obras, funcionário, prestador. Cliente tem acesso só à própria obra (`obra_participantes`).
- **Auditoria imutável**: quem fez o quê e quando, em cada registro.
- **Storage privado por obra**: `obras-documentos` e `obras-fotos` com política por caminho `{organizacao}/{obra}/...`.
- **Cabeçalhos HTTP**: CSP, HSTS, no-sniff, sem iframe (em `netlify.toml`).
- **Sem redirecionamento aberto** no retorno do e-mail; mensagens de erro não revelam se um e-mail existe.

## Rodando localmente

```bash
cd gestao-obras
cp .env.example .env.local   # preencha com a URL e a chave publishable do projeto Supabase
pnpm install
pnpm dev
```

## Banco de dados

Projeto Supabase: **gestao-obras** (`ikvlqxrlgjimyylmhiec`, região São Paulo). Projeto próprio,
separado dos outros sistemas: usuários, dados, arquivos e chaves só deste app.

As migrações em `supabase/migrations/` são aplicadas em ordem (0001 → 0009) e já estão
aplicadas no projeto. Depois de cada nova migração, regenere os tipos TypeScript em
`src/shared/types/database.ts` e rode os advisors de segurança do Supabase.

As funções usadas pelas políticas de RLS ficam no schema privado `seguranca` (não exposto
pela API), então ninguém consegue chamá-las por `/rest/v1/rpc`.

Teste de segurança: `supabase/testes/rls_base.sql` roda no SQL Editor e termina em
ROLLBACK. Ele cria dois usuários de mentira, uma obra e confere 18 pontos: isolamento
entre contas, cliente vê só a própria obra, anônimo bloqueado, auditoria com autor.

### Configuração no painel do Supabase (manual, uma vez)

Em *Authentication → URL Configuration*:
- **Site URL**: a URL do app publicado (ex.: `https://gestao-obras.netlify.app`)
- **Redirect URLs**: `https://SEU-DOMINIO/auth/callback` e `http://localhost:5173/auth/callback`

Em *Authentication → Providers → Email*: manter **Confirm email** ligado e, se possível,
ativar **Prevent use of leaked passwords** (Pro) em *Auth → Password security*.

## Publicação (Netlify)

Site criado: **r2on** → `https://r2on.netlify.app` (painel: https://app.netlify.com/projects/r2on).
As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` já estão configuradas no site.

O deploy é feito pelo GitHub (o `netlify.toml` da raiz aponta `base = "gestao-obras"`):
1. No painel do site: *Site configuration → Build & deploy → Link repository*.
2. Escolha `rafaeluendes-jpg/nexor-whatsapp` e a branch que quer publicar.
3. O Netlify lê o `netlify.toml` e faz o build com `pnpm build`. Cada push vira um deploy.

Depois, no Supabase (*Authentication → URL Configuration*): Site URL `https://r2on.netlify.app`
e Redirect URL `https://r2on.netlify.app/auth/callback`.

## Scripts

- `pnpm dev` · desenvolvimento
- `pnpm build` · produção (`dist/`)
- `pnpm lint` · oxlint
- `node scripts/gerar-icones.mjs public/favicon.svg public/icons` · regera os ícones do PWA
