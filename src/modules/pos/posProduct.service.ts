import { ProductType } from '@prisma/client'
import prisma from '../../shared/db/prisma'
import { AppError } from '../../shared/middleware/errorHandler'

export async function getAllProducts(filters?: { type?: ProductType; isAvailable?: boolean }) {
  return prisma.posProduct.findMany({
    where: {
      ...(filters?.type && { type: filters.type }),
      ...(filters?.isAvailable !== undefined && { isAvailable: filters.isAvailable }),
    },
    include: { category: true, inventoryItem: true },
    orderBy: { name: 'asc' },
  })
}

export async function getProductById(id: string) {
  const product = await prisma.posProduct.findUnique({
    where: { id },
    include: { category: true, inventoryItem: true },
  })
  if (!product) throw new AppError(404, 'Product not found', 'NOT_FOUND')
  return product
}

export async function createProduct(data: {
  name: string
  type: ProductType
  price: number
  categoryId?: string
  linkedInventoryItemId?: string
  description?: string
}) {
  return prisma.posProduct.create({
    data: { ...data },
    include: { category: true, inventoryItem: true },
  })
}

export async function updateProduct(
  id: string,
  data: {
    name?: string
    price?: number
    categoryId?: string
    linkedInventoryItemId?: string
    description?: string
  }
) {
  const product = await prisma.posProduct.findUnique({ where: { id } })
  if (!product) throw new AppError(404, 'Product not found', 'NOT_FOUND')
  return prisma.posProduct.update({
    where: { id },
    data,
    include: { category: true, inventoryItem: true },
  })
}

export async function setAvailability(id: string, isAvailable: boolean) {
  const product = await prisma.posProduct.findUnique({ where: { id } })
  if (!product) throw new AppError(404, 'Product not found', 'NOT_FOUND')
  return prisma.posProduct.update({ where: { id }, data: { isAvailable } })
}