# Requerimiento General — Backend API (NestJS + PostgreSQL)

**Proyecto:** Cancun Transfer Hotels
**Componente:** API REST que da servicio al sitio público (`cancun-transfer-web`) y, a futuro, al panel administrativo.
**Fecha:** 2026-07-01

---

## 1. Objetivo

Construir la API REST que sustituye los datos hardcodeados del frontend actual (`src/data/places.ts`, `src/hooks/useVehicles.ts`, precios fijos en `useAppStore`) y habilita el flujo completo de reserva y pago descrito en el wizard (`RouteStep → PaxStep → VehicleStep → DetailsStep → PayStep → DoneStep`).

El backend debe:

1. Servir catálogos (destinos, vehículos, tarifas) al sitio público.
2. Persistir reservas y su ciclo de vida completo.
3. Procesar pagos (Stripe y PayPal).
4. Sentar la base de datos y arquitectura modular para el futuro panel administrativo (24 módulos ya cotizados), sin necesidad de rediseño.

---

## 2. Stack tecnológico

| Capa | Tecnología | Motivo |
|---|---|---|
| Framework | **NestJS** ^11 (TypeScript) | Arquitectura modular, guards/interceptors/pipes, DI nativa |
| Base de datos | **PostgreSQL** ^16 | Relacional, soporte robusto de `enum`, `jsonb`, `numeric` para precios y particionamiento a futuro |
| ORM | **Prisma** ^6 | Tipado end-to-end, migraciones declarativas, buen soporte Postgres |
| Autenticación | JWT (access + refresh) + Passport | Sesión del panel admin; sitio público no requiere login |
| Validación | `class-validator` + `class-transformer` | DTOs tipados en cada endpoint |
| Documentación | Swagger / OpenAPI | Contrato explícito para el frontend público y el admin |
| Pagos | Stripe SDK (PaymentIntents) + PayPal Orders API v2 | Ya referenciado en `.env.example` del frontend (`VITE_STRIPE_PUBLIC_KEY`, `VITE_PAYPAL_CLIENT_ID`) |
| Correo | Resend / SMTP (Nodemailer) | Confirmaciones, recordatorios |
| PDF | Puppeteer o PDFKit | Ticket de reserva, reportes |
| Infraestructura | Nginx (reverse proxy), PM2, GitHub Actions | Mismo VPS que el sitio público (ver `deploy.yml` del frontend); despliegue directo con PM2, sin Docker |

> Nota: la cotización previa (`Cotización Sistema Administrativo.html`) propone MySQL; este requerimiento fija **PostgreSQL** como motor de base de datos por decisión del proyecto.

---

## 3. Arquitectura

```
Frontend Público (cancun-transfer-web)     Frontend Admin (futuro)
              │                                     │
              └──────────────── REST API ───────────┘
                              │
                      Backend (NestJS)
                    │                    │
              Prisma ORM          Servicios externos
                    │                    │
              PostgreSQL      Stripe · PayPal · SMTP · WhatsApp API
```

Estructura de módulos sugerida (`src/`):

```
src/
├── auth/            → JWT, refresh tokens, guards, roles (Admin, Operador)
├── bookings/         → CRUD reservas + máquina de estados
├── clients/          → Viajeros / CRM
├── vehicles/          → Vehículos + conductores
├── catalog/          → Destinos, hoteles, tarifas, extras, cupones
├── payments/          → Integración Stripe + PayPal
├── contacts/          → Formulario de contacto público
├── communications/    → Email + WhatsApp + automatizaciones
├── cms/               → Contenido del sitio + galería (futuro)
├── reports/           → Reportes + export Excel/PDF (futuro)
├── config/            → Configuración general del sistema
└── common/            → Guards, pipes, interceptors, filtros de excepción
prisma/
└── schema.prisma
```

---

## 4. Modelo de datos (entidades núcleo)

Derivado directamente de los tipos actuales del frontend (`src/types/booking.ts`, `src/store/bookingStore.ts`, `src/data/places.ts`).

