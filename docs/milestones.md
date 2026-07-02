# Hitos del Proyecto — Backend API

**Proyecto:** Cancun Transfer Hotels
**Referencia:** [`backend-requirements.md`](./backend-requirements.md) (sección 9, "Fases sugeridas de implementación")
**Última actualización:** 2026-07-02

> Documento único de tracking de avance (consolida lo que antes vivía repartido entre este archivo y el roadmap del `README.md`). Se actualiza en cada fase completada o iniciada. No repite lo que ya está en `backend-requirements.md` (arquitectura, modelo de datos, endpoints) — solo trackea **avance real vs. plan**.

---

## Leyenda

| Estado | Significado |
|---|---|
| ✅ | Completa |
| 🔄 | En progreso |
| ⏳ | No iniciada |
| ⚠️ | Completa parcialmente / con deuda pendiente |

---

## Resumen de fases

| # | Fase | Estado | Última actualización |
|---|---|---|---|
| 1 | Fundación | 🔄 | 2026-07-02 |
| 2 | Catálogos públicos | ✅ | 2026-07-02 |
| 3 | Reservas (`Booking`) | ⏳ | — |
| 4 | Pagos (Stripe/PayPal) | ⏳ | — |
| 5 | Contacto y correos | ⏳ | — |
| 6 | Base para admin (auth + roles + entidades reservadas) | 🔄 | 2026-07-02 |
| 7 | Transversal / no funcionales | ⏳ | — |

**Orden de dependencia:** 1 → 2 → 3 → 4, con 5 y 7 en paralelo una vez exista el modelo `Booking` (fase 3).

---

## Fase 1 — Fundación 🔄

**Objetivo:** setup NestJS + Prisma + PostgreSQL, módulo `common`, Swagger, manejo global de errores.

