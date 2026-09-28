'use client'

import {
  createSeriesPlaceholderAction,
  createSeriesPlaceholdersBulkAction,
  deleteSeriesPlaceholderAction,
  fetchSeriesPlaceholderSuggestionsAction,
  fetchSeriesPlaceholdersAction,
  promoteSeriesPlaceholderAction,
  updateSeriesPlaceholderAction
} from '@/app/actions/seriesPlaceholderActions'
import Btn from '@/components/ui/Btn'
import Checkbox from '@/components/ui/Checkbox'
import IconBtn from '@/components/ui/IconBtn'
import TextInput from '@/components/ui/TextInput'
import ConfirmDialog from '@/components/widgets/ConfirmDialog'
import { useGlobalToast } from '@/contexts/ToastContext'
import { useUser } from '@/contexts/UserContext'
import { useTypeSafeTranslations } from '@/hooks/useTypeSafeTranslations'
import type { SeriesPlaceholder, SeriesPlaceholderSuggestion } from '@/types/api'
import { useCallback, useEffect, useState, useTransition } from 'react'

interface SeriesPlaceholdersProps {
  seriesId: string
  /** Called after a placeholder is promoted, so the bookshelf above can refresh. */
  onPromoted?: () => void
}

interface PlaceholderForm {
  title: string
  sequence: string
  authorName: string
}

const emptyForm: PlaceholderForm = { title: '', sequence: '', authorName: '' }

/**
 * Books in a series that are not in the library, shown under the series
 * listing so the gaps are visible.
 *
 * Styled as deliberately absent rather than broken: these are not the same as
 * items whose files went missing, and must not look like them.
 */
