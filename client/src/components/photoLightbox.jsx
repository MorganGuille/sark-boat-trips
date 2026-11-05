import { useEffect, useRef, useState } from 'react'
import { TripVideo, VideoCover } from './videoPlayer'
import { readVideo } from '../utils/videoState'

// The home page photos enlarged (owner, 5 Nov 2026): one at a time on a dark screen, nothing cropped, no
// description (the alt text is for screen readers). The slides sit side by side in a row that snaps to
// each one, so a swipe is the phone's own scrolling and its own pinch zoom keeps working. The first slide
// is the video: it carries on from where it was in the row (getTime and setTime, shared with the row), moving on
// from it stops it, and coming back it waits for a tap. Only in the page while it is open.
// onClose(index last shown, whether the video was still playing).
function PhotoLightbox({ slides, start, playVideo, getTime, setTime, onClose }) {
    const dialog = useRef(null)
    const row = useRef(null)
    const player = useRef(null) // Vimeo's player here, while it plays
    const closing = useRef(false)
    const [index, setIndex] = useState(start)
    const [playing, setPlaying] = useState(playVideo)
    const [videoStart, setVideoStart] = useState(getTime)

    useEffect(() => {
        dialog.current.showModal()
        row.current.scrollLeft = start * row.current.clientWidth
    }, [start])

    // Where the player got to is kept for the row, or for coming back to it
    const noteWhereItIs = async () => {
        const now = await readVideo(player.current)
        if (now) setTime(now.seconds)
        return now
    }

    const close = async () => {
        if (closing.current) return
        closing.current = true
        const now = playing ? await noteWhereItIs() : null
        dialog.current.close()
        // A player that hasn't answered yet has only just started, so it counts as playing
        onClose(index, playing && !now?.paused)
    }

    const go = (to) => {
        const el = row.current
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        el.scrollTo({ left: to * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' })
    }

    const scrolled = (e) => {
        const shown = Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth)
        setIndex(shown)
        if (slides[shown].video || !playing || !player.current) {
            if (!slides[shown].video) setPlaying(false)
            return
        }
        const leaving = player.current
        player.current = null
        readVideo(leaving).then((now) => {
            if (now) setTime(now.seconds)
            setPlaying(false)
        })
    }

    const keys = (e) => {
        if (e.key === 'ArrowLeft' && index > 0) go(index - 1)
        else if (e.key === 'ArrowRight' && index < slides.length - 1) go(index + 1)
        else return
        e.preventDefault()
    }

    const playFromWhereItWas = () => {
        setVideoStart(getTime())
        setPlaying(true)
    }

    return (
        <dialog ref={dialog} className='photoLightbox' aria-label='Enlarged photos' onKeyDown={keys}
            onCancel={(e) => { e.preventDefault(); close() }}>
            <div className='lightboxRow' ref={row} tabIndex={0} onScroll={scrolled}
                onClick={(e) => { if (!e.target.closest('img, .videoFrame')) close() }}>
                {slides.map((slide) => (
                    <div className='lightboxSlide' key={slide.src}>
                        {slide.video ? (
                            <div className='videoFrame'>
                                {playing
                                    ? <TripVideo start={videoStart} onReady={(ready) => { player.current = ready }} />
                                    : <VideoCover onPlay={playFromWhereItWas} />}
                            </div>
                        ) : (
                            <img src={slide.src} alt={slide.alt} width={slide.width} height={slide.height} draggable='false' />
                        )}
                    </div>
                ))}
            </div>
            <p className='lightboxCount' aria-live='polite'>{index + 1} of {slides.length}</p>
            <button type='button' className='lightboxButton lightboxClose' onClick={close} aria-label='Close' autoFocus>
                <svg width='22' height='22' viewBox='0 0 24 24' aria-hidden='true'><path d='M6 6l12 12M18 6L6 18' /></svg>
            </button>
            <button type='button' className='lightboxButton lightboxBack' onClick={() => go(index - 1)} hidden={index === 0} aria-label='Previous photo'>
                <svg width='22' height='22' viewBox='0 0 24 24' aria-hidden='true'><path d='M15 18l-6-6 6-6' /></svg>
            </button>
            {/* Vimeo's player may keep a swipe for itself, so a phone gets this button while it plays */}
            <button type='button' className={`lightboxButton lightboxNext${playing ? ' overVideo' : ''}`} onClick={() => go(index + 1)} hidden={index === slides.length - 1} aria-label='Next photo'>
                <svg width='22' height='22' viewBox='0 0 24 24' aria-hidden='true'><path d='M9 18l6-6-6-6' /></svg>
            </button>
        </dialog>
    )
}

export default PhotoLightbox
