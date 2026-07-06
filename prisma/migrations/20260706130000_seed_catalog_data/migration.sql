-- Seed data: places, extras, vehicles, and flat rates
-- Idempotent (ON CONFLICT DO NOTHING) so it's safe even if run more than once.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Places
INSERT INTO "places" ("id","key","labelEs","labelEn","zone","isAirport","isPopular","active","createdAt","updatedAt") VALUES
  (gen_random_uuid(), 'cun', 'Aeropuerto de Cancún (CUN)', 'Cancún Airport (CUN)', 'Cancún', true, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hotelzone', 'Zona Hotelera', 'Hotel Zone', 'Cancún', false, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'pdc', 'Playa del Carmen', 'Playa del Carmen', 'Riviera Maya', false, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'tulum', 'Tulum', 'Tulum', 'Riviera Maya', false, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'morelos', 'Puerto Morelos', 'Puerto Morelos', 'Riviera Maya', false, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'aventuras', 'Puerto Aventuras', 'Puerto Aventuras', 'Riviera Maya', false, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'akumal', 'Akumal', 'Akumal', 'Riviera Maya', false, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'mujeres', 'Playa Mujeres', 'Playa Mujeres', 'Cancún', false, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'holbox', 'Holbox', 'Holbox', 'Isla', false, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Extras
INSERT INTO "extras" ("id","key","labelEs","labelEn","price","currency","maxQty","active","createdAt","updatedAt") VALUES
  (gen_random_uuid(), 'beer', 'Cerveza (six-pack)', 'Beer (6-pack)', 12, 'USD', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'soda', 'Refrescos (six-pack)', 'Soft drinks (6-pack)', 8, 'USD', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'champagne', 'Champagne', 'Champagne', 35, 'USD', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'snacks', 'Botana', 'Snack box', 10, 'USD', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Vehicles
INSERT INTO "vehicles" ("id","name","capacityPassengers","capacityLuggage","description","active","createdAt","updatedAt") VALUES
  (gen_random_uuid(), 'Private Van', 8, 8, 'Hasta 8 pasajeros · equipaje incluido', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Suburban SUV', 6, 6, 'Hasta 6 pasajeros · servicio premium', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- Rates: flat price per vehicle for every origin/destination pair,
-- replicating the previous frontend behavior (same price regardless of route).
INSERT INTO "rates" ("id","originId","destinationId","vehicleId","season","currency","priceNormal","pricePromo","createdAt","updatedAt")
SELECT gen_random_uuid(), o."id", d."id", vh."id", NULL, 'USD', p.price, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "places" o
CROSS JOIN "places" d
CROSS JOIN (VALUES ('Private Van', 89.60::numeric(10,2)), ('Suburban SUV', 260.10::numeric(10,2))) AS p(name, price)
JOIN "vehicles" vh ON vh."name" = p.name
WHERE o."id" <> d."id"
  AND NOT EXISTS (
    SELECT 1 FROM "rates" r
    WHERE r."originId" = o."id"
      AND r."destinationId" = d."id"
      AND r."vehicleId" = vh."id"
      AND r."season" IS NULL
  );
