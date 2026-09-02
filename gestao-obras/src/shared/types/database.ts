// Tipos gerados a partir do banco. Substituído pelo comando `pnpm gerar:tipos`
// depois que as migrações forem aplicadas. Até lá, tipo aberto.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any
