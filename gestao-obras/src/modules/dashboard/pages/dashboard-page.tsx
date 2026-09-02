import { ShieldCheck, Database, Smartphone, LockKeyhole } from 'lucide-react'
import { usePerfil, useMinhasOrganizacoes } from '@/modules/auth/hooks/use-perfil'
import { CabecalhoPagina } from '@/shared/components/layout/cabecalho-pagina'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Skeleton } from '@/shared/components/ui/skeleton'

const papeis: Record<string, string> = {
  proprietario: 'Proprietário',
  administrador: 'Administrador',
  engenheiro: 'Engenheiro',
  mestre_obras: 'Mestre de obras',
  funcionario: 'Funcionário',
  prestador: 'Prestador',
}

const pilares = [
  { icone: LockKeyhole, titulo: 'Login seguro', texto: 'Supabase Auth com PKCE, confirmação de e-mail e senha forte.' },
  { icone: ShieldCheck, titulo: 'Acesso por obra', texto: 'Row Level Security: cada pessoa só vê o que tem permissão.' },
  { icone: Database, titulo: 'Auditoria', texto: 'Toda alteração fica registrada: quem, quando e o quê.' },
  { icone: Smartphone, titulo: 'App no celular', texto: 'Instale na tela inicial e use como aplicativo.' },
]

export function DashboardPage() {
  const { data: perfil, isLoading } = usePerfil()
  const { data: orgs } = useMinhasOrganizacoes()
  const membro = orgs?.[0]
  const primeiroNome = perfil?.nome?.split(' ')[0]

  return (
    <>
      <CabecalhoPagina
        titulo={isLoading ? 'Olá!' : `Olá, ${primeiroNome ?? ''}!`}
        descricao="Bem-vindo ao R2ON. Os indicadores das obras aparecem aqui conforme os módulos forem entrando."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <Card className="py-5 gap-3">
          <CardHeader className="px-5">
            <CardDescription>Sua conta</CardDescription>
            {isLoading ? <Skeleton className="h-6 w-32" /> : <CardTitle className="text-lg">{membro?.organizacoes?.nome ?? '—'}</CardTitle>}
          </CardHeader>
          <CardContent className="px-5">
            {membro && <Badge variant="info">{papeis[membro.papel] ?? membro.papel}</Badge>}
          </CardContent>
        </Card>
        {['Obras ativas', 'Etapas em andamento', 'Pagamentos pendentes'].map((r) => (
          <Card key={r} className="py-5 gap-3">
            <CardHeader className="px-5">
              <CardDescription>{r}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">0</CardTitle>
            </CardHeader>
            <CardContent className="px-5">
              <span className="text-xs text-muted-foreground">Disponível quando o módulo estiver pronto</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="text-base font-semibold mb-3">Base de segurança instalada</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {pilares.map(({ icone: Icone, titulo, texto }) => (
          <Card key={titulo} className="py-5 gap-2">
            <CardHeader className="px-5 flex-row items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <Icone className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">{titulo}</CardTitle>
                <CardDescription>{texto}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </>
  )
}
