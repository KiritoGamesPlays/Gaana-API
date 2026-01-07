/**
 * @fileoverview Crypto utilities for decrypting Gaana media URLs.
 * Uses AES-CBC decryption to extract HLS stream paths.
 * @module utils/crypto
 */

import { createDecipheriv } from 'crypto'

/**
 * AES decryption key and IV for Gaana stream URLs
 */
const KEY = Buffer.from('gy1t#b@jl(b$wtme', 'utf8')
const IV = Buffer.from('xC4dmVJAq14BfntX', 'utf8')

/**
 * Base URL for Gaana HLS streams
 */
const HLS_BASE_URL = 'https://vodhlsgaana-ebw.akamaized.net/'

/**
 * Decrypt an encrypted Gaana stream path
 * @param encryptedData - Encrypted stream path from the API
 * @returns Decrypted full stream URL or empty string on failure
 */
export function decryptStreamPath(encryptedData: string): string {
  try {
    // Extract offset from first character
    const offset = parseInt(encryptedData[0], 10)
    if (isNaN(offset)) {
      console.warn('Invalid offset in encrypted data')
      return ''
    }

    // Extract ciphertext (skip offset + 16 characters)
    const ciphertextB64 = encryptedData.substring(offset + 16)

    // Add padding and decode base64
    const ciphertext = Buffer.from(ciphertextB64 + '==', 'base64')

    // AES-128-CBC decryption
    const decipher = createDecipheriv('aes-128-cbc', KEY, IV)
    decipher.setAutoPadding(false)

    let decrypted = decipher.update(ciphertext)
    decrypted = Buffer.concat([decrypted, decipher.final()])

    // Clean up the decrypted text - remove null bytes and non-printable characters
    let rawText = decrypted.toString('utf8').replace(/\0/g, '').trim()
    rawText = rawText
      .split('')
      .filter((c) => {
        const code = c.charCodeAt(0)
        return code >= 32 && code <= 126
      })
      .join('')

    // Extract HLS path
    if (rawText.includes('/hls/')) {
      const pathStart = rawText.indexOf('hls/')
      const cleanPath = rawText.substring(pathStart)
      return HLS_BASE_URL + cleanPath
    }

    console.warn('No /hls/ path found in decrypted text')
    return ''
  } catch (error) {
    console.warn('Failed to decrypt stream path:', error instanceof Error ? error.message : 'Unknown error')
    return ''
  }
}

/**
 * Media URL object with quality information
 */
export interface MediaUrl {
  quality: string
  bitRate: string
  url: string
  format: string
}

/**
 * Fetch stream URL from Gaana API
 * @param trackId - Track ID to get stream URL for
 * @param quality - Audio quality (low, medium, high)
 * @returns Promise with media URL info or null
 */
export async function fetchStreamUrl(
  trackId: string,
  quality: 'low' | 'medium' | 'high' = 'high'
): Promise<MediaUrl | null> {
  try {
    const url = 'https://gaana.com/api/stream-url'
    const body = new URLSearchParams({
      quality,
      track_id: trackId,
      stream_format: 'mp4'
    })

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json, text/plain, */*',
        Origin: 'https://gaana.com',
        Referer: 'https://gaana.com/'
      },
      body: body.toString()
    })

    const data = (await res.json()) as {
      api_status?: string
      data?: {
        stream_path?: string
        bit_rate?: string
        track_format?: string
      }
    }

    if (data.api_status === 'success' && data.data?.stream_path) {
      const decryptedUrl = decryptStreamPath(data.data.stream_path)

      if (decryptedUrl) {
        return {
          quality,
          bitRate: data.data.bit_rate || '',
          url: decryptedUrl,
          format: data.data.track_format || 'mp4'
        }
      }
    }

    return null
  } catch (error) {
    console.warn('Failed to fetch stream URL:', error instanceof Error ? error.message : 'Unknown error')
    return null
  }
}

/**
 * Get all available stream URLs for a track
 * @param trackId - Track ID
 * @returns Promise with array of media URLs for different qualities
 */
export async function getMediaUrls(trackId: string): Promise<MediaUrl[]> {
  const qualities: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low']
  const results: MediaUrl[] = []

  // Try high quality first, if it works, that's enough
  const highQuality = await fetchStreamUrl(trackId, 'high')
  if (highQuality) {
    results.push(highQuality)
  }

  return results
}
