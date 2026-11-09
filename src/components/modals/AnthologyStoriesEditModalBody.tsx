'use client'

import { fetchAnthologyStoriesAction, saveAnthologyStoriesAction } from '@/app/actions/anthologyStoryActions'
import { useLibraryItemModal, type UnsavedChangesLeaveHandle } from '@/components/modals/LibraryItemModal'
import Btn from '@/components/ui/Btn'
import Checkbox from '@/components/ui/Checkbox'
import Dropdown, { type DropdownItem } from '@/components/ui/Dropdown'
import IconBtn from '@/components/ui/IconBtn'
import InputDropdown from '@/components/ui/InputDropdown'
import LoadingIndicator from '@/components/ui/LoadingIndicator'
import TextInput from '@/components/ui/TextInput'
import ConfirmDialog from '@/components/widgets/ConfirmDialog'
import { useLibrary } from '@/contexts/LibraryContext'
import { useGlobalToast } from '@/contexts/ToastContext'
import { useTypeSafeTranslations } from '@/hooks/useTypeSafeTranslations'
import { secondsToTimestamp } from '@/lib/datefns'
import { isBookMediaWithTracks, type AnthologyStory, type AnthologyStoryInput, type BookLibraryItem, type Chapter } from '@/types/api'
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, useTransition, type Ref } from 'react'

/** Chapter boundaries and stored story times come from separate probes, so match loosely. */
const TIME_TOLERANCE = 0.5
const CUSTOM_TIME = 'custom'

interface StoryDraft {
  /** Stable React key; stories have no id until saved, and saving replaces them all. */
  key: string
  title: string
  startTime: number
  endTime: number
  seriesName: string
  sequence: string
}

interface AnthologyStoriesEditModalBodyProps {
  /** Lets the parent intercept leave (section change, hub back, close) while stories are dirty. */
  closeRequestRef?: Ref<UnsavedChangesLeaveHandle | null>
}

let draftKeyCounter = 0
const nextDraftKey = () => `story-${++draftKeyCounter}`

function toDraft(story: AnthologyStory): StoryDraft {
  return {
    key: nextDraftKey(),
    title: story.title,
    startTime: story.startTime,
    endTime: story.endTime,
    seriesName: story.series?.name ?? '',
    sequence: story.sequence ?? ''
  }
}

function toInput(draft: StoryDraft): AnthologyStoryInput {
  return {
    title: draft.title.trim(),
    startTime: draft.startTime,
    endTime: draft.endTime,
    seriesName: draft.seriesName.trim(),
    sequence: draft.sequence.trim()
  }
}

const serialize = (drafts: StoryDraft[]) => JSON.stringify(drafts.map(toInput))

const findStartChapter = (chapters: Chapter[], time: number) => chapters.findIndex((c) => Math.abs(c.start - time) <= TIME_TOLERANCE)
const findEndChapter = (chapters: Chapter[], time: number) => chapters.findIndex((c) => Math.abs(c.end - time) <= TIME_TOLERANCE)

interface StoryRowProps {
  draft: StoryDraft
  chapters: Chapter[]
  seriesNames: string[]
  onChange: (key: string, patch: Partial<StoryDraft>) => void
  onRemove: (key: string) => void
}

