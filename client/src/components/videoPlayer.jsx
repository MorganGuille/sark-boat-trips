// import { React, useState } from 'react'
// import Vimeo from '@u-wave/react-vimeo';
// import '../css/videoPlayer.css'

// function VideoPlayer() {

//     const [playerOpen, setPlayerOpen] = useState(true)

//     return (<>
//         <button onClick={() => setPlayerOpen(!playerOpen)} className='btn'>{playerOpen ? 'Hide ' : 'Show '}video</button>
//         {playerOpen &&
//             <Vimeo
//                 className='videoPlayer'
//                 video="https://vimeo.com/331613265"
//                 autoplay
//                 muted='true'
//                 background='true'
//                 loop='true'
//                 responsive='true'
//             />
//         }
//     </>)
// }

// export default VideoPlayer
import { useState } from 'react';
import Vimeo from '@u-wave/react-vimeo';
import '../css/videoPlayer.css';
import placeholderImg from '../assets/images/video-placeholder.webp';

function VideoPlayer() {
    const [hasLoaded, setHasLoaded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);


    const handleInitialPlay = () => {
        setHasLoaded(true);
        setIsPlaying(true);
    };

    const togglePause = () => {
        if (hasLoaded) {
            setIsPlaying(!isPlaying);
        }
    };

    return (
        <div className="video-container">

            {!hasLoaded && (
                <>
                    <button onClick={handleInitialPlay} className="custom-play-btn">
                        Play Video
                    </button>
                    <div
                        className="video-placeholder"
                        style={{ backgroundImage: `url(${placeholderImg})` }}
                    ></div>
                </>
            )}


            {hasLoaded && (
                <>
                    <Vimeo
                        className="videoPlayer"
                        video="https://vimeo.com/331613265"
                        paused={!isPlaying}
                        muted
                        background
                        loop
                        responsive
                    />


                    <div
                        className="click-overlay"
                        onClick={togglePause}
                    ></div>
                </>
            )}
        </div>
    );
}

export default VideoPlayer;