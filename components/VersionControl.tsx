import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface VersionControlProps {
  versions: { id: number; code: string }[]
  currentVersion: number
  onVersionChange: (versionId: number) => void
}

export const VersionControl: React.FC<VersionControlProps> = ({ versions, currentVersion, onVersionChange }) => {
  return (
    <Select value={currentVersion.toString()} onValueChange={(value) => onVersionChange(parseInt(value))}>
      <SelectTrigger className="w-[180px] bg-[#1a365d] text-white border-[#ffa500]">
        <SelectValue placeholder="Select version" />
      </SelectTrigger>
      <SelectContent className="bg-[#1a365d] text-white border-[#ffa500]">
        {versions.map((version) => (
          <SelectItem key={version.id} value={version.id.toString()} className="hover:bg-[#0d2a4a]">
            Version {version.id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}