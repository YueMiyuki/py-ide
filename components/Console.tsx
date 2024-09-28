import React, { forwardRef, useState } from 'react'
import { motion } from 'framer-motion'

interface ConsoleProps {
  output: string
  isRunning: boolean
  onInput: (input: string) => void
}

export const Console = forwardRef<HTMLDivElement, ConsoleProps>(({ output, isRunning, onInput }, ref) => {
  const [input, setInput] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      onInput(input)
      setInput('')
    }
  }

  return (
    <motion.div 
      className="flex flex-col h-full bg-black p-4 rounded-lg font-mono text-sm"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex-1 overflow-auto" ref={ref}>
        <pre className="whitespace-pre-wrap">{output}</pre>
      </div>
      {isRunning ? (
        <div className="flex items-center mt-2">
          <span className="text-green-500 mr-2">{'>'}</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none"
            placeholder="Enter input..."
          />
        </div>
      ) : (
        <div className="text-gray-500 mt-2">Run Python first</div>
      )}
    </motion.div>
  )
})

Console.displayName = 'Console'