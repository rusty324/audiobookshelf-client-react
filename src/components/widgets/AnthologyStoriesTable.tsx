'use client'

import { fetchAnthologyStoriesAction } from '@/app/actions/anthologyStoryActions'
import IconBtn from '@/components/ui/IconBtn'
import SimpleDataTable from '@/components/ui/SimpleDataTable'
import Tooltip from '@/components/ui/Tooltip'
import CollapsibleSection from '@/components/widgets/CollapsibleSection'
import { useUser } from '@/contexts/UserContext'
import { useTypeSafeTranslations } from '@/hooks/useTypeSafeTranslations'
import { secondsToTimestamp } from '@/lib/datefns'
import type { AnthologyStory } from '@/types/api'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

interface AnthologyStoriesTableProps {
  libraryId: string
  libraryItemId: string
  /** Bumped by the parent when the stories may have changed, to reload them. */
  reloadKey?: number
  onEditStories?: () => void
  onGoToTimestamp?: (time: number) => void
}

/**
 * The stories in an anthology and where each sits in its series. Renders
 * nothing for a book that is not an anthology: marking one is done from the
 * edit modal, so an empty table would only be clutter on every book page.
 */
export default function AnthologyStoriesTable({ libraryId, libraryItemId, reloadKey = 0, onEditStories, onGoToTimestamp }: AnthologyStoriesTableProps) {
  const t = useTypeSafeTranslations()
  const { userCanUpdate } = useUser()
  const [stories, setStories] = useState<AnthologyStory[]>([])
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchAnthologyStoriesAction(libraryItemId)
      .then((data) => {
        if (!cancelled) setStories(data.stories ?? [])
      })
      .catch((error) => {
        console.error('Failed to load anthology stories', error)
      })
    return () => {
      cancelled = true
    }
  }, [libraryItemId, reloadKey])

  const columns = useMemo(
    () => [
      {
        label: t('LabelSeries'),
        headerClassName: 'w-1/3 px-2 text-start md:px-4',
        cellClassName: 'w-1/3 px-2 md:px-4',
        accessor: (row: AnthologyStory) =>
          row.series ? (
            <Link href={`/library/${libraryId}/series/${row.series.id}`} className="link-underline wrap-break-word">
              {row.series.name}
              {row.sequence && <span className="text-foreground-muted"> #{row.sequence}</span>}
            </Link>
          ) : (
            <span className="text-foreground-muted">-</span>
          )
      },
      {
        label: t('LabelTitle'),
        headerClassName: 'min-w-0 px-2 text-start md:px-4',
        cellClassName: 'max-w-0 min-w-0 px-2 md:px-4',
        accessor: (row: AnthologyStory) => <span className="wrap-break-word">{row.title}</span>
      },
      {
        label: t('LabelStart'),
        headerClassName: 'w-20 min-w-20 px-2 text-center md:w-24 md:min-w-24',
        cellClassName: 'w-20 min-w-20 px-2 text-center md:w-24 md:min-w-24',
        accessor: (row: AnthologyStory) => {
          const startTimestamp = secondsToTimestamp(row.startTime)
          return onGoToTimestamp ? (
            <button
              type="button"
              className="link-underline cursor-pointer bg-transparent p-0 font-mono"
              onClick={(e) => {
                e.stopPropagation()
                onGoToTimestamp(row.startTime)
              }}
              aria-label={t('LabelGoToTimestamp', { 0: startTimestamp })}
            >
              {startTimestamp}
            </button>
          ) : (
            <div className="text-center font-mono">{startTimestamp}</div>
          )
        }
      },
      {
        label: t('LabelDuration'),
        headerClassName: 'w-24 min-w-24 px-2 pe-3 text-center',
        cellClassName: 'w-24 min-w-24 px-2 pe-3 text-center font-mono',
        accessor: (row: AnthologyStory) => secondsToTimestamp(Math.max(0, row.endTime - row.startTime))
      }
    ],
    [libraryId, onGoToTimestamp, t]
  )

  const headerActions = useMemo(
    () =>
      userCanUpdate && onEditStories ? (
        <Tooltip text={t('ButtonEditStories')} position="top">
          <span className="me-2 inline-flex">
            <IconBtn
              size="small"
              ariaLabel={t('ButtonEditStories')}
              onClick={(e) => {
                e.stopPropagation()
                onEditStories()
              }}
            >
              edit
            </IconBtn>
          </span>
        </Tooltip>
      ) : null,
    [onEditStories, t, userCanUpdate]
  )

  if (!stories.length) return null

  return (
    <CollapsibleSection title={t('HeaderStories')} count={stories.length} expanded={expanded} onExpandedChange={setExpanded} headerActions={headerActions}>
      <SimpleDataTable data={stories} columns={columns} getRowKey={(row) => row.id} tableClassName="table-fixed" />
    </CollapsibleSection>
  )
}
