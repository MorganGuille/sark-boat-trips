import { useEffect, useRef, useState } from 'react'
import PhotoLightbox from './photoLightbox'
import { TripVideo, VideoThumb } from './videoPlayer'
import { readVideo } from '../utils/videoState'
import '../css/slideshow.css'

// The home page photos (owner, 2 Nov 2026): a clean row of photos, each at its own shape (nothing
// cropped, no grey bands), that people move themselves: drag with the mouse or use the arrows on a
// laptop, swipe on a phone. It never moves by itself. A click or tap enlarges a photo; a drag doesn't.
//
// The video comes first, the same height as the photos (owner, 5 Nov 2026). The first tap plays it where
// it is, so nobody leaves the page; a second tap on the picture opens it in the lightbox, and it carries
// on from the same moment, and from there again when the lightbox closes. Vimeo's player keeps clicks to
// itself, so a see-through button lies over the picture to catch that tap and to let a swipe or a drag
// move the row; it stops above the player's control bar. Out of sight, the video pauses.
// images: [{ src, alt, width, height }]
const DRAG_START = 8 // pixels the mouse moves before a press counts as a drag
const VIDEO_SLIDE = { video: true, src: 'video' }
const MOSTLY_OUT_OF_SIGHT = 0.5 // of the video showing

const quietly = (promise) => promise?.catch(() => {}) // the player may be busy or gone: nothing to tell anyone

