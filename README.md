# Sistema de Confección de Informes de Gestión

Proyecto Next.js (App Router) + TypeScript + Tailwind, con Prisma/PostgreSQL y Auth.js para el módulo de acceso.

## Objetivo del sistema

Panel interno para armar, mes a mes, los informes de gestión de varias empresas del grupo a partir del Balance de Sumas y Saldos (BSyS) que exporta el sistema contable de cada una:

- **ESP** (Estado de Situación Patrimonial).
- **OyAF** (Estado de Origen y Aplicación de Fondos).
- **NOF** (Necesidades Operativas de Fondos y Otros Orígenes/Aplicaciones).
- **ER y Cuadros** (Estado de Resultados, nominal y — cuando corresponde — ajustado por inflación o convertido a moneda secundaria).

Un operador carga el BSyS del período, el sistema arma los cuatro informes automáticamente según el Plan de Cuentas ya clasificado de cada empresa, y un circuito de aprobación (En proceso → En revisión → Aprobado → Definitivo) deja el período cerrado y alimenta el historial de resultados (Resultados Históricos) que se usa para las comparaciones interanuales.

## Modelo de datos

Jerarquía principal:

```
Unidad de Negocio
  ├─ Empresa (una o más)
  │    └─ Plan de Cuentas (clasifica cada cuenta contable en Rubro / Subrubro / Partida Patrimonial / Categoría OyA)
  │         └─ BSyS (Balance de Sumas y Saldos: tipo Mes y tipo Acumulado, por período)
  └─ Informe (uno por período; consolida todas las Empresas de la Unidad)
       └─ al Aprobarse, completa Resultados Históricos
```

- **Unidad de Negocio**: el nivel al que se arma un informe. Puede combinar el BSyS y el Plan de Cuentas de varias **Empresas** (p. ej. dos sociedades que se reportan como un solo negocio).
- **Plan de Cuentas**: por Empresa. Clasifica cada cuenta contable del sistema de origen contra los catálogos de Configuración — Rubro (con su Origen/Aplicación, su default de NOF y su orden de exposición en el ESP), Subrubro, Partida Patrimonial (con su Tipo, que define si es Activo/Pasivo/Patrimonio Neto/Resultado) y, opcionalmente, Categoría OyA (clasificación fina de NOF, cuenta por cuenta).
- **BSyS**: se carga por Empresa, por período y en dos variantes — "Mes" (saldo inicio/cierre de ese mes solo, alimenta el Estado de Resultados nominal) y "Acumulado" (desde el inicio del ejercicio económico, alimenta ESP/OyAF/NOF). Cada fila queda asociada a su período (`periodoMes`/`periodoAnio`), no solo a la fecha en que se subió — así, aprobar un período no cambia si después se carga uno posterior.
- **Informe**: la unidad de trabajo del operador — un período (mes/año) de una Unidad de Negocio, con su propio estado. Al pasar por primera vez a Aprobado, completa la fila correspondiente de **Resultados Históricos** (create-only: nunca pisa un período que ya tenga datos, sea de una aprobación anterior o de una carga histórica manual).

## Flujo de estados del informe y permisos por rol

Estados, en orden: `PROCESO` (En proceso) → `EN_REVISION` (En revisión) → `APROBADO` → `DEFINITIVO`.

Hay dos roles, `USER` y `ADMIN`. El control real vive en el servidor (`src/lib/authz.ts`, `requireUser()`/`requireAdmin()`); la UI además oculta los botones que un `USER` no podría usar.

| Acción | USER | ADMIN |
| --- | --- | --- |
| Leer informes, catálogos y configuración | Sí | Sí |
| Importar BSyS | Sí | Sí |
| Eliminar un informe En proceso | Sí | Sí |
| Avanzar PROCESO → EN_REVISION | Sí | Sí |
| Avanzar EN_REVISION → APROBADO | No | Sí |
| Avanzar APROBADO → DEFINITIVO | No | Sí |
| Crear, editar o eliminar en Configuración (catálogos, plan de cuentas, empresas, unidades, monedas, series, tipo de partida, rubros, categoría OyA) | No | Sí |
| Crear, editar o eliminar Resultados Históricos | No | Sí |

Un informe solo se puede editar/eliminar mientras está En proceso — a partir de En revisión (y sobre todo Aprobado, que ya escribió en Resultados Históricos) borrarlo dejaría ese dato histórico huérfano de su origen.

## Ejercicio económico julio–junio

El ejercicio económico de todas las Unidades de Negocio va de julio a junio: el período 06/2026 pertenece al ejercicio que arrancó en 07/2025, no a un ejercicio calendario. Esto define:

- El **Acumulado** del BSyS: siempre corre desde julio del ejercicio correspondiente hasta el período del informe (nunca es una ventana móvil de 12 meses) — al empezar un ejercicio nuevo en julio, el acumulado es simplemente ese mes.
- Los **cuadros "Acum" del ER** (`src/lib/resultado-cuadro.ts`): acumulan de la misma forma, tanto para el ejercicio actual como para el mismo punto del ejercicio anterior (comparación interanual).
- La **refundición de cuenta** al cierre de ejercicio (ver `src/lib/refundicion.ts`): si el BSyS Acumulado de julio no arranca en cero en las cuentas de Resultado, el motor de informes lo explica como una línea aparte ("Resultado no distribuido al inicio del ejercicio") en vez de dejarlo sin explicar en el OyAF.

