import { useState } from 'react'
import axios from 'axios'

import '../css/dashboard.css'


function Dashboard() {

    const [loggedin, setLoggedIn] = useState(false)


    const checkLogin = async (e) => {
        e.preventDefault()
        let user = {
            userName: e.target.username.value,
            password: e.target.password.value
        }
        let response = await axios.post('http://localhost:4040/admin/login', user)
        setLoggedIn(response.data.data)
        // console.log(response)
        // console.log(user)
    }

    const Logout = async () => {
        setLoggedIn(false)
    }


    return (<section className='dashboard'>
        {loggedin ? <button className='logoutButton' onClick={Logout}>Log Out</button> : null}
        <div>Admin panel</div>
        {!loggedin ? <form onSubmit={checkLogin}>
            <input type="text" id="username" name="username" placeholder="username" required />
            <input type="password" id="password" name="password" placeholder="password" required />
            <div>
                <button type="submit">Log in</button>
                <button onClick={Logout} type="reset">Log Out</button>
            </div>
        </form> : null}
        <div>
            {loggedin ? <p className='logged'>logged in</p> : <p className='notLogged'>Please log in</p>}
        </div>
    </section>
    )
}

export default Dashboard