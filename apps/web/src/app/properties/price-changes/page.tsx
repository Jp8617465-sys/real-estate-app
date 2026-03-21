import PriceChangesClient from './price-changes-client';

export const metadata = {
  title: 'Price Changes — RealFlow Properties',
  description:
    'Live feed of Domain.com.au price reductions and adjustments across your watched suburbs.',
};

export default function PriceChangesPage() {
  return <PriceChangesClient />;
}
