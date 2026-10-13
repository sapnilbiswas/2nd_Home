import { Linking, Alert } from 'react-native';

export interface UpiPaymentParams {
  upiId: string;
  payeeName?: string;
  amount: number;
  note: string;
}

/**
 * Builds the canonical UPI standard payment string
 */
export const buildUpiUri = (params: UpiPaymentParams, scheme: string = 'upi'): string => {
  const pn = encodeURIComponent(params.payeeName || '2nd_Home');
  const pa = params.upiId.trim();
  const am = params.amount.toFixed(2);
  const tn = encodeURIComponent(params.note.trim());

  return `${scheme}://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
};

/**
 * Attempts to launch generic UPI application chooser or specific app
 */
export const openUpiApp = async (
  params: UpiPaymentParams,
  appType: 'generic' | 'phonepe' | 'gpay' = 'generic'
): Promise<boolean> => {
  let scheme = 'upi';
  if (appType === 'phonepe') scheme = 'phonepe';
  if (appType === 'gpay') scheme = 'tez'; // Android Google Pay standard scheme

  const uri = buildUpiUri(params, scheme);

  try {
    const supported = await Linking.canOpenURL(uri);
    if (supported) {
      await Linking.openURL(uri);
      return true;
    } else {
      // If specific app fails, fallback to generic upi://
      if (appType !== 'generic') {
        const genericUri = buildUpiUri(params, 'upi');
        const genericSupported = await Linking.canOpenURL(genericUri);
        if (genericSupported) {
          await Linking.openURL(genericUri);
          return true;
        }
      }
      return false;
    }
  } catch (err) {
    console.warn(`Failed to open UPI app (${appType}):`, err);
    // Direct attempt without canOpenURL check (Android intent fallback)
    try {
      await Linking.openURL(uri);
      return true;
    } catch {
      return false;
    }
  }
};
