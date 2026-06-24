"use client";

const cream = "#f4ead7";
const dim = "#cdbfa6";
const blue = "#3b82f6";

export default function PrivacyPolicy() {
  return (
    <div style={{
      maxWidth: 680,
      margin: "0 auto",
      padding: "48px 24px 80px",
      fontFamily: "Georgia, serif",
      color: cream,
      lineHeight: 1.8,
      fontSize: 16,
    }}>
      <a href="/" style={{ fontFamily: "monospace", fontSize: 13, color: dim, textDecoration: "none", letterSpacing: "1px" }}>
        ← PICXLE
      </a>

      <h1 style={{ fontFamily: "sans-serif", fontWeight: 800, fontSize: 32, margin: "32px 0 4px", letterSpacing: "-1px", color: cream }}>
        Privacy Policy
      </h1>
      <p style={{ color: dim, fontSize: 14, margin: "0 0 40px" }}>Last updated: June 2026</p>

      <p>
        Picxle is a free daily image-guessing game. This policy explains what
        information the app collects and how it is used.
      </p>

      <h2 style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 20, margin: "40px 0 8px", color: cream }}>
        What we collect
      </h2>
      <p>
        Picxle does not collect your name, email address, location, or any
        other personally identifying information.
      </p>
      <p>
        When you first open the app, a random anonymous ID (a UUID) is generated
        and stored on your device. This ID is not linked to you as a person in
        any way. It is used only to track your personal game streak and
        statistics within the app.
      </p>
      <p>When you complete a puzzle, the following is recorded:</p>
      <ul style={{ paddingLeft: 24, color: cream }}>
        <li>Your anonymous ID</li>
        <li>The puzzle identifier for that day</li>
        <li>How many guesses you took</li>
      </ul>
      <p style={{ marginTop: 16 }}>
        Your in-progress guesses and theme preference are stored locally on your
        device only and are never sent anywhere.
      </p>

      <h2 style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 20, margin: "40px 0 8px", color: cream }}>
        How we use it
      </h2>
      <p>
        The anonymous completion data is used solely to show you your personal
        streak, win percentage, and guess distribution — and to show all players
        a difficulty rating for each puzzle. It is never used for advertising,
        profiling, or sold to any third party.
      </p>

      <h2 style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 20, margin: "40px 0 8px", color: cream }}>
        Third-party services
      </h2>
      <p>Picxle uses the following third-party services to operate:</p>
      <ul style={{ paddingLeft: 24, color: cream }}>
        <li style={{ marginBottom: 8 }}>
          <strong>Supabase</strong> — stores puzzle data and anonymous completion
          records. Data may be stored in the EU or US.{" "}
          <a href="https://supabase.com/privacy" style={{ color: blue }}>Supabase Privacy Policy</a>
        </li>
        <li>
          <strong>Vercel</strong> — hosts the app and handles web requests.
          Standard server access logs may be retained briefly by Vercel.{" "}
          <a href="https://vercel.com/legal/privacy-policy" style={{ color: blue }}>Vercel Privacy Policy</a>
        </li>
      </ul>

      <h2 style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 20, margin: "40px 0 8px", color: cream }}>
        Children
      </h2>
      <p>
        Picxle does not knowingly collect any information from children under
        the age of 13.
      </p>

      <h2 style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 20, margin: "40px 0 8px", color: cream }}>
        Changes
      </h2>
      <p>
        If this policy changes, the updated version will be posted at this URL
        with a revised date.
      </p>

      <h2 style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 20, margin: "40px 0 8px", color: cream }}>
        Contact
      </h2>
      <p>
        Questions about this policy can be sent to{" "}
        <a href="mailto:picxlebypenrose@gmail.com" style={{ color: blue }}>
          picxlebypenrose@gmail.com
        </a>
      </p>
    </div>
  );
}
