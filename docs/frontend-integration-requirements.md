# Requerimientos de integración — Frontend (`cancun-transfer-web`)

**Alcance:** conectar el wizard de reserva (`RouteStep → PaxStep → VehicleStep → DetailsStep → PayStep → DoneStep`) a la API real (`backend-mayan-transfer-experts`) para el flujo de **reserva + pago con tarjeta (Stripe)**. PayPal queda fuera de este alcance (ver sección 7).

**Última revisión:** 2026-07-02, contra el código real de ambos repos:
- Backend: `backend-mayan-transfer-experts` (Fases 1–4 del roadmap, ver `docs/milestones.md`)
- Frontend: `mayan-transfer-experts` (`src/components/wizard/*`, `src/store/*`, `src/hooks/useVehicles.ts`, `src/data/places.ts`)

---

## 1. Diagnóstico: qué tan completo está el flujo hoy

**Backend: completo para este alcance.** `POST /bookings`, `GET /bookings/:id`, `POST /payments/stripe/intent` y el webhook de Stripe están implementados, probados (unit tests + verificación manual contra Stripe test API) y corriendo. Detalle en `docs/milestones.md` Fase 3 y 4.

**Frontend: 100% mock, nada está conectado a una API.** Verificado leyendo el código real:

| Componente | Estado actual |
|---|---|
| `bookingStore.ts` | Solo guarda `tripType, from, to, arrival, departure, adults, children, vehicleId, contactPref, payMethod`. **No tiene campos para pasajero (nombre, email, teléfono) ni datos de vuelo ni comentarios.** |
| `RouteStep.tsx` | `from`/`to` son slugs hardcodeados (`PLACE_KEYS`: `cun`, `hotelzone`, `pdc`...), no vienen de una API. |
| `VehicleStep.tsx` / `useVehicles.ts` | Vehículos y precios están hardcodeados en `VEHICLES_ES`/`VEHICLES_EN` (`useVehicles.ts`), con `id: 'van' | 'suv'` (no UUID) y un solo `price` fijo (no distingue ruta). |
| `DetailsStep.tsx` | **Los inputs no tienen `value`/`onChange`** — no están conectados a ningún estado. Los datos que el usuario escribe hoy se pierden. |
| `PayStep.tsx` | Solo UI estática. No hay `<PaymentElement>`, no hay llamada a Stripe, no hay botón que dispare el pago. |
| `ActionBar.tsx` | El botón "Pagar ahora" en `PayStep` simplemente hace `setScreen('done')` — no crea ninguna reserva ni procesa ningún pago. |
| `DoneStep.tsx` | Muestra el folio **hardcodeado** `CTH-7K2940` (texto literal, no viene de ningún estado). |

**Buena noticia:** el `package.json` del frontend ya tiene instalado todo lo necesario — `@stripe/react-stripe-js`, `@stripe/stripe-js`, `@tanstack/react-query`, `axios`, `react-hook-form`, `@hookform/resolvers`, `zod`. El trabajo pendiente es de **integración/wiring**, no de instalar dependencias nuevas.

---

## 2. Configuración de entorno

`.env` del frontend (`mayan-transfer-experts/.env.example`):

```env
VITE_API_URL=http://localhost:3000
VITE_STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx
VITE_PAYPAL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx   # sin uso todavía — ver sección 7
```

⚠️ **`VITE_API_URL` no incluye el prefijo de la API.** El backend expone todo bajo `API_PREFIX=api/v1` (`src/main.ts` → `app.setGlobalPrefix(apiPrefix)`). Todas las llamadas deben ir a:

```
${VITE_API_URL}/api/v1/<recurso>
```

Ej.: `GET http://localhost:3000/api/v1/routes`, no `GET http://localhost:3000/routes`.

⚠️ **Acción pendiente en el backend antes de probar en navegador:** `CORS_ORIGIN` en `backend-mayan-transfer-experts/.env` está en `http://localhost:3000` (el propio puerto del backend). Vite corre por defecto en `http://localhost:5173`. Hay que cambiar `CORS_ORIGIN=http://localhost:5173` en el `.env` del backend (y en el `.env.example`) o las peticiones desde el navegador serán bloqueadas por CORS. Esto no bloqueó las pruebas por `curl` porque `curl` no manda header `Origin`, pero sí bloqueará el fetch real del navegador.

---

## 3. El cambio de modelo más importante: slugs → UUIDs

