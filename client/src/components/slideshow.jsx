import { useState, useEffect, useRef } from 'react';
import '../css/slideshow.css';
// Note: You can actually delete this uuidv4 import if you aren't using it elsewhere in this file!
import { v4 as uuidv4 } from 'uuid';

function Slideshow({ images, interval = 5000 }) {

    const [currentIndex, setCurrentIndex] = useState(0);
    const startX = useRef(0);
    const endX = useRef(0);
    const activePointerId = useRef(null);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
        }, interval);

        return () => {
            clearInterval(timer);
        };
    }, [images, interval]);

    const goToPrevious = () => {
        setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
    };

    const goToNext = () => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    };

    const handlePointerDown = (e) => {
        startX.current = e.clientX || e.touches[0].clientX;
        activePointerId.current = e.pointerId;
    };

    const handlePointerMove = (e) => {
        if (e.pointerId === activePointerId.current) {
            endX.current = e.clientX || e.touches[0].clientX;
        }
    };

    const handlePointerUp = (e) => {
        if (e.pointerId === activePointerId.current) {
            if (startX.current - endX.current > 10) {
                goToNext();
            } else if (startX.current - endX.current < -10) {
                goToPrevious();
            }
            startX.current = 0;
            endX.current = 0;
            activePointerId.current = null;
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
                {images.map((image, index) => {
                    const isVisible =
                        index === currentIndex ||
                        index === (currentIndex + 1) % images.length ||
                        index === (currentIndex - 1 + images.length) % images.length;

                    return (
                        <div
                            key={index}
                            className={`slide ${index === currentIndex ? 'active' : ''}`}
                            // Only load the URL if it's visible or about to be
                            style={{ backgroundImage: isVisible ? `url(${image})` : 'none' }}
                        ></div>
                    );
                })}
            </div>
            <div className="slider-controls">
                <button onClick={goToPrevious}>{`<`}</button>
                <button onClick={goToNext}>{`>`}</button>
            </div>
        </div>
    );
}

export default Slideshow;