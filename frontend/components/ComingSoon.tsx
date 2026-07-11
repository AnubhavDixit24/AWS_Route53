import Head from "next/head";
import AppShell from "./AppShell";

interface ComingSoonProps {
  title: string;
  description: string;
}

export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <>
      <Head>
        <title>{title} - Route 53</title>
      </Head>
      <AppShell>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{description}</p>
        <div className="panel coming-soon-panel">
          <div className="coming-soon-icon">🚧</div>
          <h2>Coming soon</h2>
          <p>This section is not yet implemented in this clone.</p>
        </div>
      </AppShell>
    </>
  );
}