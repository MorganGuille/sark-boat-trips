import { lazy, Suspense } from 'react';
import '../css/videoPlayer.css';
import placeholderImg from '../assets/images/video-placeholder.webp';

// The Vimeo player's code is only fetched once someone taps play (the owner's rule: nothing plays or
// downloads by itself, for people on data or a slow connection)
const Vimeo = lazy(() => import('@u-wave/react-vimeo'));

// Quiet: the video has music (owner, 1 Nov 2026). iPhones ignore this and use the phone's own volume.
const VOLUME = 0.15;

function WatchLabel() {
    return (<>
        <span className="videoPlayCircle" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        </span>
        <span className="videoPlayText">Watch a trip<small>About 1 minute</small></span>
    </>);
}

// The video (58 seconds) in the photo row before it has been tapped (owner, 5 Nov 2026): its cover
// picture, the same height as the photos. The row's button around it starts it.
export function VideoThumb() {
    return (
        <span className="videoThumb">
            <img src={placeholderImg} alt="" width="1515" height="852" loading="lazy" draggable="false" />
            <span className="videoThumbLabel"><WatchLabel /></span>
        </span>
    );
}

// Vimeo's normal player, playing quietly with its own controls (sound, pause, full screen). start is
// where to begin, in seconds; onReady is given the player, to ask it things (utils/videoState.js).
export function TripVideo({ start, onReady }) {
    return (
        <Suspense fallback={<p className="videoLoading" role="status">Loading the video…</p>}>
            <Vimeo
                className="videoPlayer"
                video="https://vimeo.com/331613265"
                autoplay
                controls
                volume={VOLUME}
                start={start}
                dnt
                playsInline
                onReady={(player) => {
                    player.setVolume(VOLUME).catch(() => {});
                    onReady(player);
                }}
            />
        </Suspense>
    );
}

// The video in the lightbox when it isn't playing: its cover picture and a Watch a trip button
export function VideoCover({ onPlay }) {
    return (<>
        <img src={placeholderImg} alt="" className="videoCover" width="1515" height="852" draggable="false" />
        <button type="button" className="videoPlay" onClick={onPlay}><WatchLabel /></button>
    </>);
}
