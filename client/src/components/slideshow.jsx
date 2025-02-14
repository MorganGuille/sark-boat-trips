import { useState, useEffect } from 'react'
import '../css/slideshow.css'
import { v4 as uuidv4 } from 'uuid';

function Slideshow({ images, interval = 5000 }) {

    const [currentIndex, setCurrentIndex] = useState(0)

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


    return (
        <div className="image-slider">
            <div className="slider-container">
                {images.map((image, index) => (
                    <div
                        key={uuidv4()}
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