- [x] NestJS + Prisma + PostgreSQL + Swagger (`/api/v1/docs`)
- [x] `ValidationPipe` global, Helmet, CORS, filtro de excepciones global
- [x] Logging estructurado (`nestjs-pino`) + Health checks (Terminus)
- [x] `AuthModule` (JWT access/refresh + Passport) y `UsersModule`
- [x] Modelo `User` en `prisma/schema.prisma`
- [ ] CI en GitHub Actions (movido a [Fase 7](#fase-7--transversal--no-funcionales-))

> **Decisión de proyecto (2026-07-02):** no se usa Docker. Desarrollo y producción corren contra PostgreSQL accesible directamente vía `DATABASE_URL` (local o remoto), sin `docker-compose.yml`. Despliegue vía PM2/Nginx en el VPS, como el resto del stack.

---

## Fase 2 — Catálogos públicos ✅

**Objetivo:** modelos `Place`, `Vehicle`, `Rate` + endpoints `GET /routes`, `GET /vehicles`.

- [x] Modelos Prisma: `Place`, `Vehicle`, `Rate` + migración (`20260701204557_init_users_and_catalog`)
- [x] Módulo `catalog/` (repository → service → controller) con DTOs (`labelEs`/`labelEn`)
- [x] Seed (`prisma/seed.ts`) con destinos/vehículos
- [x] `GET /routes` y `GET /vehicles?originId=&destinationId=` documentados en Swagger
- [x] Tests unitarios (`catalog.service.spec.ts`)

Nada pendiente respecto al plan original de esta fase.

---

## Fase 3 — Reservas (`Booking`) ⏳

**Objetivo:** modelo `Booking` con máquina de estados + `POST /bookings`, `GET /bookings/:id`.

- [ ] Modelo `Booking` + enum de estados (`nueva → pendiente_pago → confirmada → proxima → en_curso → finalizada`, rama `cancelada`)
- [ ] Módulo `bookings/` con máquina de estados (transiciones explícitas, no libres)
- [ ] Generación de `folio` (`CTH-XXXXXX`)
- [ ] DTOs alineados con `src/types/booking.ts` del frontend
- [ ] Transacción Prisma al crear reserva (snapshot de precio desde `Rate`)
- [ ] Rate limiting en `/bookings`

---

## Fase 4 — Pagos (Stripe / PayPal) ⏳

**Objetivo:** integración Stripe (PaymentIntents) y PayPal (Orders v2), webhooks de confirmación.

- [ ] Modelo `Payment` (provider, providerRef, amount, currency, status, `raw` jsonb)
- [ ] Módulo `payments/`: `POST /payments/stripe/intent`, `POST /payments/paypal/order`, `POST /payments/paypal/order/:id/capture`
- [ ] Webhook Stripe → transición `pendiente_pago → confirmada`
- [ ] Rate limiting en `/payments/*`
- [ ] Variables de entorno `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV` en `.env.example`
- [ ] Dependencias SDK de Stripe y PayPal en `package.json`

---

## Fase 5 — Contacto y correos transaccionales ⏳

**Objetivo:** `POST /contacts`, envío de email de confirmación de reserva.

- [ ] Modelo `Contact`
- [ ] Módulo `contacts/` con `POST /contacts`
- [ ] Envío de email de confirmación de reserva (Nodemailer/Resend)
- [ ] Rate limiting en `/contacts`
- [ ] Variables `SMTP_*` / `RESEND_API_KEY` en `.env.example`

---

## Fase 6 — Base para admin (auth + roles + entidades reservadas) 🔄

**Objetivo:** módulos `auth` (JWT + roles) y entidades restantes (`Driver`, `Hotel`, `Extra`, `Coupon`, etc.) creadas en el esquema, sin UI, para evitar migraciones destructivas después.

- [x] Módulo `auth/` completo: JWT access + refresh, Passport (`local.strategy.ts`, `jwt.strategy.ts`), guards (`jwt-auth.guard.ts`, `local-auth.guard.ts`, `roles.guard.ts`), decorador `@Roles`, DTOs de login/register/refresh, tests (`auth.service.spec.ts`)
- [x] Módulo `users/` completo: CRUD, repository, entity, DTOs, tests (`users.service.spec.ts`)
- [x] Modelo `User` con enum `Role` (`USER` | `ADMIN`)
- [ ] Confirmar/ajustar roles: el doc original habla de `Admin`/`Operador`; el enum actual es `USER`/`ADMIN` — decidir si se remapea cuando se defina el admin real
- [ ] Modelos `Driver`, `Hotel`, `Extra`, `Coupon` en el schema (sin endpoints todavía)
- [ ] Tabla de auditoría por reserva (`ActivityLog` o similar) — depende de que exista `Booking` (fase 3)
- [ ] Modelos `EmailTemplate`, `CmsContent`, `GalleryImage` (alcance admin más lejano)

---

## Fase 7 — Transversal / no funcionales ⏳

Requisitos que cruzan varias fases (sección 7 de `backend-requirements.md`), sin dueño de fase único.

- [ ] CI en GitHub Actions (build + test en PR, deploy en push a `main`)
- [ ] Backups automáticos de la base de datos en producción
- [ ] Unit tests de `bookings` / `payments` + e2e de endpoints públicos
- [ ] (Opcional) `GET /config/rates` si se decide exponer tipo de cambio vía API

---

## Changelog

### 2026-07-02
- Auditoría inicial del proyecto contra `backend-requirements.md`.
- Confirmado: Fase 1 (⚠️ faltaba Docker Compose y CI), Fase 2 (✅), Fase 6 (🔄, adelantada respecto al orden sugerido).
- Confirmado: Fases 3, 4 y 5 sin iniciar — son el corazón del flujo de reserva/pago del wizard del frontend y deberían priorizarse.
- Creado este documento de hitos.
- **Decisión: se elimina Docker del proyecto.** Actualizados `backend-requirements.md`, `README.md` y este documento para quitar toda referencia a `docker-compose.yml`/Docker como infraestructura de desarrollo o despliegue. No había `Dockerfile` ni `docker-compose.yml` en el repo — el cambio fue únicamente documental.
- **Consolidación:** se unificó en este archivo el roadmap por "Hitos" que vivía en `README.md` (checklist granular por fase, fase transversal de no-funcionales, orden de dependencia). El `README.md` ahora solo referencia este documento con un resumen corto.
