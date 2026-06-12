-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'FRONT_DESK', 'HOUSEKEEPING', 'STORE', 'KITCHEN');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ShiftName" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('SINGLE', 'DOUBLE', 'TWIN', 'SUITE', 'DELUXE');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'RESERVED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'COMPLIMENTARY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCESS', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "IdType" AS ENUM ('NIN', 'PASSPORT', 'DRIVERS_LICENSE', 'VOTERS_CARD');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('LOGIN', 'LOGOUT', 'STAFF_CREATED', 'STAFF_UPDATED', 'STAFF_DEACTIVATED', 'ROOM_CREATED', 'ROOM_STATUS_CHANGED', 'GUEST_CREATED', 'GUEST_UPDATED', 'RESERVATION_CREATED', 'RESERVATION_CONFIRMED', 'RESERVATION_CANCELLED', 'CHECK_IN', 'CHECK_OUT', 'BILL_CREATED', 'PAYMENT_POSTED', 'BILL_VOIDED', 'ROOM_CLEANING_STARTED', 'ROOM_CLEANING_COMPLETED', 'ITEM_USAGE_RECORDED', 'STOCK_IN', 'STOCK_OUT', 'STOCK_ADJUSTED', 'STOCK_RECEIVED', 'STOCK_RETURNED', 'DEPARTMENT_REQUEST_CREATED', 'DEPARTMENT_REQUEST_APPROVED', 'DEPARTMENT_REQUEST_REJECTED', 'DEPARTMENT_REQUEST_FULFILLED', 'HOUSEKEEPING_STARTED', 'HOUSEKEEPING_COMPLETED', 'HOUSEKEEPING_USAGE_RECORDED', 'POS_ORDER_CREATED', 'POS_ORDER_CHARGED', 'POS_ORDER_VOIDED', 'POS_ORDER_COMPLETED', 'KITCHEN_TICKET_CREATED', 'KITCHEN_TICKET_UPDATED', 'KITCHEN_TICKET_READY', 'KITCHEN_TICKET_CANCELLED', 'DAILY_SUMMARY_GENERATED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('STAFF', 'ROOM', 'GUEST', 'RESERVATION', 'STAY', 'BILL', 'PAYMENT', 'INVENTORY_ITEM', 'SHIFT', 'STOCK_MOVEMENT', 'DEPARTMENT_REQUEST', 'HOUSEKEEPING_LOG', 'POS_ORDER', 'KITCHEN_TICKET', 'DAILY_SUMMARY');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'USAGE', 'ADJUSTMENT', 'RETURN');

-- CreateEnum
CREATE TYPE "Department" AS ENUM ('STORE', 'KITCHEN', 'BAR', 'HOUSEKEEPING', 'FRONT_DESK', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('OK', 'LOW_STOCK', 'OUT_OF_STOCK');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('FOOD', 'BEVERAGE');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'TAKEAWAY', 'ROOM_SERVICE');

