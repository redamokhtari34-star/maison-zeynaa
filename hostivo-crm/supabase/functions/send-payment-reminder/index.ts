import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'notifications@hostivo.fr';
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'contact@hostivo.fr';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { paymentId } = await req.json();

  if (!paymentId) {
    return new Response(
      JSON.stringify({ error: 'paymentId is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Fetch payment details
    const { data: payment, error: fetchError } = await supabase
      .from('stripe_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) {
      return new Response(
        JSON.stringify({ error: 'Payment not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Skip if payment has already succeeded
    if (payment.status === 'succeeded') {
      return new Response(
        JSON.stringify({ error: 'Cannot send reminder for successful payment' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Send email via Resend
    const emailSubject = `Rappel: Paiement non effectué - ${payment.customer_name}`;
    const emailHtml = `
      <h2>Rappel de paiement</h2>
      <p>Le client <strong>${payment.customer_name}</strong> (${payment.customer_email}) n'a pas effectué son paiement.</p>
      <p><strong>Montant:</strong> ${(payment.amount / 100).toFixed(2)} ${payment.currency.toUpperCase()}</p>
      <p><strong>Raison:</strong> ${payment.failure_reason || 'Paiement échoué'}</p>
      <p><strong>Date:</strong> ${new Date(payment.created_at).toLocaleString('fr-FR')}</p>
      <p><a href="https://dashboard.stripe.com/payments/${payment.stripe_payment_intent_id}" target="_blank">Voir dans Stripe</a></p>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      console.error('Resend API error:', error);
      throw new Error(`Failed to send email: ${error}`);
    }

    // Update last_reminder_sent_at
    const { error: updateError } = await supabase
      .from('stripe_payments')
      .update({ last_reminder_sent_at: new Date().toISOString() })
      .eq('id', paymentId);

    if (updateError) {
      console.error('Error updating reminder timestamp:', updateError);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Reminder email sent' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error sending reminder:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
