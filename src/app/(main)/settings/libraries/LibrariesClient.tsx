'use client'

import { useGlobalToast } from '@/contexts/ToastContext'
import { useTypeSafeTranslations } from '@/hooks/useTypeSafeTranslations'
import { Library } from '@/types/api'
import { useCallback, useState } from 'react'
import SettingsContent from '../SettingsContent'
import { createLibrary, editLibrary, fetchBooksExport, saveLibraryOrder } from './actions'
import LibrariesList from './LibrariesList'
import LibraryEditModal, { LibraryFormData } from './LibraryEditModal'

interface LibraryClientProps {
  libraries: Library[]
}

export default function LibrariesClient({ libraries }: LibraryClientProps) {
  const t = useTypeSafeTranslations()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLibrary, setEditingLibrary] = useState<Library | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const { showToast } = useGlobalToast()

  const handleAddLibrary = useCallback(() => {
    setEditingLibrary(null)
    setIsModalOpen(true)
  }, [])

  const handleEditLibrary = useCallback((library: Library) => {
    setEditingLibrary(library)
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setEditingLibrary(null)
  }, [])

  const handleSubmit = useCallback(
    async (formData: LibraryFormData) => {
      setIsProcessing(true)
      try {
        // TODO: Full validation
        const validFolders = formData.folders.filter((f) => f.fullPath.trim() !== '')

        const payload = {
          name: formData.name,
          mediaType: formData.mediaType,
          icon: formData.icon,
          provider: formData.provider,
          folders: validFolders,
          settings: formData.settings
        } as Library

        if (editingLibrary) {
          await editLibrary(editingLibrary.id, payload)
        } else {
          await createLibrary(payload)
        }

        handleCloseModal()
      } catch (error) {
        console.error('Failed to save library:', error)
      } finally {
        setIsProcessing(false)
      }
    },
    [editingLibrary, handleCloseModal]
  )

  /** Download a JSON listing of every book across all accessible book libraries. */
  const handleExportBooks = useCallback(async () => {
    setIsExporting(true)
    try {
      const entries = await fetchBooksExport()
      const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
      const blobUrl = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = 'audiobookshelf-books.json'
      document.body.appendChild(link)
      link.click()
      link.remove()

      // Release the object URL once the download has been handed off
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (error) {
      console.error('[LibrariesClient] Failed to export books', error)
      showToast(t('ToastExportBooksFailed'), { type: 'error' })
    } finally {
      setIsExporting(false)
    }
  }, [showToast, t])

  return (
    <>
      <SettingsContent
        title={t('HeaderLibraries')}
        secondaryButton={{
          label: t('ButtonExportBooksJson'),
          onClick: handleExportBooks,
          disabled: isExporting
        }}
        addButton={{
          label: t('ButtonAddLibrary'),
          onClick: handleAddLibrary
        }}
        moreInfoUrl="https://www.audiobookshelf.org/guides/library_creation"
      >
        <LibrariesList libraries={libraries} saveLibraryOrderAction={saveLibraryOrder} onEditLibrary={handleEditLibrary} onAddLibrary={handleAddLibrary} />
      </SettingsContent>

      <LibraryEditModal isOpen={isModalOpen} library={editingLibrary} processing={isProcessing} onClose={handleCloseModal} onSubmit={handleSubmit} />
    </>
  )
}
