import { createContext, useContext } from 'react'

// The in-page "are you sure?" box (components/confirmDialog.jsx), instead of the browser's own
// window.confirm (spec P3-6). Usage:
//   const confirm = useConfirm()
//   if (!(await confirm({ title: 'Cancel this booking?', details: ['Bob Jones', 'Mon 9 Nov, 11am'],
//       body: ['They will be emailed.'], yes: 'Yes, cancel it', no: 'Keep it', danger: true }))) return
// Resolves true for the yes button, false for the other one, Escape or a tap outside the box.
export const ConfirmContext = createContext(null)

export const useConfirm = () => useContext(ConfirmContext)
