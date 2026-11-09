'use server'

import * as api from '@/lib/api'
import { ApiError } from '@/lib/apiErrors'
import type { AnthologyStoriesResponse, AnthologyStoryInput, SeriesReadingOrderResponse } from '@/types/api'

/** The stories in an anthology book, in playback order. Empty for a book that is not an anthology. */
export async function fetchAnthologyStoriesAction(libraryItemId: string): Promise<AnthologyStoriesResponse> {
  return api.apiRequest<AnthologyStoriesResponse>(`/api/items/${libraryItemId}/stories`)
}

/**
 * Replace a book's stories. An empty list stops the book being an anthology.
 * Series are matched by name, and created when new.
 *
 * A rejected list (overlapping stories, a missing title) comes back as
 * `error` rather than a throw: production builds replace the message of an
 * error thrown from a server action, and the server's reason is the useful part.
 */
export async function saveAnthologyStoriesAction(libraryItemId: string, stories: AnthologyStoryInput[]): Promise<AnthologyStoriesResponse | { error: string }> {
  try {
    return await api.apiRequest<AnthologyStoriesResponse>(`/api/items/${libraryItemId}/stories`, {
      method: 'PATCH',
      body: JSON.stringify({ stories })
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) return { error: error.message }
    throw error
  }
}

/** A series' books, anthology stories and missing-book placeholders, merged in reading order. */
export async function fetchSeriesReadingOrderAction(seriesId: string): Promise<SeriesReadingOrderResponse> {
  return api.apiRequest<SeriesReadingOrderResponse>(`/api/series/${seriesId}/reading-order`)
}
