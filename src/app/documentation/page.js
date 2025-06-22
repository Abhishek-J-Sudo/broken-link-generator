'use client';

import Documentation from '../components/Documentation';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function DocumentationPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Documentation />
      <Footer />
    </div>
  );
}
