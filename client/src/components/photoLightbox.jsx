import { useEffect, useRef, useState } from 'react'

// The home page photos enlarged (owner, 5 Nov 2026): one photo at a time on a dark screen, nothing
// cropped, no description (the alt text is for screen readers). The photos sit side by side in a row
// that snaps to each one, so a swipe is the phone's own scrolling and its own pinch zoom keeps working.
// Only in the page while it is open. onClose gets the index of the photo last shown.
function PhotoLightbox({ images, start, onClose }) {
    const dialog = useRef(null)
    const row = useRef(null)
    const [index, setIndex] = useState(start)

    useEffect(() => {
        dialog.current.showModal()
        row.current.scrollLeft = start * row.current.clientWidth
    }, [start])

    const close = () => {
        dialog.current.close()
        onClose(index)
    }

    const go = (to) => {
        const el = row.current
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        el.scrollTo({ left: to * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' })
    }

    const keys = (e) => {
        if (e.key === 'ArrowLeft' && index > 0) go(index - 1)
        else if (e.key === 'ArrowRight' && index < images.length - 1) go(index + 1)
        else return
        e.preventDefault()
    }

    return (
        <dialog ref={dialog} className='photoLightbox' aria-label='Enlarged photos' onKeyDown={keys}
            onCancel={(e) => { e.preventDefault(); close() }}>
            <div className='lightboxRow' ref={row} tabIndex={0}
                onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
                onClick={(e) => { if (e.target.tagName !== 'IMG') close() }}>
                {images.map((image) => (
                    <div className='lightboxSlide' key={image.src}>
                        <img src={image.src} alt={image.alt} width={image.width} height={image.height} draggable='false' />
                    </div>
                ))}
            </div>
            <p className='lightboxCount' aria-live='polite'>{index + 1} of {images.length}</p>
            <button type='button' className='lightboxButton lightboxClose' onClick={close} aria-label='Close' autoFocus>
                <svg width='22' height='22' viewBox='0 0 24 24' aria-hidden='true'><path d='M6 6l12 12M18 6L6 18' /></svg>
            </button>
            <button type='button' className='lightboxButton lightboxBack' onClick={() => go(index - 1)} hidden={index === 0} aria-label='Previous photo'>
                <svg width='22' height='22' viewBox='0 0 24 24' aria-hidden='true'><path d='M15 18l-6-6 6-6' /></svg>
            </button>
            <button type='button' className='lightboxButton lightboxNext' onClick={() => go(index + 1)} hidden={index === images.length - 1} aria-label='Next photo'>
                <svg width='22' height='22' viewBox='0 0 24 24' aria-hidden='true'><path d='M9 18l6-6-6-6' /></svg>
            </button>
        </dialog>
    )
}

export default PhotoLightbox
