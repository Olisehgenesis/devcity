import Link from "next/link";

export default function NotFound() {
  return (
    <main className="missing-page">
      <img src="/devcity-mark.svg" alt="" width={56} height={56} />
      <h1>That page is not on the map</h1>
      <p>The link may be old, or nothing was published at this address.</p>
      <Link href="/">Back to the city</Link>
    </main>
  );
}
