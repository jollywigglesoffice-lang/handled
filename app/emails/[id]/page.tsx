export default function EmailPage({ params }: { params: { id: string } }) {
  return (
    <div style={{ padding: 40 }}>
      <h1>IT WORKS 🎉</h1>
      <p>Email ID: {params.id}</p>
    </div>
  );
}