function Slideshow({ images }) {
    const slides = [VIDEO_SLIDE, ...images]
    const strip = useRef(null)
    const drag = useRef(null) // { x, scrollLeft, id } while the mouse is held down on the row
    const moved = useRef(false) // that mouse press became a drag, so it isn't a click on a photo
    const [dragging, setDragging] = useState(false)
    const [enlarged, setEnlarged] = useState(null) // { index, playVideo } while the lightbox is open
    const [atStart, setAtStart] = useState(true)
    const [atEnd, setAtEnd] = useState(false)

    const [videoStarted, setVideoStarted] = useState(false)
    const [videoStart, setVideoStart] = useState(0)
    const videoBox = useRef(null)
    const videoEnlarge = useRef(null)
    const player = useRef(null) // Vimeo's player in the row, once it is ready
    const videoTime = useRef(0) // seconds in, shared with the lightbox
    const lightboxOpen = useRef(false)
    const outOfSight = useRef(false)

    // Hides an arrow at either end of the row
    const update = () => {
        const el = strip.current
        if (!el) return
        setAtStart(el.scrollLeft <= 1)
        setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1)
    }
    useEffect(() => {
        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    }, [])

    // Scrolled off the screen or moved along the row: it pauses, and stays paused until someone presses play
    useEffect(() => {
        if (!videoStarted) return
        const watcher = new IntersectionObserver(([entry]) => {
            outOfSight.current = entry.intersectionRatio < MOSTLY_OUT_OF_SIGHT
            if (outOfSight.current && !lightboxOpen.current) quietly(player.current?.pause())
        }, { threshold: [0, MOSTLY_OUT_OF_SIGHT, 1] })
        watcher.observe(videoBox.current)
        return () => watcher.disconnect()
    }, [videoStarted])

    // Keyboard users stay on the video when the cover gives way to the player
    useEffect(() => {
        if (videoStarted && document.activeElement === document.body) videoEnlarge.current?.focus({ preventScroll: true })
    }, [videoStarted])

    // Most of a screen's width at a time, so the last photo shown is the first one after
    const move = (direction) => {
        const el = strip.current
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: smooth ? 'smooth' : 'auto' })
    }

    // Dragging with a mouse (fingers already scroll it themselves)
    const startDrag = (e) => {
        moved.current = false
        if (e.pointerType !== 'mouse' || e.button !== 0) return
        drag.current = { x: e.clientX, scrollLeft: strip.current.scrollLeft, id: e.pointerId }
    }
    const whileDragging = (e) => {
        if (!drag.current) return
        // A hand that shifts a little while clicking is still a click
        if (!moved.current && Math.abs(e.clientX - drag.current.x) < DRAG_START) return
        if (!moved.current) {
            moved.current = true
            strip.current.setPointerCapture(drag.current.id)
            setDragging(true)
        }
        strip.current.scrollLeft = drag.current.scrollLeft - (e.clientX - drag.current.x)
    }
    const endDrag = () => {
        drag.current = null
        setDragging(false)
    }

    const startVideo = () => {
        setVideoStart(videoTime.current)
        setVideoStarted(true)
    }

    // It may only just have loaded, after the lightbox opened or the row moved on
    const playerReady = (ready) => {
        player.current = ready
        if (lightboxOpen.current || outOfSight.current) quietly(ready.pause())
    }

    // e.detail is 0 for the keyboard, which can't drag. The cover starts the video; anything else opens
    // the lightbox, and only one player makes a sound at a time.
    const enlarge = async (e, index) => {
        if (e.detail !== 0 && moved.current) return
        const isVideo = Boolean(slides[index].video)
        if (isVideo && !videoStarted) return startVideo()
        if (lightboxOpen.current) return
        lightboxOpen.current = true
        const now = await readVideo(player.current)
        if (now) videoTime.current = now.seconds
        quietly(player.current?.pause())
        // A player that hasn't answered yet has only just started, so it counts as playing
        setEnlarged({ index, playVideo: isVideo && !now?.paused })
    }

    // Back in the row, showing the one last looked at, with the keyboard on it, and the video where the
    // lightbox left it
    const closeEnlarged = (index, stillPlaying) => {
        lightboxOpen.current = false
        setEnlarged(null)
        if (videoStarted) {
            quietly(player.current?.setCurrentTime(videoTime.current))
            if (stillPlaying) quietly(player.current?.play())
        } else if (stillPlaying) {
            startVideo()
        }
        const shown = strip.current.querySelectorAll('button')[index]
        shown.focus({ preventScroll: true })
        const place = shown.getBoundingClientRect()
        const frame = strip.current.getBoundingClientRect()
        if (place.left < frame.left || place.right > frame.right) strip.current.scrollLeft += place.left - frame.left
    }

    return (
        <section className='photoStrip' aria-labelledby='photos-heading'>
            <h2 id='photos-heading' className='sr-only'>Photos from our trips</h2>
            <div className='photoStripFrame'>
                {/* tabIndex: the arrow keys scroll it for people using a keyboard */}
                <ul className={`photoStripRow${dragging ? ' dragging' : ''}`} ref={strip} onScroll={update} tabIndex={0}
                    aria-label='Photos, scroll sideways for more'
                    onPointerDown={startDrag} onPointerMove={whileDragging} onPointerUp={endDrag} onPointerCancel={endDrag}>
                    {slides.map((slide, index) => (
                        <li key={slide.src}>
                            {!slide.video ? (
                                <button type='button' onClick={(e) => enlarge(e, index)} aria-label={`Enlarge photo: ${slide.alt}`}>
                                    <img src={slide.src} alt={slide.alt} width={slide.width} height={slide.height} loading='lazy' draggable='false' />
                                </button>
                            ) : !videoStarted ? (
                                <button type='button' onClick={(e) => enlarge(e, index)} aria-label='Watch a trip, about 1 minute'>
                                    <VideoThumb />
                                </button>
                            ) : (
                                <div className='videoInRow' ref={videoBox}>
                                    <TripVideo start={videoStart} onReady={playerReady} />
                                    <button type='button' className='videoEnlarge' ref={videoEnlarge} onClick={(e) => enlarge(e, index)} aria-label='Enlarge the video'>
                                        <svg width='20' height='20' viewBox='0 0 24 24' aria-hidden='true'><path d='M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' /></svg>
                                    </button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
                <button type='button' className='photoArrow photoArrowBack' onClick={() => move(-1)} hidden={atStart} aria-label='Earlier photos'>
                    <svg width='22' height='22' viewBox='0 0 24 24' aria-hidden='true'><path d='M15 18l-6-6 6-6' /></svg>
                </button>
                <button type='button' className='photoArrow photoArrowNext' onClick={() => move(1)} hidden={atEnd} aria-label='More photos'>
                    <svg width='22' height='22' viewBox='0 0 24 24' aria-hidden='true'><path d='M9 18l6-6-6-6' /></svg>
                </button>
            </div>
            {enlarged === null ? null : (
                <PhotoLightbox slides={slides} start={enlarged.index} playVideo={enlarged.playVideo} getTime={() => videoTime.current}
                    setTime={(seconds) => { videoTime.current = seconds }} onClose={closeEnlarged} />
            )}
        </section>
    )
}

export default Slideshow
