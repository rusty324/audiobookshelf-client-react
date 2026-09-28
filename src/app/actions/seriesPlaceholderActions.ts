'use server'

import * as api from '@/lib/api'
import type {
  SeriesPlaceholder,
  SeriesPlaceholderBulkResult,
  SeriesPlaceholderInput,
  SeriesPlaceholderSuggestionsResponse,
  SeriesPlaceholdersResponse
} from '@/types/api'

/**
 * Placeholders recorded for a series - books that belong to it but are not in
 * the library.
 *
 * Entries the library already covers are filtered out server side rather than
 * deleted, so a placeholder resolves itself once the real book is scanned in.
 */
export async function fetchSeriesPlaceholdersAction(seriesId: string): Promise<SeriesPlaceholdersResponse> {
  return api.apiRequest<SeriesPlaceholdersResponse>(`/api/series/${seriesId}/placeholders`)
}

export async function createSeriesPlaceholderAction(seriesId: string, payload: SeriesPlaceholderInput): Promise<SeriesPlaceholder> {
  return api.apiRequest<SeriesPlaceholder>(`/api/series/${seriesId}/placeholders`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export async function updateSeriesPlaceholderAction(seriesId: string, placeholderId: string, payload: SeriesPlaceholderInput): Promise<SeriesPlaceholder> {
  return api.apiRequest<SeriesPlaceholder>(`/api/series/${seriesId}/placeholders/${placeholderId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
}

export async function deleteSeriesPlaceholderAction(seriesId: string, placeholderId: string): Promise<void> {
  await api.apiRequest(`/api/series/${seriesId}/placeholders/${placeholderId}`, {
    method: 'DELETE'
  })
}

/**
 * Ask Hardcover what is in this series. Read-only: the data is third party and
 * imperfect, so nothing is written until the user picks from the result.
 */
export async function fetchSeriesPlaceholderSuggestionsAction(seriesId: string): Promise<SeriesPlaceholderSuggestionsResponse> {
  return api.apiRequest<SeriesPlaceholderSuggestionsResponse>(`/api/series/${seriesId}/placeholder-suggestions`)
}

/**
 * Add several placeholders at once. Entries the library already covers, and
 * duplicates, are skipped server side rather than failing the request.
 */
export async function createSeriesPlaceholdersBulkAction(seriesId: string, placeholders: SeriesPlaceholderInput[]): Promise<SeriesPlaceholderBulkResult> {
  return api.apiRequest<SeriesPlaceholderBulkResult>(`/api/series/${seriesId}/placeholders/bulk`, {
    method: 'POST',
    body: JSON.stringify({ placeholders })
  })
}

/**
 * Turn a placeholder into a real library item with no files behind it, so it
 * appears wherever books appear rather than only in the series panel.
 */
export async function promoteSeriesPlaceholderAction(seriesId: string, placeholderId: string): Promise<{ libraryItemId: string }> {
  return api.apiRequest<{ libraryItemId: string }>(`/api/series/${seriesId}/placeholders/${placeholderId}/promote`, {
    method: 'POST'
  })
}
