import { useEffect, useState } from "react";

const STORAGE_KEY = "rtm_newsletter_email";

const Newsletter = () => {
  const [email, setEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSavedEmail(stored);
  }, []);

  const subscribe = () => {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setMessage("Please enter a valid email.");
      return;
    }
    localStorage.setItem(STORAGE_KEY, trimmed);
    setSavedEmail(trimmed);
    setEmail("");
    setMessage("Subscribed (saved locally).");
  };

  const unsubscribe = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedEmail(null);
    setMessage("Unsubscribed.");
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-8">
      <div className="bg-white rounded-lg p-5 shadow-sm">
        <div className="text-lg font-bold text-gray-800">Newsletter</div>
        <div className="text-sm text-gray-600">
          Get updates (local demo subscription).
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 shadow-sm flex flex-col gap-3">
        {savedEmail ? (
          <div className="text-sm text-gray-700">
            Subscribed as <span className="font-semibold">{savedEmail}</span>
          </div>
        ) : (
          <div className="text-sm text-gray-700">Not subscribed yet.</div>
        )}

        <div className="flex md:flex-row flex-col gap-2 md:items-center">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full md:w-[320px] h-11 px-3 outline-none rounded-md bg-slate-100 border border-slate-300 text-sm font-medium"
            onKeyDown={(e) => e.key === "Enter" && subscribe()}
          />
          <button
            onClick={subscribe}
            className="px-4 py-2 rounded-md bg-orange-400 text-white font-semibold hover:bg-orange-500"
          >
            Subscribe
          </button>
          {savedEmail ? (
            <button
              onClick={unsubscribe}
              className="px-4 py-2 rounded-md bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300"
            >
              Unsubscribe
            </button>
          ) : null}
        </div>

        {message ? <div className="text-sm text-gray-700">{message}</div> : null}
      </div>
    </div>
  );
};

export default Newsletter;

