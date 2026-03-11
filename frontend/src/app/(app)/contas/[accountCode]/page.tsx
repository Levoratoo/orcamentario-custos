import AccountDetailPageClient from './page-client';
import { portfolioDemoStaticParams } from '@/lib/portfolio-demo';

export const dynamicParams = false;

export function generateStaticParams() {
  return portfolioDemoStaticParams.accountCodes().map((accountCode) => ({ accountCode }));
}

export default function AccountDetailPage() {
  return <AccountDetailPageClient />;
}
