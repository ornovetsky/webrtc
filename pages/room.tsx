import React, {useEffect, useState, useCallback} from 'react'
import io from 'socket.io-client'
import { RoomId } from '../utils/api'
import VideoComponent from "../components/videoComponent";
//import VideoComponent from '../components/videoComponent'

Room.getInitialProps = async ( { query }: { query: RoomId} ) => {
  return { roomId: query.roomId }
}

interface IStreamMap {
  userId: string
  stream: MediaStream
}

export default function Room( {roomId}: RoomId) {
  const [streamsMap, setStreamsMap] = useState<IStreamMap | null>(null)

  const updateStreamsMap = (userId: string, stream: MediaStream) => {
    setStreamsMap((streamsOld:any) => ({...streamsOld, [userId]: stream }))
  }

  const deleteFromStreamsMap = (userId: string)=>{
    setStreamsMap((streamsOld:any) => {
      if(!(userId in  streamsOld)) return  streamsOld
      delete streamsOld[userId]

      return {...streamsOld}
    })
  }

  const repeatTimes = useCallback(
    () => {
      if(!streamsMap) return 2
      const users = Object.keys(streamsMap).length
      if(users > 12) return 4
      if(users > 4) return 3
      if(users > 1) return 2
      return 1
    },
    [streamsMap],
  )

  useEffect(() => {
    (async ()=>{
      const socket = io('/')

      const myStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })

      const Peer = require('peerjs').peerjs.Peer
      const peer = new Peer(undefined, {
        host: '/',
        port: 3001,
        path: '/peerjs'
      })

      let MY_ID: any

      peer.on('open', (myId: string) => {
        MY_ID = myId
        socket.emit('join-room', {roomId, userId: myId})
        updateStreamsMap(MY_ID, myStream)
      })

      peer.on('call', (call: any) =>  {
        call.answer(myStream)
        call.on('stream', (userVideoStream: MediaStream) =>  {
          updateStreamsMap(call.metadata.id, userVideoStream)
        })
      })

      socket.on('user-connected', (userId: string) => {
        const call = peer.call(userId,  myStream, {metadata: { id: MY_ID} })
        call.on('stream', (userVideoStream: MediaStream) => {
          updateStreamsMap(userId, userVideoStream)
        })
      })

      socket.on('user-disconnected', (userId: string) => {
        deleteFromStreamsMap(userId)
      })
    })()
  }, []);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh'
    }}>
      <div style={ {
        ...(repeatTimes() > 1
            ? {
              gridTemplateColumns: `repeat(${repeatTimes()}, minmax(250px, 1fr))`,
              gridAutoRows: `minmax(min-content, max-content)`
            }
            : {
              justifyContent: 'center',
              height: '100%',
              alignItems: 'center'
            }
        ),
        display:'grid',
        maxWidth: '1280px',
        maxHeight: '960px'
      }}>
        {
          streamsMap
            ? Object.entries(streamsMap).map(entries => {
              console.log(repeatTimes())
              const [userId, stream] = entries
              return ( <VideoComponent key={userId} userId={userId} stream={stream} />)
            })
            : null
        }
      </div>
    </div>
  )
}
