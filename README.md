# Sistema de Confección de Informes de Gestión

Proyecto Next.js (App Router) + TypeScript + Tailwind, con Prisma/PostgreSQL (Neon) y Auth.js para el módulo de acceso.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL (Neon) |
| `AUTH_SECRET` | Secreto de Auth.js — generar con `npx auth secret` |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_SECURITY_QUESTION` / `SEED_ADMIN_SECURITY_ANSWER` | Solo para `npm run db:seed` (crea el primer admin) |

## Deploy en Render

Este proyecto está pensado para deployarse en Render, con **dos servicios separados** (testing y producción), cada uno con su propia base de datos en Neon. Ver la guía interna de arranque de proyectos para el detalle de por qué separar ambientes.

Configuración de cada "Web Service" en Render:

- **Build command**: `npm install && npx prisma migrate deploy && npm run build`
  (las migraciones se aplican en el build; `prisma generate` corre solo por el `postinstall` del `package.json`)
- **Start command**: `npm start`
- **Environment Variables**: las mismas que en `.env.example`, con el `DATABASE_URL` de la base de Neon correspondiente a ese ambiente.

Puntos específicos de Render (no aplican en Vercel, que es donde Next.js apunta por defecto):

- Auth.js necesita `trustHost: true` (ya configurado en `src/auth.ts`) porque Render no se detecta automáticamente como host confiable — sin esto, todo login en producción falla con `UntrustedHost`.
- Render no soporta cron/edge functions especiales; `next start` corre como servidor Node.js normal, que es justamente lo que Next.js necesita como mínimo — no requiere adapters ni `output: "standalone"`.
