# Hitos del Proyecto — Backend API

**Proyecto:** Cancun Transfer Hotels
**Referencia:** [`backend-requirements.md`](./backend-requirements.md) (sección 9, "Fases sugeridas de implementación")
**Última actualización:** 2026-07-02 (Fase 4 — Stripe completado; PayPal pendiente)

> Documento único de tracking de avance (consolida lo que antes vivía repartido entre este archivo y el roadmap del `README.md`). Se actualiza en cada fase completada o iniciada. No repite lo que ya está en `backend-requirements.md` (arquitectura, modelo de datos, endpoints) — solo trackea **avance real vs. plan**.
>
> Para el contrato detallado de API + qué falta conectar en el frontend, ver [`frontend-integration-requirements.md`](./frontend-integration-requirements.md).

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
| 3 | Reservas (`Booking`) | ✅ | 2026-07-02 |
| 4 | Pagos (Stripe/PayPal) | ⚠️ | 2026-07-02 (solo Stripe) |
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

## Fase 3 — Reservas (`Booking`) ✅

**Objetivo:** modelo `Booking` con máquina de estados + `POST /bookings`, `GET /bookings/:id`.

- [x] Modelo `Booking` + enums (`TripType`, `ContactPref`, `PayMethod`, `PaymentStatus`, `BookingStatus`) — migración `20260702171529_add_bookings`. Los valores de enum usan las mismas cadenas que el doc/frontend (`round`/`oneway`, `whatsapp`/`email`, `nueva`/`pendiente_pago`/…) para no requerir mapeo en el cliente.
- [x] Módulo `bookings/` (`bookings.controller.ts`, `.service.ts`, `.repository.ts`) con máquina de estados explícita en `booking-status.util.ts` (`assertValidBookingTransition`) — transiciones válidas: `nueva→pendiente_pago|cancelada`, `pendiente_pago→confirmada|cancelada`, `confirmada→proxima|cancelada`, `proxima→en_curso|cancelada`, `en_curso→finalizada`; `finalizada`/`cancelada` son terminales.
- [x] Generación de `folio` (`CTH-XXXXXX`, alfabeto sin caracteres ambiguos) en `utils/folio.util.ts`, con reintento (hasta 5 intentos) ante colisión de unicidad.
- [x] DTOs (`CreateBookingDto`) alineados con la descripción de `Booking` en `backend-requirements.md` sección 4. **Verificado campo a campo el 2026-07-02** contra `mayan-transfer-experts/src/types/booking.ts` real: los enums `TripType`/`ContactPref`/`PayMethod` coinciden exactamente en valores de string. El frontend, sin embargo, **no tiene wiring real** hacia esta API todavía — ver `docs/frontend-integration-requirements.md`.
- [x] Transacción Prisma al crear reserva (`BookingsRepository.createWithPriceSnapshot`): busca la `Rate` de la ruta+vehículo dentro de la transacción y congela `priceTotal`/`currency` en el momento de la reserva (usa `pricePromo` si existe, si no `priceNormal`). Si no hay tarifa para la combinación, `404 NotFoundException`.
- [x] Rate limiting en `POST /bookings`: `@nestjs/throttler` instalado, guard global (`100 req/min` por IP) + `@Throttle` específico en el endpoint de creación (`5 req/min` por IP).
- [x] `BookingsService.transitionStatus()` implementado y testeado, pero **sin endpoint HTTP todavía** — se deja como método interno para que el webhook de Stripe/PayPal (Fase 4) lo use para mover `pendiente_pago → confirmada`. Las acciones de admin (confirmar/cancelar/reprogramar manualmente) son alcance de la Fase 6/API admin futura.

**Verificado manualmente** (servidor local + datos del seed): `POST /bookings` crea la reserva con el precio correcto tomado de `Rate`; `GET /bookings/:id` devuelve el resumen; `tripType: round` sin `departureDate` → `400`; combinación origen/destino/vehículo sin tarifa → `404`.

---

## Fase 4 — Pagos (Stripe / PayPal) ⚠️ solo Stripe

**Objetivo:** integración Stripe (PaymentIntents) y PayPal (Orders v2), webhooks de confirmación. **Decisión de alcance (2026-07-02): PayPal se pospone**, solo se implementa Stripe por ahora.