-- CreateEnum
CREATE TYPE "PosOrderStatus" AS ENUM ('OPEN', 'CHARGED', 'COMPLETED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PosPaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'POST_TO_ROOM', 'COMPLIMENTARY', 'SPLIT');

-- CreateEnum
CREATE TYPE "KitchenTicketStatus" AS ENUM ('RECEIVED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KitchenItemStatus" AS ENUM ('QUEUED', 'PREPARING', 'COOKING', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "name" "ShiftName" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_shifts" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_logs" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "loginTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutTime" TIMESTAMP(3),

    CONSTRAINT "shift_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "shiftId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "ipAddress" TEXT,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "type" "RoomType" NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
    "basePrice" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "idType" "IdType",
    "idNumber" TEXT,
    "nationality" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "checkInDate" DATE NOT NULL,
    "checkOutDate" DATE NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stays" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt" TIMESTAMP(3),
    "checkInById" TEXT NOT NULL,
    "checkOutById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "BillStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_line_items" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'SUCCESS',
    "reference" TEXT,
    "staffId" TEXT NOT NULL,
    "shiftId" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "housekeeping_logs" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "shiftId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "housekeeping_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_outbox" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttempt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "reorderLevel" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "ItemStatus" NOT NULL DEFAULT 'OK',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "department" "Department" NOT NULL,
    "staffId" TEXT NOT NULL,
    "shiftId" TEXT,
    "requestId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_requests" (
    "id" TEXT NOT NULL,
    "department" "Department" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_request_items" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "fulfilledQty" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "department_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "housekeeping_usages" (
    "id" TEXT NOT NULL,
    "housekeepingLogId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "staffId" TEXT NOT NULL,
    "shiftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "housekeeping_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "categoryId" TEXT,
    "linkedInventoryItemId" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_orders" (
    "id" TEXT NOT NULL,
    "type" "OrderType" NOT NULL,
    "status" "PosOrderStatus" NOT NULL DEFAULT 'OPEN',
    "tableRef" TEXT,
    "roomId" TEXT,
    "staffId" TEXT NOT NULL,
    "shiftId" TEXT,
    "note" TEXT,
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "sentToKitchen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pos_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PosPaymentMethod" NOT NULL,
    "reference" TEXT,
    "staffId" TEXT NOT NULL,
    "shiftId" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "pos_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_tickets" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "KitchenTicketStatus" NOT NULL DEFAULT 'RECEIVED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kitchen_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_ticket_items" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "status" "KitchenItemStatus" NOT NULL DEFAULT 'QUEUED',
    "assignedTo" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "kitchen_ticket_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waste_logs" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "shiftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waste_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_summaries" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "occupancyRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "totalCheckins" INTEGER NOT NULL DEFAULT 0,
    "totalCheckouts" INTEGER NOT NULL DEFAULT 0,
    "totalPosSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "topSellingItems" JSONB,
    "stockMovementsSummary" JSONB,
    "notes" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_username_key" ON "staff"("username");

-- CreateIndex
CREATE UNIQUE INDEX "staff_shifts_staffId_date_key" ON "staff_shifts"("staffId", "date");

-- CreateIndex
CREATE INDEX "activity_logs_staffId_idx" ON "activity_logs"("staffId");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "activity_logs_timestamp_idx" ON "activity_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "configs_key_key" ON "configs"("key");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_roomNumber_key" ON "rooms"("roomNumber");

-- CreateIndex
CREATE UNIQUE INDEX "stays_reservationId_key" ON "stays"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "bills_stayId_key" ON "bills"("stayId");

-- CreateIndex
CREATE INDEX "sync_outbox_status_idx" ON "sync_outbox"("status");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_categories_name_key" ON "inventory_categories"("name");

-- CreateIndex
CREATE INDEX "stock_movements_itemId_idx" ON "stock_movements"("itemId");

-- CreateIndex
CREATE INDEX "stock_movements_staffId_idx" ON "stock_movements"("staffId");

-- CreateIndex
CREATE INDEX "stock_movements_createdAt_idx" ON "stock_movements"("createdAt");

-- CreateIndex
CREATE INDEX "department_requests_status_idx" ON "department_requests"("status");

-- CreateIndex
CREATE INDEX "department_requests_department_idx" ON "department_requests"("department");

-- CreateIndex
CREATE INDEX "pos_orders_staffId_idx" ON "pos_orders"("staffId");

-- CreateIndex
CREATE INDEX "pos_orders_status_idx" ON "pos_orders"("status");

-- CreateIndex
CREATE INDEX "pos_orders_createdAt_idx" ON "pos_orders"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "kitchen_tickets_orderId_key" ON "kitchen_tickets"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_summaries_date_key" ON "daily_summaries"("date");

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_logs" ADD CONSTRAINT "shift_logs_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_logs" ADD CONSTRAINT "shift_logs_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stays" ADD CONSTRAINT "stays_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stays" ADD CONSTRAINT "stays_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stays" ADD CONSTRAINT "stays_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "stays"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_line_items" ADD CONSTRAINT "bill_line_items_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_logs" ADD CONSTRAINT "housekeeping_logs_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "inventory_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "department_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_request_items" ADD CONSTRAINT "department_request_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "department_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_request_items" ADD CONSTRAINT "department_request_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_usages" ADD CONSTRAINT "housekeeping_usages_housekeepingLogId_fkey" FOREIGN KEY ("housekeepingLogId") REFERENCES "housekeeping_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_usages" ADD CONSTRAINT "housekeeping_usages_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_products" ADD CONSTRAINT "pos_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "inventory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_products" ADD CONSTRAINT "pos_products_linkedInventoryItemId_fkey" FOREIGN KEY ("linkedInventoryItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "pos_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "pos_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "pos_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "pos_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "kitchen_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
