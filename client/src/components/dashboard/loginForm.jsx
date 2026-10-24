import { useState } from 'react'

function LoginForm({ error, onLogin }) {

    const [busy, setBusy] = useState(false)

    const submit = async (e) => {
        e.preventDefault()
        const { username, password } = e.target
        setBusy(true)
        try {
            await onLogin(username.value, password.value)
        } finally {
            setBusy(false)
        }
    }

    return (
        <form className='loginCard' onSubmit={submit} aria-label='Dashboard login'>
            <h1>Dashboard login</h1>
            <label htmlFor='username'>Username</label>
            <input type='text' id='username' name='username' autoComplete='username' required />
            <label htmlFor='password'>Password</label>
            <input type='password' id='password' name='password' autoComplete='current-password' required />
            {error ? <p role='alert' className='loginError'>{error}</p> : null}
            <button className='btn' type='submit' disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        </form>
    )
}

export default LoginForm
