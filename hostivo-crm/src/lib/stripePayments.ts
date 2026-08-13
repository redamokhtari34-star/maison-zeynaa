import { supabase } from './supabaseClient';
import type { StripePayment } from '../types';

export async function fetchFailedPayments(): Promise<StripePayment[]> {
  const { data, error } = await supabase
    .from('stripe_payments')
    .select('*')
    .in('status', ['failed', 'requires_payment_method', 'pending'])
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch payments: ${error.message}`);
  }

  return (data || []) as StripePayment[];
}

export async function fetchPaymentById(id: string): Promise<StripePayment | null> {
  const { data, error } = await supabase
    .from('stripe_payments')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 is "no rows returned"
    throw new Error(`Failed to fetch payment: ${error.message}`);
  }

  return (data || null) as StripePayment | null;
}

export async function sendPaymentReminder(paymentId: string): Promise<void> {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-payment-reminder`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentId }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send reminder');
  }
}

export async function deleteFailedPayment(id: string): Promise<void> {
  const { error } = await supabase
    .from('stripe_payments')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete payment: ${error.message}`);
  }
}
