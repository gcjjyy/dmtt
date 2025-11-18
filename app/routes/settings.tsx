import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useLanguage, type Language } from "~/contexts/LanguageContext";

export default function Settings() {
  const { language, setLanguage, t } = useLanguage();

  // Username state
  const [currentUsername, setCurrentUsername] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [usernameError, setUsernameError] = useState("");

  // Load username from localStorage
  useEffect(() => {
    const username = localStorage.getItem("typing-practice-username") || "";
    setCurrentUsername(username);
    setNewUsername(username);
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
  };

  const handleUsernameChange = () => {
    const trimmedName = newUsername.trim();

    // Validation
    if (trimmedName.length === 0) {
      setUsernameError(t("이름을 입력해주세요", "Please enter your name"));
      return;
    }

    if (trimmedName.length > 50) {
      setUsernameError(t("이름은 50자 이내로 입력해주세요", "Name must be 50 characters or less"));
      return;
    }

    const validNamePattern = /^[가-힣a-zA-Z0-9\s]+$/;
    if (!validNamePattern.test(trimmedName)) {
      setUsernameError(t("한글, 영문, 숫자만 사용 가능합니다", "Only Korean, English, and numbers allowed"));
      return;
    }

    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  const confirmUsernameChange = () => {
    const trimmedName = newUsername.trim();
    localStorage.setItem("typing-practice-username", trimmedName);
    setCurrentUsername(trimmedName);
    setShowConfirmDialog(false);
    setShowSuccess(true);
    setUsernameError("");

    // Hide success message after 3 seconds
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
              <h2 className="text-gray-900 dark:text-white mb-4">
                {t("사용자명 변경", "Change Username")}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t(
                  "사용자명을 변경하시겠습니까?",
                  "Are you sure you want to change your username?"
                )}
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-900 dark:text-white py-3 px-6 rounded-lg"
                >
                  {t("취소", "Cancel")}
                </button>
                <button
                  onClick={confirmUsernameChange}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg"
                >
                  {t("확인", "Confirm")}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-8">
          <Link
            to="/"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            ← {t("돌아가기", "Back")}
          </Link>
          <h1 className="text-gray-900 dark:text-white">
            {t("설정", "Settings")}
          </h1>
          <div className="w-20"></div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl">
          {/* Username Settings */}
          <div className="mb-8 pb-8 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-gray-900 dark:text-white mb-4">
              {t("사용자명 설정", "Username Settings")}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t(
                "점수 기록에 사용될 이름을 변경할 수 있습니다",
                "Change the name used for score tracking"
              )}
            </p>

            <div className="mb-4">
              <label
                htmlFor="username"
                className="block text-gray-700 dark:text-gray-300 mb-2"
              >
                {t("현재 사용자명", "Current Username")}
              </label>
              <input
                id="username"
                type="text"
                value={newUsername}
                onChange={(e) => {
                  setNewUsername(e.target.value);
                  setUsernameError("");
                }}
                className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder={t("이름 입력", "Enter name")}
              />
              {usernameError && (
                <p className="mt-2 text-red-600 dark:text-red-400">
                  {usernameError}
                </p>
              )}
              {showSuccess && (
                <p className="mt-2 text-green-600 dark:text-green-400">
                  {t("사용자명이 변경되었습니다", "Username has been changed")}
                </p>
              )}
            </div>

            <button
              onClick={handleUsernameChange}
              disabled={newUsername.trim() === currentUsername}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg"
            >
              {t("변경", "Change")}
            </button>
          </div>

          {/* Language Settings */}
          <div className="mb-8">
            <h2 className="text-gray-900 dark:text-white mb-4">
              {t("언어 설정", "Language Settings")}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t(
                "타자 연습에 사용할 언어를 선택하세요",
                "Choose the language for typing practice"
              )}
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleLanguageChange("ko")}
                className={`p-6 rounded-xl border-2 transition-all ${
                  language === "ko"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                    : "border-gray-300 dark:border-gray-600 hover:border-blue-300"
                }`}
              >
                <div className="mb-2">🇰🇷</div>
                <div className="text-gray-900 dark:text-white">한국어</div>
                <div className="text-gray-600 dark:text-gray-400">Korean</div>
                {language === "ko" && (
                  <div className="mt-2 text-blue-600 dark:text-blue-400">✓ 선택됨</div>
                )}
              </button>

              <button
                onClick={() => handleLanguageChange("en")}
                className={`p-6 rounded-xl border-2 transition-all ${
                  language === "en"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                    : "border-gray-300 dark:border-gray-600 hover:border-blue-300"
                }`}
              >
                <div className="mb-2">🇺🇸</div>
                <div className="text-gray-900 dark:text-white">English</div>
                <div className="text-gray-600 dark:text-gray-400">영어</div>
                {language === "en" && (
                  <div className="mt-2 text-blue-600 dark:text-blue-400">✓ Selected</div>
                )}
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h2 className="text-gray-900 dark:text-white mb-4">
              {t("정보", "Information")}
            </h2>
            <div className="space-y-2 text-gray-600 dark:text-gray-400">
              <p>
                {t(
                  "• 단문 연습: 짧은 속담으로 연습",
                  "• Short Practice: Practice with short proverbs"
                )}
              </p>
              <p>
                {t(
                  "• 장문 연습: 긴 글로 타자 실력 향상",
                  "• Long Practice: Improve typing with long texts"
                )}
              </p>
              <p>
                {t(
                  "• 베네치아 게임: 재미있는 타자 게임",
                  "• Venice Game: Fun typing game"
                )}
              </p>
              <p>
                {t(
                  "• 랭킹: 최고 기록 확인",
                  "• Rankings: Check top scores"
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
