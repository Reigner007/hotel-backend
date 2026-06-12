// @ts-nocheck
import { defineConfig } from 'prisma/config'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '.env') })

const directUrl = process.env.DATABASE_URL!

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: directUrl,
  },
  migrate: {
    async adapter() {
      const { PrismaNeon } = await import('@prisma/adapter-neon')
      return new PrismaNeon({ connectionString: directUrl })
    },
    url: directUrl,
  },
})