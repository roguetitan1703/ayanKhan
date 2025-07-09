const sendOtpLess = async (phoneNo) => {
    try {
        phoneNo = Number(phoneNo)
        const options = {
            method: 'POST',
            headers: {
                clientId: 'U6QA4M114408K083R8IVZ9JNG5GQGSZU',
                clientSecret: 'gephvgxgfpor4n9z0gk1vkbx08u50nmy',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phoneNumber: "+91"+`${phoneNo}`,
                expiry: 120,
                otpLength: 6,
                channels: ["SMS"],
                metaData: { key1: "Data1", key2: "Data2" }
            })
        };
        
//         App I'd - 8GBDSR6914D6SI5QT4EP

// Client id - U6QA4M114408K083R8IVZ9JNG5GQGSZU

// Client secret - gephvgxgfpor4n9z0gk1vkbx08u50nmy

        const response = await fetch('https://auth.otpless.app/auth/v1/initiate/otp', options);
        const data = await response.json();
        return data;

    } catch (e) {
        console.error(e);
        return { status: false, message: e.message };
    }
};

export default sendOtpLess