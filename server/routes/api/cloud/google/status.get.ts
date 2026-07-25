import { isGoogleDriveConnected } from '~~/server/cloud/google-connection'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  return { connected: isGoogleDriveConnected() }
})