## Instalación local

```bash
npm install
cp .env.example .env   # completar DATABASE_URL, AUTH_SECRET, etc.
npx prisma migrate dev # aplica las migraciones (ver "Migraciones" abajo)
npm run db:seed        # crea el primer usuario ADMIN (usa SEED_ADMIN_*)
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Variables de entorno

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `AUTH_SECRET` | Secreto de Auth.js — generar con `npx auth secret` |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_SECURITY_QUESTION` / `SEED_ADMIN_SECURITY_ANSWER` | Solo para `npm run db:seed` (crea el primer admin) |

Ver `.env.example` para el archivo completo (sin valores reales).

## Migraciones

Todo cambio de schema pasa por `npm run db:migrate` (`prisma migrate dev`), que genera un archivo en `prisma/migrations/` y lo aplica en local. **`prisma db push` queda prohibido** — no deja rastro en `prisma/migrations/`, así que una base nueva (o el deploy de Render, que corre `prisma migrate deploy`) queda con un schema incompleto.

En producción las migraciones se aplican solas en el build de Render (`prisma migrate deploy`, ver más abajo) — nunca a mano contra la base de producción salvo indicación explícita.

## Importadores

Para la carga inicial de datos históricos (Plan de Cuentas, BSyS, Resultados Históricos y Series e Índices de una empresa/unidad de negocio nueva) hay un único CLI en `prisma/importar.ts`, en vez de un script por empresa:

```bash
npx tsx prisma/importar.ts --tipo plan|bsys|historicos|series \
  --empresa <codEmp o nombre> --archivo "<ruta al xlsx>" \
  [--periodo AAAA-MM] [--hasta AAAA-MM]
```

- `--tipo`: qué se importa — `plan` (Plan de Cuentas), `bsys` (Balance de Sumas y Saldos), `historicos` (Resultados Históricos) o `series` (Series e Índices).
- `--empresa`: código o nombre de la empresa/unidad de negocio. Para `plan`/`bsys`/`historicos` acepta alias conocidos (`havanna`, `lv12`, `bradenton`, `plate-silver`, o el `codEmp`/`unidadNegocioId` numérico) que disparan la configuración específica de esa empresa; si no matchea ningún alias, se usa el flujo genérico (crea la empresa por nombre para `plan`, o toma el valor como `unidadNegocioId` numérico para `historicos`). Para `series` no hay variantes por empresa — el valor se usa directamente como el "tipo de tabla" (p. ej. "Dólar Oficial").
- `--archivo`: ruta al `.xlsx` a importar.
- `--periodo AAAA-MM` (opcional, solo `bsys`): período a cargar; si se omite, usa el default de la configuración de esa empresa.
- `--hasta AAAA-MM` (opcional, solo `historicos`): no carga períodos posteriores a este.

Estos scripts son de una sola corrida (puesta en marcha de una empresa nueva o carga de históricos) — no son parte del flujo normal de la aplicación, y nunca deben correrse contra producción salvo que se esté dando de alta una empresa o cargando históricos a propósito.

`prisma/legacy/` conserva los 11 scripts originales por empresa (`import-plan-de-cuentas*.ts`, `import-bsys-*.ts`, `import-resultados-historicos*.ts`, `import-series-e-indices.ts`) como referencia histórica — `prisma/importar.ts` los reemplaza, pero no se borraron.

## Tests

```bash
npm test
```

Corre Vitest (`vitest run`) sobre `src/lib/__tests__/`. Cubre la lógica pura del motor de informes — separada de las consultas a Prisma para poder testearla sin base de datos:

- `buildInformeReport` (`src/lib/balance-oya-report.ts`): ESP, OyAF y NOF — exposición de signo de Activo/Pasivo/Patrimonio Neto, rubros AJUSTE, Categoría OyA vs. default del Rubro, Resultado del período, advertencias (`exigeSaldoCero`, cuenta no clasificada), control de partida doble.
- `computeResultadoNominalDeEmpresaPure` (`src/lib/resultado-nominal.ts`): resultado nominal del mes.
- `inicioEjercicio` (`src/lib/resultado-cuadro.ts`): cálculo del ejercicio julio-junio.

Al tocar cualquiera de estos tres archivos, correr `npm test` antes de dar el cambio por terminado.

## Deploy en Render

Este proyecto está pensado para deployarse en Render, con **dos servicios separados** (testing y producción), cada uno con su propia base de datos (Prisma Postgres). Hoy solo el ambiente de testing está provisionado y en uso — el de producción se crea cuando corresponda, siguiendo la misma configuración.

Configuración de cada "Web Service" en Render:

- **Build command**: `npm install && npx prisma migrate deploy && npm run build`
  (las migraciones se aplican en el build; `prisma generate` corre solo por el `postinstall` del `package.json`)
- **Start command**: `npm start`
- **Environment Variables**: las mismas que en `.env.example`, con el `DATABASE_URL` de la base correspondiente a ese ambiente.

Puntos específicos de Render (no aplican en Vercel, que es donde Next.js apunta por defecto):

- Auth.js necesita `trustHost: true` (ya configurado en `src/auth.ts`) porque Render no se detecta automáticamente como host confiable — sin esto, todo login en producción falla con `UntrustedHost`.
- Render no soporta cron/edge functions especiales; `next start` corre como servidor Node.js normal, que es justamente lo que Next.js necesita como mínimo — no requiere adapters ni `output: "standalone"`.
