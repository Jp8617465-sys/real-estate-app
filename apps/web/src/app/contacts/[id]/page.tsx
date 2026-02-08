import { ContactDetail } from '@/components/contacts/contact-detail';

interface ContactPageProps {
  params: { id: string };
}

export default function ContactPage({ params }: ContactPageProps) {
  return <ContactDetail contactId={params.id} />;
}
