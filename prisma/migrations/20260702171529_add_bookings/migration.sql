-- CreateEnum
CREATE TYPE "TripType" AS ENUM ('round', 'oneway');

-- CreateEnum
CREATE TYPE "ContactPref" AS ENUM ('whatsapp', 'email');

-- CreateEnum
CREATE TYPE "PayMethod" AS ENUM ('card', 'paypal');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('nueva', 'pendiente_pago', 'confirmada', 'proxima', 'en_curso', 'finalizada', 'cancelada');

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "tripType" "TripType" NOT NULL,
    "originId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "arrivalDate" DATE NOT NULL,
    "departureDate" DATE,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL DEFAULT 0,
    "vehicleId" TEXT NOT NULL,
    "priceTotal" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "contactPref" "ContactPref" NOT NULL,
    "arrivalAirline" TEXT,
    "arrivalFlightNo" TEXT,
    "arrivalTime" TEXT,
    "departureAirline" TEXT,
    "departureFlightNo" TEXT,
    "departureTime" TEXT,
    "comments" TEXT,
    "payMethod" "PayMethod" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "status" "BookingStatus" NOT NULL DEFAULT 'nueva',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_folio_key" ON "bookings"("folio");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_originId_fkey" FOREIGN KEY ("originId") REFERENCES "places"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "places"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
