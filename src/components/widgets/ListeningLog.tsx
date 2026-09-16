'use client'

import { fetchPlaybackEventsAction } from '@/app/actions/playbackActions'
import Btn from '@/components/ui/Btn'
import { useTypeSafeTranslations } from '@/hooks/useTypeSafeTranslations'
import { formatJsDate, secondsToTimestamp } from '@/lib/datefns'
import type { PlaybackEvent } from '@/types/api'
import type { TypeSafeTranslations } from '@/types/translations'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface ListeningLogProps {
  libraryItemId: string
  dateFormat?: string
}

const ITEMS_PER_PAGE = 25

function eventLabel(eventType: PlaybackEvent['eventType'], t: TypeSafeTranslations): string {
  switch (eventType) {
    case 'play':
      return t('LabelPlaybackEventPlay')
    case 'pause':
      return t('LabelPlaybackEventPause')
    case 'seek':
      return t('LabelPlaybackEventSeek')
    case 'chapterSkip':
      return t('LabelPlaybackEventChapterSkip')
    case 'finished':
      return t('LabelPlaybackEventFinished')
    default:
      return eventType
  }
}

export default function ListeningLog({ libraryItemId, dateFormat = 'MM/dd/yyyy' }: ListeningLogProps) {
  const t = useTypeSafeTranslations()
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [events, setEvents] = useState<PlaybackEvent[]>([])
  const [page, setPage] = useState(0)
  const [numPages, setNumPages] = useState(0)

  const loadEvents = useCallback(
    async (pageToLoad: number) => {
      if (!libraryItemId) return
      setLoading(true)
      try {
        const payload = await fetchPlaybackEventsAction(libraryItemId, pageToLoad, ITEMS_PER_PAGE)
        setEvents((prev) => (pageToLoad === 0 ? payload.events : [...prev, ...payload.events]))
        setPage(payload.page)
        setNumPages(payload.numPages)
      } catch (error) {
        // The log is supplementary: a failure should not disrupt the item page
        console.error('[ListeningLog] Failed to load playback events', error)
      } finally {
        setLoading(false)
      }
    },
    [libraryItemId]
  )

  useEffect(() => {
    loadEvents(0)
  }, [loadEvents])

  /** Events bucketed by day, the way a listening history reads. */
  const groupedEvents = useMemo(() => {
    const groups: { date: string; events: PlaybackEvent[] }[] = []
    for (const event of events) {
      const date = formatJsDate(new Date(event.createdAt), dateFormat)
      const existing = groups.find((group) => group.date === date)
      if (existing) existing.events.push(event)
      else groups.push({ date, events: [event] })
    }
    return groups
  }, [events, dateFormat])

  const hasMore = page + 1 < numPages

  if (!events.length && !loading) return null

  return (
    <div className="mt-4 w-full">
      <button type="button" className="flex cursor-pointer items-center" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <p className="text-sm font-semibold">{t('HeaderListeningLog')}</p>
        <span className={`material-symbols ml-1 text-lg transition-transform ${expanded ? 'rotate-180' : ''}`}>expand_more</span>
      </button>

      {expanded && (
        <div className="mt-2">
          {groupedEvents.map((group) => (
            <div key={group.date} className="mb-3">
              <p className="text-foreground/60 pb-1 text-xs font-semibold">{group.date}</p>

              {group.events.map((event) => (
                <div key={event.id} className="bg-primary/40 mb-1 flex items-center justify-between rounded-md px-3 py-2">
                  <div className="min-w-0 pr-2">
                    <p className="text-sm">{eventLabel(event.eventType, t)}</p>
                    {event.chapterTitle && <p className="text-foreground/60 truncate text-xs">{event.chapterTitle}</p>}
                    {event.fromTime !== null && (
                      <p className="text-foreground/50 text-xs">
                        {t('LabelPreviousPlace')}: {secondsToTimestamp(event.fromTime)}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm">{secondsToTimestamp(event.currentTime)}</p>
                    <p className="text-foreground/60 text-xs">{new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-1">
              <Btn disabled={loading} onClick={() => loadEvents(page + 1)}>
                {t('ButtonLoadMore')}
              </Btn>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
