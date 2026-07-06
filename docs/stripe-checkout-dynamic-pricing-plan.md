# Plan: Stripe Checkout (hosted) + montos dinámicos con extras

**Estado:** planeado, no implementado todavía.
**Repos afectados:** `backend-mayan-transfer-experts` (este repo) y `mayan-transfer-experts` (frontend).

---

## Contexto

El flujo de pago actual usa Stripe **PaymentIntent embebido** (`POST /payments/stripe/intent` + `<PaymentElement>` dentro de `PayStep`, ver `src/modules/payments/`). El monto (`Booking.priceTotal`) se congela en `POST /bookings` tomando **solo** la tarifa fija de `Rate` (ruta+vehículo) — los extras (cerveza, refrescos, champagne, snacks) existen únicamente como catálogo estático en el frontend (`mayan-transfer-experts/src/data/extrasCatalog.ts`) y nunca llegan al backend ni afectan el total cobrado.

Se necesita:
1. Que el backend calcule el total real incluyendo extras (decisión confirmada: el precio del vehículo sigue siendo fijo por ruta+vehículo como hoy; `adults`/`children` siguen siendo solo informativos/de capacidad — no escalan el precio).
2. Persistir los extras como catálogo real en BD (no estático), con línea de detalle por reserva.
3. Reemplazar el PaymentIntent embebido por **Stripe Checkout hosted**: el usuario es redirigido a `checkout.stripe.com` y regresa a la app vía `success_url`/`cancel_url`.

Decisiones de diseño ya confirmadas con el usuario:
- Precio fijo por vehículo + extras sumados dinámicamente (no tarifa por pasajero).
- Modelo `Extra`/`BookingExtra` en Prisma (catálogo real, no constante estática).
- Reemplazo completo del flujo embebido por Stripe Checkout Session redirigido (no se mantiene el `<PaymentElement>` embebido).

---

## Backend (`backend-mayan-transfer-experts`)

### 1. Schema (`prisma/schema.prisma`)
- Nuevo modelo `Extra`: `id, key (unique), labelEs, labelEn, price Decimal(10,2), currency, maxQty Int, active Boolean, createdAt, updatedAt` — mismo patrón que `Vehicle`/`Place`.
- Nuevo modelo `BookingExtra`: `id, bookingId (FK Booking), extraId (FK Extra), qty Int, unitPrice Decimal(10,2)` (snapshot al momento de la reserva), `currency`. `@@unique([bookingId, extraId])`.
- `Booking` gana relación `extras BookingExtra[]`.
- Migración: `pnpm exec prisma migrate dev --name add_extras`.

### 2. Catálogo de extras (mismo patrón que `catalog/` para `Place`/`Vehicle`)
- `catalog.repository.ts`: `findActiveExtras(): Promise<Extra[]>`.
- `catalog.service.ts`: `getExtras()`.
- `catalog.controller.ts`: `GET /extras` (nuevo endpoint público, sin auth, igual que `/routes`).
- `entities/extra.entity.ts` nuevo, mismo estilo que `PlaceEntity`.

### 3. Reservas: aceptar y validar extras, calcular total dinámico
- `dto/booking-extra.dto.ts` (nuevo): `{ extraId: @IsUUID(), qty: @IsInt() @Min(1) }`.
- `CreateBookingDto`: agregar `extras?: BookingExtraDto[]` (`@IsOptional() @ValidateNested({each:true}) @Type(() => BookingExtraDto)`).
- `BookingsRepository.createWithPriceSnapshot` (dentro de la misma transacción, junto a la búsqueda de `rate`):
  - Si viene `extras`, buscar `tx.extra.findMany({ where: { id: { in: extraIds }, active: true } })`.
  - Validar: todos los `extraId` existen, no hay duplicados, `qty <= extra.maxQty` → si no, `BadRequestException`.
  - `extrasTotal = Σ(extra.price * qty)`.
  - `priceTotal = (rate.pricePromo ?? rate.priceNormal) + extrasTotal` (esta es la fórmula del "monto dinámico").
  - Crear el booking con nested write `extras: { create: [{ extraId, qty, unitPrice: extra.price, currency: extra.currency }] }`.
  - Extender `findById` con `include: { extras: { include: { extra: true } } }` para que el resto del flujo (incluido el armado de `line_items` de Stripe) tenga nombres/precios de los extras sin queries extra.
- `BookingEntity`: agregar `extras: [{ extraId, labelEs, labelEn, qty, unitPrice, currency }]` al response.
- `BookingsService.create`: pasar `dto.extras` al repositorio.

### 4. Stripe: PaymentIntent → Checkout Session
- `payments.service.ts`:
  - Nuevo `createCheckoutSession(dto)`: obtiene el booking (con `vehicle` + `extras.extra` incluidos), arma `line_items`:
    - 1 línea por el transfer: `price_data.unit_amount = round((booking.priceTotal - extrasTotal) * 100)`, nombre `Transfer <vehicleName>`.
    - 1 línea por cada `BookingExtra`: `unit_amount = round(unitPrice*100)`, `quantity: qty`, nombre `extra.labelEn`.
  - `stripe.checkout.sessions.create({ mode: 'payment', line_items, success_url: `${frontendUrl}/?session_id={CHECKOUT_SESSION_ID}&booking=success`, cancel_url: `${frontendUrl}/?booking=cancel`, client_reference_id: booking.id, metadata: { bookingId, folio } }, { idempotencyKey: `booking-${id}-checkout-session` })`.
  - `paymentsRepository.upsertByProviderRef({ providerRef: session.id, amount: booking.priceTotal, ... })` (igual que hoy, cambia el `providerRef` de payment_intent id a session id).
  - `bookingsService.markAwaitingPayment(...)` sin cambios.
  - Retorna `{ url: session.url, sessionId: session.id }`.
  - Elimina `createStripeIntent`.
  - `handleStripeEvent`: escuchar `checkout.session.completed` (→ `markPaymentSucceeded`) y `checkout.session.expired`/`checkout.session.async_payment_failed` (→ `markPaymentFailed`), buscando el `Payment` por `providerRef = session.id`. Se elimina el manejo de `payment_intent.*` (ya no aplica porque el `providerRef` guardado ahora es el session id, no el payment_intent id).
