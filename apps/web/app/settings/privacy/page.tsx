export default function PrivacyPage() {
  return (
    <section className="page-band">
      <div className="container">
        <p className="eyebrow">Privacy</p>
        <h1 className="hero-title">Plans stay private by default.</h1>
        <div className="card-grid">
          <article className="card">
            <h2>Uploads</h2>
            <p>Do not upload documents containing sensitive personal information.</p>
          </article>
          <article className="card">
            <h2>AI</h2>
            <p>Fireworks should receive structured plan JSON, not raw addresses or uploaded plan files.</p>
          </article>
          <article className="card">
            <h2>Analytics</h2>
            <p>Track state transitions and counts, not raw floor plans, PDFs, or addresses.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
