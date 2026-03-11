import BscIndicatorPageClient from './page-client';
import { portfolioDemoStaticParams } from '@/lib/portfolio-demo';

export const dynamicParams = false;

export function generateStaticParams() {
  return portfolioDemoStaticParams.bscIndicatorCodes().map((code) => ({ code }));
}

export default function BscIndicatorPage() {
  return <BscIndicatorPageClient />;
}