function StoryRow({ draft, chapters, seriesNames, onChange, onRemove }: StoryRowProps) {
  const t = useTypeSafeTranslations()

  const startIndex = findStartChapter(chapters, draft.startTime)
  const endIndex = findEndChapter(chapters, draft.endTime)

  // Times that no longer fall on a chapter boundary (the chapters were edited
  // after the story was marked) are kept, and shown as such, until changed
  const startItems = useMemo<DropdownItem[]>(() => {
    const items: DropdownItem[] = chapters.map((chapter, index) => ({ text: chapter.title, subtext: secondsToTimestamp(chapter.start), value: index }))
    if (startIndex < 0) items.unshift({ text: t('LabelCustomTime', { 0: secondsToTimestamp(draft.startTime) }), value: CUSTOM_TIME })
    return items
  }, [chapters, draft.startTime, startIndex, t])

  const endItems = useMemo<DropdownItem[]>(() => {
    const items: DropdownItem[] = chapters
      .map((chapter, index) => ({ text: chapter.title, subtext: secondsToTimestamp(chapter.end), value: index }))
      .filter((item) => startIndex < 0 || (item.value as number) >= startIndex)
    if (endIndex < 0) items.unshift({ text: t('LabelCustomTime', { 0: secondsToTimestamp(draft.endTime) }), value: CUSTOM_TIME })
    return items
  }, [chapters, draft.endTime, endIndex, startIndex, t])

  const handleStartChange = useCallback(
    (value: string | number) => {
      if (value === CUSTOM_TIME) return
      const chapter = chapters[Number(value)]
      if (!chapter) return
      const patch: Partial<StoryDraft> = { startTime: chapter.start }
      // Keep the range valid: a start past the current end pulls the end along
      if (draft.endTime <= chapter.start + TIME_TOLERANCE) patch.endTime = chapter.end
      // A title still named after its first chapter follows it; one the user typed is kept
      const previousChapterTitle = chapters[startIndex]?.title
      if (!draft.title.trim() || draft.title === previousChapterTitle) patch.title = chapter.title
      onChange(draft.key, patch)
    },
    [chapters, draft.endTime, draft.key, draft.title, onChange, startIndex]
  )

  const handleEndChange = useCallback(
    (value: string | number) => {
      if (value === CUSTOM_TIME) return
      const chapter = chapters[Number(value)]
      if (chapter) onChange(draft.key, { endTime: chapter.end })
    },
    [chapters, draft.key, onChange]
  )

  return (
    <div className="border-border mb-3 rounded-md border p-3">
      <div className="-mx-1 flex items-end">
        <div className="mb-2 min-w-0 grow px-1">
          <TextInput label={t('LabelTitle')} value={draft.title} onChange={(value) => onChange(draft.key, { title: value })} />
        </div>
        <div className="mb-2 shrink-0 px-1">
          <IconBtn size="small" borderless ariaLabel={t('ButtonRemove')} onClick={() => onRemove(draft.key)}>
            delete
          </IconBtn>
        </div>
      </div>
      <div className="-mx-1 flex flex-wrap">
        <div className="mb-2 w-full px-1 sm:w-1/2">
          <Dropdown
            label={t('LabelFirstChapter')}
            items={startItems}
            value={startIndex < 0 ? CUSTOM_TIME : startIndex}
            onChange={handleStartChange}
            usePortal
          />
        </div>
        <div className="mb-2 w-full px-1 sm:w-1/2">
          <Dropdown label={t('LabelLastChapter')} items={endItems} value={endIndex < 0 ? CUSTOM_TIME : endIndex} onChange={handleEndChange} usePortal />
        </div>
      </div>
      <div className="-mx-1 flex flex-wrap">
        <div className="mb-1 w-full px-1 sm:w-2/3">
          <InputDropdown
            label={t('LabelSeries')}
            value={draft.seriesName}
            items={seriesNames}
            allowEmpty
            onChange={(value) => onChange(draft.key, { seriesName: String(value) })}
          />
        </div>
        <div className="mb-1 w-full px-1 sm:w-1/3">
          <TextInput label={t('LabelSequence')} value={draft.sequence} onChange={(value) => onChange(draft.key, { sequence: value })} />
        </div>
      </div>
    </div>
  )
}

interface AnthologyStoriesEditContentProps {
  libraryItem: BookLibraryItem
  closeRequestRef?: Ref<UnsavedChangesLeaveHandle | null>
}