Hoy el frontend identifica lugares y vehículos con **slugs fijos** (`'cun'`, `'van'`). La API identifica todo con **UUID** (`Place.id`, `Vehicle.id`, `Rate.id`). El wizard necesita una capa de mapeo:

1. Al cargar `RouteStep`, hacer `GET /api/v1/routes` y guardar la lista completa de `Place` (no solo los keys). Los `<select>` de origen/destino deben usar `place.id` como `value` (no `place.key`), aunque se siga mostrando `place.labelEs`/`place.labelEn` como texto. El `key` (`'cun'`, `'tulum'`...) sigue sirviendo para lo que hoy usa `PLACE_KEYS` (orden, ícono de aeropuerto vía `isAirport`, destacados vía `isPopular`) pero **el `id` es lo que se manda al backend**.
2. Al entrar a `VehicleStep`, con `originId`/`destinationId` ya elegidos, hacer `GET /api/v1/vehicles?originId=&destinationId=`. Esto reemplaza `useVehicles.ts` por completo — el precio ya no es fijo, depende de la ruta. Guardar `vehicleId` (UUID) en el store, no el slug `'van'`.
3. `formatPrice` (`appStore.ts`) sigue funcionando igual (toma un `usd: number` y convierte) — solo cambia de dónde sale ese número: antes `vehicle.price` hardcodeado, ahora `vehicleRate.pricePromo ?? vehicleRate.priceNormal` de la respuesta de `/vehicles`.

---

## 4. Cambios necesarios en `bookingStore.ts`

El store hoy no tiene dónde guardar la mayoría de los campos que `DetailsStep` necesita capturar. Campos a agregar (todos van directo al `POST /bookings`, ver contrato en sección 6):

```ts
firstName: string;
lastName: string;
email: string;
phone: string;
arrivalAirline?: string;
arrivalFlightNo?: string;
arrivalTime?: string;
departureAirline?: string;
departureFlightNo?: string;
departureTime?: string;
comments?: string;
```

Y `from`/`to` deben pasar de slug (`string`) a UUID (siguen siendo `string`, pero el valor cambia de fuente — ver sección 3).

`DetailsStep.tsx` necesita conectar cada `<input>`/`<textarea>` a estos campos (`value`/`onChange`, o migrar el formulario a `react-hook-form` + `zod`, que ya están instalados y no se usan en ningún lado todavía).

---

## 5. Secuencia completa del flujo

```
RouteStep      GET /routes                          → poblar selects, guardar originId/destinationId (UUID)
PaxStep        (sin llamada — solo adults/children en store)
VehicleStep    GET /vehicles?originId=&destinationId= → guardar vehicleId + priceTotal mostrado
DetailsStep    (sin llamada — captura pasajero/vuelo en store)
  ↓ botón "Pagar ahora" en PayStep dispara TODO esto en secuencia:
PayStep  (1)   POST /bookings                        → { id, folio, status:'nueva', paymentStatus:'pending', ... }
         (2)   POST /payments/stripe/intent {bookingId} → { clientSecret, paymentId }
         (3)   stripe.confirmPayment() con el clientSecret (ver sección 8)
DoneStep       GET /bookings/:id                      → folio real + status para mostrar confirmación
```

**Importante:** hoy el botón de `PayStep` (`ActionBar.tsx`) no distingue entre "avanzar de paso" y "ejecutar el pago". Hay que separar esa lógica: en las demás pantallas `handlePrimary` solo debe llamar a `next()`; en `PayStep` debe disparar el flujo async de arriba y solo navegar a `done` si `POST /bookings` y la confirmación de Stripe tienen éxito. Si algo falla, debe mostrar el error y quedarse en `PayStep` (ver manejo de errores en sección 6.5).

---

## 6. Contrato de la API

Swagger interactivo disponible en `http://localhost:3000/api/v1/docs` — siempre es la fuente de verdad más actualizada. Lo que sigue es un resumen verificado a mano.

### 6.1 Envoltorio de respuesta

**Toda respuesta exitosa** viene envuelta en `{ "data": ... }` (interceptor global `TransformInterceptor`). Ejemplo real:

```json
{ "data": { "id": "...", "folio": "CTH-HW2NWQ", "status": "nueva", ... } }
```

**Todo error** tiene esta forma (`HttpExceptionFilter`), con `message` como `string` o `string[]` (errores de validación):

```json
{
  "statusCode": 400,
  "path": "/api/v1/bookings",
  "timestamp": "2026-07-02T18:28:59.098Z",
  "message": ["tripType must be one of the following values: round, oneway", "..."]
}
```

