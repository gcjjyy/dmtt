import { useState } from "react";
import { useNavigate } from "react-router";
import { useLanguage } from "~/contexts/LanguageContext";

export default function Welcome() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = username.trim();

    // Validation
    if (trimmedName.length === 0) {
      setError(t("이름을 입력해주세요", "Please enter your name"));
      return;
    }

    if (trimmedName.length > 50) {
      setError(t("이름은 50자 이내로 입력해주세요", "Name must be 50 characters or less"));
      return;
    }

    // Check for valid characters (Korean, English, numbers, spaces)
    const validNamePattern = /^[가-힣a-zA-Z0-9\s]+$/;
    if (!validNamePattern.test(trimmedName)) {
      setError(t("한글, 영문, 숫자만 사용 가능합니다", "Only Korean, English, and numbers allowed"));
      return;
    }

    // Save to localStorage
    localStorage.setItem("typing-practice-username", trimmedName);

    // Navigate to home
    navigate("/");
  };

  return (
    <div className="w-full h-full bg-[#008080] p-4">
      <div className="flex justify-center pt-20">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl w-[28rem]">
          <div className="text-center mb-8">
            <div className="mb-4">👋</div>
            <h1 className="text-gray-900 dark:text-white mb-2">
              {t("환영합니다!", "Welcome!")}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {t(
                "타자 연습을 시작하기 전에 이름을 입력해주세요",
                "Please enter your name before starting"
              )}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label
                htmlFor="username"
                className="block text-gray-700 dark:text-gray-300 mb-2"
              >
                {t("이름", "Name")}
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                className="w-full p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder={t("홍길동", "Your Name")}
                autoFocus
              />
              {error && (
                <p className="mt-2 text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-lg transition-colors"
            >
              {t("시작하기", "Start")}
            </button>
          </form>

          <div className="mt-6 text-center text-gray-500 dark:text-gray-400">
            {t(
              "입력한 이름은 점수 기록에 사용됩니다",
              "Your name will be used for score tracking"
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
