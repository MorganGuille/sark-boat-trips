import { React, useEffect } from 'react'
import axios from 'axios'
import { URL } from '../../config.js'

function Success() {

    const verifyPayment = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        console.log('Verify Payment function called')

        if (!sessionId) return;

        try {
            const response = await axios.get(`${URL}/charters/verify-payment?session_id=${sessionId}`);
            console.log('session id :', sessionId)
            console.log('username:', response)
            if (response.data.success) {
                console.log('Payment confirmed:', response.data);
                // Show confirmation message or redirect
            }
        } catch (error) {
            console.error('Error verifying payment:', error);
        }
    };


    useEffect(() => {

        verifyPayment();


    }, []);



    return (
        <h1 className='centered-section'>Success</h1>
    )
}

export default Success