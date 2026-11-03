import { useCallback, useEffect, useRef, useState } from 'react'
import { ConfirmContext } from '../hooks/useConfirm'
import '../css/confirmDialog.css'

// Shows one confirm box at a time for the whole site (App.jsx wraps every page in it; see
// hooks/useConfirm.js). A real <dialog> opened with showModal, so the page behind can't be reached,
// Escape closes it, and the browser puts the keyboard back where it was afterwards. Nothing is in the
// page until a box is asked for.
export default function ConfirmProvider({ children }) {
    const [ask, setAsk] = useState(null)
    const dialog = useRef(null)

    const confirm = useCallback((options) => new Promise((resolve) => setAsk({ ...options, resolve })), [])

    useEffect(() => {
        if (ask && !dialog.current.open) dialog.current.showModal()
    }, [ask])

    const answer = (yes) => {
        dialog.current?.close()
        ask?.resolve(yes)
        setAsk(null)
    }

    const { title, details = [], body = [], yes = 'Yes', no = 'Go back', danger = false } = ask || {}
    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {ask && (
                <dialog ref={dialog} className='confirmDialog' aria-labelledby='confirmTitle'
                    onCancel={(e) => { e.preventDefault(); answer(false) }}
                    onClick={(e) => { if (e.target === dialog.current) answer(false) }}>
                    <div className='confirmBox'>
                        <h2 id='confirmTitle'>{title}</h2>
                        {details.length > 0 && (
                            <div className='confirmFacts'>
                                {details.map((line, i) => i === 0 ? <strong key={i}>{line}</strong> : <span key={i}>{line}</span>)}
                            </div>
                        )}
                        {body.filter(Boolean).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
                        <div className='confirmChoices'>
                            <button type='button' className='confirmNo' autoFocus={danger} onClick={() => answer(false)}>{no}</button>
                            <button type='button' className={danger ? 'confirmYes confirmDanger' : 'confirmYes'} autoFocus={!danger} onClick={() => answer(true)}>{yes}</button>
                        </div>
                    </div>
                </dialog>
            )}
        </ConfirmContext.Provider>
    )
}
