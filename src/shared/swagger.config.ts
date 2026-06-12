import swaggerJsdoc from 'swagger-jsdoc'
import path from 'path'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hotel Management System API',
      version: '1.0.0',
      description:
        'Local backend for hotel operations. All endpoints require JWT Bearer auth except `POST /auth/login`.',
      contact: { name: 'Hotel System' },
    },
    servers: [{ url: '/api/v1', description: 'Local server' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Obtain token from POST /auth/login',
        },
      },
      schemas: {
        // ── Generic ────────────────────────────────────────────────────
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            code: { type: 'string', example: 'NOT_FOUND' },
            message: { type: 'string', example: 'Record not found' },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
          },
        },
        // ── Auth ───────────────────────────────────────────────────────
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'john_desk' },
            password: { type: 'string', example: 'SecurePass123' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                staff: { $ref: '#/components/schemas/StaffPublic' },
              },
            },
          },
        },
        // ── Staff ──────────────────────────────────────────────────────
        StaffPublic: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string', example: 'john_desk' },
            fullName: { type: 'string', example: 'John Doe' },
            role: { $ref: '#/components/schemas/Role' },
            status: { $ref: '#/components/schemas/StaffStatus' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateStaffRequest: {
          type: 'object',
          required: ['username', 'password', 'fullName', 'role'],
          properties: {
            username: { type: 'string', example: 'jane_hk' },
            password: { type: 'string', example: 'StrongPass456' },
            fullName: { type: 'string', example: 'Jane Smith' },
            role: { $ref: '#/components/schemas/Role' },
          },
        },
        UpdateStaffStatusRequest: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { $ref: '#/components/schemas/StaffStatus' },
          },
        },
        // ── Shifts ─────────────────────────────────────────────────────
        Shift: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { $ref: '#/components/schemas/ShiftName' },
            startTime: { type: 'string', example: '06:00' },
            endTime: { type: 'string', example: '14:00' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateShiftRequest: {
          type: 'object',
          required: ['name', 'startTime', 'endTime'],
          properties: {
            name: { $ref: '#/components/schemas/ShiftName' },
            startTime: { type: 'string', example: '06:00' },
            endTime: { type: 'string', example: '14:00' },
          },
        },
        AssignShiftRequest: {
          type: 'object',
          required: ['staffId', 'shiftId', 'date'],
          properties: {
            staffId: { type: 'string', format: 'uuid' },
            shiftId: { type: 'string', format: 'uuid' },
            date: { type: 'string', format: 'date', example: '2025-01-15' },
          },
        },
        // ── Rooms ──────────────────────────────────────────────────────
        Room: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            roomNumber: { type: 'string', example: '101' },
            floor: { type: 'integer', example: 1 },
            type: { $ref: '#/components/schemas/RoomType' },
            status: { $ref: '#/components/schemas/RoomStatus' },
            basePrice: { type: 'number', format: 'decimal', example: 25000.00 },
            description: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateRoomRequest: {
          type: 'object',
          required: ['roomNumber', 'floor', 'type', 'basePrice'],
          properties: {
            roomNumber: { type: 'string', example: '101' },
            floor: { type: 'integer', example: 1 },
            type: { $ref: '#/components/schemas/RoomType' },
            basePrice: { type: 'number', example: 25000.00 },
            description: { type: 'string', example: 'Corner room with balcony' },
          },
        },
        UpdateRoomStatusRequest: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { $ref: '#/components/schemas/RoomStatus' },
          },
        },
        // ── Guests ─────────────────────────────────────────────────────
        Guest: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            fullName: { type: 'string', example: 'Emeka Okafor' },
            phone: { type: 'string', example: '+2348012345678' },
            email: { type: 'string', nullable: true, example: 'emeka@example.com' },
            idType: { $ref: '#/components/schemas/IdType', nullable: true },
            idNumber: { type: 'string', nullable: true },
            nationality: { type: 'string', nullable: true, example: 'Nigerian' },
            address: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateGuestRequest: {
          type: 'object',
          required: ['fullName', 'phone'],
          properties: {
            fullName: { type: 'string', example: 'Emeka Okafor' },
            phone: { type: 'string', example: '+2348012345678' },
            email: { type: 'string', example: 'emeka@example.com' },
            idType: { $ref: '#/components/schemas/IdType' },
            idNumber: { type: 'string', example: '12345678901' },
            nationality: { type: 'string', example: 'Nigerian' },
            address: { type: 'string', example: '5 Allen Avenue, Ikeja, Lagos' },
          },
        },
        // ── Reservations ───────────────────────────────────────────────
        Reservation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            guestId: { type: 'string', format: 'uuid' },
            roomId: { type: 'string', format: 'uuid' },
            checkInDate: { type: 'string', format: 'date' },
            checkOutDate: { type: 'string', format: 'date' },
            adults: { type: 'integer', example: 2 },
            children: { type: 'integer', example: 0 },
            status: { $ref: '#/components/schemas/ReservationStatus' },
            totalAmount: { type: 'number', example: 75000.00 },
            notes: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateReservationRequest: {
          type: 'object',
          required: ['guestId', 'roomId', 'checkInDate', 'checkOutDate'],
          properties: {
            guestId: { type: 'string', format: 'uuid' },
            roomId: { type: 'string', format: 'uuid' },
            checkInDate: { type: 'string', format: 'date', example: '2025-02-01' },
            checkOutDate: { type: 'string', format: 'date', example: '2025-02-04' },
            adults: { type: 'integer', example: 2, default: 1 },
            children: { type: 'integer', example: 0, default: 0 },
            notes: { type: 'string', example: 'Late check-in expected' },
          },
        },
        // ── Stays ──────────────────────────────────────────────────────
        Stay: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            reservationId: { type: 'string', format: 'uuid' },
            guestId: { type: 'string', format: 'uuid' },
            roomId: { type: 'string', format: 'uuid' },
            checkInAt: { type: 'string', format: 'date-time' },
            checkOutAt: { type: 'string', format: 'date-time', nullable: true },
            checkInById: { type: 'string', format: 'uuid' },
            checkOutById: { type: 'string', format: 'uuid', nullable: true },
          },
        },
        CheckInRequest: {
          type: 'object',
          required: ['reservationId'],
          properties: {
            reservationId: { type: 'string', format: 'uuid' },
          },
        },
        // ── Billing ────────────────────────────────────────────────────
        Bill: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            stayId: { type: 'string', format: 'uuid' },
            totalAmount: { type: 'number', example: 75000.00 },
            paidAmount: { type: 'number', example: 0.00 },
            status: { $ref: '#/components/schemas/BillStatus' },
            lineItems: { type: 'array', items: { $ref: '#/components/schemas/BillLineItem' } },
            payments: { type: 'array', items: { $ref: '#/components/schemas/Payment' } },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        BillLineItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            billId: { type: 'string', format: 'uuid' },
            description: { type: 'string', example: 'Room 101 — 3 night(s)' },
            quantity: { type: 'integer', example: 1 },
            unitPrice: { type: 'number', example: 25000.00 },
            totalPrice: { type: 'number', example: 75000.00 },
          },
        },
        AddLineItemRequest: {
          type: 'object',
          required: ['description', 'unitPrice'],
          properties: {
            description: { type: 'string', example: 'Room service — Jollof rice' },
            quantity: { type: 'integer', example: 2, default: 1 },
            unitPrice: { type: 'number', example: 3500.00 },
          },
        },
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            billId: { type: 'string', format: 'uuid' },
            amount: { type: 'number', example: 75000.00 },
            method: { $ref: '#/components/schemas/PaymentMethod' },
            status: { $ref: '#/components/schemas/PaymentStatus' },
            reference: { type: 'string', nullable: true, example: 'TRF-20250201-001' },
            processedAt: { type: 'string', format: 'date-time' },
          },
        },
        PostPaymentRequest: {
          type: 'object',
          required: ['amount', 'method'],
          properties: {
            amount: { type: 'number', example: 75000.00 },
            method: { $ref: '#/components/schemas/PaymentMethod' },
            reference: { type: 'string', example: 'TRF-20250201-001' },
            notes: { type: 'string', example: 'Bank transfer confirmed' },
          },
        },
        // ── Enums ──────────────────────────────────────────────────────
        Role: {
          type: 'string',
          enum: ['ADMIN', 'MANAGER', 'FRONT_DESK', 'HOUSEKEEPING', 'STORE', 'KITCHEN'],
        },
        StaffStatus: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
        },
        ShiftName: {
          type: 'string',
          enum: ['MORNING', 'AFTERNOON', 'NIGHT'],
        },
        RoomType: {
          type: 'string',
          enum: ['SINGLE', 'DOUBLE', 'TWIN', 'SUITE', 'DELUXE'],
        },
        RoomStatus: {
          type: 'string',
          enum: ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'RESERVED'],
        },
        ReservationStatus: {
          type: 'string',
          enum: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'],
        },
        BillStatus: {
          type: 'string',
          enum: ['OPEN', 'PARTIAL', 'PAID', 'VOIDED'],
        },
        PaymentMethod: {
          type: 'string',
          enum: ['CASH', 'CARD', 'TRANSFER', 'COMPLIMENTARY'],
        },
        PaymentStatus: {
          type: 'string',
          enum: ['SUCCESS', 'FAILED', 'REVERSED'],
        },
        IdType: {
          type: 'string',
          enum: ['NIN', 'PASSPORT', 'DRIVERS_LICENSE', 'VOTERS_CARD'],
        },
        // ── Phase 2 Enums ──────────────────────────────────────────────
        StockMovementType: {
          type: 'string',
          enum: ['IN', 'OUT', 'USAGE', 'ADJUSTMENT', 'RETURN'],
        },
        Department: {
          type: 'string',
          enum: ['STORE', 'KITCHEN', 'BAR', 'HOUSEKEEPING', 'FRONT_DESK', 'MAINTENANCE'],
        },
        ItemStatus: {
          type: 'string',
          enum: ['OK', 'LOW_STOCK', 'OUT_OF_STOCK'],
        },
        RequestStatus: {
          type: 'string',
          enum: ['PENDING', 'APPROVED', 'REJECTED', 'FULFILLED'],
        },
        // ── Inventory ──────────────────────────────────────────────────
        InventoryCategory: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Cleaning Supplies' },
            description: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            _count: {
              type: 'object',
              properties: { items: { type: 'integer', example: 12 } },
            },
          },
        },
        CreateCategoryRequest: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', example: 'Cleaning Supplies' },
            description: { type: 'string', example: 'All housekeeping cleaning materials' },
          },
        },
        InventoryItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Toilet Rolls' },
            categoryId: { type: 'string', format: 'uuid' },
            unit: { type: 'string', example: 'pieces' },
            quantity: { type: 'number', example: 200 },
            reorderLevel: { type: 'number', example: 50 },
            status: { $ref: '#/components/schemas/ItemStatus' },
            description: { type: 'string', nullable: true },
            category: { $ref: '#/components/schemas/InventoryCategory' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateInventoryItemRequest: {
          type: 'object',
          required: ['name', 'categoryId', 'unit'],
          properties: {
            name: { type: 'string', example: 'Toilet Rolls' },
            categoryId: { type: 'string', format: 'uuid' },
            unit: { type: 'string', example: 'pieces' },
            quantity: { type: 'number', example: 200, default: 0 },
            reorderLevel: { type: 'number', example: 50, default: 0 },
            description: { type: 'string', example: 'Standard single-ply' },
          },
        },
        UpdateInventoryItemRequest: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            unit: { type: 'string' },
            reorderLevel: { type: 'number' },
            description: { type: 'string' },
            categoryId: { type: 'string', format: 'uuid' },
          },
        },
        // ── Stock ──────────────────────────────────────────────────────
        StockMovement: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            itemId: { type: 'string', format: 'uuid' },
            quantity: { type: 'number', example: 10 },
            type: { $ref: '#/components/schemas/StockMovementType' },
            department: { $ref: '#/components/schemas/Department' },
            staffId: { type: 'string', format: 'uuid' },
            shiftId: { type: 'string', format: 'uuid', nullable: true },
            requestId: { type: 'string', format: 'uuid', nullable: true },
            note: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            item: { $ref: '#/components/schemas/InventoryItem' },
          },
        },
        StockMovementResult: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                movement: { $ref: '#/components/schemas/StockMovement' },
                newQuantity: { type: 'number', example: 210 },
                newStatus: { $ref: '#/components/schemas/ItemStatus' },
              },
            },
          },
        },
        ReceiveStockRequest: {
          type: 'object',
          required: ['itemId', 'quantity'],
          properties: {
            itemId: { type: 'string', format: 'uuid' },
            quantity: { type: 'number', example: 50 },
            note: { type: 'string', example: 'Delivery from ABC Supplies' },
            shiftId: { type: 'string', format: 'uuid' },
          },
        },
        AdjustStockRequest: {
          type: 'object',
          required: ['itemId', 'quantity', 'note'],
          properties: {
            itemId: { type: 'string', format: 'uuid' },
            quantity: { type: 'number', example: 5 },
            note: { type: 'string', example: 'Physical count correction — 5 items damaged' },
            shiftId: { type: 'string', format: 'uuid' },
          },
        },
        // ── Department Requests ────────────────────────────────────────
        DepartmentRequestItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            itemId: { type: 'string', format: 'uuid' },
            quantity: { type: 'number', example: 10 },
            fulfilledQty: { type: 'number', example: 0 },
            item: { $ref: '#/components/schemas/InventoryItem' },
          },
        },
        DepartmentRequest: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            department: { $ref: '#/components/schemas/Department' },
            requestedById: { type: 'string', format: 'uuid' },
            reviewedById: { type: 'string', format: 'uuid', nullable: true },
            status: { $ref: '#/components/schemas/RequestStatus' },
            note: { type: 'string', nullable: true },
            reviewNote: { type: 'string', nullable: true },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/DepartmentRequestItem' },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateDepartmentRequestRequest: {
          type: 'object',
          required: ['department', 'items'],
          properties: {
            department: { $ref: '#/components/schemas/Department' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['itemId', 'quantity'],
                properties: {
                  itemId: { type: 'string', format: 'uuid' },
                  quantity: { type: 'number', example: 5 },
                },
              },
            },
            note: { type: 'string', example: 'Needed for evening service' },
            shiftId: { type: 'string', format: 'uuid' },
          },
        },
        // ── Housekeeping ──────────────────────────────────────────────
        HousekeepingUsage: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            housekeepingLogId: { type: 'string', format: 'uuid' },
            itemId: { type: 'string', format: 'uuid' },
            quantity: { type: 'number', example: 2 },
            staffId: { type: 'string', format: 'uuid' },
            shiftId: { type: 'string', format: 'uuid', nullable: true },
            item: { $ref: '#/components/schemas/InventoryItem' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        HousekeepingLog: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            roomId: { type: 'string', format: 'uuid' },
            staffId: { type: 'string', format: 'uuid' },
            shiftId: { type: 'string', format: 'uuid', nullable: true },
            startedAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time', nullable: true },
            notes: { type: 'string', nullable: true },
            room: { $ref: '#/components/schemas/Room' },
            usages: {
              type: 'array',
              items: { $ref: '#/components/schemas/HousekeepingUsage' },
            },
          },
        },
        StartCleaningRequest: {
          type: 'object',
          required: ['roomId'],
          properties: {
            roomId: { type: 'string', format: 'uuid' },
            shiftId: { type: 'string', format: 'uuid' },
            notes: { type: 'string', example: 'Guest checked out — full clean required' },
          },
        },
        RecordUsageRequest: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['itemId', 'quantity'],
                properties: {
                  itemId: { type: 'string', format: 'uuid' },
                  quantity: { type: 'number', example: 2 },
                },
              },
            },
            shiftId: { type: 'string', format: 'uuid' },
          },
        },

        // ── Phase 3 Enums ──────────────────────────────────────────────
        ProductType: { type: 'string', enum: ['FOOD', 'BEVERAGE'] },
        OrderType: { type: 'string', enum: ['DINE_IN', 'TAKEAWAY', 'ROOM_SERVICE'] },
        PosOrderStatus: { type: 'string', enum: ['OPEN', 'CHARGED', 'COMPLETED', 'VOIDED'] },
        PosPaymentMethod: { type: 'string', enum: ['CASH', 'CARD', 'TRANSFER', 'POST_TO_ROOM', 'COMPLIMENTARY', 'SPLIT'] },
        KitchenTicketStatus: { type: 'string', enum: ['RECEIVED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED'] },
        KitchenItemStatus: { type: 'string', enum: ['QUEUED', 'PREPARING', 'COOKING', 'DONE', 'CANCELLED'] },
        SyncStatus: { type: 'string', enum: ['PENDING', 'SENT', 'FAILED'] },
        // ── POS ────────────────────────────────────────────────────────
        PosProduct: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Jollof Rice' },
            type: { $ref: '#/components/schemas/ProductType' },
            price: { type: 'number', example: 3500.00 },
            isAvailable: { type: 'boolean', example: true },
            description: { type: 'string', nullable: true },
            category: { $ref: '#/components/schemas/InventoryCategory', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreatePosProductRequest: {
          type: 'object',
          required: ['name', 'type', 'price'],
          properties: {
            name: { type: 'string', example: 'Jollof Rice' },
            type: { $ref: '#/components/schemas/ProductType' },
            price: { type: 'number', example: 3500.00 },
            categoryId: { type: 'string', format: 'uuid' },
            linkedInventoryItemId: { type: 'string', format: 'uuid', description: 'For auto stock deduction on sale/use' },
            description: { type: 'string' },
          },
        },
        UpdatePosProductRequest: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            price: { type: 'number' },
            categoryId: { type: 'string', format: 'uuid' },
            linkedInventoryItemId: { type: 'string', format: 'uuid' },
            description: { type: 'string' },
          },
        },
        PosOrderItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            productId: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer', example: 2 },
            unitPrice: { type: 'number', example: 3500.00 },
            totalPrice: { type: 'number', example: 7000.00 },
            notes: { type: 'string', nullable: true, example: 'No pepper' },
            sentToKitchen: { type: 'boolean', example: false },
            product: { $ref: '#/components/schemas/PosProduct' },
          },
        },
        PosPayment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            orderId: { type: 'string', format: 'uuid' },
            amount: { type: 'number', example: 7000.00 },
            method: { $ref: '#/components/schemas/PosPaymentMethod' },
            reference: { type: 'string', nullable: true },
            processedAt: { type: 'string', format: 'date-time' },
          },
        },
        PosOrder: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            type: { $ref: '#/components/schemas/OrderType' },
            status: { $ref: '#/components/schemas/PosOrderStatus' },
            tableRef: { type: 'string', nullable: true, example: 'Table 4' },
            roomId: { type: 'string', format: 'uuid', nullable: true },
            staffId: { type: 'string', format: 'uuid' },
            shiftId: { type: 'string', format: 'uuid', nullable: true },
            note: { type: 'string', nullable: true },
            totalAmount: { type: 'number', example: 7000.00 },
            items: { type: 'array', items: { $ref: '#/components/schemas/PosOrderItem' } },
            payments: { type: 'array', items: { $ref: '#/components/schemas/PosPayment' } },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreatePosOrderRequest: {
          type: 'object',
          required: ['type', 'items'],
          properties: {
            type: { $ref: '#/components/schemas/OrderType' },
            tableRef: { type: 'string', example: 'Table 4', description: 'Required for DINE_IN' },
            roomId: { type: 'string', format: 'uuid', description: 'Required for ROOM_SERVICE' },
            note: { type: 'string' },
            shiftId: { type: 'string', format: 'uuid' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['productId', 'quantity'],
                properties: {
                  productId: { type: 'string', format: 'uuid' },
                  quantity: { type: 'integer', example: 2 },
                  notes: { type: 'string', example: 'No pepper' },
                },
              },
            },
          },
        },
        ChargeOrderRequest: {
          type: 'object',
          required: ['payments'],
          properties: {
            shiftId: { type: 'string', format: 'uuid' },
            payments: {
              type: 'array',
              description: 'For split payment, provide multiple entries that sum to order total',
              items: {
                type: 'object',
                required: ['method', 'amount'],
                properties: {
                  method: { $ref: '#/components/schemas/PosPaymentMethod' },
                  amount: { type: 'number', example: 7000.00 },
                  reference: { type: 'string', example: 'TRF-001' },
                  note: { type: 'string' },
                },
              },
            },
          },
        },
        // ── Kitchen ────────────────────────────────────────────────────
        KitchenTicketItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            ticketId: { type: 'string', format: 'uuid' },
            productName: { type: 'string', example: 'Jollof Rice' },
            quantity: { type: 'integer', example: 2 },
            notes: { type: 'string', nullable: true },
            status: { $ref: '#/components/schemas/KitchenItemStatus' },
            assignedTo: { type: 'string', format: 'uuid', nullable: true },
            startedAt: { type: 'string', format: 'date-time', nullable: true },
            completedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        KitchenTicket: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            orderId: { type: 'string', format: 'uuid' },
            status: { $ref: '#/components/schemas/KitchenTicketStatus' },
            note: { type: 'string', nullable: true },
            items: { type: 'array', items: { $ref: '#/components/schemas/KitchenTicketItem' } },
            order: {
              type: 'object',
              properties: {
                type: { $ref: '#/components/schemas/OrderType' },
                tableRef: { type: 'string', nullable: true },
                roomId: { type: 'string', nullable: true },
                note: { type: 'string', nullable: true },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        UpdateKitchenItemStatusRequest: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { $ref: '#/components/schemas/KitchenItemStatus' },
            assignedTo: { type: 'string', format: 'uuid', description: 'Cook assigned to this item' },
            shiftId: { type: 'string', format: 'uuid' },
          },
        },
        // ── Reporting ──────────────────────────────────────────────────
        DailySummary: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            date: { type: 'string', format: 'date' },
            totalRevenue: { type: 'number', example: 350000.00 },
            occupancyRate: { type: 'number', example: 75.50, description: 'Percentage 0-100' },
            totalCheckins: { type: 'integer', example: 8 },
            totalCheckouts: { type: 'integer', example: 5 },
            totalPosSales: { type: 'number', example: 85000.00 },
            topSellingItems: { type: 'array', items: { type: 'object' } },
            stockMovementsSummary: { type: 'object' },
            generatedAt: { type: 'string', format: 'date-time' },
          },
        },
        RevenueReport: {
          type: 'object',
          properties: {
            period: {
              type: 'object',
              properties: { from: { type: 'string' }, to: { type: 'string' } },
            },
            roomRevenue: { type: 'number', example: 265000.00 },
            posRevenue: { type: 'number', example: 85000.00 },
            totalRevenue: { type: 'number', example: 350000.00 },
            byPaymentMethod: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  method: { type: 'string' },
                  amount: { type: 'number' },
                },
              },
            },
          },
        },
        StaffActivityReport: {
          type: 'object',
          properties: {
            staffId: { type: 'string', format: 'uuid' },
            period: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } } },
            totalActions: { type: 'integer', example: 47 },
            actionBreakdown: { type: 'object', example: { LOGIN: 5, CHECK_IN: 8, PAYMENT_POSTED: 12 } },
            shiftLogs: { type: 'array', items: { type: 'object' } },
          },
        },
        SyncOutboxEntry: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            eventType: { type: 'string', example: 'DAILY_SUMMARY' },
            status: { $ref: '#/components/schemas/SyncStatus' },
            attempts: { type: 'integer', example: 0 },
            lastAttempt: { type: 'string', format: 'date-time', nullable: true },
            sentAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    path.join(__dirname, '../core/auth/auth.routes.ts'),
    path.join(__dirname, '../staff/profiles/staff.routes.ts'),
    path.join(__dirname, '../staff/shifts/shift.routes.ts'),
    path.join(__dirname, '../modules/rooms/room.routes.ts'),
    path.join(__dirname, '../modules/frontdesk/guest.routes.ts'),
    path.join(__dirname, '../modules/reservations/reservation.routes.ts'),
    path.join(__dirname, '../modules/stays/stay.routes.ts'),
    path.join(__dirname, '../modules/billing/billing.routes.ts'),
    path.join(__dirname, '../modules/inventory/inventory.routes.ts'),
    path.join(__dirname, '../modules/stock/stock.routes.ts'),
    path.join(__dirname, '../modules/stock/departmentRequest.routes.ts'),
    path.join(__dirname, '../modules/housekeeping/housekeeping.routes.ts'),
    path.join(__dirname, '../modules/pos/pos.routes.ts'),
    path.join(__dirname, '../modules/kitchen/kitchen.routes.ts'),
    path.join(__dirname, '../modules/reporting/reporting.routes.ts'),
  ],
}

export const swaggerSpec = swaggerJsdoc(options)