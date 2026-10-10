import type { Metadata } from 'next';
import QRCode from 'qrcode';
import DonationView from './donation-view';

export const metadata: Metadata = {
  title: 'Support peakh',
  description: 'Support the continued development of peakh.',
};

export default async function DonatePage() {
  const configuredId = process.env.PEAKH_UPI_ID?.trim() || 'dharanishpk1939-1@okhdfcbank';
  const upiId = /^[^\s@]+@[^\s@]+$/.test(configuredId) ? configuredId : null;
  const payeeName = process.env.PEAKH_UPI_PAYEE_NAME?.trim() || 'Dharanish';
  const upiUrl = upiId ? `upi://pay?${new URLSearchParams({ pa: upiId, pn: payeeName, cu: 'INR' })}` : null;
  const qrCode = upiUrl ? await QRCode.toDataURL(upiUrl, { margin: 1, width: 240, color: { dark: '#171716', light: '#ffffff' } }) : null;
  return <DonationView upiId={upiId} upiUrl={upiUrl} qrCode={qrCode} />;
}
