import axios from 'axios'

const TOKEN_KEY = 'adminToken'
const LOGOUT_EVENT = 'admin:logout'

const getToken = () => {
    try {
        return localStorage.getItem(TOKEN_KEY)
    } catch {
        return null
    }
}

const setToken = (token) => {
    try {
        localStorage.setItem(TOKEN_KEY, token)
    } catch { /* storage unavailable */ }
}

const clearToken = () => {
    try {
        localStorage.removeItem(TOKEN_KEY)
    } catch { /* storage unavailable */ }
}

// Client-side expiry check, for UX only; the server is what enforces it
const hasValidToken = () => {
    const token = getToken()
    if (!token) return false
    try {
        const { exp } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        return exp * 1000 > Date.now()
    } catch {
        return false
    }
}

// Axios instance for dashboard calls: adds the token and logs out on a 401
const authAxios = axios.create()

authAxios.interceptors.request.use((config) => {
    const token = getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

authAxios.interceptors.response.use(
    (res) => res,
    (error) => {
        if (error.response?.status === 401) {
            clearToken()
            window.dispatchEvent(new Event(LOGOUT_EVENT))
        }
        return Promise.reject(error)
    }
)

export { authAxios, setToken, clearToken, hasValidToken, LOGOUT_EVENT }
