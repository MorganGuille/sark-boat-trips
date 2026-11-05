import { useEffect, useRef, useState } from 'react'
import PhotoLightbox from './photoLightbox'
import '../css/slideshow.css'

// The home page photos (owner, 2 Nov 2026): a clean row of photos, each at its own shape (nothing
// cropped, no grey bands), that people move themselves: drag with the mouse or use the arrows on a
// laptop, swipe on a phone. It never moves by itself. A click or tap enlarges a photo; a drag doesn't.
// images: [{ src, alt, width, height }]
const DRAG_START = 8 // pixels the mouse moves before a press counts as a drag

function Slideshow({ images }) {
    const strip = useRef(null)
    const drag = useRef(null) // { x, scrollLeft, id } while the mouse is held down on the row
    const moved = useRef(false) // that mouse press became a drag, so it isn't a click on a photo
    const [dragging, setDragging] = useState(false)
    const [enlarged, setEnlarged] = useState(null) // which photo is open
    const [atStart, setAtStart] = useState(true)
    const [atEnd, setAtEnd] = useState(false)

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

    // e.detail is 0 for the keyboard, which can't drag
    const enlarge = (e, index) => {
        if (e.detail === 0 || !moved.current) setEnlarged(index)
    }

    // Back in the row, showing the photo last looked at, with the keyboard on it
    const closeEnlarged = (index) => {
        setEnlarged(null)
        const photo = strip.current.querySelectorAll('button')[index]
        photo.focus({ preventScroll: true })
        const shown = photo.getBoundingClientRect()
        const frame = strip.current.getBoundingClientRect()
        if (shown.left < frame.left || shown.right > frame.right) strip.current.scrollLeft += shown.left - frame.left
    }

    return (
        <section className='photoStrip' aria-labelledby='photos-heading'>
            <h2 id='photos-heading' className='sr-only'>Photos from our trips</h2>
            <div className='photoStripFrame'>
                {/* tabIndex: the arrow keys scroll it for people using a keyboard */}
                <ul className={`photoStripRow${dragging ? ' dragging' : ''}`} ref={strip} onScroll={update} tabIndex={0}
                    aria-label='Photos, scroll sideways for more'
                    onPointerDown={startDrag} onPointerMove={whileDragging} onPointerUp={endDrag} onPointerCancel={endDrag}>
                    {images.map((image, index) => (
                        <li key={image.src}>
                            <button type='button' onClick={(e) => enlarge(e, index)} aria-label={`Enlarge photo: ${image.alt}`}>
                                <img src={image.src} alt={image.alt} width={image.width} height={image.height} loading='lazy' draggable='false' />
                            </button>
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
            {enlarged === null ? null : <PhotoLightbox images={images} start={enlarged} onClose={closeEnlarged} />}
        </section>
    )
}

export default Slideshow
