import VoltsNavbar from '@/components/VoltsNavbar';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <VoltsNavbar />
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 text-foreground/80 space-y-6">
        <h1 className="text-4xl font-bold text-foreground mb-8">Terms of Service</h1>
        
        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing and using SWIFT Connect, you accept and agree to be bound by the terms and provision of this agreement.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-3">2. Description of Service</h2>
          <p>
            SWIFT Connect provides a web-based, peer-to-peer file transfer service using WebRTC. For files exceeding a certain size limit, the service may utilize the sender's Google Drive storage to facilitate the transfer by generating and transmitting a secure, restricted-access share link.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-3">3. User Responsibilities</h2>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>You are solely responsible for the content of the files you transfer.</li>
            <li>You must not use SWIFT Connect to transfer illegal, copyrighted (without authorization), or malicious files.</li>
            <li>You acknowledge that while we use encryption protocols, you use the service at your own risk.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-3">4. Google Drive Integration</h2>
          <p>
            If you utilize our large-file transfer feature, you authorize SWIFT Connect to upload files to your Google Drive and modify their permissions for the sole purpose of sharing them with your chosen recipient. SWIFT Connect is not responsible for any data loss, breaches, or quota limits reached on your personal Google account.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-3">5. Disclaimer of Warranties</h2>
          <p>
            The service is provided "as is". SWIFT Connect makes no warranties, expressed or implied, and hereby disclaims all other warranties, including without limitation, implied warranties or conditions of merchantability or fitness for a particular purpose.
          </p>
        </section>

        <p className="pt-8 text-sm text-muted-foreground border-t mt-12">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </main>
    </div>
  );
}
