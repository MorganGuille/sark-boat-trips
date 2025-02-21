import { useState, useEffect, useRef } from 'react'
import '../css/slideshow.css'
import { v4 as uuidv4 } from 'uuid';

function Slideshow({ images, interval = 5000 }) {

    const [currentIndex, setCurrentIndex] = useState(0)
    const startX = useRef(0)
    const endX = useRef(0);
    const activePointerId = useRef(null);


    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length)
        }, interval)

        return () => {
            clearInterval(timer)
        }
    }, [images, interval])

    const goToPrevious = () => {
        setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
    };

    const goToNext = () => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    };

    const handlePointerDown = (e) => {
        startX.current = e.clientX || e.touches[0].clientX;
        activePointerId.current = e.pointerId;
        // e.target.setPointerCapture(e.pointerId);
        // console.log('Touch Start:', startX.current);
    };

    const handlePointerMove = (e) => {
        if (e.pointerId === activePointerId.current) {
            endX.current = e.clientX || e.touches[0].clientX;
            // console.log('Touch Move:', endX.current);
        }
    };

    const handlePointerUp = (e) => {
        if (e.pointerId === activePointerId.current) {
            // console.log('Touch End - Start X:', startX.current, 'End X:', endX.current);
            if (startX.current - endX.current > 10) {
                goToNext();
            } else if (startX.current - endX.current < -10) {
                goToPrevious();
            }
            startX.current = 0;
            endX.current = 0;
            activePointerId.current = null;
            // e.target.releasePointerCapture(e.pointerId);
        }
    };


    return (



        <div
            className="image-slider"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerOut={handlePointerUp}
        >
            <div className="slider-container">
                {images.map((image, index) => (
                    <div
                        key={index}
                        className={`slide ${index === currentIndex ? 'active' : ''}`}
                        style={{ backgroundImage: `url(${image})` }}
                    ></div>
                ))}
            </div>
            <div className="slider-controls">
                <button onClick={goToPrevious}>{`<`}</button>
                <button onClick={goToNext}>{`>`}</button>
            </div>
        </div>
    )
}


export default Slideshow