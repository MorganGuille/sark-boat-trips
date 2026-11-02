import { useEffect, useRef, useState } from 'react'
import '../css/slideshow.css'

// The home page photos (owner, 2 Nov 2026): a clean row of photos, each at its own shape (nothing
// cropped, no grey bands), that people move themselves: drag with the mouse or use the arrows on a
// laptop, swipe on a phone. It never moves by itself. images: [{ src, alt, width, height }]
function Slideshow({ images }) {
    const strip = useRef(null)
    const drag = useRef(null) // { x, scrollLeft } while the mouse is held down on the row
    const [dragging, setDragging] = useState(false)
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
        if (e.pointerType !== 'mouse' || e.button !== 0) return
        drag.current = { x: e.clientX, scrollLeft: strip.current.scrollLeft }
        strip.current.setPointerCapture(e.pointerId)
        setDragging(true)
    }
    const whileDragging = (e) => {
        if (!drag.current) return
        strip.current.scrollLeft = drag.current.scrollLeft - (e.clientX - drag.current.x)
    }
    const endDrag = () => {
        drag.current = null
        setDragging(false)
    }

    return (
        <section className='photoStrip' aria-labelledby='photos-heading'>
            <h2 id='photos-heading' className='sr-only'>Photos from our trips</h2>
            <div className='photoStripFrame'>
                {/* tabIndex: the arrow keys scroll it for people using a keyboard */}
                <ul className={`photoStripRow${dragging ? ' dragging' : ''}`} ref={strip} onScroll={update} tabIndex={0}
                    aria-label='Photos, scroll sideways for more'
                    onPointerDown={startDrag} onPointerMove={whileDragging} onPointerUp={endDrag} onPointerCancel={endDrag}>
                    {images.map((image) => (
                        <li key={image.src}>
                            <img src={image.src} alt={image.alt} width={image.width} height={image.height} loading='lazy' draggable='false' />
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
        </section>
    )
}

export default Slideshow
