import Header from "components/Header";
import Footer from "components/Footer";
import VatCheckerClient from "components/VatCheckerClient";

export default function VatCheckerPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-black">
      <Header />
      <main className="flex-1">
        <VatCheckerClient />
      </main>
      <Footer />
    </div>
  );
}
