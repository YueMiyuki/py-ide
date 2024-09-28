const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const { spawn } = require('child_process')
const { v4: uuidv4 } = require('uuid')
const fs = require('fs')
const path = require('path')
const os = require('os')
const config = require("./config.json")

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || config.corsOrigin.indexOf(origin) !== -1) {
          callback(null, true) // If the origin is in the allowed list, accept it
        } else {
          callback(new Error('Not allowed by CORS')) // Block undesired origins
        }
      },
      methods: ['GET', 'POST'],
    },
  })

const runningProcesses = new Map()

// Helper: Get client IP address.
const getClientIp = (socket) => {
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address
  return ip?.split(',')[0]?.trim() || 'Unknown IP'
}

io.on('connection', (socket) => {
  const clientIp = getClientIp(socket)
  console.log(`A user connected from IP: ${clientIp}`)

  socket.on('run', (code) => {
    const processId = uuidv4()
    const tempDir = os.tmpdir()
    const tempFilePath = path.join(tempDir, `${processId}.py`)

    // Write the incoming code to a temporary .py file
    fs.writeFileSync(tempFilePath, code)

    // Spawn a Docker process using Alpine Python (without -t flag)
    const pythonProcess = spawn('docker', [
      'run',
      '--rm',
      '-i',        // Just keep stdin open (no TTY since it's not a terminal session)
      '-v', `${tempFilePath}:/app/script.py`,
      'python:3.9-alpine',
      'python', '/app/script.py',
    ])

    // Register the running process
    runningProcesses.set(socket.id, { process: pythonProcess, id: processId, filePath: tempFilePath })

    // Pipe stdout to the client
    pythonProcess.stdout.on('data', (data) => {
      socket.emit('output', data.toString())
    })

    // Pipe stderr to the client (e.g., for errors)
    pythonProcess.stderr.on('data', (data) => {
      socket.emit('output', data.toString())
    })

    // Process exit handler
    pythonProcess.on('close', (code) => {
      socket.emit('exit', code)

      // Cleanup temp file after execution
      try {
        fs.unlinkSync(tempFilePath)
        console.log(`Temp file ${tempFilePath} deleted`)
      } catch (err) {
        console.error('Error deleting temp file:', err)
      }

      // Remove the process from the list
      runningProcesses.delete(socket.id)
    })
  })

  // Handle user input sent from client
  socket.on('input', (input) => {
    const runningProcess = runningProcesses.get(socket.id)
    if (runningProcess) {
      runningProcess.process.stdin.write(input + '\n') // Send input to Python script via stdin
    }
  })

  // Handle process termination
  socket.on('stop', () => {
    const runningProcess = runningProcesses.get(socket.id)
    if (runningProcess) {
      runningProcess.process.kill()

      try {
        fs.unlinkSync(runningProcess.filePath)
        console.log(`Temp file ${runningProcess.filePath} deleted`)
      } catch (err) {
        console.error('Error deleting temp file:', err)
      }

      runningProcesses.delete(socket.id)
      socket.emit('exit', 1)
    }
  })

  socket.on('disconnect', () => {
    console.log(`User from IP ${clientIp} disconnected`)
    const runningProcess = runningProcesses.get(socket.id)
    if (runningProcess) {
      runningProcess.process.kill()

      try {
        fs.unlinkSync(runningProcess.filePath)
        console.log(`Temp file ${runningProcess.filePath} deleted`)
      } catch (err) {
        console.error('Error deleting temp file:', err)
      }

      runningProcesses.delete(socket.id)
    }
  })
})

const PORT = process.env.PORT || config.socketPort || 3001
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})