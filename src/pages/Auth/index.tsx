import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";

const Auth = () => {
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate("/home", { replace: true });
  }, [navigate, user]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
      } else {
        await signUp(name.trim(), email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[460px] bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="text-2xl font-bold text-gray-800">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </div>
        <div className="text-sm text-gray-600 mt-1">
          {mode === "signin"
            ? "Sign in to collaborate with your team."
            : "Start collaborating on tasks and projects."}
        </div>

        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          {mode === "signup" ? (
            <div>
              <label className="text-sm font-semibold text-gray-700">
                Full name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full h-11 px-3 rounded-md bg-slate-100 border border-slate-300 outline-none text-sm"
                placeholder="Your name"
              />
            </div>
          ) : null}

          <div>
            <label className="text-sm font-semibold text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full h-11 px-3 rounded-md bg-slate-100 border border-slate-300 outline-none text-sm"
              placeholder="you@email.com"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full h-11 px-3 rounded-md bg-slate-100 border border-slate-300 outline-none text-sm"
              placeholder="Password"
            />
          </div>

          {error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-md bg-orange-400 text-white font-semibold hover:bg-orange-500 disabled:opacity-60"
          >
            {loading
              ? "Please wait..."
              : mode === "signin"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        <div className="mt-4 text-sm text-gray-600">
          {mode === "signin"
            ? "Don't have an account?"
            : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-orange-500 font-semibold hover:text-orange-600"
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
