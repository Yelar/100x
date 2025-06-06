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
          <p className="text-muted-foreground mb-12">Last Updated: June 6, 2025</p>

          <div className="space-y-12">
            <section className="space-y-4">
              <p className="text-lg leading-relaxed">
                At 100x Email, accessible from https://100x.email, your privacy is important to us. This Privacy Policy outlines how we handle your data when you use our email assistance service. By using 100x Email, you agree to the terms of this Privacy Policy. If you do not agree with these practices, please refrain from using our service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-orange-500">1. Information We Process</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-medium mb-2">1.1 Email Data</h3>
                  <ul className="space-y-3 list-none">
                    <li className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2.5" />
                      <div>Your email content is processed only by our trusted Language Learning Model (LLM) providers to generate responses and suggestions.</div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2.5" />
                      <div><strong>Important</strong>: We do not store any of your email data. All processing is done in real-time.</div>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-medium mb-2">1.2 Email Permissions</h3>
                  <ul className="space-y-3 list-none">
                    <li className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2.5" />
                      <div>We request email sending permissions solely for the purpose of sending emails through our application.</div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2.5" />
                      <div>These permissions are never used for any other purpose.</div>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-orange-500">2. Data Security</h2>
              <ul className="space-y-3 list-none">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2.5" />
                  <div>All data processing is done through secure, encrypted connections.</div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2.5" />
                  <div>We implement industry-standard security measures to protect your data during transmission.</div>
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-orange-500">3. Third-Party Services</h2>
              <p className="text-lg leading-relaxed">
                We only share your email data with our LLM providers for the sole purpose of processing and generating email responses. No other third parties have access to your data.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-orange-500">4. Data Retention</h2>
              <p className="text-lg leading-relaxed">
                We maintain a strict no-storage policy. Your email data is processed in real-time and is not retained on our servers or by our service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-orange-500">5. Changes to This Privacy Policy</h2>
              <p className="text-lg leading-relaxed">
                We may update this Privacy Policy to reflect changes in our practices or for operational, legal, or regulatory reasons. We will notify you of any material changes via email.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-orange-500">6. Contact Us</h2>
              <p className="text-lg leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us at{' '}
                <a href="mailto:elarysertaj@gmail.com" className="text-orange-500 hover:text-orange-600 font-medium">
                  elarysertaj@gmail.com
                </a>
              </p>
            </section>
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