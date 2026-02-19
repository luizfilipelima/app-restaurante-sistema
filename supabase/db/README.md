# Banco de Dados - Supabase

Estrutura organizada dos scripts e migrations do backend.

## Estrutura

```
supabase/db/
├── schema/           # Schema inicial (executar primeiro)
│   └── initial.sql   # Tabelas, índices, triggers e RLS básico
├── migrations/       # Migrations de features (ordem sugerida abaixo)
│   ├── add_bi_columns.sql
│   ├── add_payment_method_table.sql
│   ├── create_dashboard_analytics_rpc.sql
│   ├── create_get_advanced_dashboard_stats_rpc.sql
│   ├── create_get_dashboard_kpis_rpc.sql
│   ├── migration_*.sql
│   ├── optimize_indexes.sql
│   └── performance_optimization.sql
└── scripts/          # Scripts pontuais (não versionados)
    ├── setup/        # Setup inicial, criar usuários
    ├── rls/          # Políticas RLS e correções
    ├── fixes/        # Correções pontuais
    └── diagnostic/   # Consultas de diagnóstico
```

## Ordem de Execução Recomendada

1. **schema/initial.sql** — Schema base (tabelas, RLS básico)
2. **scripts/rls/supabase-rls-completo.sql** — Políticas completas
3. **scripts/setup/supabase-criar-super-admin.sql** — (Opcional) Criar super admin
4. **BI do Dashboard** — Execute no SQL Editor do Supabase, nesta ordem:
   - `migrations/add_bi_columns.sql`
   - `migrations/create_dashboard_analytics_rpc.sql`
   - `migrations/create_get_advanced_dashboard_stats_rpc.sql`
   - `migrations/create_get_dashboard_kpis_rpc.sql`
5. Demais migrations conforme necessidade do projeto

## Convenções

- **schema/** — Arquivos de estrutura base, executar uma vez
- **migrations/** — Alterações versionadas (features, índices, RPCs)
- **scripts/setup/** — Scripts de setup (usuários, super admin)
- **scripts/rls/** — Políticas e correções de RLS
- **scripts/fixes/** — Correções pontuais para ambiente
- **scripts/diagnostic/** — Queries para debug/diagnóstico
