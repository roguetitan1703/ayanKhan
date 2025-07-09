const verifyOtpLess = async (requestId,otp) => {
    try {
        const options = {
            method: 'POST',
            headers: {
                clientId: '2OHRH3M6QV0PE2Z3UNSR03BFJMF7DIPD',
                clientSecret: 'ckptgtlxyvepujr558tplgz94byhkl40',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requestId: requestId,
                otp: otp,
            })
        };

        const response = await fetch('https://auth.otpless.app/auth/v1/verify/otp', options);
        const data = await response.json();

        console.log(data);
        return data;

    } catch (e) {
        console.error(e);
        return { status: false, message: e.message };
    }
};

export default verifyOtpLess