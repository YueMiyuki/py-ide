import { useEffect, useState } from 'react'
import io, { Socket } from 'socket.io-client'

// Load WebSocket URL from config.json
const config = require('../config.json')

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    // Use the WebSocket URL from the config file
    const socketUrl = config.webSocketUrl || 'http://localhost:3001'
    
    // Establish the WebSocket connection
    const newSocket = io(socketUrl, {
      transports: ['websocket'], // Ensure WebSocket transport is used
    })

    // Set the newly created socket
    setSocket(newSocket)

    // Cleanup: Close the socket when the component unmounts
    return () => {
      newSocket.close()
    }
  }, [])

  return socket
}