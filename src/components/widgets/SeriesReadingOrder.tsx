'use client'

import { fetchSeriesReadingOrderAction } from '@/app/actions/anthologyStoryActions'
import { useTypeSafeTranslations } from '@/hooks/useTypeSafeTranslations'
import { secondsToTimestamp } from '@/lib/datefns'
import { mergeClasses } from '@/lib/merge-classes'
import type { SeriesReadingOrderEntry } from '@/types/api'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface SeriesReadingOrderProps {
  libraryId: string
  seriesId: string
  /** Bumped by the parent when the series' entries may have changed, to reload them. */
  reloadKey?: number
}

const entryKey = (entry: SeriesReadingOrderEntry) => (entry.type === 'book' ? `book-${entry.libraryItemId}` : `${entry.type}-${entry.id}`)

const entryIcon: Record<SeriesReadingOrderEntry['type'], string> = {
  book: 'book',
  story: 'auto_stories',
  placeholder: 'help_outline'
}

/**
 * The series in reading order, with anthology stories at their own positions
 * between the books.
 *
 * Shown only when the series has stories: the book grid above already shows
 * books in order, and the grid cannot hold stories, since its shelves are
 * virtualized and stories are not library items.
 */
export default function SeriesReadingOrder({ libraryId, seriesId, reloadKey = 0 }: SeriesReadingOrderProps) {
  const t = useTypeSafeTranslations()
  const [entries, setEntries] = useState<SeriesReadingOrderEntry[]>([])
  const [hasStories, setHasStories] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchSeriesReadingOrderAction(seriesId)
      .then((data) => {
        if (cancelled) return
        setEntries(data.entries ?? [])
        setHasStories(!!data.hasStories)
      })
      .catch((error) => {
        console.error('Failed to load series reading order', error)
      })
    return () => {
      cancelled = true
    }
  }, [seriesId, reloadKey])

  if (!hasStories) return null

  return (
    <div className="w-full px-4 pt-8 sm:px-8">
      <div className="mb-4 flex items-center">
        <p className="text-lg font-semibold">{t('HeaderReadingOrder')}</p>
        <p className="ps-3 text-sm text-gray-400">{entries.length}</p>
      </div>
      <p className="mb-4 text-sm text-gray-400">{t('MessageReadingOrderHelp')}</p>

      <ol>
        {entries.map((entry) => {
          const isPlaceholder = entry.type === 'placeholder'
          return (
            <li
              key={entryKey(entry)}
              className={mergeClasses(
                'mb-2 flex w-full items-center rounded border px-3 py-2',
                isPlaceholder ? 'border-dashed border-white/20 opacity-60' : 'border-white/10'
              )}
            >
              <div className="w-12 shrink-0 text-center">
                <p className="font-mono text-sm">{entry.sequence ? `#${entry.sequence}` : '-'}</p>
              </div>
              <span className="material-symbols shrink-0 px-1 text-lg text-gray-400" aria-hidden="true">
                {entryIcon[entry.type]}
              </span>
              <div className="min-w-0 grow px-2">
                {entry.type === 'book' && (
                  <Link href={`/library/${libraryId}/item/${entry.libraryItemId}`} className="link-underline block truncate">
                    {entry.title}
                  </Link>
                )}
                {entry.type === 'story' && (
                  <>
                    <Link href={`/library/${libraryId}/item/${entry.libraryItemId}`} className="link-underline block truncate">
                      {entry.title}
                    </Link>
                    <p className="truncate text-xs text-gray-400">{t('LabelStoryInBook', { 0: entry.bookTitle, 1: secondsToTimestamp(entry.startTime) })}</p>
                  </>
                )}
                {entry.type === 'placeholder' && (
                  <>
                    <p className="truncate">{entry.title}</p>
                    {entry.authorName && <p className="truncate text-xs text-gray-400">{entry.authorName}</p>}
                  </>
                )}
              </div>
              <p className="hidden shrink-0 px-2 text-xs tracking-wide text-gray-400 uppercase sm:block">
                {entry.type === 'story' ? t('LabelStory') : entry.type === 'placeholder' ? t('LabelNotInLibrary') : ''}
              </p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
