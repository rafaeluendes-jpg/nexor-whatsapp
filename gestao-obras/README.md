# Gestão de Obras

Aplicativo web (PWA) de gestão inteligente de obras: funciona no celular como aplicativo
instalável e no computador em tela cheia. Vive na pasta `gestao-obras/`, separado do robô
de WhatsApp que está na raiz deste repositório.

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

As migrações em `supabase/migrations/` são aplicadas em ordem (0001 → 0007).
Depois de aplicar, gere os tipos TypeScript para `src/shared/types/database.ts`.

## Scripts

- `pnpm dev` · desenvolvimento
- `pnpm build` · produção (`dist/`)
- `pnpm lint` · oxlint
- `node scripts/gerar-icones.mjs public/favicon.svg public/icons` · regera os ícones do PWA
