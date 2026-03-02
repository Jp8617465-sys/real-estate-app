import AuctionResultsClient from './auction-results-client';

export const metadata = {
  title: 'Auction Results — RealFlow Market',
  description: 'Browse recent Domain.com.au auction clearance data by suburb.',
};

export default function AuctionResultsPage() {
  return <AuctionResultsClient />;
}
