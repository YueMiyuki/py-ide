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

const app = express()
const server = http.createServer(app)

// Function to dynamically handle multiple CORS origins
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      console.log(`Origin: ${origin}`)
      // Allow requests with no 'origin' (like Postman or curl requests)
      if (!origin) return callback(null, true)

      if (config.corsOrigin.includes(origin)) {
        console.log("Allow: " + origin)
        return callback(null, true) // Allow the origin
      } else {
        console.log("Reject: " + origin)
        return callback(new Error('Not allowed by CORS')) // Block the origin
      }
    },
    methods: ['GET', 'POST'],
  },
})

// Helper to get client IP address.
const getClientIp = socket => {
  return (
    socket.handshake.headers['x-forwarded-for'] || socket.handshake.address
  )
    .split(',')[0]
    .trim()
}

// Store all running processes to stop and clean up correctly.
const runningProcesses = new Map()

io.on('connection', (socket) => {
  const clientIp = getClientIp(socket)
  console.log(`User connected from IP: ${clientIp}`)

  // When 'run' event is received from the client
  socket.on('run', (code) => {
    const processId = uuidv4()
    const tempDir = os.tmpdir()
    const tempFilePath = path.join(tempDir, `${processId}.py`)

    // Save the incoming code to a temporary file
    fs.writeFileSync(tempFilePath, code)

    // Run the Python script inside a Docker container
    const pythonProcess = spawn('docker', [
      'run',
      '--rm',
      '-i', // Keep stdin open for inputs (no TTY required)
      '-v', `${tempFilePath}:/app/script.py`,
      'python:3.9-ide',
      'python', '/app/script.py',
    ])

    // Keep track of the running process to allow stopping it later
    runningProcesses.set(socket.id, { process: pythonProcess, id: processId, filePath: tempFilePath })

    // Send output back to the client
    pythonProcess.stdout.on('data', (data) => {
      socket.emit('output', data.toString())
    })

    // Send errors back to the client
    pythonProcess.stderr.on('data', (data) => {
      socket.emit('output', data.toString())
    })

    // When the process finishes, clean up
    pythonProcess.on('close', (code) => {
      socket.emit('exit', code)

      // Delete temp file after execution
      try {
        fs.unlinkSync(tempFilePath)
        console.log(`Temp file ${tempFilePath} deleted`)
      } catch (err) {
        console.error('Error deleting temp file:', err)
      }

      runningProcesses.delete(socket.id)
    })
  })

  // Handle user inputs
  socket.on('input', (input) => {
    const runningProcess = runningProcesses.get(socket.id)
    if (runningProcess) {
      runningProcess.process.stdin.write(input + '\n') // Send input to the Python script
    }
  })

  // Handle process termination request
  socket.on('stop', () => {
    const runningProcess = runningProcesses.get(socket.id)
    if (runningProcess) {
      runningProcess.process.kill()

      // Clean up temp files and state
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

  // Handle socket disconnect event
  socket.on('disconnect', () => {
    console.log(`User from IP ${clientIp} disconnected`)
    const runningProcess = runningProcesses.get(socket.id)
    if (runningProcess) {
      runningProcess.process.kill()

      // Clean up
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

// Start the server using the port from config.json
const PORT = process.env.PORT || config.socketPort
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})