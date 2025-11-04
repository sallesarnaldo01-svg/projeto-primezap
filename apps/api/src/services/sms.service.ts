import twilio from 'twilio';

// Credenciais do Twilio (devem ser configuradas no .env)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !twilioNumber) {
  console.warn('Twilio credentials not fully configured in environment variables. SMS service will not be initialized.');
}

// Cria uma instância do cliente Twilio
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * Envia uma mensagem SMS usando o Twilio.
 * @param to Número de telefone do destinatário (ex: +5511999999999)
 * @param body Conteúdo da mensagem SMS
 * @returns O status da mensagem enviada
 */
export async function sendSms(to: string, body: string) {
  if (!client || !twilioNumber) {
    throw new Error('Twilio client not initialized. Check environment variables.');
  }

  try {
    const message = await client.messages.create({
      body: body,
      from: twilioNumber,
      to: to,
    });
    console.log('SMS sent, SID:', message.sid);
    return message;
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw new Error('Failed to send SMS');
  }
}
