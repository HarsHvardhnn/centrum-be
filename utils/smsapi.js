const axios = require("axios");
require("dotenv").config();

const SMSAPI_BASE_URL = "https://api.smsapi.pl/sms.do";
const SMSAPI_TOKEN = process.env.SMSAPI_TOKEN;

// Function to replace Polish special characters with normal characters
function replacePolishCharacters(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  const polishCharMap = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
  };
  
  return text.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (char) => polishCharMap[char] || char);
}



async function checkSMSStatus(messageId) {
  try {
    if (!messageId) {
      throw new Error("Message ID is required");
    }

    // SMSAPI endpoint for checking message status
    const statusUrl = `https://api.smsapi.pl/sms/status`;

    const response = await axios.get(statusUrl, {
      params: {
        format: "json",
        access_token: SMSAPI_TOKEN,
        id: messageId,
      },
    });

    // Update the status in your database
    // if (response.data && response.data.status) {
    //   await updateSMSStatus(
    //     null,
    //     messageId,
    //     response.data.status,
    //     response.data.date_delivered
    //   );
    // }

    return {
      success: true,
      messageId: messageId,
      status: response.data.status,
      number: response.data.number,
      dateSent: response.data.date_sent
        ? new Date(response.data.date_sent * 1000)
        : null,
      dateDelivered: response.data.date_delivered
        ? new Date(response.data.date_delivered * 1000)
        : null,
      error: response.data.error,
    };
  } catch (error) {
    console.error(
      "Error checking SMS status:",
      error.response ? error.response.data : error.message
    );
    return {
      success: false,
      error: error.response ? error.response.data : error.message,
    };
  }
}
// Function to send SMS
async function sendSMS(phoneNumber, message, sender="CM7") {
  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    // Replace Polish special characters in the message
    const sanitizedMessage = replacePolishCharacters(message);
    
    // Log the character replacement for debugging
    if (message !== sanitizedMessage) {
      console.log("SMS message character replacement:");
      console.log("Original:", message);
      console.log("Sanitized:", sanitizedMessage);
    }

    const response = await axios.post(SMSAPI_BASE_URL, null, {
      params: {
        format: "json",
        access_token: SMSAPI_TOKEN,
        to: formattedPhone,
        message: sanitizedMessage,
        from: sender,
      },
    });

    console.log("SMS sent successfully:", response.data);
    return {
      success: true,
      messageId: response.data.list[0].id,
      data: response.data,
    };
  } catch (error) {
    console.error(
      "Error sending SMS:",
      error.response ? error.response.data : error.message
    );
    return {
      success: false,
      error: error.response ? error.response.data : error.message,
    };
  }
}

function formatPhoneNumber(phoneNumber) {
  let digits = phoneNumber.replace(/\D/g, "");

  if (digits.length === 9) {
    return "+48" + digits;
  }

  if (digits.startsWith("48") && digits.length === 11) {
    return "+" + digits;
  }

  if (phoneNumber.startsWith("+")) {
    return phoneNumber;
  }

  return "+" + digits;
}

module.exports = {
  sendSMS,
  checkSMSStatus,
};
