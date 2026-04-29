export default function EmailPage({ params }: { params: { id: string } }) {
  return (
    <div style={{ padding: 40 }}>
      <h1>Email detail page</h1>
      <p>Selected email ID: {params.id}</p>
    </div>
  );
}

