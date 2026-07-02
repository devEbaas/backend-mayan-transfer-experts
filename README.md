# Mayan Transfer Experts — Backend

API backend construida con [NestJS](https://nestjs.com/), [Prisma](https://www.prisma.io/) y PostgreSQL, con arquitectura modular por dominio.

## Arquitectura

```
src/
├── main.ts                  # Bootstrap: pipes, filtros, swagger, helmet, cors
├── app.module.ts             # Módulo raíz, ata configuración + módulos de negocio
├── config/                   # Configuración tipada y validación de variables de entorno (Joi)
├── common/                   # Filtros, interceptores, DTOs y decoradores compartidos
├── database/prisma/          # PrismaService / PrismaModule (única puerta de entrada a la DB)
├── logger/                   # Logging estructurado (nestjs-pino)
├── health/                   # Health checks (Terminus + Prisma)
└── modules/
    ├── users/                 # Controller → Service → Repository
    └── auth/                  # JWT + Passport (local + jwt strategies), guards de roles
```

Cada módulo de negocio sigue el patrón **Controller → Service → Repository**: el `Repository` es la única clase que importa `PrismaService`, lo que mantiene Prisma aislado detrás de una interfaz simple y hace que los `Service` sean fáciles de testear mockeando el repositorio.

## Requisitos

- Node.js 22+
- pnpm 9+
- Una instancia de PostgreSQL accesible (local o remota; sin Docker)

## Setup

1. Instalar dependencias:

   ```bash
   pnpm install
   ```

2. Copiar `.env.example` a `.env` y completar con tus valores reales (especialmente `DATABASE_URL`, `JWT_SECRET` y `JWT_REFRESH_SECRET`):

   ```bash
   cp .env.example .env
   ```

3. Ejecutar las migraciones de Prisma:

   ```bash
   pnpm prisma:migrate
   ```

4. Levantar el servidor en modo desarrollo:

   ```bash
   pnpm start:dev
   ```

5. La API queda disponible en `http://localhost:3000/api/v1` y la documentación Swagger en `http://localhost:3000/api/v1/docs`.

## Scripts

| Script                    | Descripción                                      |
| ------------------------- | ------------------------------------------------- |
| `pnpm start:dev`          | Levanta el servidor con hot-reload                |
| `pnpm build`               | Compila a `dist/`                                 |
| `pnpm start:prod`          | Corre el build compilado                          |
| `pnpm lint`                 | ESLint con auto-fix                               |
| `pnpm test`                 | Tests unitarios (Jest)                            |
| `pnpm test:e2e`             | Tests end-to-end (requiere DB accesible)          |
| `pnpm prisma:generate`      | Regenera el cliente de Prisma                     |
| `pnpm prisma:migrate`       | Aplica migraciones en desarrollo                  |
| `pnpm prisma:studio`        | Abre Prisma Studio                                |

## Autenticación

- `POST /api/v1/auth/register` — crea un usuario y devuelve `accessToken` / `refreshToken`.
- `POST /api/v1/auth/login` — autentica con email/password (Passport local).
- `POST /api/v1/auth/refresh` — intercambia un refresh token por un nuevo par de tokens.

Los endpoints de `users` (excepto `GET /users/:id`) requieren rol `ADMIN` (`@Roles(Role.ADMIN)`), y todos los endpoints de `users` requieren un `Authorization: Bearer <accessToken>` válido.

## Testing

- Los tests unitarios están junto a cada servicio (`*.spec.ts`) y mockean el `Repository` correspondiente.
- El test e2e (`test/app.e2e-spec.ts`) es un smoke test de `GET /health`; requiere una base de datos real alcanzable vía `DATABASE_URL`.

## Roadmap de implementación

Estado actual: **Fundación y Catálogos públicos** completos, **Auth/Users** adelantado. Pendiente: **Reservas, Pagos y Contacto** (el flujo core del wizard de reserva) y las tareas transversales de CI/tests.

El tracking detallado por fase (checklist, decisiones y changelog de avance) vive en **[`docs/milestones.md`](./docs/milestones.md)** — se actualiza ahí a medida que se avanza, no en este README.