- `payments.controller.ts`: renombrar endpoint a `POST /payments/stripe/checkout-session`; el webhook (`POST /payments/stripe/webhook`) no cambia de forma.
- Renombrar `dto/create-stripe-intent.dto.ts` → `create-checkout-session.dto.ts` (mismo shape, `{ bookingId }`).
- Renombrar `entities/payment-intent.entity.ts` → `checkout-session.entity.ts` (`{ url, sessionId }`).

### 5. Config
- `configuration.ts` / `config.type.ts` / `env.validation.ts`: nueva var `FRONTEND_URL` (default `http://localhost:5173`), usada para `success_url`/`cancel_url`.
- `.env.example` (y `.env` real): agregar `FRONTEND_URL=http://localhost:5173`.

### 6. Seed (`prisma/seed.ts`)
- Agregar `EXTRAS` (beer/soda/champagne/snacks, mismos textos que `mayan-transfer-experts/src/data/extrasCatalog.ts`) y upsert por `key`, mismo patrón que `PLACES`/`VEHICLES`.

### 7. Tests
- `payments.service.spec.ts`: mockear `stripe.checkout.sessions.create` en vez de `paymentIntents.create`; casos de webhook `checkout.session.completed`/`expired`.
- `bookings.service.spec.ts` / repositorio: caso con extras válidos (total correcto), `extraId` inexistente/inactivo → 400, `qty > maxQty` → 400.
- `catalog.service.spec.ts`: agregar caso para `getExtras()`.

---

## Frontend (`mayan-transfer-experts`)

### 1. Tipos (`src/types/booking.ts`)
- Nuevo `ExtraCatalogItem` (id, key, labelEs, labelEn, price, currency, maxQty) reemplaza el `ExtraItem` local.
- `CreateBookingPayload.extras?: { extraId: string; qty: number }[]`.
- `StripeIntentResponse` → `CheckoutSessionResponse { url: string; sessionId: string }`.

### 2. Catálogo de extras real
- Nuevo `src/hooks/useExtras.ts` (mismo patrón que `useRoutes.ts`): `GET /extras`.
- Borrar `src/data/extrasCatalog.ts`; `ExtrasStep.tsx` usa `useExtras()` — los ids pasan de strings hardcodeados (`'beer'`) a UUIDs reales del backend. `bookingStore.extras: Record<string, number>` no cambia de forma, solo de qué son las keys.

### 3. `PayStep.tsx`
- `buildPayload()`: agregar `extras: Object.entries(extras).filter(([,qty]) => qty > 0).map(([extraId, qty]) => ({ extraId, qty }))`.
- El total mostrado (`sumTitle` card) debe reflejar `vehiclePrice + extrasSubtotal` (hoy solo muestra `bestPrice(vehicle)` y los extras aparecen como línea aparte "+X" — se corrige para mostrar el gran total real, igual al que calculará el backend).
- `handleStartPayment`: tras crear el booking (si no existe), llamar `POST /payments/stripe/checkout-session` con `{ bookingId }` y hacer `window.location.href = session.url` — sin más estado de `clientSecret`.
- Quitar `Elements`/`StripeCheckoutForm`/`clientSecret`.
- Nuevo `useEffect` al montar: leer `new URLSearchParams(window.location.search)`.
  - Si `session_id` + `booking=success`: mostrar estado "confirmando pago" y hacer poll de `GET /bookings/:id` (ya existe) cada ~2s hasta que `paymentStatus !== 'pending'`; `succeeded` → `setScreen('done')`; `failed` → mostrar error y permitir reintentar. Limpiar la query string con `history.replaceState`.
  - Si `booking=cancel`: limpiar query string, mostrar mensaje de "pago cancelado, intenta de nuevo".

### 4. Limpieza
- Borrar `src/lib/stripe.ts` y `src/components/wizard/StripeCheckoutForm.tsx` (ya no aplican con Checkout hosted).
- Quitar `@stripe/react-stripe-js` y `@stripe/stripe-js` de `package.json` (ya no se usan en el cliente).

---

## Verificación end-to-end
1. `pnpm exec prisma migrate dev` + `pnpm run prisma:seed` en el backend (extras + rates).
2. Levantar backend (`pnpm run start:dev`) y frontend (`npm run dev`).
3. Flujo manual en navegador: Ruta → Pasajeros → Vehículo → Extras (elegir 1-2) → Datos → Pago → confirmar redirige a `checkout.stripe.com` con el monto correcto (vehículo + extras) desglosado en línea; pagar con tarjeta de prueba `4242 4242 4242 4242`; verificar que la redirección de vuelta muestra `DoneStep` con folio, y que `GET /bookings/:id` quedó `status: confirmada`, `paymentStatus: succeeded`.
4. Probar cancelar desde Checkout (botón "back") → vuelve a `PayStep` con mensaje de cancelado, sin romper el booking existente (sigue en `pendiente_pago`, se puede reintentar).
5. `stripe listen --forward-to localhost:3000/api/v1/payments/stripe/webhook` en dev para firmar webhooks locales, como ya se hacía con PaymentIntents.
6. Correr `pnpm test` (backend) y confirmar suite en verde.
