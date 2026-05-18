import { ClientHomeContent } from "./client-home-content";

type ClientHomePageProps = {
  searchParams?: Promise<{ account?: string }>;
};

export default async function ClientHomePage({
  searchParams,
}: ClientHomePageProps) {
  return <ClientHomeContent searchParams={searchParams} />;
}