### Place / Destination
- `id`, `key` (slug único: `cun`, `hotelzone`, `pdc`, `tulum`, `morelos`, `aventuras`, `akumal`, `mujeres`, `holbox`)
- `labelEs`, `labelEn`
- `zone`, `isAirport` (bool), `isPopular` (bool), `active`

### Vehicle
- `id`, `name`, `capacityPassengers`, `capacityLuggage`, `description`, `imageUrl`, `active`

### Rate (Tarifa)
- `id`, `originId` (FK Place), `destinationId` (FK Place), `vehicleId` (FK Vehicle)
- `season` (opcional), `currency`, `priceNormal`, `pricePromo` (nullable)
- Determina el precio mostrado en `VehicleStep` — hoy hardcodeado en `useVehicles.ts`

### Booking
Mapea 1:1 con `BookingForm` + datos de `DetailsStep` + `PayStep`:

- `id`, `folio` (código público tipo `CTH-7K2940`, visto en `DoneStep`)
- `tripType` (`round` | `oneway`)
- `originId`, `destinationId` (FK Place)
- `arrivalDate`, `departureDate` (nullable si `oneway`)
- `adults` (1–12), `children` (0–8)
- `vehicleId` (FK Vehicle), `priceTotal`, `currency`
- Pasajero: `firstName`, `lastName`, `email`, `phone`, `contactPref` (`whatsapp`|`email`)
- Vuelo: `arrivalAirline`, `arrivalFlightNo`, `arrivalTime`, `departureAirline`, `departureFlightNo`, `departureTime`, `comments`
- `payMethod` (`card`|`paypal`), `paymentStatus`, `status` (state machine, ver abajo)
- `createdAt`, `updatedAt`

**Estados de reserva** (7, según KPIs ya definidos en la cotización del panel admin):
`nueva → pendiente_pago → confirmada → proxima → en_curso → finalizada` (rama alterna: `cancelada`)

### Payment
- `id`, `bookingId` (FK), `provider` (`stripe`|`paypal`), `providerRef` (payment_intent_id / order_id)
- `amount`, `currency`, `status` (`pending`|`succeeded`|`failed`|`refunded`), `raw` (jsonb, respuesta del proveedor)

### Contact
- `id`, `name`, `email`, `phone`, `message`, `createdAt`

### (Fuera del alcance inmediato, reservado para el panel admin)
`User` (admin/operador), `Driver`, `Hotel`, `Extra`, `Coupon`, `ActivityLog`, `EmailTemplate`, `CmsContent`, `GalleryImage`.

---

## 5. API pública (consumida por `cancun-transfer-web`)

Estos endpoints ya están referenciados implícitamente en el `README.md` del frontend y deben implementarse primero:

| Método | Endpoint | Uso |
|---|---|---|
| `GET` | `/routes` | Poblar dropdowns Origen/Destino (`RouteStep`) |
| `GET` | `/vehicles?originId=&destinationId=` | Vehículos + precio para la ruta seleccionada (`VehicleStep`) |
| `POST` | `/bookings` | Crear reserva al final de `DetailsStep` → devuelve `bookingId`/`folio` |
| `GET` | `/bookings/:id` | Resumen en `PayStep` / `DoneStep` |
| `POST` | `/payments/stripe/intent` | Crear `PaymentIntent`, devuelve `client_secret` para `<PaymentElement>` |
| `POST` | `/payments/paypal/order` | Crear orden PayPal |
| `POST` | `/payments/paypal/order/:id/capture` | Capturar pago al aprobar en el botón PayPal |
| `POST` | `/contacts` | Formulario de contacto (`ContactPage`, no visto en árbol actual pero referenciado en README) |

Todos documentados vía Swagger, con DTOs validados y respuestas tipadas coincidentes con `src/types/booking.ts`.

---

## 6. API administrativa (alcance futuro, base de datos ya preparada)

No se implementa en esta primera entrega, pero el modelo de datos y la arquitectura modular deben soportarla sin refactor mayor:

