import { ResultIntegrityTrustError, verifyRemoteResultIntegrity } from './client.js'

/**
 * Imported execution results are inspection objects, not remote responses.
 *
 * - unsigned imports remain inspectable as `unverified`;
 * - signed imports with no trust context remain `present-unverified`;
 * - a known trusted key with a bad signature is an integrity failure and throws;
 * - an unknown key may trigger one capability refresh, but inability to refresh
 *   does not make an offline archive invalid — it remains unverified.
 */
export async function classifyImportedExecutionIntegrity({ envelope, capabilities, refreshCapabilities }) {
  if (!envelope?.integrity) return 'unverified'
  if (!capabilities) return 'present-unverified'

  try {
    await verifyRemoteResultIntegrity(envelope, capabilities)
    return 'verified'
  } catch (error) {
    if (!(error instanceof ResultIntegrityTrustError)) throw error
  }

  if (typeof refreshCapabilities !== 'function') return 'present-unverified'

  let refreshed
  try {
    refreshed = await refreshCapabilities()
  } catch {
    return 'present-unverified'
  }

  try {
    await verifyRemoteResultIntegrity(envelope, refreshed)
    return 'verified'
  } catch (error) {
    if (error instanceof ResultIntegrityTrustError) return 'present-unverified'
    throw error
  }
}
