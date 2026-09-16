'use client'

import { recordPlaybackEventsAction } from '@/app/actions/playbackActions'
import type { PlaybackEventSubmission } from '@/types/api'
import { useCallback, useEffect, useRef } from 'react'

/** How often buffered events are flushed while playing. */
const FLUSH_INTERVAL_MS = 15000

/** Upper bound on the buffer so repeated flush failures cannot grow it without limit. */
const MAX_BUFFERED_EVENTS = 100

interface UsePlaybackEventLogOptions {
  /** Returns the open playback session id, or null when there is none. */
  getSessionId: () => string | null
}

export interface UsePlaybackEventLogReturn {
  /** Buffer an event. Flushed on a timer, on pause, and when the player closes. */
  queueEvent: (eventType: PlaybackEventSubmission['eventType'], currentTime: number, fromTime?: number | null) => void
  /** Send anything buffered. Safe to call when the buffer is empty. */
  flushEvents: () => void
  startFlushInterval: () => void
  stopFlushInterval: () => void
  /** Drop buffered events without sending, for teardown. */
  resetEvents: () => void
}

/**
 * Buffers playback actions for the per-item listening log.
 *
 * Events are batched rather than sent individually so that scrubbing costs one
 * request instead of one per tick. The log is supplementary, so a failed flush
 * is logged and swallowed rather than surfaced or retried aggressively.
 */
export function usePlaybackEventLog({ getSessionId }: UsePlaybackEventLogOptions): UsePlaybackEventLogReturn {
  const bufferRef = useRef<PlaybackEventSubmission[]>([])
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const flushEvents = useCallback(() => {
    const sessionId = getSessionId()
    if (!sessionId || !bufferRef.current.length) return

    const events = bufferRef.current
    bufferRef.current = []

    void recordPlaybackEventsAction(sessionId, events).catch((error) => {
      console.error('[usePlaybackEventLog] Failed to send playback events', error)
    })
  }, [getSessionId])

  const queueEvent = useCallback(
    (eventType: PlaybackEventSubmission['eventType'], currentTime: number, fromTime: number | null = null) => {
      if (!getSessionId() || !Number.isFinite(currentTime)) return

      bufferRef.current.push({
        eventType,
        currentTime,
        fromTime: Number.isFinite(fromTime) ? fromTime : null,
        createdAt: Date.now()
      })

      if (bufferRef.current.length > MAX_BUFFERED_EVENTS) {
        bufferRef.current = bufferRef.current.slice(-MAX_BUFFERED_EVENTS)
      }
    },
    [getSessionId]
  )

  const stopFlushInterval = useCallback(() => {
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current)
      flushTimerRef.current = null
    }
  }, [])

  const startFlushInterval = useCallback(() => {
    stopFlushInterval()
    flushTimerRef.current = setInterval(() => {
      flushEvents()
    }, FLUSH_INTERVAL_MS)
  }, [flushEvents, stopFlushInterval])

  const resetEvents = useCallback(() => {
    stopFlushInterval()
    bufferRef.current = []
  }, [stopFlushInterval])

  // Never leave a timer running behind an unmounted player
  useEffect(() => stopFlushInterval, [stopFlushInterval])

  return { queueEvent, flushEvents, startFlushInterval, stopFlushInterval, resetEvents }
}
