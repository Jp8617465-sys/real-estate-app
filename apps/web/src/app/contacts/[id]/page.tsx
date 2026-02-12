import { ContactDetail } from '@/components/contacts/contact-detail';

interface ContactPageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { id } = await params;
  return <ContactDetail contactId={id} />;
}
