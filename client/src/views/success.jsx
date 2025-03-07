import { React, useEffect, useState } from 'react'
import axios from 'axios'
import { URL } from '../../config.js'

function Success() {

    const [response, setResponseData] = useState({})

    const verifyPayment = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        console.log('Verify Payment function called')

        if (!sessionId) return;

        try {
            const response = await axios.get(`${URL}/charters/verify-payment?session_id=${sessionId}`);
            console.log('session id :', sessionId)
            console.log('username:', response)
            if (response.data.ok) {
                console.log('Payment confirmed:', response.data);
                setResponseData(response.data)
                // Show confirmation message or redirect
            }
        } catch (error) {
            console.error('Error verifying payment:', error);
        }
    };

    useEffect(() => {

        verifyPayment();


    }, []);



    return (<>
        <title>Sark Boat Trips | Success</title>
        <div className='stripe-landing'>
            <h1 >Success</h1>
            <p>{`${response.name}, thank you so much for booking your charter tour with us!`}</p>
            <p>{`Your deposit has been confirmed and your charter is reserved for ${response.date}.`}<br />If you haven't already,
                please contact us to arrange your trip and let us know what we can do for you!`</p>
            <p>You can email us at sarkboattrips@gmail.com <br />or message us on Whatsapp at +44 7911 764 246</p>
            <p></p>
        </div>
    </>)
}

export default Success