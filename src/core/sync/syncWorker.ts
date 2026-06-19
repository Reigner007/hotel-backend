import prisma from '../../shared/db/prisma'

const CLOUD_URL = process.env.CLOUD_SYNC_URL?.replace(/\/+$/, '')
const SYNC_SECRET = process.env.CLOUD_SYNC_SECRET
const HOTEL_ID = process.env.HOTEL_ID
const HOTEL_NAME = process.env.HOTEL_NAME
const SYNC_ENABLED = process.env.SYNC_ENABLED === 'true'

let intervalId: ReturnType<typeof setInterval> | null = null

async function registerHotel(): Promise<void> {
  if (!CLOUD_URL || !SYNC_SECRET || !HOTEL_ID) return
  try {
    const base = CLOUD_URL.replace('/sync', '')
    const res = await fetch(`${base}/hotels/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET },
      body: JSON.stringify({ hotelId: HOTEL_ID, name: HOTEL_NAME || HOTEL_ID }),
    })
    if (res.status === 201) {
      console.log(`[Sync] Hotel "${HOTEL_ID}" registered in cloud`)
    } else if (res.status === 409) {
      console.log(`[Sync] Hotel "${HOTEL_ID}" already registered`)
    } else {
      const body = await res.text()
      console.error(`[Sync] Hotel registration failed (${res.status}): ${body}`)
    }
  } catch (err) {
    console.error('[Sync] Hotel registration error:', err instanceof Error ? err.message : err)
  }
}

async function processOutbox(): Promise<void> {
  if (!CLOUD_URL || !SYNC_SECRET || !HOTEL_ID) return

  const entries = await prisma.syncOutbox.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 10,
  })

  for (const entry of entries) {
    const payload = { hotelId: HOTEL_ID, ...(entry.payload as Record<string, unknown>) }

    try {
      const res = await fetch(`${CLOUD_URL}/daily-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-secret': SYNC_SECRET,
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        await prisma.syncOutbox.update({
          where: { id: entry.id },
          data: { status: 'SENT', attempts: { increment: 1 }, lastAttempt: new Date(), sentAt: new Date() },
        })
      } else {
        const body = await res.text()
        console.error(`[Sync] Failed to send ${entry.id} (${res.status}): ${body}`)
        await prisma.syncOutbox.update({
          where: { id: entry.id },
          data: { status: 'FAILED', attempts: { increment: 1 }, lastAttempt: new Date() },
        })
      }
    } catch (err) {
      console.error(`[Sync] Network error sending ${entry.id}:`, err instanceof Error ? err.message : err)
    }
  }
}

export function startSyncWorker(): void {
  if (!SYNC_ENABLED) {
    console.log('[Sync] Disabled (SYNC_ENABLED=false)')
    return
  }
  if (!CLOUD_URL || !SYNC_SECRET || !HOTEL_ID) {
    console.warn('[Sync] Missing CLOUD_SYNC_URL, CLOUD_SYNC_SECRET, or HOTEL_ID — sync not started')
    return
  }

  console.log(`[Sync] Worker started → ${CLOUD_URL}`)

  registerHotel()
  processOutbox()

  intervalId = setInterval(() => {
    processOutbox()
  }, 60_000)
}

export function stopSyncWorker(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}
