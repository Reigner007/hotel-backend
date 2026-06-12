import 'dotenv/config'
import app from './app'
import prisma from './shared/db/prisma'

const PORT = process.env.PORT ?? 3000

async function main() {
  await prisma.$connect()
  console.log('✅ Database connected')

  app.listen(PORT, () => {
    console.log(`🚀 Hotel backend running → http://localhost:${PORT}`)
    console.log(`📖 Swagger docs        → http://localhost:${PORT}/api/docs`)
    console.log(`📄 Swagger JSON spec   → http://localhost:${PORT}/api/docs.json`)
    console.log(`🌍 Environment: ${process.env.NODE_ENV ?? 'development'}`)
  })
}

main().catch((err) => {
  console.error('❌ Failed to start server:', err)
  process.exit(1)
})

process.on('SIGINT', async () => {
  await prisma.$disconnect()
  console.log('🛑 Server stopped')
  process.exit(0)
})