- **Auth y roles**: login, refresh token, roles `Admin` / `Operador`
- **Dashboard**: KPIs (nueva, pendiente, confirmada, próxima, en curso, finalizada, cancelada) + calendario
- **Reservas**: CRUD completo, acciones (duplicar, confirmar, cancelar, reprogramar, generar PDF, reenviar email/WhatsApp), historial de actividad
- **Catálogos**: viajeros/CRM, vehículos, conductores, tarifas, destinos/zonas, hoteles, extras, cupones
- **CMS y galería**
- **Comunicaciones**: plantillas de email, automatizaciones (recordatorio 24h/2h, post-viaje), integración WhatsApp Business API
- **Reportes**: ingresos, cancelaciones, top vehículos/hoteles, export Excel/PDF
- **Configuración general**: datos de empresa, claves Stripe/PayPal/SMTP/WhatsApp, monedas, tipo de cambio (hoy hardcodeado en `appStore.ts` como `RATES`)

---

## 7. Requisitos no funcionales

- **Seguridad**: validación de DTOs (`class-validator`) en cada endpoint, CORS restringido al dominio del frontend (`VITE_API_URL`), rate limiting en endpoints sensibles (`/bookings`, `/payments/*`, `/contacts`), variables sensibles solo por entorno (nunca en repo).
- **Consistencia de datos**: transacciones Prisma para creación de reserva + pago; máquina de estados con transiciones validadas (no cualquier estado puede pasar a cualquier otro).
- **Documentación**: Swagger disponible en `/docs`, actualizado automáticamente desde los DTOs.
- **Internacionalización**: catálogos (`Place`, `Vehicle`) devuelven `labelEs`/`labelEn` para alimentar `i18next` del frontend.
- **Moneda**: precios almacenados en USD (base), conversión a `MXN`/`CAD`/`EUR` puede resolverse en frontend (como hoy) o exponerse vía `/config/rates` a futuro.
- **Logging**: logging estructurado de requests y errores; log de auditoría por reserva (quién y cuándo la modificó) desde el día uno del modelo de datos, aunque el endpoint de consulta sea parte del admin futuro.
- **Testing**: unit tests de servicios críticos (`bookings`, `payments`) + e2e de los endpoints públicos.
- **Infraestructura**: sin Docker — PostgreSQL local/remoto accesible vía `DATABASE_URL`, migraciones Prisma versionadas, CI en GitHub Actions (build + test en PR, deploy en push a `main`), backups automáticos de la base de datos en producción.

---

## 8. Variables de entorno esperadas

```env
DATABASE_URL=postgresql://user:password@localhost:5432/cancun_transfer
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENV=sandbox
SMTP_HOST=
SMTP_USER=
SMTP_PASSWORD=
RESEND_API_KEY=
CORS_ORIGIN=http://localhost:5173
```

---

## 9. Fases sugeridas de implementación

1. **Fundación**: setup NestJS + Prisma + PostgreSQL, módulo `common`, Swagger, manejo global de errores.
2. **Catálogos públicos**: `Place`, `Vehicle`, `Rate` + endpoints `GET /routes`, `GET /vehicles`.
3. **Reservas**: modelo `Booking` con máquina de estados + `POST /bookings`, `GET /bookings/:id`.
4. **Pagos**: integración Stripe (PaymentIntents) y PayPal (Orders v2), webhooks de confirmación.
5. **Contacto y correos transaccionales**: `POST /contacts`, envío de email de confirmación de reserva.
6. **Base para admin**: módulos `auth` (JWT + roles) y entidades restantes (`User`, `Driver`, `Hotel`, `Extra`, `Coupon`) creadas en el esquema aunque sin UI todavía, para no requerir migraciones destructivas después.

---

## 10. Fuera de alcance de este requerimiento

- Panel administrativo (frontend) — módulos ya cotizados por separado.
- Facturación electrónica (CFDI).
- Multiempresa.
- App móvil / PWA para operadores.
- Asignación automática de vehículos/conductores.
- Notificaciones push en tiempo real.
