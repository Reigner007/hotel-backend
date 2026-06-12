import { ItemStatus } from '@prisma/client'
import prisma from '../../shared/db/prisma'
import { AppError } from '../../shared/middleware/errorHandler'
import { logActivity } from '../../core/activity-logs/activityLog.service'

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getAllCategories() {
  return prisma.inventoryCategory.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: { name: 'asc' },
  })
}

export async function createCategory(
  data: { name: string; description?: string },
  staffId: string
) {
  const exists = await prisma.inventoryCategory.findUnique({ where: { name: data.name } })
  if (exists) throw new AppError(409, 'Category already exists', 'CONFLICT')

  return prisma.inventoryCategory.create({ data })
}

// ─── Items ────────────────────────────────────────────────────────────────────

export async function getAllItems(filters?: { status?: ItemStatus; categoryId?: string }) {
  return prisma.inventoryItem.findMany({
    where: {
      ...(filters?.status && { status: filters.status }),
      ...(filters?.categoryId && { categoryId: filters.categoryId }),
    },
    include: { category: true },
    orderBy: { name: 'asc' },
  })
}

export async function getItemById(id: string) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      category: true,
      stockMovements: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })
  if (!item) throw new AppError(404, 'Inventory item not found', 'NOT_FOUND')
  return item
}

export async function createItem(
  data: {
    name: string
    categoryId: string
    unit: string
    quantity?: number
    reorderLevel?: number
    description?: string
  },
  staffId: string
) {
  const category = await prisma.inventoryCategory.findUnique({ where: { id: data.categoryId } })
  if (!category) throw new AppError(404, 'Category not found', 'NOT_FOUND')

  const qty = data.quantity ?? 0
  const reorder = data.reorderLevel ?? 0
  const status = resolveItemStatus(qty, reorder)

  const item = await prisma.inventoryItem.create({
    data: {
      name: data.name,
      categoryId: data.categoryId,
      unit: data.unit,
      quantity: qty,
      reorderLevel: reorder,
      status,
      description: data.description,
    },
    include: { category: true },
  })

  await logActivity({
    actionType: 'ITEM_USAGE_RECORDED',
    entityType: 'INVENTORY_ITEM',
    entityId: item.id,
    staffId,
    metadata: { name: item.name, quantity: qty },
  })

  return item
}

export async function updateItem(
  id: string,
  data: {
    name?: string
    unit?: string
    reorderLevel?: number
    description?: string
    categoryId?: string
  },
  staffId: string
) {
  const item = await prisma.inventoryItem.findUnique({ where: { id } })
  if (!item) throw new AppError(404, 'Inventory item not found', 'NOT_FOUND')

  const reorder = data.reorderLevel ?? Number(item.reorderLevel)
  const status = resolveItemStatus(Number(item.quantity), reorder)

  return prisma.inventoryItem.update({
    where: { id },
    data: { ...data, reorderLevel: reorder, status },
    include: { category: true },
  })
}

export async function getLowStockItems() {
  return prisma.inventoryItem.findMany({
    where: { status: { in: ['LOW_STOCK', 'OUT_OF_STOCK'] } },
    include: { category: true },
    orderBy: { quantity: 'asc' },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function resolveItemStatus(quantity: number, reorderLevel: number): ItemStatus {
  if (quantity <= 0) return 'OUT_OF_STOCK'
  if (quantity <= reorderLevel) return 'LOW_STOCK'
  return 'OK'
}