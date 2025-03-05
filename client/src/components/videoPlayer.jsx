import { React, useState } from 'react'
import Vimeo from '@u-wave/react-vimeo';
import '../css/videoPlayer.css'

function VideoPlayer() {

    const [playerOpen, setPlayerOpen] = useState(true)

    return (<>
        <button onClick={() => setPlayerOpen(!playerOpen)} className='btn'>{playerOpen ? 'Hide ' : 'Show '}video</button>
        {playerOpen &&
            <Vimeo
                className='videoPlayer'
                video="https://vimeo.com/331613265"
                autoplay
                muted='true'
                background='true'
                loop='true'
                responsive='true'
            />
        }
    </>)
}

export default VideoPlayer