### 6.2 `GET /api/v1/routes`

Sin body. Respuesta: array de `Place`:

```ts
{ id: string; key: string; labelEs: string; labelEn: string; zone: string | null; isAirport: boolean; isPopular: boolean; active: boolean; createdAt: string; updatedAt: string }[]
```

### 6.3 `GET /api/v1/vehicles?originId=<uuid>&destinationId=<uuid>`

Ambos query params son UUID obligatorios. Respuesta: array (uno por vehículo disponible en esa ruta):

```ts
{ vehicleId: string; name: string; capacityPassengers: number; capacityLuggage: number; description: string | null; imageUrl: string | null; rateId: string; currency: string; priceNormal: number; pricePromo: number | null }[]
```

Precio a mostrar/usar: `pricePromo ?? priceNormal`. Si la ruta no tiene ese vehículo, simplemente no aparece en el array (no es un error).

### 6.4 `POST /api/v1/bookings`

Rate limit: **5 req/min por IP**. Body (`CreateBookingDto`):

```ts
{
  tripType: 'round' | 'oneway';
  originId: string;       // uuid, de GET /routes
  destinationId: string;  // uuid, de GET /routes
  vehicleId: string;      // uuid, de GET /vehicles
  arrivalDate: string;    // 'YYYY-MM-DD'
  departureDate?: string; // 'YYYY-MM-DD' — OBLIGATORIO si tripType === 'round' (400 si falta)
  adults: number;         // 1–12
  children?: number;      // 0–8, default 0
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  contactPref: 'whatsapp' | 'email';
  arrivalAirline?: string;
  arrivalFlightNo?: string;
  arrivalTime?: string;      // texto libre, ej. "14:30"
  departureAirline?: string;
  departureFlightNo?: string;
  departureTime?: string;
  comments?: string;
  payMethod: 'card' | 'paypal';  // usar 'card' — 'paypal' no tiene endpoint funcional aún (sección 7)
}
```

Respuesta `201` (`BookingEntity`, mismos campos + calculados):

```ts
{
  id: string; folio: string; tripType: 'round'|'oneway'; originId: string; destinationId: string;
  arrivalDate: string; departureDate: string | null; adults: number; children: number;
  vehicleId: string; priceTotal: number; currency: string;
  firstName: string; lastName: string; email: string; phone: string; contactPref: 'whatsapp'|'email';
  arrivalAirline: string|null; arrivalFlightNo: string|null; arrivalTime: string|null;
  departureAirline: string|null; departureFlightNo: string|null; departureTime: string|null; comments: string|null;
  payMethod: 'card'|'paypal'; paymentStatus: 'pending'|'succeeded'|'failed'|'refunded';
  status: 'nueva'|'pendiente_pago'|'confirmada'|'proxima'|'en_curso'|'finalizada'|'cancelada';
  createdAt: string; updatedAt: string;
}
```

`priceTotal` viene ya calculado por el backend desde la tarifa vigente (no confiar en el precio que el frontend mostró en `VehicleStep`, aunque en condiciones normales deben coincidir).

Errores posibles: `400` (validación, o `round` sin `departureDate`), `404` (`"No rate available for the selected route and vehicle"` — no existe tarifa para esa combinación origen/destino/vehículo), `429` (rate limit).

### 6.5 `GET /api/v1/bookings/:id`

Devuelve el mismo `BookingEntity` de arriba. `404` si el id no existe o no es un UUID válido (`"Validation failed (uuid is expected)"`).

### 6.6 `POST /api/v1/payments/stripe/intent`

Rate limit: **10 req/min por IP**. Body:

```ts
{ bookingId: string } // uuid del booking recién creado
```

Respuesta `201`:

```ts
{ clientSecret: string; paymentId: string }
```

Este llamado también mueve el `booking.status` de `nueva` → `pendiente_pago` internamente (no requiere acción del frontend).

Errores: `404` si el `bookingId` no existe; `409 Conflict` si el booking ya no está en un estado que acepte pago (ej. ya está `confirmada` — evita crear un segundo cobro sobre una reserva ya pagada).

**Idempotencia:** llamar este endpoint más de una vez para el mismo `bookingId` en menos de 24h devuelve el mismo `PaymentIntent`/`clientSecret` (Stripe idempotency key interna) — es seguro reintentar si la llamada falla por red.

---

## 7. Fuera de alcance / gaps conocidos

