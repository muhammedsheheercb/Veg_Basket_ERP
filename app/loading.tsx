export default function Loading() {
  return <main className="management loading-page" aria-busy="true" aria-label="Loading page">
    <section className="loading-heading"><i/><i/><i/></section>
    <section className="card data-panel loading-table">
      <div className="loading-toolbar"><i/><i/></div>
      {Array.from({ length: 8 }, (_, index) => <div className="loading-row" key={index}><i/><i/><i/><i/><i/></div>)}
    </section>
  </main>;
}
