import { useState, lazy, Suspense } from 'react';
import '../css/videoPlayer.css';
import placeholderImg from '../assets/images/video-placeholder.webp';

// The Vimeo player's code is only fetched once someone taps play (the owner's rule: nothing plays or
// downloads by itself, for people on data or a slow connection)
const Vimeo = lazy(() => import('@u-wave/react-vimeo'));

// Quiet: the video has music (owner, 1 Nov 2026). iPhones ignore this and use the phone's own volume.
const VOLUME = 0.15;

// The video (58 seconds) on the home page: its cover picture and a Watch a trip button. Tapping it loads
// Vimeo's normal player, which starts playing quietly with its own controls (sound, pause, full screen).
function VideoPlayer() {
    const [started, setStarted] = useState(false);

    return (
        <div className="videoBlock">
            <div className="videoFrame">
                {started ? (
                    <Suspense fallback={<p className="videoLoading" role="status">Loading the video…</p>}>
                        <Vimeo
                            className="videoPlayer"
                            video="https://vimeo.com/331613265"
                            autoplay
                            controls
                            volume={VOLUME}
                            dnt
                            playsInline
                            onReady={(player) => player.setVolume(VOLUME).catch(() => {})}
                        />
                    </Suspense>
                ) : (<>
                    <img src={placeholderImg} alt="" className="videoCover" loading="lazy" width="1515" height="852" />
                    <button type="button" className="videoPlay" onClick={() => setStarted(true)}>
                        <span className="videoPlayCircle" aria-hidden="true">
                            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </span>
                        <span className="videoPlayText">Watch a trip<small>About 1 minute</small></span>
                    </button>
                </>)}
            </div>
            <p className="videoNote">Plays only when you tap it.</p>
        </div>
    );
}

export default VideoPlayer;