- **PayPal no está implementado en el backend.** `payMethod: 'paypal'` es aceptado por `POST /bookings` (el campo es solo descriptivo al crear la reserva) pero **no existen** `/payments/paypal/order` ni `/payments/paypal/order/:id/capture`. **El frontend no debe ofrecer PayPal como opción funcional todavía** — el botón "Pay with PayPal" en `PayStep.tsx` debe quedar deshabilitado u oculto hasta que se implemente esa fase.
- **No hay endpoint de contacto** (`POST /contacts`, formulario de contacto del sitio) — Fase 5, no iniciada.
- **No hay conversión de moneda vía API** (`/config/rates`). El backend siempre devuelve precios en la `currency` de la tarifa (hoy `USD` para todo el seed). La conversión a `MXN`/`CAD`/`EUR` sigue siendo responsabilidad del frontend (`appStore.ts` → `RATES`, sin cambios necesarios ahí).
- **No hay cancelación/expiración automática** de una reserva `pendiente_pago` abandonada. Si el usuario cierra la pestaña a medio pago, la reserva queda en `pendiente_pago` indefinidamente (no bloquea nada del lado del usuario, pero es un gap conocido para el panel admin futuro).

---

## 8. Integración de Stripe en `PayStep`

1. Envolver `PayStep` (o el layout del wizard) en `<Elements stripe={stripePromise} options={{ clientSecret }}>` de `@stripe/react-stripe-js`, con `stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)`. El `clientSecret` solo está disponible **después** de llamar a `POST /bookings` + `POST /payments/stripe/intent`, así que `<Elements>` debe montarse recién en ese punto (no al entrar a `PayStep`).
2. Renderizar `<PaymentElement />` dentro del `<Elements>`.
3. Al confirmar, usar `stripe.confirmPayment({ elements, confirmParams: { return_url: <url de vuelta a /done> }, redirect: 'if_required' })`.
   - `redirect: 'if_required'` evita el redirect de página completa para tarjetas (resuelve la promesa in-page). **Ojo:** si más adelante se habilitan métodos de pago locales tipo OXXO/SPEI (comunes en México, y `automatic_payment_methods: { enabled: true }` ya está activado del lado del backend), Stripe **sí** requiere el redirect completo para esos métodos — el `return_url` debe estar siempre presente y `DoneStep` debe saber leer los query params `payment_intent` / `redirect_status` que Stripe agrega al volver.
4. **No asumir que el pago ya está confirmado en el backend apenas `confirmPayment` resuelve.** La confirmación real (`booking.status → 'confirmada'`) la hace el webhook de Stripe de forma asíncrona (típicamente 1–2 segundos después para tarjeta, puede ser minutos/horas para OXXO). Por eso `DoneStep` debe:
   - Hacer `GET /bookings/:id` al montar.
   - Si `status` sigue en `pendiente_pago`, mostrar un estado "confirmando tu pago..." en vez de asumir éxito total, y opcionalmente reintentar el `GET` un par de veces (polling corto, 2–3 intentos con backoff) antes de mostrarlo como pendiente de confirmación por email.
   - Usar `booking.folio` real (no el string hardcodeado `CTH-7K2940` actual).

---

## 9. Resumen de trabajo pendiente en el frontend

- [ ] Agregar campos de pasajero/vuelo a `bookingStore.ts` y conectarlos en `DetailsStep.tsx` (hoy los inputs no tienen estado).
- [ ] Cliente HTTP (`axios` + `@tanstack/react-query`, ya instalados) apuntando a `${VITE_API_URL}/api/v1`.
- [ ] `RouteStep`: reemplazar `PLACE_KEYS` estático por `GET /routes`; guardar `originId`/`destinationId` (UUID) en el store.
- [ ] `VehicleStep`: reemplazar `useVehicles.ts` hardcodeado por `GET /vehicles?originId=&destinationId=`; guardar `vehicleId` (UUID) real.
- [ ] `PayStep`/`ActionBar`: implementar la secuencia `POST /bookings` → `POST /payments/stripe/intent` → `<PaymentElement>` + `confirmPayment` descrita en las secciones 5 y 8.
- [ ] `DoneStep`: leer el booking real (`GET /bookings/:id`) y mostrar `folio`/estado reales en vez del texto hardcodeado.
- [ ] Ocultar/deshabilitar la opción PayPal en `PayStep` hasta que exista esa fase en el backend.
- [ ] Backend: cambiar `CORS_ORIGIN` a `http://localhost:5173` en dev (o el puerto real que use Vite) antes de probar contra el navegador.