function AnthologyStoriesEditContent({ libraryItem, closeRequestRef }: AnthologyStoriesEditContentProps) {
  const t = useTypeSafeTranslations()
  const { showToast } = useGlobalToast()
  const { filterData, refetchFilterDataSilently } = useLibrary()

  const chapters = useMemo<Chapter[]>(() => libraryItem.media.chapters ?? [], [libraryItem.media.chapters])
  const seriesNames = useMemo(() => (filterData?.series ?? []).map((series) => series.name), [filterData?.series])

  const [loaded, setLoaded] = useState(false)
  const [drafts, setDrafts] = useState<StoryDraft[]>([])
  const [baseline, setBaseline] = useState('[]')
  const [isAnthology, setIsAnthology] = useState(false)
  const [isSaving, startSaveTransition] = useTransition()

  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const pendingLeaveRef = useRef<(() => void) | null>(null)

  const applyStories = useCallback((stories: AnthologyStory[]) => {
    const next = stories.map(toDraft)
    setDrafts(next)
    setBaseline(serialize(next))
    setIsAnthology(next.length > 0)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchAnthologyStoriesAction(libraryItem.id)
      .then((data) => {
        if (!cancelled) applyStories(data.stories ?? [])
      })
      .catch((error) => {
        console.error('Failed to load anthology stories', error)
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [applyStories, libraryItem.id])

  const hasChanges = loaded && serialize(drafts) !== baseline

  const handleDraftChange = useCallback((key: string, patch: Partial<StoryDraft>) => {
    setDrafts((prev) => prev.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)))
  }, [])

  const handleRemove = useCallback((key: string) => {
    setDrafts((prev) => prev.filter((draft) => draft.key !== key))
  }, [])

  const handleAddStory = useCallback(() => {
    setDrafts((prev) => {
      // Start where the last story left off, which is how anthologies run
      const last = prev[prev.length - 1]
      const lastEndIndex = last ? findEndChapter(chapters, last.endTime) : -1
      const chapter = chapters[lastEndIndex + 1] ?? chapters[0]
      if (!chapter) return prev
      return [
        ...prev,
        {
          key: nextDraftKey(),
          title: chapter.title,
          startTime: chapter.start,
          endTime: chapter.end,
          seriesName: last?.seriesName ?? '',
          sequence: ''
        }
      ]
    })
  }, [chapters])

  const handleAnthologyToggle = useCallback(
    (value: boolean) => {
      setIsAnthology(value)
      if (!value) {
        setDrafts([])
      } else if (!drafts.length) {
        handleAddStory()
      }
    },
    [drafts.length, handleAddStory]
  )

  const handleSave = useCallback(
    (onSaved?: () => void) => {
      const missingTitle = drafts.some((draft) => !draft.title.trim())
      if (missingTitle) {
        showToast(t('ToastTitleRequired'), { type: 'error' })
        return
      }

      startSaveTransition(async () => {
        try {
          const result = await saveAnthologyStoriesAction(libraryItem.id, drafts.map(toInput))
          if ('error' in result) {
            showToast(result.error, { type: 'error' })
            return
          }
          applyStories(result.stories)
          // A story can name a new series; pick it up for the series lists
          refetchFilterDataSilently()
          showToast(t('ToastStoriesSaved'), { type: 'success' })
          onSaved?.()
        } catch (error) {
          console.error('Failed to save anthology stories', error)
          showToast(t('ToastStoriesSaveFailed'), { type: 'error' })
        }
      })
    },
    [applyStories, drafts, libraryItem.id, refetchFilterDataSilently, showToast, t]
  )

  const requestLeave = useCallback(
    (onAllow: () => void) => {
      if (hasChanges) {
        pendingLeaveRef.current = onAllow
        setShowCloseConfirm(true)
        return
      }
      onAllow()
    },
    [hasChanges]
  )

  useImperativeHandle(closeRequestRef, () => ({ requestLeave }), [requestLeave])

  const handleCancelLeave = useCallback(() => {
    pendingLeaveRef.current = null
    setShowCloseConfirm(false)
  }, [])

  const handleDiscardAndLeave = useCallback(() => {
    const onAllow = pendingLeaveRef.current
    pendingLeaveRef.current = null
    setShowCloseConfirm(false)
    onAllow?.()
  }, [])

  const handleSaveAndLeave = useCallback(() => {
    const onAllow = pendingLeaveRef.current
    handleSave(() => {
      pendingLeaveRef.current = null
      setShowCloseConfirm(false)
      onAllow?.()
    })
  }, [handleSave])

  if (!loaded) {
    return (
      <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center">
        <LoadingIndicator variant="inline" />
      </div>
    )
  }

  const hasChapters = chapters.length > 0

  return (
    <>
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg" aria-busy={isSaving || undefined}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4" inert={isSaving || undefined}>
          <Checkbox value={isAnthology} label={t('LabelBookIsAnthology')} onChange={handleAnthologyToggle} disabled={!hasChapters && !drafts.length} />
          <p className="text-foreground-muted mt-2 mb-4 text-sm">{t('MessageAnthologyStoriesHelp')}</p>

          {!hasChapters && <p className="text-warning mb-4 text-sm">{t('MessageAnthologyNeedsChapters')}</p>}

          {isAnthology && (
            <>
              {drafts.map((draft) => (
                <StoryRow key={draft.key} draft={draft} chapters={chapters} seriesNames={seriesNames} onChange={handleDraftChange} onRemove={handleRemove} />
              ))}
              {hasChapters && (
                <div>
                  <Btn size="small" onClick={handleAddStory}>
                    {t('ButtonAddStory')}
                  </Btn>
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-bg border-border flex shrink-0 justify-end gap-3 border-t px-4 py-3">
          <Btn size="small" disabled={!hasChanges || isSaving} onClick={() => applyStories(JSON.parse(baseline).map(fromInput))}>
            {t('ButtonDiscardChanges')}
          </Btn>
          <Btn color="bg-success text-success-foreground" size="small" loading={isSaving} disabled={!hasChanges || isSaving} onClick={() => handleSave()}>
            {t('ButtonSave')}
          </Btn>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showCloseConfirm}
        message={t('MessageConfirmCloseStoriesWithChanges')}
        altButtonText={t('ButtonDiscard')}
        yesButtonText={t('ButtonSave')}
        processing={isSaving}
        onClose={handleCancelLeave}
        onAlt={handleDiscardAndLeave}
        onConfirm={handleSaveAndLeave}
      />
    </>
  )
}

/** Rebuild a story from its saved form, for discarding edits back to the baseline. */
function fromInput(input: AnthologyStoryInput): AnthologyStory {
  return {
    id: '',
    bookId: '',
    title: input.title,
    startTime: input.startTime,
    endTime: input.endTime,
    sequence: input.sequence,
    series: input.seriesName ? { id: '', name: input.seriesName } : null
  }
}

/**
 * Marks a book as an anthology and places its stories in series. Each story
 * is a range of chapters with its own series position, so Tales From The
 * Folly can hold one story at Rivers of London 2.5 and another at 4.5.
 */
export function AnthologyStoriesEditModalBody({ closeRequestRef }: AnthologyStoriesEditModalBodyProps) {
  const { resolvedItem, fetchPending } = useLibraryItemModal()
  const bookItem = resolvedItem?.mediaType === 'book' && isBookMediaWithTracks(resolvedItem.media) ? (resolvedItem as BookLibraryItem) : null

  if (fetchPending && !resolvedItem) {
    return (
      <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center">
        <LoadingIndicator variant="inline" />
      </div>
    )
  }

  if (!bookItem) return null

  return <AnthologyStoriesEditContent key={bookItem.id} libraryItem={bookItem} closeRequestRef={closeRequestRef} />
}
