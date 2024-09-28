import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DiffEditor } from '@monaco-editor/react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Version {
  id: number
  code: string
}

interface DiffViewerModalProps {
  isOpen: boolean
  onClose: () => void
  versions: Version[]
  diffVersions: { old: number; new: number }
  setDiffVersions: React.Dispatch<React.SetStateAction<{ old: number; new: number }>>
}

export const DiffViewerModal: React.FC<DiffViewerModalProps> = ({ 
  isOpen, 
  onClose, 
  versions, 
  diffVersions, 
  setDiffVersions 
}) => {
  const handleOldVersionChange = (value: string) => {
    setDiffVersions(prev => ({ ...prev, old: parseInt(value) }))
  }

  const handleNewVersionChange = (value: string) => {
    setDiffVersions(prev => ({ ...prev, new: parseInt(value) }))
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[#0a192f] p-4 rounded-lg shadow-xl w-4/5 h-4/5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Code Diff</h2>
              <div className="flex space-x-4">
                <Select value={diffVersions.old.toString()} onValueChange={handleOldVersionChange}>
                  <SelectTrigger className="w-[180px] bg-[#1a365d] text-white">
                    <SelectValue placeholder="Old Version" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((version) => (
                      <SelectItem key={version.id} value={version.id.toString()}>
                        Version {version.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={diffVersions.new.toString()} onValueChange={handleNewVersionChange}>
                  <SelectTrigger className="w-[180px] bg-[#1a365d] text-white">
                    <SelectValue placeholder="New Version" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((version) => (
                      <SelectItem key={version.id} value={version.id.toString()}>
                        Version {version.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={onClose}
                  className="text-white hover:text-gray-300 focus:outline-none"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="h-[calc(100%-3rem)] overflow-hidden rounded-lg">
              <DiffEditor
                height="100%"
                original={versions[diffVersions.old - 1]?.code || ''}
                modified={versions[diffVersions.new - 1]?.code || ''}
                language="python"
                theme="vs-dark"
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}