export default function SeriesPlaceholders({ seriesId, onPromoted }: SeriesPlaceholdersProps) {
  const t = useTypeSafeTranslations()
  const { showToast } = useGlobalToast()
  const { userCanUpdate, serverSettings } = useUser()
  const canUpdate = userCanUpdate
  // The token itself never reaches the client; this only says whether one is set
  const hardcoverEnabled = !!serverSettings?.hardcoverEnabled

  const [placeholders, setPlaceholders] = useState<SeriesPlaceholder[]>([])
  const [loaded, setLoaded] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PlaceholderForm>(emptyForm)
  const [isSaving, startSaveTransition] = useTransition()

  const [suggestions, setSuggestions] = useState<SeriesPlaceholderSuggestion[]>([])
  const [selected, setSelected] = useState<boolean[]>([])
  const [matchedSeriesName, setMatchedSeriesName] = useState('')
  const [seriesIsCompleted, setSeriesIsCompleted] = useState(false)
  const [isLookingUp, startLookupTransition] = useTransition()
  const [isAddingSuggestions, startAddTransition] = useTransition()

  const [removeTarget, setRemoveTarget] = useState<SeriesPlaceholder | null>(null)
  const [promoteTarget, setPromoteTarget] = useState<SeriesPlaceholder | null>(null)
  const [isMutating, startMutateTransition] = useTransition()

  const loadPlaceholders = useCallback(async () => {
    try {
      const data = await fetchSeriesPlaceholdersAction(seriesId)
      setPlaceholders(data.placeholders ?? [])
    } catch (error) {
      console.error('Failed to load series placeholders', error)
    } finally {
      setLoaded(true)
    }
  }, [seriesId])

  useEffect(() => {
    setLoaded(false)
    setPlaceholders([])
    setSuggestions([])
    setSelected([])
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    loadPlaceholders()
  }, [loadPlaceholders])

  const closeForm = useCallback(() => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }, [])

  const dismissSuggestions = useCallback(() => {
    setSuggestions([])
    setSelected([])
    setMatchedSeriesName('')
    setSeriesIsCompleted(false)
  }, [])

  const handleSubmitForm = useCallback(() => {
    const title = form.title.trim()
    if (!title) {
      showToast(t('ToastTitleRequired'), { type: 'error' })
      return
    }
    const payload = { title, sequence: form.sequence.trim(), authorName: form.authorName.trim() }

    startSaveTransition(async () => {
      try {
        if (editingId) {
          await updateSeriesPlaceholderAction(seriesId, editingId, payload)
        } else {
          await createSeriesPlaceholderAction(seriesId, payload)
        }
        closeForm()
        await loadPlaceholders()
      } catch (error) {
        // A 409 carries a specific reason - already owned, or already listed -
        // which is more useful than a generic failure
        const message = error instanceof Error && error.message ? error.message : t('ToastSeriesPlaceholderFailed')
        showToast(message, { type: 'error' })
      }
    })
  }, [closeForm, editingId, form, loadPlaceholders, seriesId, showToast, t])

  const handleFindMissingBooks = useCallback(() => {
    startLookupTransition(async () => {
      try {
        const data = await fetchSeriesPlaceholderSuggestionsAction(seriesId)
        const found = data.suggestions ?? []
        setSuggestions(found)
        setSelected(found.map(() => true))
        setMatchedSeriesName(data.matchedSeriesName ?? '')
        setSeriesIsCompleted(!!data.isCompleted)
        if (!found.length) {
          showToast(t('ToastHardcoverNoMissingBooks'), { type: 'success' })
        }
      } catch (error) {
        console.error('Hardcover lookup failed', error)
        showToast(t('ToastHardcoverLookupFailed'), { type: 'error' })
      }
    })
  }, [seriesId, showToast, t])

  const handleAddSelected = useCallback(() => {
    const chosen = suggestions.filter((_, index) => selected[index])
    if (!chosen.length) return

    startAddTransition(async () => {
      try {
        const result = await createSeriesPlaceholdersBulkAction(
          seriesId,
          chosen.map((suggestion) => ({
            title: suggestion.title,
            subtitle: suggestion.subtitle,
            sequence: suggestion.sequence,
            authorName: suggestion.authorName,
            source: 'hardcover' as const
          }))
        )
        // Skipped entries are not a failure - they are ones the library
        // already covers - but silence would look like a partial error
        showToast(
          result.skipped
            ? t('ToastSeriesPlaceholdersAddedSomeSkipped', { 0: result.added, 1: result.skipped })
            : t('ToastSeriesPlaceholdersAdded', { 0: result.added }),
          { type: 'success' }
        )
        dismissSuggestions()
        await loadPlaceholders()
      } catch (error) {
        console.error('Failed to add suggested placeholders', error)
        showToast(t('ToastSeriesPlaceholderFailed'), { type: 'error' })
      }
    })
  }, [dismissSuggestions, loadPlaceholders, selected, seriesId, showToast, suggestions, t])

  const handleConfirmRemove = useCallback(() => {
    if (!removeTarget) return
    const target = removeTarget
    startMutateTransition(async () => {
      try {
        await deleteSeriesPlaceholderAction(seriesId, target.id)
        setRemoveTarget(null)
        await loadPlaceholders()
      } catch (error) {
        console.error('Failed to remove series placeholder', error)
        showToast(t('ToastSeriesPlaceholderFailed'), { type: 'error' })
      }
    })
  }, [loadPlaceholders, removeTarget, seriesId, showToast, t])

  const handleConfirmPromote = useCallback(() => {
    if (!promoteTarget) return
    const target = promoteTarget
    startMutateTransition(async () => {
      try {
        await promoteSeriesPlaceholderAction(seriesId, target.id)
        setPromoteTarget(null)
        showToast(t('ToastPlaceholderPromoted'), { type: 'success' })
        await loadPlaceholders()
        onPromoted?.()
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : t('ToastPromotePlaceholderFailed')
        showToast(message, { type: 'error' })
      }
    })
  }, [loadPlaceholders, onPromoted, promoteTarget, seriesId, showToast, t])

  // Stay out of the way until there is something to show or something to do
  if (!loaded || (!placeholders.length && !canUpdate)) return null

  const selectedCount = selected.filter(Boolean).length
  const allSelected = suggestions.length > 0 && selectedCount === suggestions.length

  return (
    <div className="w-full px-4 py-8 sm:px-8">
      <div className="mb-4 flex items-center">
        <p className="text-lg font-semibold">{t('HeaderNotInLibrary')}</p>
        {placeholders.length > 0 && <p className="ps-3 text-sm text-gray-400">{placeholders.length}</p>}
        <div className="grow" />
        {canUpdate && hardcoverEnabled && !showForm && !suggestions.length && (
          <Btn size="small" className="me-2" loading={isLookingUp} onClick={handleFindMissingBooks}>
            {t('ButtonFindMissingBooks')}
          </Btn>
        )}
        {canUpdate && !showForm && (
          <Btn size="small" onClick={() => setShowForm(true)}>
            {t('ButtonAddMissingBook')}
          </Btn>
        )}
      </div>

      <p className="mb-4 text-sm text-gray-400">{t('MessageSeriesPlaceholdersHelp')}</p>

      {showForm && (
        <div className="bg-primary/40 mb-4 w-full rounded border border-white/10 p-4">
          <div className="-mx-1 flex flex-wrap">
            <div className="mb-2 w-full px-1 sm:w-1/2">
              <TextInput label={t('LabelTitle')} value={form.title} onChange={(value) => setForm((prev) => ({ ...prev, title: value }))} />
            </div>
            <div className="mb-2 w-1/2 px-1 sm:w-1/4">
              <TextInput label={t('LabelSequence')} value={form.sequence} onChange={(value) => setForm((prev) => ({ ...prev, sequence: value }))} />
            </div>
            <div className="mb-2 w-1/2 px-1 sm:w-1/4">
              <TextInput label={t('LabelAuthor')} value={form.authorName} onChange={(value) => setForm((prev) => ({ ...prev, authorName: value }))} />
            </div>
          </div>
          <div className="flex items-center justify-end pt-2">
            <Btn size="small" className="me-2" onClick={closeForm}>
              {t('ButtonCancel')}
            </Btn>
            <Btn size="small" color="bg-success" loading={isSaving} onClick={handleSubmitForm}>
              {t('ButtonSave')}
            </Btn>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="bg-primary/40 mb-4 w-full rounded border border-white/10 p-4">
          <div className="mb-2 flex items-center">
            <p className="font-semibold">{t('HeaderSuggestedFromHardcover', { 0: matchedSeriesName })}</p>
            <div className="grow" />
            <Btn size="small" onClick={() => setSelected(suggestions.map(() => !allSelected))}>
              {allSelected ? t('ButtonDeselectAll') : t('ButtonSelectAll')}
            </Btn>
          </div>
          <p className="mb-3 text-sm text-gray-400">{seriesIsCompleted ? t('MessageHardcoverSeriesComplete') : t('MessageHardcoverSeriesOngoing')}</p>

          {suggestions.map((suggestion, index) => (
            <div key={suggestion.sourceId || `${suggestion.sequence}-${suggestion.title}`} className="flex items-center py-1">
              <Checkbox
                value={!!selected[index]}
                label={suggestion.title}
                size="small"
                labelClass="ps-2 text-sm"
                onChange={(value) =>
                  setSelected((prev) => {
                    const next = [...prev]
                    next[index] = value
                    return next
                  })
                }
              />
              <div className="grow" />
              {suggestion.sequence && <p className="px-2 font-mono text-sm text-gray-400">#{suggestion.sequence}</p>}
              {suggestion.releaseYear && <p className="text-xs text-gray-500">{suggestion.releaseYear}</p>}
            </div>
          ))}

          <div className="flex items-center justify-end pt-3">
            <Btn size="small" className="me-2" onClick={dismissSuggestions}>
              {t('ButtonCancel')}
            </Btn>
            <Btn size="small" color="bg-success" loading={isAddingSuggestions} disabled={!selectedCount} onClick={handleAddSelected}>
              {t('ButtonAddSelectedCount', { 0: selectedCount })}
            </Btn>
          </div>
        </div>
      )}

      {!placeholders.length && !showForm && !suggestions.length && <p className="text-sm text-gray-400 italic">{t('MessageNoSeriesPlaceholders')}</p>}

      {placeholders.map((placeholder) => (
        <div
          key={placeholder.id}
          className="mb-2 flex w-full items-center rounded border border-dashed border-white/20 px-3 py-2 opacity-60 transition-opacity hover:opacity-90"
        >
          <div className="w-10 shrink-0 text-center">
            {placeholder.sequence ? (
              <p className="font-mono text-sm">#{placeholder.sequence}</p>
            ) : (
              <span className="material-symbols text-lg text-gray-500">help_outline</span>
            )}
          </div>
          <div className="min-w-0 grow px-2">
            <p className="truncate">{placeholder.title}</p>
            {placeholder.authorName && <p className="truncate text-xs text-gray-400">{placeholder.authorName}</p>}
          </div>
          <p className="hidden shrink-0 px-2 text-xs tracking-wide text-gray-400 uppercase sm:block">{t('LabelNotInLibrary')}</p>
          {canUpdate && (
            <div className="flex shrink-0 items-center">
              <IconBtn size="small" borderless ariaLabel={t('LabelPromoteToLibraryItem')} onClick={() => setPromoteTarget(placeholder)}>
                library_add
              </IconBtn>
              <IconBtn
                size="small"
                borderless
                ariaLabel={t('ButtonEdit')}
                onClick={() => {
                  setEditingId(placeholder.id)
                  setForm({ title: placeholder.title, sequence: placeholder.sequence || '', authorName: placeholder.authorName || '' })
                  setShowForm(true)
                }}
              >
                edit
              </IconBtn>
              <IconBtn size="small" borderless ariaLabel={t('ButtonRemove')} onClick={() => setRemoveTarget(placeholder)}>
                close
              </IconBtn>
            </div>
          )}
        </div>
      ))}

      <ConfirmDialog
        isOpen={!!removeTarget}
        message={t('MessageConfirmRemoveSeriesPlaceholder', { 0: removeTarget?.title ?? '' })}
        processing={isMutating}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleConfirmRemove}
      />

      <ConfirmDialog
        isOpen={!!promoteTarget}
        message={t('MessageConfirmPromotePlaceholder', { 0: promoteTarget?.title ?? '' })}
        processing={isMutating}
        onClose={() => setPromoteTarget(null)}
        onConfirm={handleConfirmPromote}
      />
    </div>
  )
}