- [x] Modelo `Payment` (`provider`, `providerRef`, `amount`, `currency`, `status`, `raw` jsonb) + enum `PaymentProvider` (`stripe`/`paypal`, listo para cuando se agregue PayPal) — migración `20260702180644_add_payments`. `@@unique([provider, providerRef])`.
- [x] Módulo `payments/`: `POST /payments/stripe/intent` (crea `PaymentIntent`, hace upsert idempotente del `Payment`, mueve el booking a `pendiente_pago`), `POST /payments/stripe/webhook` (verifica firma, procesa `payment_intent.succeeded`/`payment_intent.payment_failed`).
- [ ] `POST /payments/paypal/order`, `POST /payments/paypal/order/:id/capture` — **no implementado**, pospuesto.
- [x] Webhook Stripe → transición `pendiente_pago → confirmada` vía `BookingsService.markPaymentSucceeded()` (y `markPaymentFailed()` para el caso contrario, que deja el booking en `pendiente_pago` para permitir reintento). Idempotente ante eventos duplicados.
- [x] Rate limiting: `10 req/min` por IP en `POST /payments/stripe/intent`.
- [x] Variables `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` en `.env.example` y `env.validation.ts` (el webhook secret es requerido solo en `production`, opcional en dev). `PAYPAL_*` no se agregaron todavía.
- [x] Dependencia `stripe` (SDK oficial) en `package.json`. `rawBody: true` habilitado en `main.ts` para poder verificar la firma del webhook.
- [x] Idempotencia: `stripe.paymentIntents.create` usa `idempotencyKey: booking-${bookingId}-stripe-intent`; el `Payment` se guarda con `upsert` sobre `(provider, providerRef)` para que llamadas repetidas no dupliquen filas.

**Verificado manualmente end-to-end** contra la API real de Stripe (test key) y un webhook firmado localmente con el mismo secreto: `POST /bookings` → `POST /payments/stripe/intent` (booking pasa a `pendiente_pago`) → webhook `payment_intent.succeeded` firmado → booking pasa a `confirmada` + `paymentStatus: succeeded`. Camino de falla también verificado: webhook `payment_intent.payment_failed` → booking se queda en `pendiente_pago` + `paymentStatus: failed` (permite reintentar el pago). Firma inválida/ausente → `400`. Tests unitarios en `payments.service.spec.ts` (mock de Stripe SDK).

**Gap conocido:** no hay manejo de `payment_intent.processing` ni `payment_intent.canceled` (relevantes si se habilitan métodos de pago redirect como OXXO/SPEI vía `automatic_payment_methods`, ya activado en la creación del intent). Documentado como pendiente en `docs/frontend-integration-requirements.md` sección 8.

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
- **Fase 3 (Reservas) completada.** Modelo `Booking` + 5 enums nuevos, migración `20260702171529_add_bookings`, módulo `bookings/` completo (controller/service/repository/DTOs), máquina de estados con transiciones explícitas, generador de folio, snapshot de precio en transacción Prisma, rate limiting con `@nestjs/throttler` (nueva dependencia). Tests unitarios agregados (`bookings.service.spec.ts`, `booking-status.util.spec.ts`, `folio.util.spec.ts`) — 23 tests en total, todos en verde; build y lint limpios. Verificado a mano contra la DB real: creación, consulta, validación de round-trip y 404 por falta de tarifa.
- Siguiente paso sugerido: **Fase 4 (Pagos Stripe/PayPal)**, que ya puede engancharse a `BookingsService.transitionStatus()` para mover `pendiente_pago → confirmada` desde el webhook.
- **Fase 4 (Pagos) completada solo para Stripe**, por decisión explícita de alcance — PayPal queda pospuesto. Modelo `Payment` + enum `PaymentProvider`, migración `20260702180644_add_payments`, módulo `payments/` (intent + webhook), dependencia `stripe`, `rawBody` habilitado en `main.ts`. Verificado extremo a extremo contra la API real de Stripe (test key) y webhooks firmados localmente, incluyendo el camino de pago fallido. 32 tests unitarios en total, todos en verde.
- **Revisión completa del flujo reserva+pago para generar requerimientos de frontend.** Se auditó el repo real de `mayan-transfer-experts` (no solo se asumió el contrato): el wizard está 100% mockeado — `bookingStore` no tiene campos de pasajero/vuelo, `DetailsStep` tiene inputs sin `value`/`onChange`, `VehicleStep`/`RouteStep` usan datos hardcodeados con slugs (no UUID), `PayStep` no llama a Stripe, `DoneStep` muestra un folio hardcodeado. Las dependencias necesarias (`@stripe/react-stripe-js`, `@tanstack/react-query`, `axios`, `react-hook-form`, `zod`) ya están instaladas pero sin usar. Se generó `docs/frontend-integration-requirements.md` con el contrato completo, el mapeo slug→UUID necesario, y la lista de wiring pendiente. También se corrigió `CORS_ORIGIN` (apuntaba al puerto del propio backend en vez de al de Vite) en `.env`/`.env.example`.
