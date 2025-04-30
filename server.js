const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const { spawn } = require('child_process')
const { v4: uuidv4 } = require('uuid')
const fs = require('fs')
const path = require('path')
const os = require('os')

// Load configuration from config.json
const config = require('./config.json')

// Helper function for timestamped logs
const logWithTimestamp = (message) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${message}`)
}

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      logWithTimestamp(`Origin check: ${origin}`)
      if (!origin) return callback(null, true)
      
      if (config.corsOrigin.includes(origin)) {
        logWithTimestamp(`Allowed origin: ${origin}`)
        callback(null, true)
      } else {
        logWithTimestamp(`Rejected origin: ${origin}`)
        callback(new Error('Not allowed by CORS'))
      }
    },
    methods: ['GET', 'POST'],
  },
})

const getClientIp = socket => {
  return (
    socket.handshake.headers['x-forwarded-for'] || socket.handshake.address
  )
    .split(',')[0]
    .trim()
}

const runningProcesses = new Map()

// Resource limits for containers
const DOCKER_RESOURCE_LIMITS = {
  CPU: "1",       // Max 1 CPU core
  MEMORY: "512m", // Max 512MB RAM
  SWAP: "512m"
}

io.on('connection', (socket) => {
  const clientIp = getClientIp(socket)
  logWithTimestamp(`New connection from ${clientIp} (socket ID: ${socket.id})`)

  socket.on('run', (code) => {
    const processId = uuidv4()
    const tempDir = os.tmpdir()
    const tempFilePath = path.join(tempDir, `${processId}.py`)

    try {
      fs.writeFileSync(tempFilePath, code)
      logWithTimestamp(`Created temp file: ${tempFilePath}`)
    } catch (err) {
      logWithTimestamp(`File creation error: ${err.message}`)
      socket.emit('output', 'Error: Failed to create temporary file')
      return
    }

    const dockerArgs = [
      'run',
      '--rm',
      '-i',
      '--cpus', DOCKER_RESOURCE_LIMITS.CPU,
      '--memory', DOCKER_RESOURCE_LIMITS.MEMORY,
      '--memory-swap', DOCKER_RESOURCE_LIMITS.SWAP,
      '-v', `${tempFilePath}:/app/script.py`,
      'python:3.9-ide',
      'python', '/app/script.py',
    ]

    logWithTimestamp(`Starting container for ${clientIp} with args: ${dockerArgs.join(' ')}`)
    
    const pythonProcess = spawn('docker', dockerArgs)

    const timeoutId = setTimeout(() => {
      const runningProcess = runningProcesses.get(socket.id)
      if (runningProcess) {
        logWithTimestamp(`Timeout reached for ${clientIp} (process: ${processId})`)
        pythonProcess.kill()
        socket.emit('output', '\nProcess terminated: 60-second timeout reached\n')
        socket.emit('exit', 124)
        
        try {
          fs.unlinkSync(runningProcess.filePath)
          logWithTimestamp(`Cleaned temp file after timeout: ${tempFilePath}`)
        } catch (err) {
          logWithTimestamp(`Timeout cleanup error: ${err.message}`)
        }
        
        runningProcesses.delete(socket.id)
      }
    }, 60000)

    runningProcesses.set(socket.id, {
      process: pythonProcess,
      id: processId,
      filePath: tempFilePath,
      timeoutId,
      clientIp
    })

    pythonProcess.stdout.on('data', (data) => {
      socket.emit('output', data.toString())
    })

    pythonProcess.stderr.on('data', (data) => {
      socket.emit('output', data.toString())
    })

    pythonProcess.on('close', (code) => {
      const runningProcess = runningProcesses.get(socket.id)
      if (runningProcess) {
        logWithTimestamp(`Process ${processId} exited with code ${code} (${clientIp})`)
        clearTimeout(runningProcess.timeoutId)
        
        try {
          fs.unlinkSync(runningProcess.filePath)
          logWithTimestamp(`Cleaned temp file: ${tempFilePath}`)
        } catch (err) {
          logWithTimestamp(`Exit cleanup error: ${err.message}`)
        }
        
        runningProcesses.delete(socket.id)
        socket.emit('exit', code)
      }
    })
  })

  socket.on('input', (input) => {
    const runningProcess = runningProcesses.get(socket.id)
    if (runningProcess) {
      runningProcess.process.stdin.write(input + '\n')
    }
  })

  socket.on('stop', () => {
    const runningProcess = runningProcesses.get(socket.id)
    if (runningProcess) {
      logWithTimestamp(`Manual stop for ${runningProcess.clientIp} (process: ${runningProcess.id})`)
      runningProcess.process.kill()
      clearTimeout(runningProcess.timeoutId)
      
      try {
        fs.unlinkSync(runningProcess.filePath)
        logWithTimestamp(`Cleaned temp file after manual stop: ${runningProcess.filePath}`)
      } catch (err) {
        logWithTimestamp(`Manual stop cleanup error: ${err.message}`)
      }
      
      runningProcesses.delete(socket.id)
      socket.emit('exit', 1)
    }
  })

  socket.on('disconnect', () => {
    const runningProcess = runningProcesses.get(socket.id)
    logWithTimestamp(`Disconnect from ${clientIp} ${runningProcess ? '(process running)' : ''}`)
    
    if (runningProcess) {
      runningProcess.process.kill()
      clearTimeout(runningProcess.timeoutId)
      
      try {
        fs.unlinkSync(runningProcess.filePath)
        logWithTimestamp(`Cleaned temp file after disconnect: ${runningProcess.filePath}`)
      } catch (err) {
        logWithTimestamp(`Disconnect cleanup error: ${err.message}`)
      }
      
      runningProcesses.delete(socket.id)
    }
  })
})

const PORT = process.env.PORT || config.socketPort
server.listen(PORT, () => {
  logWithTimestamp(`Server started on port ${PORT}`)
  logWithTimestamp(`Container resource limits: ${JSON.stringify(DOCKER_RESOURCE_LIMITS)}`)
})