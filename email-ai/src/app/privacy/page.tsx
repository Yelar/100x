import { Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-[family-name:var(--font-geist-sans)] relative">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-lg border-b">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-lg bg-gradient-to-r from-orange-500 to-orange-600 text-transparent bg-clip-text">100x Email</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl relative">
        <Link 
          href="/" 
          className="absolute top-8 left-4 flex items-center gap-3 text-base font-medium text-muted-foreground hover:text-orange-500 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
          Back to Home
        </Link>
        <div className="mt-20">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-orange-500 to-orange-600 text-transparent bg-clip-text">Privacy Policy</h1>
          <p className="text-muted-foreground mb-12">Effective Date: October 10, 2023</p>

          <div className="space-y-12">
            <section className="space-y-4">
              <p className="text-lg leading-relaxed">
                Welcome to ShipFast, an email assistant powered by AI. We are committed to protecting your privacy and ensuring that your personal information is handled in a safe and responsible manner. This Privacy Policy outlines how we collect, use, and protect your information.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-orange-500">1. Information We Collect</h2>
              <ul className="space-y-3 list-none">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2.5" />
                  <div>
                    <strong className="text-foreground">User Data</strong>: We collect emails and access tokens necessary for the operation of our email assistant services.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2.5" />
                  <div>
                    <strong className="text-foreground">Non-Personal Data</strong>: We use web cookies to enhance user experience and analyze website traffic.
                  </div>
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-orange-500">2. How We Use Your Information</h2>
              <ul className="space-y-3 list-none">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2.5" />
                  <div>To provide and improve our services.</div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2.5" />
                  <div>To communicate with you about updates or changes to our services.</div>
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-orange-500">3. Sharing Your Information</h2>
              <p className="text-lg leading-relaxed">
                We do not share your personal information with third parties, except as required by law or to protect our rights.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-orange-500">4. Security of Your Information</h2>
              <p className="text-lg leading-relaxed">
                We implement appropriate technical and organizational measures to protect your information from unauthorized access, use, or disclosure.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-orange-500">5. Governing Law</h2>
              <p className="text-lg leading-relaxed">
                This Privacy Policy is governed by the laws of Kazakhstan.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-orange-500">6. Changes to This Privacy Policy</h2>
              <p className="text-lg leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes via email.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-orange-500">7. Contact Us</h2>
              <p className="text-lg leading-relaxed">
                If you have any questions or concerns about this Privacy Policy, please contact us at{' '}
                <a href="mailto:elarysertaj@gmail.com" className="text-orange-500 hover:text-orange-600 font-medium">
                  elarysertaj@gmail.com
                </a>.
              </p>
              <p className="text-lg leading-relaxed">
                For more information, please visit our full privacy policy at{' '}
                <a href="https://100x.email/privacy" className="text-orange-500 hover:text-orange-600 font-medium">
                  https://100x.email/privacy
                </a>.
              </p>
            </section>

            <p className="text-lg font-medium mt-12">Thank you for choosing ShipFast.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 bg-background/80 backdrop-blur-lg text-center text-muted-foreground border-t">
        <div className="flex items-center justify-center gap-4">
          <Mail className="w-4 h-4 text-orange-500" />
          <span className="font-medium">100x Email &copy; 2024</span>
          <Link href="/privacy" className="text-sm hover:text-orange-500 transition-colors">
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  );
} 