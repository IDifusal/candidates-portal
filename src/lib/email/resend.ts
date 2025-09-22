import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY environment variable is required')
}

const resend = new Resend(process.env.RESEND_API_KEY)

interface SendMagicLinkEmailParams {
  to: string
  candidateName: string
  companyName: string
  contactPersonName: string
  contactPersonTitle: string
  magicLink: string
  opportunityType: string
  urgency: string
  engagementType: string
}

interface SendNewMessageNotificationParams {
  to: string
  candidateName: string
  companyName: string
  contactPersonName: string
  messagePreview: string
  magicLink: string
}

export const sendMagicLinkEmail = async ({
  to,
  candidateName,
  companyName,
  contactPersonName,
  contactPersonTitle,
  magicLink,
  opportunityType,
  urgency,
  engagementType
}: SendMagicLinkEmailParams) => {
  // Development mode: Skip email sending and just log
  if (process.env.NODE_ENV === 'development' || !process.env.RESEND_API_KEY) {
    console.log('📧 [DEVELOPMENT] Magic Link Email (not sent):')
    console.log({
      to,
      from: `${companyName} <onboarding@resend.dev>`,
      subject: `${contactPersonName} from ${companyName} wants to connect with you`,
      magicLink,
      opportunityType,
      urgency,
      engagementType
    })
    return { success: true, data: { id: 'dev-mock-email-id' } }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `${companyName} <onboarding@resend.dev>`, // Use Resend's default domain for development
      to: [to],
      subject: `${contactPersonName} from ${companyName} wants to connect with you`,
      html: generateMagicLinkEmailHTML({
        candidateName,
        companyName,
        contactPersonName,
        contactPersonTitle,
        magicLink,
        opportunityType,
        urgency,
        engagementType
      })
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Email send error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

export const sendNewMessageNotification = async ({
  to,
  candidateName,
  companyName,
  contactPersonName,
  messagePreview,
  magicLink
}: SendNewMessageNotificationParams) => {
  // Development mode: Skip email sending and just log
  if (process.env.NODE_ENV === 'development' || !process.env.RESEND_API_KEY) {
    console.log('📧 [DEVELOPMENT] New Message Notification (not sent):')
    console.log({
      to,
      from: `${companyName} <onboarding@resend.dev>`,
      subject: `New message from ${contactPersonName} at ${companyName}`,
      messagePreview: messagePreview.substring(0, 50) + '...',
      magicLink
    })
    return { success: true, data: { id: 'dev-mock-notification-id' } }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `${companyName} <onboarding@resend.dev>`, // Use Resend's default domain for development
      to: [to],
      subject: `New message from ${contactPersonName} at ${companyName}`,
      html: generateNewMessageEmailHTML({
        candidateName,
        companyName,
        contactPersonName,
        messagePreview,
        magicLink
      })
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Email send error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

const generateMagicLinkEmailHTML = ({
  candidateName,
  companyName,
  contactPersonName,
  contactPersonTitle,
  magicLink,
  opportunityType,
  urgency,
  engagementType
}: Omit<SendMagicLinkEmailParams, 'to'>) => {
  const urgencyText = urgency === 'immediate' ? 'immediate' : 
                     urgency === 'flexible' ? 'flexible timeline' : 'future opportunity'
  
  const opportunityText = opportunityType.replace('_', ' ')
  const engagementText = engagementType.replace('_', ' ')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Opportunity from ${companyName}</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .company-name {
          font-size: 24px;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #6b7280;
          font-size: 16px;
        }
        .content {
          margin-bottom: 30px;
        }
        .greeting {
          font-size: 18px;
          margin-bottom: 20px;
        }
        .opportunity-details {
          background: #f1f5f9;
          border-left: 4px solid #3b82f6;
          padding: 20px;
          margin: 20px 0;
          border-radius: 0 8px 8px 0;
        }
        .detail-item {
          margin-bottom: 8px;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #6b7280;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          padding: 16px 32px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          text-align: center;
          margin: 20px 0;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .cta-button:hover {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
        }
        .footer {
          text-align: center;
          font-size: 14px;
          color: #6b7280;
          border-top: 1px solid #e5e7eb;
          padding-top: 20px;
          margin-top: 30px;
        }
        .contact-info {
          background: #fefefe;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .contact-person {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 4px;
        }
        .contact-title {
          color: #6b7280;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="company-name">${companyName}</div>
          <div class="subtitle">New Opportunity</div>
        </div>

        <div class="content">
          <div class="greeting">
            Hi ${candidateName},
          </div>

          <p>
            I hope this message finds you well. I came across your profile and I'm really impressed 
            with your background and experience. I believe you could be a great fit for an exciting 
            opportunity we have.
          </p>

          <div class="opportunity-details">
            <div class="detail-item">
              <span class="detail-label">Opportunity Type:</span>
              <span class="detail-value">${opportunityText}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Engagement:</span>
              <span class="detail-value">${engagementText}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Timeline:</span>
              <span class="detail-value">${urgencyText}</span>
            </div>
          </div>

          <p>
            I'd love to have a conversation with you to discuss this opportunity in more detail, 
            learn about your career goals, and see if there's a mutual fit.
          </p>

          <div style="text-align: center;">
            <a href="${magicLink}" class="cta-button">
              Start Conversation
            </a>
          </div>

          <p style="font-size: 14px; color: #6b7280;">
            This link will take you directly to our secure chat platform where we can discuss 
            the opportunity. No account creation required - just click and start chatting!
          </p>

          <div class="contact-info">
            <div class="contact-person">${contactPersonName}</div>
            <div class="contact-title">${contactPersonTitle}</div>
            <div class="contact-title">${companyName}</div>
          </div>
        </div>

        <div class="footer">
          <p>
            This link is valid for 7 days. If you have any questions or concerns, 
            please don't hesitate to reach out.
          </p>
          <p style="margin-top: 10px; font-size: 12px;">
            If you're not interested in opportunities at this time, you can safely ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

const generateNewMessageEmailHTML = ({
  candidateName,
  companyName,
  contactPersonName,
  messagePreview,
  magicLink
}: Omit<SendNewMessageNotificationParams, 'to'>) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New message from ${contactPersonName}</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 30px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .header {
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 20px;
          margin-bottom: 20px;
        }
        .company-name {
          font-size: 18px;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 4px;
        }
        .message-preview {
          background: #f8fafc;
          border-left: 4px solid #3b82f6;
          padding: 16px;
          margin: 20px 0;
          border-radius: 0 8px 8px 0;
          font-style: italic;
          color: #4b5563;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          font-size: 14px;
          text-align: center;
          margin: 15px 0;
        }
        .footer {
          text-align: center;
          font-size: 12px;
          color: #6b7280;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="company-name">${companyName}</div>
          <p style="margin: 0; color: #6b7280;">New message from ${contactPersonName}</p>
        </div>

        <p>Hi ${candidateName},</p>
        
        <p>You have a new message in your conversation:</p>

        <div class="message-preview">
          "${messagePreview.length > 150 ? messagePreview.substring(0, 150) + '...' : messagePreview}"
        </div>

        <div style="text-align: center;">
          <a href="${magicLink}" class="cta-button">
            View & Reply
          </a>
        </div>

        <div class="footer">
          <p>Click the link above to continue your conversation.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

export default resend
