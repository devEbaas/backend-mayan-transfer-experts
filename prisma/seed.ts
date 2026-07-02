import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLACES = [
  {
    key: 'cun',
    labelEs: 'Aeropuerto de Cancún (CUN)',
    labelEn: 'Cancún Airport (CUN)',
    zone: 'Cancún',
    isAirport: true,
    isPopular: false,
  },
  {
    key: 'hotelzone',
    labelEs: 'Zona Hotelera',
    labelEn: 'Hotel Zone',
    zone: 'Cancún',
    isAirport: false,
    isPopular: true,
  },
  {
    key: 'pdc',
    labelEs: 'Playa del Carmen',
    labelEn: 'Playa del Carmen',
    zone: 'Riviera Maya',
    isAirport: false,
    isPopular: true,
  },
  {
    key: 'tulum',
    labelEs: 'Tulum',
    labelEn: 'Tulum',
    zone: 'Riviera Maya',
    isAirport: false,
    isPopular: true,
  },
  {
    key: 'morelos',
    labelEs: 'Puerto Morelos',
    labelEn: 'Puerto Morelos',
    zone: 'Riviera Maya',
    isAirport: false,
    isPopular: true,
  },
  {
    key: 'aventuras',
    labelEs: 'Puerto Aventuras',
    labelEn: 'Puerto Aventuras',
    zone: 'Riviera Maya',
    isAirport: false,
    isPopular: true,
  },
  {
    key: 'akumal',
    labelEs: 'Akumal',
    labelEn: 'Akumal',
    zone: 'Riviera Maya',
    isAirport: false,
    isPopular: true,
  },
  {
    key: 'mujeres',
    labelEs: 'Playa Mujeres',
    labelEn: 'Playa Mujeres',
    zone: 'Cancún',
    isAirport: false,
    isPopular: true,
  },
  {
    key: 'holbox',
    labelEs: 'Holbox',
    labelEn: 'Holbox',
    zone: 'Isla',
    isAirport: false,
    isPopular: true,
  },
] as const;

const VEHICLES = [
  {
    name: 'Private Van',
    capacityPassengers: 8,
    capacityLuggage: 8,
    description: 'Hasta 8 pasajeros · equipaje incluido',
    priceNormal: 89.6,
  },
  {
    name: 'Suburban SUV',
    capacityPassengers: 6,
    capacityLuggage: 6,
    description: 'Hasta 6 pasajeros · servicio premium',
    priceNormal: 260.1,
  },
] as const;

async function main() {
  const places = await Promise.all(
    PLACES.map((place) =>
      prisma.place.upsert({
        where: { key: place.key },
        update: place,
        create: place,
      }),
    ),
  );

  const vehicles = await Promise.all(
    VEHICLES.map((vehicle) => {
      const data = {
        name: vehicle.name,
        capacityPassengers: vehicle.capacityPassengers,
        capacityLuggage: vehicle.capacityLuggage,
        description: vehicle.description,
      };
      return prisma.vehicle.upsert({
        where: { name: vehicle.name },
        update: data,
        create: data,
      });
    }),
  );

  const priceByVehicleId = new Map(
    vehicles.map((vehicle, index) => [vehicle.id, VEHICLES[index].priceNormal]),
  );

  // Tarifa plana por vehículo para cualquier par origen/destino, replicando
  // el comportamiento actual del frontend (mismo precio sin importar la ruta).
  for (const origin of places) {
    for (const destination of places) {
      if (origin.id === destination.id) continue;

      for (const vehicle of vehicles) {
        const priceNormal = priceByVehicleId.get(vehicle.id)!;
        // `season` es nullable, y Prisma no admite `null` en el atajo de
        // índice compuesto para `upsert`, así que se resuelve manualmente.
        const existing = await prisma.rate.findFirst({
          where: {
            originId: origin.id,
            destinationId: destination.id,
            vehicleId: vehicle.id,
            season: null,
          },
        });

        if (existing) {
          await prisma.rate.update({
            where: { id: existing.id },
            data: { priceNormal },
          });
        } else {
          await prisma.rate.create({
            data: {
              originId: origin.id,
              destinationId: destination.id,
              vehicleId: vehicle.id,
              priceNormal,
            },
          });
        }
      }
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
