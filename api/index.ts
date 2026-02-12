/**
 * @fileoverview Server entry point for Vercel serverless and local development.
 * Handles both Vercel serverless deployment and local development server setup.
 * @module api/index
 */

import { handle } from '@hono/node-server/vercel'
import { serve } from '@hono/node-server'
import app from '../src/index.js'

/**
 * Vercel API configuration.
 * Disables body parser as Hono handles request parsing internally.
 *
 * @constant
 */
export const config = {
  api: {
    bodyParser: false
  }
}

/**
 * Vercel serverless handler export.
 * Used for Vercel serverless function deployment.
 */
export default handle(app)

// Run local development server when not on Vercel
if (!process.env.VERCEL) {
  const port = parseInt('9005')
  serve(
    {
      fetch: app.fetch,
      port
    },
    (info) => {
      console.log(`🚀 Server running on http://localhost:${info.port}`)
      console.log(`📚 API Base: http://localhost:${info.port}/api`)
    }
  )
}
